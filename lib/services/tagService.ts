import { prisma } from "@/lib/prisma";
import { Prisma, type Tag } from "@/lib/generated/prisma/client";
import type { TagInput } from "@/lib/validations/tag";

/**
 * Nome de Tag já existente (case-insensitive) — rota mapeia para 409
 * (TAL-39).
 */
export class ErroTagDuplicada extends Error {
  constructor(nome: string) {
    super(`Ja existe uma tag com o nome "${nome}".`);
    this.name = "ErroTagDuplicada";
  }
}

/** `id` de `Tag` sem registro correspondente — rota mapeia para 404. */
export class ErroNaoEncontrado extends Error {
  constructor(message = "Tag nao encontrada.") {
    super(message);
    this.name = "ErroNaoEncontrado";
  }
}

/**
 * Lista Tags (TAL-37, TAL-36). Sem argumento retorna todas (tela de gestão);
 * `somenteAtivas=true` filtra `ativo: true` (formulário de cadastro de
 * candidato, que só deve oferecer Tags ativas como opção).
 */
export async function listar(somenteAtivas?: boolean): Promise<Tag[]> {
  return prisma.tag.findMany({
    where: somenteAtivas ? { ativo: true } : undefined,
    orderBy: { nome: "asc" },
  });
}

async function verificarNomeDuplicado(
  nome: string,
  idExcluir?: string,
): Promise<void> {
  const existente = await prisma.tag.findFirst({
    where: {
      nome: { equals: nome, mode: "insensitive" },
      ...(idExcluir ? { id: { not: idExcluir } } : {}),
    },
  });

  if (existente) {
    throw new ErroTagDuplicada(nome);
  }
}

/**
 * Cria uma Tag com `ativo=true` por padrão (TAL-38). Nome duplicado
 * (case-insensitive) é checado antes do `create`; `P2002` (corrida entre
 * checagem e escrita) é traduzido do mesmo jeito, nunca vaza cru (TAL-39).
 */
export async function criar(dados: TagInput): Promise<Tag> {
  const nome = dados.nome.trim();

  await verificarNomeDuplicado(nome);

  try {
    return await prisma.tag.create({
      data: { nome, funcao: dados.funcao },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ErroTagDuplicada(nome);
    }
    throw error;
  }
}

/**
 * Edita nome/função de uma Tag existente (TAL-40). `id` inexistente ->
 * `ErroNaoEncontrado`. Nome duplicado (de outra Tag, case-insensitive) ->
 * `ErroTagDuplicada`.
 */
export async function editar(id: string, dados: TagInput): Promise<Tag> {
  const existente = await prisma.tag.findUnique({ where: { id } });

  if (!existente) {
    throw new ErroNaoEncontrado();
  }

  const nome = dados.nome.trim();

  await verificarNomeDuplicado(nome, id);

  try {
    return await prisma.tag.update({
      where: { id },
      data: { nome, funcao: dados.funcao },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ErroTagDuplicada(nome);
    }
    throw error;
  }
}

/**
 * Ativa/desativa uma Tag sem excluí-la (TAL-41). `id` inexistente ->
 * `ErroNaoEncontrado`.
 */
export async function alternarAtivo(id: string, ativo: boolean): Promise<Tag> {
  try {
    return await prisma.tag.update({ where: { id }, data: { ativo } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new ErroNaoEncontrado();
    }
    throw error;
  }
}
