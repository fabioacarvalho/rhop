import { prisma } from "@/lib/prisma";
import {
  DecisaoAprovacao,
  Role,
  StatusSolicitacao,
  type Aprovacao,
  type Solicitacao,
} from "@/lib/generated/prisma/client";
import type { AuthenticatedUser } from "@/lib/services/authService";
import { registrar } from "@/lib/services/logService";
import { gerarResumoSolicitacao } from "@/lib/services/iaService";
import { emitirAvancoEtapa } from "@/lib/events/solicitacaoEvents";
import type { DecisaoInput } from "@/lib/validations/aprovacao";
import { lerEtapas, papelEfetivo } from "@/lib/services/fluxoEtapas";

/** Solicitacao inexistente — rota mapeia para 404. */
export class ErroNaoEncontrado extends Error {
  constructor(message = "Solicitacao nao encontrada.") {
    super(message);
    this.name = "ErroNaoEncontrado";
  }
}

/**
 * Usuario autenticado nao e o aprovador elegivel da etapa atual
 * (papel errado, gestor errado, ou solicitante sem equipe) — 403.
 */
export class ErroNaoAutorizadoAprovacao extends Error {
  constructor(
    message = "Usuario nao autorizado a decidir esta solicitacao.",
  ) {
    super(message);
    this.name = "ErroNaoAutorizadoAprovacao";
  }
}

/**
 * Decisao impossivel: status final, etapa ja decidida, ou corrida
 * concorrente — 409.
 */
export class ErroDecisaoInvalida extends Error {
  constructor(message = "Decisao invalida para o estado atual da solicitacao.") {
    super(message);
    this.name = "ErroDecisaoInvalida";
  }
}

/** Card da fila de Aprovacoes Pendentes (APR-01). */
export interface AprovacaoPendenteCard {
  solicitacao_id: string;
  tipo_fluxo_nome: string;
  solicitante_nome: string;
  solicitante_email: string;
  etapa_atual: Role;
  prazo_sla: Date;
  resumo_ia: string | null;
  criado_em: Date;
}

type SolicitacaoComRelacoes = Solicitacao & {
  tipoFluxo: { id: string; nome: string; etapas: unknown };
  solicitante: {
    id: string;
    nome: string;
    email: string;
    equipe: { gestor_id: string } | null;
  };
  aprovacoes: Aprovacao[];
};

/**
 * Lista solicitacoes pendentes para o aprovador autenticado (APR-01, APR-05).
 *
 * - GESTOR: `etapa_atual = GESTOR` e `solicitante.equipe.gestor_id = usuario.id`
 * - RH_ADMIN: `etapa_atual = RH_ADMIN`
 * - Garante stub de `Aprovacao` da etapa e tenta preencher `resumo_ia`
 *   (falha de IA → card com `resumo_ia: null`, fluxo segue).
 */
export async function listarPendentes(
  usuario: AuthenticatedUser,
): Promise<AprovacaoPendenteCard[]> {
  if (usuario.role !== Role.GESTOR && usuario.role !== Role.RH_ADMIN) {
    return [];
  }

  const where =
    usuario.role === Role.GESTOR
      ? {
          status: StatusSolicitacao.PENDENTE,
          etapa_atual: Role.GESTOR,
          solicitante: { equipe: { gestor_id: usuario.id } },
        }
      : {
          status: StatusSolicitacao.PENDENTE,
          etapa_atual: Role.RH_ADMIN,
        };

  const solicitacoes = await prisma.solicitacao.findMany({
    where,
    include: {
      tipoFluxo: { select: { id: true, nome: true, etapas: true } },
      solicitante: {
        select: {
          id: true,
          nome: true,
          email: true,
          equipe: { select: { gestor_id: true } },
        },
      },
      aprovacoes: true,
    },
    orderBy: { criado_em: "asc" },
  });

  const cards: AprovacaoPendenteCard[] = [];

  for (const solicitacao of solicitacoes as SolicitacaoComRelacoes[]) {
    const stub = await garantirStubEtapaAtual(solicitacao);
    let resumo = stub.resumo_ia;

    if (!resumo) {
      resumo = await preencherResumoIa(solicitacao, stub);
    }

    cards.push({
      solicitacao_id: solicitacao.id,
      tipo_fluxo_nome: solicitacao.tipoFluxo.nome,
      solicitante_nome: solicitacao.solicitante.nome,
      solicitante_email: solicitacao.solicitante.email,
      etapa_atual: solicitacao.etapa_atual,
      prazo_sla: solicitacao.prazo_sla,
      resumo_ia: resumo,
      criado_em: solicitacao.criado_em,
    });
  }

  return cards;
}

