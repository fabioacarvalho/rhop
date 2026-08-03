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

  await prisma.aprovacao.update({
    where: { id: stub.id },
    data: {
      aprovador_id: usuario.id,
      decisao,
      comentario: input.comentario ?? null,
      decidido_em: agora,
    },
  });

  await registrar({
    tipo: "AUDITORIA",
    entidade: "Aprovacao",
    entidade_id: stub.id,
    acao: input.decisao === "APROVADA" ? "APROVACAO" : "REJEICAO",
    usuario_id: usuario.id,
    detalhes: {
      solicitacao_id: sol.id,
      etapa: stub.etapa,
      comentario: input.comentario ?? null,
    },
  });

  if (input.decisao === "REJEITADA") {
    const atualizada = await prisma.solicitacao.update({
      where: { id: sol.id },
      data: { status: StatusSolicitacao.REJEITADA },
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

  const etapas = lerEtapas(sol.tipoFluxo.etapas);
  const indiceAtual = indiceEtapaAtual(etapas, sol.etapa_atual);
  const proxima = indiceAtual >= 0 ? etapas[indiceAtual + 1] : undefined;

  if (proxima === undefined) {
    const atualizada = await prisma.solicitacao.update({
      where: { id: sol.id },
      data: { status: StatusSolicitacao.APROVADA },
    });

    await registrar({
      tipo: "AUDITORIA",
      entidade: "Solicitacao",
      entidade_id: sol.id,
      acao: "STATUS_APROVADA",
      usuario_id: usuario.id,
    });

    return atualizada;
  }

  const atualizada = await prisma.solicitacao.update({
    where: { id: sol.id },
    data: {
      etapa_atual: proxima,
      status: StatusSolicitacao.PENDENTE,
    },
  });

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

function lerEtapas(etapasJson: unknown): Role[] {
  if (!Array.isArray(etapasJson)) {
    return [];
  }
  return etapasJson.filter(
    (e): e is Role => e === Role.GESTOR || e === Role.RH_ADMIN,
  );
}

/** Indice 0-based da etapa atual em `etapas`. */
function indiceEtapaAtual(etapas: Role[], etapaAtual: Role): number {
  return etapas.indexOf(etapaAtual);
}

/**
 * Garante linha de `Aprovacao` para a etapa corrente (1-based).
 * Cria stub sem decisao se ainda nao existir.
 */
async function garantirStubEtapaAtual(
  solicitacao: SolicitacaoComRelacoes,
): Promise<Aprovacao> {
  const etapas = lerEtapas(solicitacao.tipoFluxo.etapas);
  const idx = indiceEtapaAtual(etapas, solicitacao.etapa_atual);
  const etapaNumero = idx >= 0 ? idx + 1 : 1;
  const role = solicitacao.etapa_atual;

  const existente = solicitacao.aprovacoes.find((a) => a.etapa === etapaNumero);
  if (existente) {
    return existente;
  }

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
