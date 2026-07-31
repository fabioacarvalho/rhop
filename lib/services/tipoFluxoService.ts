import { prisma } from "@/lib/prisma";
import { Prisma, type TipoFluxo } from "@/lib/generated/prisma/client";
import { registrar } from "@/lib/services/logService";
import type { TipoFluxoInput } from "@/lib/validations/tipoFluxo";

/**
 * Sinaliza `id` de `TipoFluxo` sem registro correspondente — quem chama
 * `buscarPorId`/`editar` deve converter isso em `404` (CONF-06, CONF-07).
 */
export class ErroNaoEncontrado extends Error {
  constructor(message = "Tipo de fluxo nao encontrado.") {
    super(message);
    this.name = "ErroNaoEncontrado";
  }
}

/**
 * Sinaliza edicao bloqueada por `Solicitacao` `PENDENTE` vinculada ao
 * `TipoFluxo` (CONF-07) — quem chama `editar` deve converter isso em `409`.
 */
export class ErroEdicaoBloqueada extends Error {
  constructor(quantidade: number) {
    super(
      `Nao e possivel editar: existem ${quantidade} solicitacao(oes) pendente(s) usando este tipo de fluxo.`,
    );
    this.name = "ErroEdicaoBloqueada";
  }
}

/**
 * Sinaliza qualquer violacao das regras de integridade de `TipoFluxo` antes
 * da escrita (CONF-02) — nunca deixa o erro bruto do Prisma (ex.: `P2002` de
 * `nome` duplicado) vazar para quem chamou `criar`/`editar`.
 */
export class ErroValidacaoTipoFluxo extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErroValidacaoTipoFluxo";
  }
}

/** Item de `listar()` — id + nome, o minimo exigido por CONF-06. */
export type TipoFluxoResumo = Pick<TipoFluxo, "id" | "nome">;

/** Registro completo de `TipoFluxo`, retornado por `buscarPorId`/`criar`/`editar`. */
export type TipoFluxoDetalhe = TipoFluxo;

/**
 * Lista todos os `TipoFluxo` cadastrados (CONF-06), ordenados por `nome`
 * para exibicao estavel na UI. Retorna apenas `id`+`nome` — a listagem nao
 * precisa do registro completo (`campos_formulario`/`etapas`).
 */
export async function listar(): Promise<TipoFluxoResumo[]> {
  return prisma.tipoFluxo.findMany({
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
}

/**
 * Busca um `TipoFluxo` completo por `id` (CONF-06, usado tambem por
 * `editar` para o bloqueio por pendencia e pela tela de edicao).
 *
 * Lanca `ErroNaoEncontrado` se nao existir registro com esse `id`.
 */
export async function buscarPorId(id: string): Promise<TipoFluxoDetalhe> {
  const tipoFluxo = await prisma.tipoFluxo.findUnique({ where: { id } });

  if (!tipoFluxo) {
    throw new ErroNaoEncontrado();
  }

  return tipoFluxo;
}

/**
 * Cria um `TipoFluxo` (CONF-02 a CONF-05, CONF-09).
 *
 * Em sucesso, grava `Log` tipo `AUDITORIA` (`acao: 'CRIACAO'`) via
 * `logService.registrar` — que nunca lanca, entao uma falha ao gravar o log
 * nunca impede a criacao de ser reportada como bem-sucedida.
 *
 * `nome` duplicado (constraint `@unique`, `P2002`) e capturado e traduzido
 * para `ErroValidacaoTipoFluxo` — nunca deixa o erro bruto do Prisma vazar.
 */
export async function criar(
  dados: TipoFluxoInput,
  usuarioId: string,
): Promise<TipoFluxoDetalhe> {
  let tipoFluxo: TipoFluxoDetalhe;

  try {
    tipoFluxo = await prisma.tipoFluxo.create({
      data: {
        nome: dados.nome,
        campos_formulario: dados.campos_formulario,
        etapas: dados.etapas,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ErroValidacaoTipoFluxo(
        `Ja existe um tipo de fluxo com o nome "${dados.nome}".`,
      );
    }
    throw error;
  }

  await registrar({
    tipo: "AUDITORIA",
    entidade: "TipoFluxo",
    entidade_id: tipoFluxo.id,
    acao: "CRIACAO",
    usuario_id: usuarioId,
  });

  return tipoFluxo;
}

/**
 * Edita um `TipoFluxo` existente (CONF-07, CONF-09).
 *
 * Ordem de checagem (ambas ANTES de qualquer escrita):
 * 1. Conta `Solicitacao` com `tipo_fluxo_id = id` e `status = 'PENDENTE'`.
 *    Se houver alguma, lanca `ErroEdicaoBloqueada` (mensagem cita a
 *    quantidade) — `prisma.tipoFluxo.update` e `logService.registrar` NAO
 *    sao chamados.
 * 2. Sem pendencias, tenta o `update`. `id` inexistente e traduzido em
 *    `ErroNaoEncontrado` (erro `P2025` do Prisma).
 *
 * Em sucesso, grava `Log` tipo `AUDITORIA` (`acao: 'EDICAO'`).
 */
export async function editar(
  id: string,
  dados: TipoFluxoInput,
  usuarioId: string,
): Promise<TipoFluxoDetalhe> {
  const pendentes = await prisma.solicitacao.count({
    where: { tipo_fluxo_id: id, status: "PENDENTE" },
  });

  if (pendentes > 0) {
    throw new ErroEdicaoBloqueada(pendentes);
  }

  let tipoFluxo: TipoFluxoDetalhe;

  try {
    tipoFluxo = await prisma.tipoFluxo.update({
      where: { id },
      data: {
        nome: dados.nome,
        campos_formulario: dados.campos_formulario,
        etapas: dados.etapas,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new ErroNaoEncontrado();
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ErroValidacaoTipoFluxo(
        `Ja existe um tipo de fluxo com o nome "${dados.nome}".`,
      );
    }
    throw error;
  }

  await registrar({
    tipo: "AUDITORIA",
    entidade: "TipoFluxo",
    entidade_id: tipoFluxo.id,
    acao: "EDICAO",
    usuario_id: usuarioId,
  });

  return tipoFluxo;
}