/**
 * Registra aprovacao/rejeicao com autorizacao de backend (APR-06 a APR-12).
 */
export async function decidir(
  solicitacaoId: string,
  usuario: AuthenticatedUser,
  input: DecisaoInput,
): Promise<Solicitacao> {
  const solicitacao = await prisma.solicitacao.findUnique({
    where: { id: solicitacaoId },
    include: {
      tipoFluxo: { select: { id: true, nome: true, etapas: true } },
      solicitante: {
        select: {
          id: true,
          nome: true,
          email: true,
          equipe: { select: { gestor_id: true } },
        },
      },
      aprovacoes: true,
    },
  });

  if (!solicitacao) {
    throw new ErroNaoEncontrado();
  }

  const sol = solicitacao as SolicitacaoComRelacoes;
  assertPodeDecidir(sol, usuario);

  const stub = await garantirStubEtapaAtual(sol);
  if (stub.decisao != null) {
    throw new ErroDecisaoInvalida(
      "Esta etapa ja possui uma decisao registrada.",
    );
  }

  const agora = new Date();
  const decisao =
    input.decisao === "APROVADA"
      ? DecisaoAprovacao.APROVADA
      : DecisaoAprovacao.REJEITADA;

  const dadosAprovacao = {
    aprovador_id: usuario.id,
    decisao,
    comentario: input.comentario ?? null,
    decidido_em: agora,
  };

  // `Aprovacao.decisao` e `Solicitacao.status/etapa_atual` avancam juntos
  // numa unica transacao: se as duas escritas fossem separadas e uma delas
  // falhasse no meio (timeout, erro transiente), a solicitacao ficaria com
  // decisao gravada mas sem avancar de etapa — travada pra sempre, pois o
  // guard de idempotencia acima bloquearia qualquer nova tentativa.
  if (input.decisao === "REJEITADA") {
    const [, atualizada] = await prisma.$transaction([
      prisma.aprovacao.update({ where: { id: stub.id }, data: dadosAprovacao }),
      prisma.solicitacao.update({
        where: { id: sol.id },
        data: { status: StatusSolicitacao.REJEITADA },
      }),
    ]);

    await registrar({
      tipo: "AUDITORIA",
      entidade: "Aprovacao",
      entidade_id: stub.id,
      acao: "REJEICAO",
      usuario_id: usuario.id,
      detalhes: {
        solicitacao_id: sol.id,
        etapa: stub.etapa,
        comentario: input.comentario ?? null,
      },
    });
    await registrar({
      tipo: "AUDITORIA",
      entidade: "Solicitacao",
      entidade_id: sol.id,
      acao: "STATUS_REJEITADA",
      usuario_id: usuario.id,
    });

    return atualizada;
  }

  // Indice da etapa corrente vem de `stub.etapa` (numeracao pela ultima
  // `Aprovacao` existente, ver `garantirStubEtapaAtual`) — nao de
  // `etapas.indexOf(etapa_atual)`: quando uma etapa GESTOR e substituida por
  // RH_ADMIN (`papelEfetivo`, solicitante sem `Equipe`), o papel efetivo pode
  // repetir em duas posicoes seguidas do array, e `indexOf` sempre acharia a
  // primeira ocorrencia.
  const etapas = lerEtapas(sol.tipoFluxo.etapas);
  const indiceAtual = stub.etapa - 1;
  const proximaPlanejada = etapas[indiceAtual + 1];
  const proxima =
    proximaPlanejada === undefined
      ? undefined
      : papelEfetivo(proximaPlanejada, sol.solicitante.equipe != null);

  const dadosSolicitacao =
    proxima === undefined
      ? { status: StatusSolicitacao.APROVADA }
      : { etapa_atual: proxima, status: StatusSolicitacao.PENDENTE };

  const [, atualizada] = await prisma.$transaction([
    prisma.aprovacao.update({ where: { id: stub.id }, data: dadosAprovacao }),
    prisma.solicitacao.update({ where: { id: sol.id }, data: dadosSolicitacao }),
  ]);

  // Mantem `stub` (dentro de `sol.aprovacoes`) coerente com o que acabou de
  // ser commitado — a proxima chamada a `garantirStubEtapaAtual` (mais
  // abaixo, via `solAvancada`) depende de ver esta etapa como decidida.
  stub.decisao = decisao;
  stub.aprovador_id = usuario.id;
  stub.comentario = dadosAprovacao.comentario;
  stub.decidido_em = agora;

  await registrar({
    tipo: "AUDITORIA",
    entidade: "Aprovacao",
    entidade_id: stub.id,
    acao: "APROVACAO",
    usuario_id: usuario.id,
    detalhes: {
      solicitacao_id: sol.id,
      etapa: stub.etapa,
      comentario: input.comentario ?? null,
    },
  });

  if (proxima === undefined) {
    await registrar({
      tipo: "AUDITORIA",
      entidade: "Solicitacao",
      entidade_id: sol.id,
      acao: "STATUS_APROVADA",
      usuario_id: usuario.id,
    });

    return atualizada;
  }

  await registrar({
    tipo: "AUDITORIA",
    entidade: "Solicitacao",
    entidade_id: sol.id,
    acao: "AVANCO_ETAPA",
    usuario_id: usuario.id,
    detalhes: { etapa_atual: proxima },
  });

  const solAvancada: SolicitacaoComRelacoes = {
    ...sol,
    ...atualizada,
    etapa_atual: proxima,
    aprovacoes: sol.aprovacoes,
  };

  const novoStub = await garantirStubEtapaAtual(solAvancada);
  // Fire-and-forget: falha de IA nao reverte a decisao (APR-14).
  void preencherResumoIa(solAvancada, novoStub);
  await emitirAvancoEtapa({
    solicitacao_id: sol.id,
    etapa_atual: proxima,
  });

  return atualizada;
}

