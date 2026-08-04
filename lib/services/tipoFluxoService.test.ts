import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock de `@/lib/prisma` e `@/lib/services/logService` — unit test isolado,
// nunca deve bater no banco real (mesmo padrão de logService.test.ts /
// userService.test.ts / authService.test.ts).
vi.mock("@/lib/prisma", () => ({
  prisma: {
    tipoFluxo: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    solicitacao: {
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/services/logService", () => ({
  registrar: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { registrar } from "@/lib/services/logService";
import { Prisma } from "@/lib/generated/prisma/client";
import {
  ErroEdicaoBloqueada,
  ErroNaoEncontrado,
  ErroValidacaoTipoFluxo,
  buscarPorId,
  criar,
  editar,
  listar,
  type TipoFluxoDetalhe,
} from "./tipoFluxoService";
import type { TipoFluxoInput } from "@/lib/validations/tipoFluxo";

const mockFindMany = vi.mocked(prisma.tipoFluxo.findMany);
const mockFindUnique = vi.mocked(prisma.tipoFluxo.findUnique);
const mockCreate = vi.mocked(prisma.tipoFluxo.create);
const mockUpdate = vi.mocked(prisma.tipoFluxo.update);
const mockCount = vi.mocked(prisma.solicitacao.count);
const mockRegistrar = vi.mocked(registrar);

beforeEach(() => {
  mockFindMany.mockReset();
  mockFindUnique.mockReset();
  mockCreate.mockReset();
  mockUpdate.mockReset();
  mockCount.mockReset();
  mockRegistrar.mockReset();
});

const DADOS_VALIDOS: TipoFluxoInput = {
  nome: "Solicitacao de Ferias",
  campos_formulario: [
    { chave: "data_inicio", rotulo: "Data de inicio", tipo: "data", obrigatorio: true },
  ],
  etapas: ["GESTOR", "RH_ADMIN"],
  categoria: "PADRAO",
  habilitado_solicitante: true,
};

const TIPO_FLUXO_CRIADO: TipoFluxoDetalhe = {
  id: "tipo-1",
  nome: DADOS_VALIDOS.nome,
  campos_formulario: DADOS_VALIDOS.campos_formulario,
  etapas: DADOS_VALIDOS.etapas,
  categoria: DADOS_VALIDOS.categoria,
  habilitado_solicitante: DADOS_VALIDOS.habilitado_solicitante,
  criado_em: new Date("2026-01-01T00:00:00.000Z"),
  atualizado_em: new Date("2026-01-01T00:00:00.000Z"),
} as unknown as TipoFluxoDetalhe;

describe("tipoFluxoService.listar", () => {
  it("retorna a lista de TipoFluxo mockada (id + nome)", async () => {
    const lista = [
      { id: "tipo-1", nome: "Ferias" },
      { id: "tipo-2", nome: "Reembolso" },
    ];
    mockFindMany.mockResolvedValueOnce(lista as never);

    await expect(listar()).resolves.toEqual(lista);
    expect(mockFindMany).toHaveBeenCalledTimes(1);
  });
});

describe("tipoFluxoService.buscarPorId", () => {
  it("lanca ErroNaoEncontrado quando findUnique retorna null", async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    await expect(buscarPorId("tipo-inexistente")).rejects.toBeInstanceOf(
      ErroNaoEncontrado,
    );
  });

  it("retorna o registro completo quando encontrado", async () => {
    mockFindUnique.mockResolvedValueOnce(TIPO_FLUXO_CRIADO as never);

    await expect(buscarPorId("tipo-1")).resolves.toEqual(TIPO_FLUXO_CRIADO);
  });
});

describe("tipoFluxoService.criar", () => {
  it("persiste e chama logService.registrar com tipo AUDITORIA / acao CRIACAO", async () => {
    mockCreate.mockResolvedValueOnce(TIPO_FLUXO_CRIADO as never);

    const resultado = await criar(DADOS_VALIDOS, "user-1");

    expect(resultado).toEqual(TIPO_FLUXO_CRIADO);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        nome: DADOS_VALIDOS.nome,
        campos_formulario: DADOS_VALIDOS.campos_formulario,
        etapas: DADOS_VALIDOS.etapas,
        categoria: DADOS_VALIDOS.categoria,
        habilitado_solicitante: DADOS_VALIDOS.habilitado_solicitante,
      },
    });
    expect(mockRegistrar).toHaveBeenCalledTimes(1);
    expect(mockRegistrar).toHaveBeenCalledWith({
      tipo: "AUDITORIA",
      entidade: "TipoFluxo",
      entidade_id: TIPO_FLUXO_CRIADO.id,
      acao: "CRIACAO",
      usuario_id: "user-1",
    });
  });

  it("persiste 'categoria: FERIAS' quando informado", async () => {
    const dadosFerias: TipoFluxoInput = { ...DADOS_VALIDOS, categoria: "FERIAS" };
    mockCreate.mockResolvedValueOnce({
      ...TIPO_FLUXO_CRIADO,
      categoria: "FERIAS",
    } as never);

    await criar(dadosFerias, "user-1");

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        nome: dadosFerias.nome,
        campos_formulario: dadosFerias.campos_formulario,
        etapas: dadosFerias.etapas,
        categoria: "FERIAS",
        habilitado_solicitante: dadosFerias.habilitado_solicitante,
      },
    });
  });

  it("traduz nome duplicado (P2002) para ErroValidacaoTipoFluxo legivel", async () => {
    mockCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed on the fields: (`nome`)",
        {
          code: "P2002",
          clientVersion: "test",
          meta: { target: ["nome"] },
        },
      ),
    );

    const erro = await criar(DADOS_VALIDOS, "user-1").catch(
      (error: unknown) => error,
    );

    expect(erro).toBeInstanceOf(ErroValidacaoTipoFluxo);
    expect((erro as Error).message).toMatch(/ja existe um tipo de fluxo/i);
    expect(mockRegistrar).not.toHaveBeenCalled();
  });
});

