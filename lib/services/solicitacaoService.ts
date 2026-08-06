import { prisma } from "@/lib/prisma";
import {
  Prisma,
  Role,
  StatusSolicitacao,
  type Solicitacao,
} from "@/lib/generated/prisma/client";
import { registrar } from "@/lib/services/logService";
import type { AuthenticatedUser } from "@/lib/services/authService";
import * as tipoFluxoService from "@/lib/services/tipoFluxoService";
import { gerarEPersistir } from "@/lib/services/resumoSolicitanteService";
import {
  validarDados,
  type ErroValidacaoCampo,
} from "@/lib/validations/solicitacaoDados";
import type { CampoFormularioDefinicao } from "@/lib/validations/tipoFluxo";
import type { SolicitacaoInput } from "@/lib/validations/solicitacao";
import { lerEtapas, papelEfetivo } from "@/lib/services/fluxoEtapas";

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

/**
 * Usuario nao e o solicitante dono nem RH_Admin — cancelamento e acao do
 * solicitante ou do RH, nunca do aprovador (mesmo que seja o gestor da etapa
 * atual) — rota converte em 403.
 */
export class ErroNaoAutorizadoCancelamento extends Error {
  constructor(message = "Usuario nao autorizado a cancelar esta solicitacao.") {
    super(message);
    this.name = "ErroNaoAutorizadoCancelamento";
  }
}

/** `status` diferente de `PENDENTE` (ja encerrada ou corrida concorrente) — rota converte em 409. */
export class ErroCancelamentoInvalido extends Error {
  constructor(message = "Solicitacao ja encerrada; nao e possivel cancelar.") {
    super(message);
    this.name = "ErroCancelamentoInvalido";
  }
}

/** Item de `listarMinhas` (SOL-01, SOL-02) — inclui o suficiente para a tabela da Screen 1. */
export type SolicitacaoResumo = Solicitacao & {
  tipoFluxo: { nome: string };
};

/** Registro completo, retornado por `buscarDetalhePorId`. */
export type SolicitacaoDetalhe = Solicitacao & {
  tipoFluxo: { id: string; nome: string; campos_formulario: unknown; etapas: unknown };
  solicitante: { id: string; nome: string; email: string };
};

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
  const etapaPlanejada = etapas[0];

  if (!etapaPlanejada) {
    // SOL-12: TipoFluxo sem etapas — garantido nao acontecer por CONF-04
    // (configuracao-fluxos exige >=1 etapa na criacao/edicao).
    throw new Error("Tipo de fluxo sem etapas de aprovacao configuradas.");
  }

  const solicitante = await prisma.user.findUnique({
    where: { id: solicitanteId },
    select: { equipe_id: true },
  });
  const etapaInicial = papelEfetivo(etapaPlanejada, solicitante?.equipe_id != null);

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
 * - Sem visibilidade (nem solicitante dono, nem gestor da equipe, nem RH_Admin) -> `ErroAcessoNegado`.
 */
export async function buscarDetalhePorId(
  id: string,
  usuario: AuthenticatedUser | string,
): Promise<SolicitacaoDetalhe> {
  const solicitacao = await prisma.solicitacao.findUnique({
    where: { id },
    include: {
      solicitante: {
        select: {
          id: true,
          nome: true,
          email: true,
          equipe: { select: { gestor_id: true } },
        },
      },
      tipoFluxo: {
        select: { id: true, nome: true, campos_formulario: true, etapas: true },
      },
    },
  });

  if (!solicitacao) {
    throw new ErroNaoEncontrado();
  }

  const usuarioId = typeof usuario === "string" ? usuario : usuario.id;
  const userRole = typeof usuario === "string" ? null : usuario.role;

  let visivel = false;

  if (solicitacao.solicitante_id === usuarioId) {
    visivel = true;
  } else if (userRole === Role.RH_ADMIN) {
    visivel = true;
  } else if (userRole === Role.GESTOR) {
    visivel = solicitacao.solicitante.equipe?.gestor_id === usuarioId;
  } else if (typeof usuario === "string") {
    const userDb = await prisma.user.findUnique({
      where: { id: usuarioId },
      select: { role: true },
    });
    if (userDb?.role === Role.RH_ADMIN) {
      visivel = true;
    } else if (userDb?.role === Role.GESTOR) {
      visivel = solicitacao.solicitante.equipe?.gestor_id === usuarioId;
    }
  }

  if (!visivel) {
    throw new ErroAcessoNegado();
  }

  return solicitacao;
}

/**
 * Cancela uma `Solicitacao` (SOL-14 e similares).
 *
 * - `id` inexistente -> `ErroNaoEncontrado`.
 * - Somente o solicitante dono ou `RH_ADMIN` pode cancelar —
 *   `ErroNaoAutorizadoCancelamento` mesmo se o usuario for o `GESTOR`
 *   aprovador da etapa atual (cancelamento nunca e acao do aprovador).
 * - `status !== PENDENTE` -> `ErroCancelamentoInvalido` (tambem cobre a
 *   corrida de dois cancelamentos concorrentes: o segundo encontra o status
 *   ja alterado).
 * - Sucesso: `status=CANCELADA`, grava `Log AUDITORIA` (acao `CANCELAMENTO`).
 */
export async function cancelar(
  id: string,
  usuario: AuthenticatedUser,
): Promise<Solicitacao> {
  const solicitacao = await prisma.solicitacao.findUnique({ where: { id } });

  if (!solicitacao) {
    throw new ErroNaoEncontrado();
  }

  if (
    usuario.role !== Role.RH_ADMIN &&
    solicitacao.solicitante_id !== usuario.id
  ) {
    throw new ErroNaoAutorizadoCancelamento();
  }

  if (solicitacao.status !== StatusSolicitacao.PENDENTE) {
    throw new ErroCancelamentoInvalido();
  }

  const atualizada = await prisma.solicitacao.update({
    where: { id },
    data: { status: StatusSolicitacao.CANCELADA },
  });

  await registrar({
    tipo: "AUDITORIA",
    entidade: "Solicitacao",
    entidade_id: id,
    acao: "CANCELAMENTO",
    usuario_id: usuario.id,
  });

  return atualizada;
}
