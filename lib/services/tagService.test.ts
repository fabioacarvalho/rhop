import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tag: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { Prisma, type Tag } from "@/lib/generated/prisma/client";
import {
  ErroNaoEncontrado,
  ErroTagDuplicada,
  alternarAtivo,
  criar,
  editar,
  listar,
} from "./tagService";
import type { TagInput } from "@/lib/validations/tag";

const mockFindMany = vi.mocked(prisma.tag.findMany);
const mockFindFirst = vi.mocked(prisma.tag.findFirst);
const mockFindUnique = vi.mocked(prisma.tag.findUnique);
const mockCreate = vi.mocked(prisma.tag.create);
const mockUpdate = vi.mocked(prisma.tag.update);

beforeEach(() => {
  mockFindMany.mockReset();
  mockFindFirst.mockReset();
  mockFindUnique.mockReset();
  mockCreate.mockReset();
  mockUpdate.mockReset();
});

const DADOS_VALIDOS: TagInput = {
  nome: "Sênior",
  funcao: "Nível de experiência",
};

const TAG_CRIADA: Tag = {
  id: "tag-1",
  nome: "Sênior",
  funcao: "Nível de experiência",
  ativo: true,
  criado_em: new Date("2026-08-01T00:00:00.000Z"),
  atualizado_em: new Date("2026-08-01T00:00:00.000Z"),
} as unknown as Tag;

describe("tagService.listar", () => {
  it("sem argumento retorna todas as tags", async () => {
    mockFindMany.mockResolvedValueOnce([TAG_CRIADA]);

    const result = await listar();

    expect(result).toEqual([TAG_CRIADA]);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: { nome: "asc" },
    });
  });

  it("somenteAtivas=true filtra ativo:true", async () => {
    mockFindMany.mockResolvedValueOnce([TAG_CRIADA]);

    await listar(true);

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { ativo: true },
      orderBy: { nome: "asc" },
    });
  });
});

describe("tagService.criar", () => {
  it("caminho feliz -> cria com ativo=true por padrao", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    mockCreate.mockResolvedValueOnce(TAG_CRIADA);

    const result = await criar(DADOS_VALIDOS);

    expect(result).toEqual(TAG_CRIADA);
    expect(mockCreate).toHaveBeenCalledWith({
      data: { nome: "Sênior", funcao: "Nível de experiência" },
    });
  });

  it("nome duplicado mesmo case -> ErroTagDuplicada, sem chamar create", async () => {
    mockFindFirst.mockResolvedValueOnce(TAG_CRIADA);

    await expect(criar(DADOS_VALIDOS)).rejects.toThrow(ErroTagDuplicada);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("nome duplicado outro case -> ErroTagDuplicada", async () => {
    mockFindFirst.mockResolvedValueOnce(TAG_CRIADA);

    await expect(criar({ ...DADOS_VALIDOS, nome: "sênior" })).rejects.toThrow(
      ErroTagDuplicada,
    );
  });

  it("corrida no P2002 (findFirst nao pegou, create rejeita) -> ErroTagDuplicada", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    mockCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    await expect(criar(DADOS_VALIDOS)).rejects.toThrow(ErroTagDuplicada);
  });

  it("normaliza nome com trim antes de gravar", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    mockCreate.mockResolvedValueOnce(TAG_CRIADA);

    await criar({ ...DADOS_VALIDOS, nome: "  Sênior  " });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ nome: "Sênior" }) }),
    );
  });
});

describe("tagService.editar", () => {
  it("caminho feliz -> atualiza nome/funcao", async () => {
    mockFindUnique.mockResolvedValueOnce(TAG_CRIADA);
    mockFindFirst.mockResolvedValueOnce(null);
    mockUpdate.mockResolvedValueOnce({ ...TAG_CRIADA, funcao: "Nova funcao" });

    const result = await editar("tag-1", {
      ...DADOS_VALIDOS,
      funcao: "Nova funcao",
    });

    expect(result.funcao).toBe("Nova funcao");
  });

  it("id inexistente -> ErroNaoEncontrado", async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    await expect(editar("tag-x", DADOS_VALIDOS)).rejects.toThrow(
      ErroNaoEncontrado,
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("nome duplicado de outra tag -> ErroTagDuplicada", async () => {
    mockFindUnique.mockResolvedValueOnce(TAG_CRIADA);
    mockFindFirst.mockResolvedValueOnce({ ...TAG_CRIADA, id: "tag-2" });

    await expect(editar("tag-1", DADOS_VALIDOS)).rejects.toThrow(
      ErroTagDuplicada,
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("exclui a propria tag da checagem de duplicidade", async () => {
    mockFindUnique.mockResolvedValueOnce(TAG_CRIADA);
    mockFindFirst.mockResolvedValueOnce(null);
    mockUpdate.mockResolvedValueOnce(TAG_CRIADA);

    await editar("tag-1", DADOS_VALIDOS);

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { not: "tag-1" } }),
      }),
    );
  });
});

describe("tagService.alternarAtivo", () => {
  it("caminho feliz -> atualiza campo ativo", async () => {
    mockUpdate.mockResolvedValueOnce({ ...TAG_CRIADA, ativo: false });

    const result = await alternarAtivo("tag-1", false);

    expect(result.ativo).toBe(false);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "tag-1" },
      data: { ativo: false },
    });
  });

  it("id inexistente (P2025) -> ErroNaoEncontrado", async () => {
    mockUpdate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "test",
      }),
    );

    await expect(alternarAtivo("tag-x", true)).rejects.toThrow(
      ErroNaoEncontrado,
    );
  });
});
