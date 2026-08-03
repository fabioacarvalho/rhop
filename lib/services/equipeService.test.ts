import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock de `@/lib/prisma` e `@/lib/services/logService` — unit test isolado,
// nunca deve bater no banco real (mesmo padrão de tipoFluxoService.test.ts /
// userService.test.ts).
vi.mock("@/lib/prisma", () => ({
  prisma: {
    equipe: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

vi.mock("@/lib/services/logService", () => ({
  registrar: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { registrar } from "@/lib/services/logService";
import { Prisma, Role, type Equipe, type User } from "@/lib/generated/prisma/client";
import {
  ErroEdicaoBloqueadaEquipe,
  ErroNaoEncontradoEquipe,
  ErroValidacaoEquipe,
  buscarPorId,
  contarGeridasAtivasPor,
  criar,
  definirStatus,
  editar,
  listar,
  listarAtivasParaSelecao,
  listarGeridasPor,
} from "./equipeService";
import type { EquipeInput } from "@/lib/validations/equipe";

const mockFindMany = vi.mocked(prisma.equipe.findMany);
const mockFindUnique = vi.mocked(prisma.equipe.findUnique);
const mockCreate = vi.mocked(prisma.equipe.create);
const mockUpdate = vi.mocked(prisma.equipe.update);
const mockCount = vi.mocked(prisma.equipe.count);
const mockUserFindUnique = vi.mocked(prisma.user.findUnique);
const mockUserCount = vi.mocked(prisma.user.count);
const mockUserGroupBy = vi.mocked(prisma.user.groupBy);
const mockRegistrar = vi.mocked(registrar);

beforeEach(() => {
  mockFindMany.mockReset();
  mockFindUnique.mockReset();
  mockCreate.mockReset();
  mockUpdate.mockReset();
  mockCount.mockReset();
  mockUserFindUnique.mockReset();
  mockUserCount.mockReset();
  mockUserGroupBy.mockReset();
  mockRegistrar.mockReset().mockResolvedValue(undefined);
});

const DADOS_VALIDOS: EquipeInput = {
  nome: "Equipe Vendas",
  gestor_id: "gestor-1",
};

function gestorFake(overrides: Partial<User> = {}): User {
  return {
    id: "gestor-1",
    nome: "Gestor Um",
    email: "gestor@empresa.com",
    role: Role.GESTOR,
    gestor_id: null,
    ativo: true,
    equipe_id: null,
    ...overrides,
  } as User;
}

function equipeFake(overrides: Partial<Equipe> = {}): Equipe {
  return {
    id: "equipe-1",
    nome: DADOS_VALIDOS.nome,
    gestor_id: DADOS_VALIDOS.gestor_id,
    ativo: true,
    criado_em: new Date("2026-01-01T00:00:00.000Z"),
    atualizado_em: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as Equipe;
}

describe("equipeService.criar", () => {
  it("com gestor_id de GESTOR ativo -> persiste e grava AUDITORIA/CRIACAO", async () => {
    mockUserFindUnique.mockResolvedValueOnce(gestorFake());
    mockCreate.mockResolvedValueOnce(equipeFake());

    const resultado = await criar(DADOS_VALIDOS, "ator-1");

    expect(resultado).toEqual(equipeFake());
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
      data: { nome: DADOS_VALIDOS.nome, gestor_id: DADOS_VALIDOS.gestor_id },
    });
    expect(mockRegistrar).toHaveBeenCalledTimes(1);
    expect(mockRegistrar).toHaveBeenCalledWith({
      tipo: "AUDITORIA",
      entidade: "Equipe",
      entidade_id: "equipe-1",
      acao: "CRIACAO",
      usuario_id: "ator-1",
    });
  });

  it("com nome duplicado (P2002) -> ErroValidacaoEquipe, sem registrar log", async () => {
    mockUserFindUnique.mockResolvedValueOnce(gestorFake());
    mockCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed on the fields: (`nome`)",
        { code: "P2002", clientVersion: "test", meta: { target: ["nome"] } },
      ),
    );

    const erro = await criar(DADOS_VALIDOS, "ator-1").catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroValidacaoEquipe);
    expect((erro as Error).message).toMatch(/ja existe uma equipe/i);
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it("com gestor_id inexistente -> ErroValidacaoEquipe, nao chama create", async () => {
    mockUserFindUnique.mockResolvedValueOnce(null);

    const erro = await criar(DADOS_VALIDOS, "ator-1").catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroValidacaoEquipe);
    expect((erro as Error).message).toMatch(/nao corresponde a nenhum usuario/i);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it("com gestor_id de usuario role != GESTOR -> ErroValidacaoEquipe, nao chama create", async () => {
    mockUserFindUnique.mockResolvedValueOnce(gestorFake({ role: Role.SOLICITANTE }));

    const erro = await criar(DADOS_VALIDOS, "ator-1").catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroValidacaoEquipe);
    expect((erro as Error).message).toMatch(/role GESTOR/i);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it("com gestor_id de GESTOR inativo -> ErroValidacaoEquipe, nao chama create", async () => {
    mockUserFindUnique.mockResolvedValueOnce(gestorFake({ ativo: false }));

    const erro = await criar(DADOS_VALIDOS, "ator-1").catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroValidacaoEquipe);
    expect((erro as Error).message).toMatch(/inativo/i);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockRegistrar).not.toHaveBeenCalled();
  });
});

describe("equipeService.editar", () => {
  it("com gestor_id valido -> atualiza e grava AUDITORIA/EDICAO", async () => {
    mockUserFindUnique.mockResolvedValueOnce(gestorFake());
    mockUpdate.mockResolvedValueOnce(equipeFake());

    const resultado = await editar("equipe-1", DADOS_VALIDOS, "ator-1");

    expect(resultado).toEqual(equipeFake());
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "equipe-1" },
      data: { nome: DADOS_VALIDOS.nome, gestor_id: DADOS_VALIDOS.gestor_id },
    });
    expect(mockRegistrar).toHaveBeenCalledWith({
      tipo: "AUDITORIA",
      entidade: "Equipe",
      entidade_id: "equipe-1",
      acao: "EDICAO",
      usuario_id: "ator-1",
    });
  });

  it("com id inexistente (P2025) -> ErroNaoEncontradoEquipe", async () => {
    mockUserFindUnique.mockResolvedValueOnce(gestorFake());
    mockUpdate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError(
        "An operation failed because it depends on one or more records that were required but not found.",
        { code: "P2025", clientVersion: "test" },
      ),
    );

    const erro = await editar("equipe-inexistente", DADOS_VALIDOS, "ator-1").catch(
      (e: unknown) => e,
    );

    expect(erro).toBeInstanceOf(ErroNaoEncontradoEquipe);
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it("com nome duplicado (P2002) -> ErroValidacaoEquipe", async () => {
    mockUserFindUnique.mockResolvedValueOnce(gestorFake());
    mockUpdate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed on the fields: (`nome`)",
        { code: "P2002", clientVersion: "test", meta: { target: ["nome"] } },
      ),
    );

    const erro = await editar("equipe-1", DADOS_VALIDOS, "ator-1").catch(
      (e: unknown) => e,
    );

    expect(erro).toBeInstanceOf(ErroValidacaoEquipe);
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it("com gestor_id invalido -> ErroValidacaoEquipe, nao chama update", async () => {
    mockUserFindUnique.mockResolvedValueOnce(null);

    const erro = await editar("equipe-1", DADOS_VALIDOS, "ator-1").catch(
      (e: unknown) => e,
    );

    expect(erro).toBeInstanceOf(ErroValidacaoEquipe);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockRegistrar).not.toHaveBeenCalled();
  });
});

describe("equipeService.definirStatus", () => {
  it("id inexistente -> ErroNaoEncontradoEquipe, nao chama update", async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    const erro = await definirStatus("equipe-x", false, "ator-1").catch(
      (e: unknown) => e,
    );

    expect(erro).toBeInstanceOf(ErroNaoEncontradoEquipe);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it("desativar com >=1 membro ativo -> ErroEdicaoBloqueadaEquipe, nao chama update", async () => {
    mockFindUnique.mockResolvedValueOnce(equipeFake());
    mockUserCount.mockResolvedValueOnce(2);

    const erro = await definirStatus("equipe-1", false, "ator-1").catch(
      (e: unknown) => e,
    );

    expect(erro).toBeInstanceOf(ErroEdicaoBloqueadaEquipe);
    expect((erro as Error).message).toMatch(/2/);
    expect(mockUserCount).toHaveBeenCalledWith({
      where: { equipe_id: "equipe-1", ativo: true },
    });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it("desativar sem membro ativo -> atualiza e grava AUDITORIA/DESATIVACAO", async () => {
    mockFindUnique.mockResolvedValueOnce(equipeFake());
    mockUserCount.mockResolvedValueOnce(0);
    mockUpdate.mockResolvedValueOnce(equipeFake({ ativo: false }));

    const resultado = await definirStatus("equipe-1", false, "ator-1");

    expect(resultado.ativo).toBe(false);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "equipe-1" },
      data: { ativo: false },
    });
    expect(mockRegistrar).toHaveBeenCalledWith({
      tipo: "AUDITORIA",
      entidade: "Equipe",
      entidade_id: "equipe-1",
      acao: "DESATIVACAO",
      usuario_id: "ator-1",
    });
  });

  it("reativar -> sempre permitido, nao consulta membros, grava AUDITORIA/REATIVACAO", async () => {
    mockFindUnique.mockResolvedValueOnce(equipeFake({ ativo: false }));
    mockUpdate.mockResolvedValueOnce(equipeFake({ ativo: true }));

    const resultado = await definirStatus("equipe-1", true, "ator-1");

    expect(resultado.ativo).toBe(true);
    expect(mockUserCount).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "equipe-1" },
      data: { ativo: true },
    });
    expect(mockRegistrar).toHaveBeenCalledWith({
      tipo: "AUDITORIA",
      entidade: "Equipe",
      entidade_id: "equipe-1",
      acao: "REATIVACAO",
      usuario_id: "ator-1",
    });
  });
});