describe("tipoFluxoService.editar", () => {
  it("com Solicitacao PENDENTE vinculada -> lanca ErroEdicaoBloqueada e nao chama update/logService", async () => {
    mockCount.mockResolvedValueOnce(3);

    const erro = await editar("tipo-1", DADOS_VALIDOS, "user-1").catch(
      (error: unknown) => error,
    );

    expect(erro).toBeInstanceOf(ErroEdicaoBloqueada);
    expect((erro as Error).message).toMatch(/3/);
    expect(mockCount).toHaveBeenCalledWith({
      where: { tipo_fluxo_id: "tipo-1", status: "PENDENTE" },
    });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it("sem pendencias -> atualiza e chama logService.registrar com acao EDICAO", async () => {
    mockCount.mockResolvedValueOnce(0);
    mockUpdate.mockResolvedValueOnce(TIPO_FLUXO_CRIADO as never);

    const resultado = await editar("tipo-1", DADOS_VALIDOS, "user-1");

    expect(resultado).toEqual(TIPO_FLUXO_CRIADO);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "tipo-1" },
      data: {
        nome: DADOS_VALIDOS.nome,
        campos_formulario: DADOS_VALIDOS.campos_formulario,
        etapas: DADOS_VALIDOS.etapas,
        categoria: DADOS_VALIDOS.categoria,
        habilitado_solicitante: DADOS_VALIDOS.habilitado_solicitante,
      },
    });
    expect(mockRegistrar).toHaveBeenCalledTimes(1);
    expect(mockRegistrar).toHaveBeenCalledWith({
      tipo: "AUDITORIA",
      entidade: "TipoFluxo",
      entidade_id: TIPO_FLUXO_CRIADO.id,
      acao: "EDICAO",
      usuario_id: "user-1",
    });
  });

  it("persiste 'categoria: FERIAS' no editar quando informado", async () => {
    mockCount.mockResolvedValueOnce(0);
    const dadosFerias: TipoFluxoInput = { ...DADOS_VALIDOS, categoria: "FERIAS" };
    mockUpdate.mockResolvedValueOnce({
      ...TIPO_FLUXO_CRIADO,
      categoria: "FERIAS",
    } as never);

    await editar("tipo-1", dadosFerias, "user-1");

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "tipo-1" },
      data: {
        nome: dadosFerias.nome,
        campos_formulario: dadosFerias.campos_formulario,
        etapas: dadosFerias.etapas,
        categoria: "FERIAS",
        habilitado_solicitante: dadosFerias.habilitado_solicitante,
      },
    });
  });

  it("com id inexistente -> lanca ErroNaoEncontrado", async () => {
    mockCount.mockResolvedValueOnce(0);
    mockUpdate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError(
        "An operation failed because it depends on one or more records that were required but not found.",
        {
          code: "P2025",
          clientVersion: "test",
        },
      ),
    );

    const erro = await editar("tipo-inexistente", DADOS_VALIDOS, "user-1").catch(
      (error: unknown) => error,
    );

    expect(erro).toBeInstanceOf(ErroNaoEncontrado);
    expect(mockRegistrar).not.toHaveBeenCalled();
  });
});