/**
 * Historico de decisoes da solicitacao (APR-16), com regra de visibilidade.
 */
export async function listarHistorico(
  solicitacaoId: string,
  usuario: AuthenticatedUser,
): Promise<Aprovacao[]> {
  const solicitacao = await prisma.solicitacao.findUnique({
    where: { id: solicitacaoId },
    include: {
      solicitante: {
        select: { id: true, equipe: { select: { gestor_id: true } } },
      },
      aprovacoes: { orderBy: { etapa: "asc" } },
    },
  });

  if (!solicitacao) {
    throw new ErroNaoEncontrado();
  }

  const visivel =
    usuario.role === Role.RH_ADMIN ||
    solicitacao.solicitante_id === usuario.id ||
    (usuario.role === Role.GESTOR &&
      solicitacao.solicitante.equipe?.gestor_id === usuario.id);

  if (!visivel) {
    throw new ErroNaoAutorizadoAprovacao(
      "Usuario sem visibilidade sobre esta solicitacao.",
    );
  }

  return solicitacao.aprovacoes;
}

function assertPodeDecidir(
  solicitacao: SolicitacaoComRelacoes,
  usuario: AuthenticatedUser,
): void {
  if (solicitacao.status !== StatusSolicitacao.PENDENTE) {
    throw new ErroDecisaoInvalida(
      "Solicitacao ja encerrada; nao e possivel decidir.",
    );
  }

  if (usuario.role !== solicitacao.etapa_atual) {
    throw new ErroNaoAutorizadoAprovacao(
      "Papel do usuario nao corresponde a etapa atual.",
    );
  }

  if (solicitacao.etapa_atual === Role.GESTOR) {
    if (!solicitacao.solicitante.equipe) {
      throw new ErroNaoAutorizadoAprovacao(
        "Solicitante sem equipe; nao ha aprovador elegivel.",
      );
    }
    if (solicitacao.solicitante.equipe.gestor_id !== usuario.id) {
      throw new ErroNaoAutorizadoAprovacao(
        "Usuario nao e o gestor do solicitante.",
      );
    }
  }
}