describe("equipeService.listar", () => {
  it("retorna nome do gestor e contagem de membros ativos por equipe", async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: "equipe-1",
        nome: "Vendas",
        gestor_id: "gestor-1",
        gestor: { nome: "Gestor Um" },
        ativo: true,
      },
      {
        id: "equipe-2",
        nome: "Suporte",
        gestor_id: "gestor-2",
        gestor: { nome: "Gestor Dois" },
        ativo: true,
      },
    ] as never);
    mockUserGroupBy.mockResolvedValueOnce([
      { equipe_id: "equipe-1", _count: { _all: 3 } },
    ] as never);

    const resultado = await listar();

    expect(resultado).toEqual([
      {
        id: "equipe-1",
        nome: "Vendas",
        gestor_id: "gestor-1",
        gestor_nome: "Gestor Um",
        membros_ativos: 3,
        ativo: true,
      },
      {
        id: "equipe-2",
        nome: "Suporte",
        gestor_id: "gestor-2",
        gestor_nome: "Gestor Dois",
        membros_ativos: 0,
        ativo: true,
      },
    ]);
  });
});

describe("equipeService.buscarPorId", () => {
  it("lanca ErroNaoEncontradoEquipe quando findUnique retorna null", async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    await expect(buscarPorId("equipe-x")).rejects.toBeInstanceOf(
      ErroNaoEncontradoEquipe,
    );
  });

  it("retorna o registro completo quando encontrado", async () => {
    mockFindUnique.mockResolvedValueOnce(equipeFake());

    await expect(buscarPorId("equipe-1")).resolves.toEqual(equipeFake());
  });
});

