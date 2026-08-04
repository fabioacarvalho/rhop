import { prisma } from "@/lib/prisma";
import {
  CategoriaTipoFluxo,
  StatusSolicitacao,
  type Solicitacao,
} from "@/lib/generated/prisma/client";
import { registrar } from "@/lib/services/logService";
import { gerarResumoSolicitante } from "@/lib/services/iaService";

type SolicitacaoParaConflito = Solicitacao & {
  tipoFluxo: { nome: string; categoria: CategoriaTipoFluxo };
  solicitante: { id: string; equipe_id: string | null };
};

/** Intervalo de datas de uma `Solicitacao` (FERIAS/DAYOFF). */
interface Periodo {
  inicio: Date;
  fim: Date;
}

/**
 * Extrai o periodo de uma `Solicitacao` a partir de `dados`, conforme a
 * convencao por categoria (RIA-12, RIA-13): FERIAS le `data_inicio`/
 * `data_fim`; DAYOFF le `data` (vira `inicio === fim`). Retorna `null` se o(s)
 * campo(s) esperado(s) estiverem ausentes ou malformados (RIA-19) — nunca
 * lanca.
 */
export function extrairPeriodo(
  categoria: CategoriaTipoFluxo,
  dados: Record<string, unknown>,
): Periodo | null {
  if (categoria === CategoriaTipoFluxo.FERIAS) {
    const inicio = parseData(dados.data_inicio);
    const fim = parseData(dados.data_fim);
    if (!inicio || !fim) {
      return null;
    }
    return { inicio, fim };
  }

  if (categoria === CategoriaTipoFluxo.DAYOFF) {
    const data = parseData(dados.data);
    if (!data) {
      return null;
    }
    return { inicio: data, fim: data };
  }

  return null;
}

function parseData(valor: unknown): Date | null {
  if (typeof valor !== "string") {
    return null;
  }
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

/**
 * Verifica se dois periodos se sobrepoem (RIA-16) — cobre igualdade exata e
 * intersecao parcial.
 */
export function haSobreposicao(a: Periodo, b: Periodo): boolean {
  return a.inicio <= b.fim && b.inicio <= a.fim;
}

function formatarPeriodo(periodo: Periodo): string {
  const formatar = (data: Date) => data.toLocaleDateString("pt-BR");
  return `${formatar(periodo.inicio)} a ${formatar(periodo.fim)}`;
}

function comoRegistroDados(dados: unknown): Record<string, unknown> {
  return dados && typeof dados === "object" && !Array.isArray(dados)
    ? (dados as Record<string, unknown>)
    : {};
}

/**
 * Busca conflito de agenda com outro membro da mesma equipe (RIA-06 a
 * RIA-10, RIA-16 a RIA-19).
 *
 * Retorna `null` cedo quando `categoria === PADRAO` (RIA-10), quando o
 * solicitante nao pertence a uma equipe (RIA-09), ou quando o proprio
 * periodo nao pode ser extraido (RIA-19). Compara apenas com `Solicitacao`
 * de colegas (exclui a propria e o proprio solicitante) da mesma categoria e
 * equipe, com status `APROVADA`/`PENDENTE` (RIA-17). Erro de banco e
 * capturado, grava `Log ERRO` e retorna `null` (RIA-18) — nunca lanca.
 */
async function buscarConflito(
  solicitacao: SolicitacaoParaConflito,
): Promise<{ periodoDescricao: string } | null> {
  if (solicitacao.tipoFluxo.categoria === CategoriaTipoFluxo.PADRAO) {
    return null;
  }
  if (solicitacao.solicitante.equipe_id === null) {
    return null;
  }

  const periodo = extrairPeriodo(
    solicitacao.tipoFluxo.categoria,
    comoRegistroDados(solicitacao.dados),
  );
  if (!periodo) {
    return null;
  }

  try {
    const concorrentes = await prisma.solicitacao.findMany({
      where: {
        id: { not: solicitacao.id },
        solicitante_id: { not: solicitacao.solicitante.id },
        status: { in: [StatusSolicitacao.APROVADA, StatusSolicitacao.PENDENTE] },
        tipoFluxo: { categoria: solicitacao.tipoFluxo.categoria },
        solicitante: { equipe_id: solicitacao.solicitante.equipe_id },
      },
      select: { dados: true },
    });

    for (const concorrente of concorrentes) {
      const periodoConcorrente = extrairPeriodo(
        solicitacao.tipoFluxo.categoria,
        comoRegistroDados(concorrente.dados),
      );
      if (periodoConcorrente && haSobreposicao(periodo, periodoConcorrente)) {
        return { periodoDescricao: formatarPeriodo(periodo) };
      }
    }

    return null;
  } catch (error) {
    await registrar({
      tipo: "ERRO",
      entidade: "Solicitacao",
      entidade_id: solicitacao.id,
      acao: "FALHA_CONFLITO",
      detalhes: { motivo: error instanceof Error ? error.message : String(error) },
    });
    return null;
  }
}

/**
 * Gera e persiste `resumo_ia_solicitante` (RIA-01) — ponto de entrada
 * fire-and-forget chamado por `solicitacaoService.criar`. Nunca lanca (mesmo
 * contrato de `iaService`): qualquer falha inesperada (ex.: erro ao buscar a
 * propria `Solicitacao`) e capturada e vira `Log ERRO`, sem propagar.
 */
export async function gerarEPersistir(solicitacaoId: string): Promise<void> {
  try {
    const solicitacao = await prisma.solicitacao.findUnique({
      where: { id: solicitacaoId },
      include: {
        tipoFluxo: { select: { nome: true, categoria: true } },
        solicitante: { select: { id: true, equipe_id: true } },
      },
    });

    if (!solicitacao) {
      return;
    }

    const sol = solicitacao as SolicitacaoParaConflito;
    const conflito = await buscarConflito(sol);

    const resumo = await gerarResumoSolicitante({
      solicitacaoId: sol.id,
      tipoFluxoNome: sol.tipoFluxo.nome,
      dados: comoRegistroDados(sol.dados),
      conflito,
    });

    if (resumo) {
      await prisma.solicitacao.update({
        where: { id: sol.id },
        data: { resumo_ia_solicitante: resumo },
      });
    }
  } catch (error) {
    await registrar({
      tipo: "ERRO",
      entidade: "Solicitacao",
      entidade_id: solicitacaoId,
      acao: "FALHA_IA",
      detalhes: { motivo: error instanceof Error ? error.message : String(error) },
    });
  }
}