/** Linha de `Aprovacao` com o maior `etapa` — a mais avancada ja tocada. */
function ultimaAprovacao(aprovacoes: Aprovacao[]): Aprovacao | undefined {
  return aprovacoes.reduce<Aprovacao | undefined>(
    (max, a) => (!max || a.etapa > max.etapa ? a : max),
    undefined,
  );
}

/**
 * Garante linha de `Aprovacao` para a etapa corrente (1-based). Numera pela
 * ultima linha existente (`ultimaAprovacao`), nao por
 * `etapas.indexOf(etapa_atual)`: quando uma etapa GESTOR e substituida por
 * RH_ADMIN (`papelEfetivo`, solicitante sem `Equipe`), o papel efetivo pode
 * repetir em duas posicoes seguidas do array, o que confundiria uma busca
 * por papel. Uma vez decidida, a ultima linha e sempre a etapa anterior —
 * `decidir()` grava `Aprovacao.decisao` e `Solicitacao.etapa_atual` na mesma
 * transacao, entao "ultima decidida" nunca fica dessincronizado de
 * `etapa_atual` a ponto de parecer a mesma etapa ainda em aberto.
 *
 * Corrige `aprovador_role` de um stub existente ainda nao decidido se a
 * etapa foi substituida (ver `papelEfetivo`) apos o stub ter sido criado.
 */
async function garantirStubEtapaAtual(
  solicitacao: SolicitacaoComRelacoes,
): Promise<Aprovacao> {
  const role = solicitacao.etapa_atual;
  const ultima = ultimaAprovacao(solicitacao.aprovacoes);

  if (ultima && ultima.decisao == null) {
    if (ultima.aprovador_role !== role) {
      return prisma.aprovacao.update({
        where: { id: ultima.id },
        data: { aprovador_role: role },
      });
    }
    return ultima;
  }

  const etapaNumero = (ultima?.etapa ?? 0) + 1;
  const criado = await prisma.aprovacao.create({
    data: {
      solicitacao_id: solicitacao.id,
      etapa: etapaNumero,
      aprovador_role: role,
    },
  });

  solicitacao.aprovacoes.push(criado);
  return criado;
}

async function preencherResumoIa(
  solicitacao: SolicitacaoComRelacoes,
  stub: Aprovacao,
): Promise<string | null> {
  const dados =
    solicitacao.dados &&
    typeof solicitacao.dados === "object" &&
    !Array.isArray(solicitacao.dados)
      ? (solicitacao.dados as Record<string, unknown>)
      : {};

  const resumo = await gerarResumoSolicitacao({
    solicitacaoId: solicitacao.id,
    tipoFluxoNome: solicitacao.tipoFluxo.nome,
    dados,
    etapa: solicitacao.etapa_atual,
  });

  if (resumo) {
    await prisma.aprovacao.update({
      where: { id: stub.id },
      data: { resumo_ia: resumo },
    });
    stub.resumo_ia = resumo;
  }

  return resumo;
}