describe("equipeService.listarAtivasParaSelecao", () => {
  it("filtra por ativo=true", async () => {
    const lista = [{ id: "equipe-1", nome: "Vendas" }];
    mockFindMany.mockResolvedValueOnce(lista as never);

    await expect(listarAtivasParaSelecao()).resolves.toEqual(lista);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    });
  });
});

describe("equipeService.listarGeridasPor", () => {
  it("filtra por gestor_id e ativo=true", async () => {
    const lista = [{ id: "equipe-1", nome: "Vendas" }];
    mockFindMany.mockResolvedValueOnce(lista as never);

    await expect(listarGeridasPor("gestor-1")).resolves.toEqual(lista);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { gestor_id: "gestor-1", ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    });
  });
});

describe("equipeService.contarGeridasAtivasPor", () => {
  it("retorna 0 quando nao gerencia nenhuma equipe ativa", async () => {
    mockCount.mockResolvedValueOnce(0);

    await expect(contarGeridasAtivasPor("gestor-1")).resolves.toBe(0);
    expect(mockCount).toHaveBeenCalledWith({
      where: { gestor_id: "gestor-1", ativo: true },
    });
  });

  it("retorna N quando gerencia N equipes ativas", async () => {
    mockCount.mockResolvedValueOnce(3);

    await expect(contarGeridasAtivasPor("gestor-1")).resolves.toBe(3);
  });
});
