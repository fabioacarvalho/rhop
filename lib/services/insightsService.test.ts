import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    solicitacao: {
      groupBy: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/services/tipoFluxoService", () => ({
  buscarPorId: vi.fn(),
  ErroNaoEncontrado: class ErroNaoEncontrado extends Error {},
}));

vi.mock("@/lib/services/iaService", () => ({
  gerarResumoInsights: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import {
  buscarPorId,
  ErroNaoEncontrado,
} from "@/lib/services/tipoFluxoService";
import { gerarResumoInsights } from "@/lib/services/iaService";
import { Role } from "@/lib/generated/prisma/client";
import type { AuthenticatedUser } from "@/lib/services/authService";
import type { InsightsFiltro } from "@/lib/validations/insight";
import {
  agregar,
  periodoParaIntervalo,
  resolverIdsVisiveis,
} from "./insightsService";

const mockGroupBy = vi.mocked(prisma.solicitacao.groupBy);
const mockUserFindMany = vi.mocked(prisma.user.findMany);
const mockQueryRaw = vi.mocked(prisma.$queryRaw);
const mockBuscarPorId = vi.mocked(buscarPorId);
const mockGerarResumoInsights = vi.mocked(gerarResumoInsights);

const RH: AuthenticatedUser = {
  id: "rh-1",
  nome: "RH Admin",
  email: "rh@ex.com",
  role: Role.RH_ADMIN,
  gestor_id: null,
};

const GESTOR: AuthenticatedUser = {
  id: "gestor-1",
  nome: "Marina",
  email: "marina@ex.com",
  role: Role.GESTOR,
  gestor_id: null,
};

const TIPO_FLUXO = {
  id: "tipo-1",
  nome: "Reembolso",
  campos_formulario: {},
  etapas: ["GESTOR"],
  criado_em: new Date(),
  atualizado_em: new Date(),
};

const filtroBase: InsightsFiltro = {
  tipoFluxoId: "tipo-1",
  periodo: "ULTIMOS_30_DIAS",
  dimensao: "STATUS",
};

beforeEach(() => {
  mockGroupBy.mockReset();
  mockUserFindMany.mockReset();
  mockQueryRaw.mockReset();
  mockBuscarPorId.mockReset();
  mockGerarResumoInsights.mockReset();
  mockBuscarPorId.mockResolvedValue(TIPO_FLUXO as never);
});

describe("periodoParaIntervalo", () => {
  it("ULTIMOS_30_DIAS -> janela de 30 dias até agora", () => {
    const agora = new Date("2026-07-31T12:00:00Z");
    const { inicio, fim } = periodoParaIntervalo("ULTIMOS_30_DIAS", agora);

    expect(fim).toEqual(agora);
    expect(inicio.getTime()).toBe(agora.getTime() - 30 * 24 * 60 * 60 * 1000);
  });

  it("ANO_ATUAL -> 1º de janeiro do ano de `agora` até `agora`", () => {
    const agora = new Date("2026-07-31T12:00:00Z");
    const { inicio, fim } = periodoParaIntervalo("ANO_ATUAL", agora);

    expect(fim).toEqual(agora);
    expect(inicio).toEqual(new Date(2026, 0, 1));
  });
});

describe("resolverIdsVisiveis", () => {
  it("RH_ADMIN -> null (global)", async () => {
    const resultado = await resolverIdsVisiveis(RH);
    expect(resultado).toBeNull();
    expect(mockUserFindMany).not.toHaveBeenCalled();
  });

  it("GESTOR com equipe -> [proprio, ...equipe]", async () => {
    mockUserFindMany.mockResolvedValueOnce([
      { id: "sub-1" },
      { id: "sub-2" },
    ] as never);

    const resultado = await resolverIdsVisiveis(GESTOR);

    expect(resultado).toEqual(["gestor-1", "sub-1", "sub-2"]);
    expect(mockUserFindMany).toHaveBeenCalledWith({
      where: { gestor_id: "gestor-1" },
      select: { id: true },
    });
  });

  it("GESTOR sem subordinados -> [proprio]", async () => {
    mockUserFindMany.mockResolvedValueOnce([] as never);

    const resultado = await resolverIdsVisiveis(GESTOR);

    expect(resultado).toEqual(["gestor-1"]);
  });
});

describe("agregar", () => {
  it("tipoFluxoId inexistente -> propaga ErroNaoEncontrado sem agregar", async () => {
    mockBuscarPorId.mockRejectedValueOnce(new ErroNaoEncontrado());

    await expect(agregar(RH, filtroBase)).rejects.toBeInstanceOf(
      ErroNaoEncontrado,
    );
    expect(mockGroupBy).not.toHaveBeenCalled();
    expect(mockGerarResumoInsights).not.toHaveBeenCalled();
  });

  it("RH_ADMIN vê global -> where sem solicitante_id", async () => {
    mockGroupBy.mockResolvedValueOnce([
      { status: "APROVADA", _count: { _all: 3 } },
    ] as never);
    mockGerarResumoInsights.mockResolvedValueOnce("Resumo coerente.");

    const resultado = await agregar(RH, filtroBase);

    expect(resultado.total).toBe(3);
    expect(resultado.itens).toEqual([{ chave: "APROVADA", quantidade: 3 }]);
    expect(resultado.resumo_ia).toBe("Resumo coerente.");
    const where = mockGroupBy.mock.calls[0][0].where as Record<
      string,
      unknown
    >;
    expect(where.solicitante_id).toBeUndefined();
  });

  it("GESTOR só equipe -> where com solicitante_id in [...]", async () => {
    mockUserFindMany.mockResolvedValueOnce([{ id: "sub-1" }] as never);
    mockGroupBy.mockResolvedValueOnce([] as never);

    await agregar(GESTOR, filtroBase);

    const where = mockGroupBy.mock.calls[0][0].where as Record<
      string,
      unknown
    >;
    expect(where.solicitante_id).toEqual({ in: ["gestor-1", "sub-1"] });
  });

  it("total === 0 -> itens vazio, resumo_ia null, IA não chamada", async () => {
    mockGroupBy.mockResolvedValueOnce([] as never);

    const resultado = await agregar(RH, filtroBase);

    expect(resultado.itens).toEqual([]);
    expect(resultado.total).toBe(0);
    expect(resultado.resumo_ia).toBeNull();
    expect(mockGerarResumoInsights).not.toHaveBeenCalled();
  });

  it("dimensao MES -> usa $queryRaw e mapeia itens", async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { mes: new Date("2026-06-01T00:00:00Z"), quantidade: 4n },
    ] as never);
    mockGerarResumoInsights.mockResolvedValueOnce("Tendência de alta.");

    const resultado = await agregar(RH, {
      ...filtroBase,
      dimensao: "MES",
    });

    expect(resultado.itens).toEqual([{ chave: "2026-06", quantidade: 4 }]);
    expect(resultado.total).toBe(4);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it("período vazio (MES) não chama IA", async () => {
    mockQueryRaw.mockResolvedValueOnce([] as never);

    const resultado = await agregar(RH, { ...filtroBase, dimensao: "MES" });

    expect(resultado.total).toBe(0);
    expect(resultado.resumo_ia).toBeNull();
    expect(mockGerarResumoInsights).not.toHaveBeenCalled();
  });
});
