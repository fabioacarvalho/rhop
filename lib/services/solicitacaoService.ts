import { prisma } from "@/lib/prisma";
import { Prisma, Role, type Solicitacao } from "@/lib/generated/prisma/client";
import { registrar } from "@/lib/services/logService";
import * as tipoFluxoService from "@/lib/services/tipoFluxoService";
import { gerarEPersistir } from "@/lib/services/resumoSolicitanteService";
import {
  validarDados,
  type ErroValidacaoCampo,
} from "@/lib/validations/solicitacaoDados";
import type { CampoFormularioDefinicao } from "@/lib/validations/tipoFluxo";
import type { SolicitacaoInput } from "@/lib/validations/solicitacao";

/** Prazo de SLA fixo (48h), aplicado a toda `Solicitacao` (ver `design.md`, seção 0). */
export const SLA_HORAS = 48;

/** `tipo_fluxo_id` sem `TipoFluxo` correspondente — rota converte em 404. */
export class ErroTipoFluxoNaoEncontrado extends Error {
  constructor(message = "Tipo de fluxo nao encontrado.") {
    super(message);
    this.name = "ErroTipoFluxoNaoEncontrado";
  }
}

/** `id` de `Solicitacao` sem registro correspondente — rota converte em 404. */
export class ErroNaoEncontrado extends Error {
  constructor(message = "Solicitacao nao encontrada.") {
    super(message);
    this.name = "ErroNaoEncontrado";
  }
}

/** Usuario autenticado nao e o solicitante dono do registro — rota converte em 403. */
export class ErroAcessoNegado extends Error {
  constructor(message = "Voce nao tem acesso a esta solicitacao.") {
    super(message);
    this.name = "ErroAcessoNegado";
  }
}

/** `dados` invalido contra `campos_formulario` — rota converte em 400 com `erros`. */
export class ErroDadosInvalidos extends Error {
  erros: ErroValidacaoCampo[];

  constructor(erros: ErroValidacaoCampo[]) {
    super("Dados invalidos para o tipo de fluxo selecionado.");
    this.name = "ErroDadosInvalidos";
    this.erros = erros;
  }
}

/** Item de `listarMinhas` (SOL-01, SOL-02) — inclui o suficiente para a tabela da Screen 1. */
export type SolicitacaoResumo = Solicitacao & {
  tipoFluxo: { nome: string };
};

/** Registro completo, retornado por `buscarDetalhePorId`. */
export type SolicitacaoDetalhe = Solicitacao & {
  tipoFluxo: { id: string; nome: string; campos_formulario: unknown; etapas: unknown };
};

function lerEtapas(etapasJson: unknown): Role[] {
  if (!Array.isArray(etapasJson)) {
    return [];
  }
  return etapasJson.filter(
    (e): e is Role => e === Role.GESTOR || e === Role.RH_ADMIN,
  );
}

/**
 * Cria uma `Solicitacao` (SOL-01, SOL-06 a SOL-13).
 *
 * - `tipo_fluxo_id` inexistente -> `ErroTipoFluxoNaoEncontrado` (mapeia o
 *   `ErroNaoEncontrado` de `tipoFluxoService`, reusado sem acessar Prisma
 *   direto).
 * - `dados` invalido contra `campos_formulario` (`validarDados`) ->
 *   `ErroDadosInvalidos`, nada e persistido.
 * - Sucesso: `status=PENDENTE` (default do schema), `etapa_atual=etapas[0]`,
 *   `prazo_sla=now+SLA_HORAS`, grava `Log AUDITORIA`.
 * - Falha de `logService.registrar` nunca impede o retorno de sucesso — em
 *   producao `registrar` ja contem falhas internamente; o `try/catch` aqui e
 *   defesa extra (CLAUDE.md: "IA/log nunca pode travar o fluxo").
 */
export async function criar(
  input: SolicitacaoInput,
  solicitanteId: string,
): Promise<Solicitacao> {
  let tipoFluxo;
  try {
    tipoFluxo = await tipoFluxoService.buscarPorId(input.tipo_fluxo_id);
  } catch (error) {
    if (error instanceof tipoFluxoService.ErroNaoEncontrado) {
      throw new ErroTipoFluxoNaoEncontrado();
    }
    throw error;
  }

  const campos =
    tipoFluxo.campos_formulario as unknown as CampoFormularioDefinicao[];
  const resultado = validarDados(input.dados, campos);

  if (!resultado.valido) {
    throw new ErroDadosInvalidos(resultado.erros);
  }

  const etapas = lerEtapas(tipoFluxo.etapas);
  const etapaInicial = etapas[0];

  if (!etapaInicial) {
    // SOL-12: TipoFluxo sem etapas — garantido nao acontecer por CONF-04
    // (configuracao-fluxos exige >=1 etapa na criacao/edicao).
    throw new Error("Tipo de fluxo sem etapas de aprovacao configuradas.");
  }

  const agora = new Date();
  const prazoSla = new Date(agora.getTime() + SLA_HORAS * 60 * 60 * 1000);

  const solicitacao = await prisma.solicitacao.create({
    data: {
      tipo_fluxo_id: tipoFluxo.id,
      solicitante_id: solicitanteId,
      dados: input.dados as Prisma.InputJsonValue,
      etapa_atual: etapaInicial,
      prazo_sla: prazoSla,
    },
  });

  try {
    await registrar({
      tipo: "AUDITORIA",
      entidade: "Solicitacao",
      entidade_id: solicitacao.id,
      acao: "CRIACAO",
      usuario_id: solicitanteId,
    });
  } catch {
    // ver docstring: nunca deixa a criacao ser reportada como falha por causa do log.
  }

  // Fire-and-forget: gerarEPersistir nunca lanca (mesmo contrato de iaService),
  // mas nao bloqueia o retorno de criar (RIA-01).
  void gerarEPersistir(solicitacao.id);

  return solicitacao;
}

/**
 * Lista as `Solicitacao` do proprio solicitante (SOL-01), mais recentes primeiro.
 */
export async function listarMinhas(
  solicitanteId: string,
): Promise<SolicitacaoResumo[]> {
  return prisma.solicitacao.findMany({
    where: { solicitante_id: solicitanteId },
    include: { tipoFluxo: { select: { nome: true } } },
    orderBy: { criado_em: "desc" },
  });
}

/**
 * Busca o detalhe de uma `Solicitacao` (SOL-10 a SOL-12).
 *
 * - `id` inexistente -> `ErroNaoEncontrado`.
 * - `solicitante_id !== solicitanteId` -> `ErroAcessoNegado` (403, nao 404 —
 *   ver `design.md`, "Tech Decisions").
 */
export async function buscarDetalhePorId(
  id: string,
  solicitanteId: string,
): Promise<SolicitacaoDetalhe> {
  const solicitacao = await prisma.solicitacao.findUnique({
    where: { id },
    include: {
      tipoFluxo: {
        select: { id: true, nome: true, campos_formulario: true, etapas: true },
      },
    },
  });

  if (!solicitacao) {
    throw new ErroNaoEncontrado();
  }

  if (solicitacao.solicitante_id !== solicitanteId) {
    throw new ErroAcessoNegado();
  }

  return solicitacao;
}
