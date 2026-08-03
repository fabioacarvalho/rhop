import { prisma } from "@/lib/prisma";
import { Prisma, Role, type Equipe } from "@/lib/generated/prisma/client";
import { registrar } from "@/lib/services/logService";
import type { EquipeInput } from "@/lib/validations/equipe";

/**
 * Sinaliza `id` de `Equipe` sem registro correspondente — quem chama
 * `buscarPorId`/`editar`/`definirStatus` deve converter isso em `404`.
 */
export class ErroNaoEncontradoEquipe extends Error {
  constructor(message = "Equipe nao encontrada.") {
    super(message);
    this.name = "ErroNaoEncontradoEquipe";
  }
}

/**
 * Sinaliza qualquer violacao das regras de integridade de `Equipe` antes da
 * escrita (nome duplicado ou `gestor_id` invalido) — nunca deixa o erro bruto
 * do Prisma (ex.: `P2002`) vazar para quem chamou `criar`/`editar`.
 */
export class ErroValidacaoEquipe extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErroValidacaoEquipe";
  }
}

/**
 * Sinaliza desativacao bloqueada por `User` `ativo` ainda vinculado a
 * `Equipe` (mesmo estilo de `ErroEdicaoBloqueadaUsuario` em userService.ts)
 * — quem chama `definirStatus` deve converter isso em `409`.
 */
export class ErroEdicaoBloqueadaEquipe extends Error {
  constructor(quantidade: number) {
    super(
      `Nao e possivel desativar: existem ${quantidade} membro(s) ativo(s) nesta equipe.`,
    );
    this.name = "ErroEdicaoBloqueadaEquipe";
  }
}

/**
 * Valida `gestor_id` compartilhado por `criar` e `editar`: precisa
 * referenciar um `User` existente, com `role === GESTOR` e `ativo === true`.
 * Roda ANTES de qualquer escrita — nunca deixa uma `Equipe` orfa de gestor
 * valido ser persistida.
 */
async function validarGestor(gestorId: string): Promise<void> {
  const gestor = await prisma.user.findUnique({ where: { id: gestorId } });

  if (!gestor) {
    throw new ErroValidacaoEquipe(
      `gestor_id "${gestorId}" nao corresponde a nenhum usuario existente.`,
    );
  }
  if (gestor.role !== Role.GESTOR) {
    throw new ErroValidacaoEquipe(
      `gestor_id "${gestorId}" nao corresponde a um usuario com role GESTOR.`,
    );
  }
  if (!gestor.ativo) {
    throw new ErroValidacaoEquipe(
      `gestor_id "${gestorId}" corresponde a um usuario inativo.`,
    );
  }
}

/**
 * Item de `listar()` — inclui o nome do gestor e a contagem de membros
 * ativos ja resolvidos, para exibicao direta na tela de listagem.
 */
export interface EquipeResumo {
  id: string;
  nome: string;
  gestor_id: string;
  gestor_nome: string;
  membros_ativos: number;
  ativo: boolean;
}

/**
 * Lista todas as `Equipe` cadastradas, com nome do gestor e contagem de
 * membros ativos.
 *
 * Decisao de implementacao: a contagem de membros ativos e feita com uma
 * segunda query (`prisma.user.groupBy`) em vez de `_count` filtrado por
 * relacao — mais simples de ler e de mockar em teste do que a sintaxe de
 * `_count.select.membros.where`, e o volume de equipes/usuarios do dominio
 * (RH interno) nao justifica a otimizacao de round-trip.
 */
export async function listar(): Promise<EquipeResumo[]> {
  const [equipes, contagens] = await Promise.all([
    prisma.equipe.findMany({
      include: { gestor: { select: { nome: true } } },
      orderBy: { nome: "asc" },
    }),
    prisma.user.groupBy({
      by: ["equipe_id"],
      where: { ativo: true, equipe_id: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const membrosAtivosPorEquipe = new Map<string, number>();
  for (const contagem of contagens) {
    if (contagem.equipe_id) {
      membrosAtivosPorEquipe.set(contagem.equipe_id, contagem._count._all);
    }
  }

  return equipes.map((equipe) => ({
    id: equipe.id,
    nome: equipe.nome,
    gestor_id: equipe.gestor_id,
    gestor_nome: equipe.gestor.nome,
    membros_ativos: membrosAtivosPorEquipe.get(equipe.id) ?? 0,
    ativo: equipe.ativo,
  }));
}

/**
 * Busca uma `Equipe` completa por `id`. Lanca `ErroNaoEncontradoEquipe` se
 * nao existir registro com esse `id`.
 */
export async function buscarPorId(id: string): Promise<Equipe> {
  const equipe = await prisma.equipe.findUnique({ where: { id } });

  if (!equipe) {
    throw new ErroNaoEncontradoEquipe();
  }

  return equipe;
}

/**
 * Cria uma `Equipe`: valida `gestor_id` (GESTOR ativo) -> tenta o `create`
 * -> `nome` duplicado (`P2002`) e traduzido para `ErroValidacaoEquipe` ->
 * sucesso grava `Log` tipo `AUDITORIA` (`acao: 'CRIACAO'`).
 */
export async function criar(
  dados: EquipeInput,
  atorId: string,
): Promise<Equipe> {
  await validarGestor(dados.gestor_id);

  let equipe: Equipe;
  try {
    equipe = await prisma.equipe.create({
      data: { nome: dados.nome, gestor_id: dados.gestor_id },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ErroValidacaoEquipe(
        `Ja existe uma equipe com o nome "${dados.nome}".`,
      );
    }
    throw error;
  }

  await registrar({
    tipo: "AUDITORIA",
    entidade: "Equipe",
    entidade_id: equipe.id,
    acao: "CRIACAO",
    usuario_id: atorId,
  });

  return equipe;
}

/**
 * Edita uma `Equipe` existente: mesma validacao de `gestor_id` de `criar` ->
 * tenta o `update` -> `id` inexistente (`P2025`) e traduzido para
 * `ErroNaoEncontradoEquipe`, `nome` duplicado (`P2002`) para
 * `ErroValidacaoEquipe` -> sucesso grava `Log` tipo `AUDITORIA`
 * (`acao: 'EDICAO'`).
 */
export async function editar(
  id: string,
  dados: EquipeInput,
  atorId: string,
): Promise<Equipe> {
  await validarGestor(dados.gestor_id);

  let equipe: Equipe;
  try {
    equipe = await prisma.equipe.update({
      where: { id },
      data: { nome: dados.nome, gestor_id: dados.gestor_id },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new ErroNaoEncontradoEquipe();
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ErroValidacaoEquipe(
        `Ja existe uma equipe com o nome "${dados.nome}".`,
      );
    }
    throw error;
  }

  await registrar({
    tipo: "AUDITORIA",
    entidade: "Equipe",
    entidade_id: equipe.id,
    acao: "EDICAO",
    usuario_id: atorId,
  });

  return equipe;
}

/**
 * Ativa/desativa uma `Equipe`. Desativacao e bloqueada (`ErroEdicaoBloqueadaEquipe`,
 * SEM escrita) se ainda houver `User` `ativo` vinculado (`equipe_id = id`).
 * Reativacao e sempre permitida. Sucesso grava `Log` tipo `AUDITORIA`
 * (`acao: 'DESATIVACAO'` ou `'REATIVACAO'`).
 */
export async function definirStatus(
  id: string,
  ativo: boolean,
  atorId: string,
): Promise<Equipe> {
  const equipeAtual = await prisma.equipe.findUnique({ where: { id } });
  if (!equipeAtual) {
    throw new ErroNaoEncontradoEquipe();
  }

  if (!ativo) {
    const membrosAtivos = await prisma.user.count({
      where: { equipe_id: id, ativo: true },
    });
    if (membrosAtivos > 0) {
      throw new ErroEdicaoBloqueadaEquipe(membrosAtivos);
    }
  }

  const equipe = await prisma.equipe.update({ where: { id }, data: { ativo } });

  await registrar({
    tipo: "AUDITORIA",
    entidade: "Equipe",
    entidade_id: equipe.id,
    acao: ativo ? "REATIVACAO" : "DESATIVACAO",
    usuario_id: atorId,
  });

  return equipe;
}

/** Item de `listarAtivasParaSelecao()`/`listarGeridasPor()` — popula `<select>`. */
export interface EquipeSelecao {
  id: string;
  nome: string;
}

/** Todas as `Equipe` ativas, para popular `<select>` de `equipe_id`. */
export async function listarAtivasParaSelecao(): Promise<EquipeSelecao[]> {
  return prisma.equipe.findMany({
    where: { ativo: true },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
}

/** `Equipe` ativas geridas por `gestorId`. */
export async function listarGeridasPor(
  gestorId: string,
): Promise<EquipeSelecao[]> {
  return prisma.equipe.findMany({
    where: { gestor_id: gestorId, ativo: true },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
}

/**
 * Quantidade de `Equipe` ativas geridas por `userId` — usada por
 * `userService.editar` (task futura) para bloquear a remocao do papel
 * GESTOR de quem ainda gerencia equipe ativa.
 */
export async function contarGeridasAtivasPor(userId: string): Promise<number> {
  return prisma.equipe.count({ where: { gestor_id: userId, ativo: true } });
}
