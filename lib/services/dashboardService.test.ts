import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    solicitacao: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { Role, StatusSolicitacao } from "@/lib/generated/prisma/client";
import type { AuthenticatedUser } from "@/lib/services/authService";
import {
  contarPorStatus,
  listar,
  listarSolicitantesVisiveis,
} from "./dashboardService";

const mockCount = vi.mocked(prisma.solicitacao.count);
const mockFindMany = vi.mocked(prisma.solicitacao.findMany);
const mockUserFindMany = vi.mocked(prisma.user.findMany);

const GESTOR: AuthenticatedUser = {
  id: "gestor-1",
  nome: "Marina",
  email: "marina@ex.com",
  role: Role.GESTOR,
  gestor_id: null,
};

const RH: AuthenticatedUser = {
  id: "rh-1",
  nome: "RH Admin",
  email: "rh@ex.com",
  role: Role.RH_ADMIN,
  gestor_id: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("contarPorStatus", () => {
  it("RH_ADMIN conta todas as solicitacoes (sem filtro de visibilidade)", async () => {
    mockCount.mockResolvedValue(3);

    await contarPorStatus(RH);

    for (const chamada of mockCount.mock.calls) {
      const where = chamada[0]?.where as Record<string, unknown>;
      expect(where.OR).toBeUndefined();
    }
  });

  it("GESTOR conta so as proprias solicitacoes + equipe", async () => {
    mockCount.mockResolvedValue(1);

    await contarPorStatus(GESTOR);

    for (const chamada of mockCount.mock.calls) {
      const where = chamada[0]?.where as { OR?: unknown[] };
      expect(where.OR).toEqual([
        { solicitante_id: GESTOR.id },
        { solicitante: { gestor_id: GESTOR.id } },
      ]);
    }
  });

  it("sem solicitacoes no escopo, todos os 4 contadores sao 0", async () => {
    mockCount.mockResolvedValue(0);

    const resultado = await contarPorStatus(RH);

    expect(resultado).toEqual({
      pendentes: 0,
      atrasados: 0,
      aprovados: 0,
      rejeitados: 0,
    });
  });

  it("solicitacao atrasada conta em pendentes e em atrasados (aditivo, nao exclusivo)", async () => {
    mockCount.mockResolvedValue(1);

    await contarPorStatus(RH);

    const wherePendentes = mockCount.mock.calls[0][0]?.where as Record<
      string,
      unknown
    >;
    const whereAtrasados = mockCount.mock.calls[1][0]?.where as Record<
      string,
      unknown
    >;

    expect(wherePendentes.status).toBe(StatusSolicitacao.PENDENTE);
    expect(whereAtrasados.atrasada_em).toEqual({ not: null });
  });

  it("consulta aprovados e rejeitados pelo StatusSolicitacao correspondente", async () => {
    mockCount.mockResolvedValue(0);

    await contarPorStatus(RH);

    const whereAprovados = mockCount.mock.calls[2][0]?.where as Record<
      string,
      unknown
    >;
    const whereRejeitados = mockCount.mock.calls[3][0]?.where as Record<
      string,
      unknown
    >;

    expect(whereAprovados.status).toBe(StatusSolicitacao.APROVADA);
    expect(whereRejeitados.status).toBe(StatusSolicitacao.REJEITADA);
  });
});

describe("listar", () => {
  function mockListaVazia() {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
  }

  it("sem filtros: orderBy criado_em desc e pageSize padrao 20", async () => {
    mockListaVazia();

    await listar(RH, {});

    const args = mockFindMany.mock.calls[0][0];
    expect(args?.orderBy).toEqual({ criado_em: "desc" });
    expect(args?.take).toBe(20);
    expect(args?.skip).toBe(0);
  });

  it("status=PENDENTE nao restringe atrasada_em (inclui as atrasadas)", async () => {
    mockListaVazia();

    await listar(RH, { status: "PENDENTE" });

    const where = mockFindMany.mock.calls[0][0]?.where as Record<
      string,
      unknown
    >;
    expect(where.status).toBe("PENDENTE");
    expect(where.atrasada_em).toBeUndefined();
  });

  it("status=ATRASADO restringe a atrasada_em != null, sem filtrar por status", async () => {
    mockListaVazia();

    await listar(RH, { status: "ATRASADO" });

    const where = mockFindMany.mock.calls[0][0]?.where as Record<
      string,
      unknown
    >;
    expect(where.atrasada_em).toEqual({ not: null });
    expect(where.status).toBeUndefined();
  });

  it("combina tipo_fluxo_id e solicitante_id via AND", async () => {
    mockListaVazia();

    await listar(RH, {
      tipo_fluxo_id: "tipo-1",
      solicitante_id: "user-9",
    });

    const where = mockFindMany.mock.calls[0][0]?.where as Record<
      string,
      unknown
    >;
    expect(where.tipo_fluxo_id).toBe("tipo-1");
    expect(where.solicitante_id).toBe("user-9");
  });

  it("GESTOR filtrando solicitante_id de outra equipe retorna lista vazia, sem lancar erro", async () => {
    mockListaVazia();

    const resultado = await listar(GESTOR, { solicitante_id: "de-outra-equipe" });

    expect(resultado).toEqual({ solicitacoes: [], total: 0 });

    const where = mockFindMany.mock.calls[0][0]?.where as {
      OR?: unknown[];
      solicitante_id?: string;
    };
    expect(where.OR).toEqual([
      { solicitante_id: GESTOR.id },
      { solicitante: { gestor_id: GESTOR.id } },
    ]);
    expect(where.solicitante_id).toBe("de-outra-equipe");
  });

  it("projeta os campos minimos exigidos (tipo, solicitante, status, atrasada, data)", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "sol-1",
        tipoFluxo: { nome: "Reembolso" },
        solicitante: { nome: "Rafael" },
        status: StatusSolicitacao.PENDENTE,
        atrasada_em: new Date("2026-07-01"),
        criado_em: new Date("2026-07-30"),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    mockCount.mockResolvedValue(1);

    const resultado = await listar(RH, {});

    expect(resultado.solicitacoes).toEqual([
      {
        id: "sol-1",
        tipo_fluxo_nome: "Reembolso",
        solicitante_nome: "Rafael",
        status: StatusSolicitacao.PENDENTE,
        atrasada: true,
        criado_em: new Date("2026-07-30"),
      },
    ]);
    expect(resultado.total).toBe(1);
  });
});

describe("listarSolicitantesVisiveis", () => {
  it("RH_ADMIN: retorna todos os User, sem filtro", async () => {
    mockUserFindMany.mockResolvedValue([]);

    await listarSolicitantesVisiveis(RH);

    const args = mockUserFindMany.mock.calls[0][0];
    expect(args?.where).toBeUndefined();
  });

  it("GESTOR: retorna ele mesmo + equipe (OR gestor_id)", async () => {
    mockUserFindMany.mockResolvedValue([]);

    await listarSolicitantesVisiveis(GESTOR);

    const where = mockUserFindMany.mock.calls[0][0]?.where as {
      OR?: unknown[];
    };
    expect(where.OR).toEqual([
      { id: GESTOR.id },
      { gestor_id: GESTOR.id },
    ]);
  });

  it("GESTOR sem equipe: retorna so ele mesmo (resultado do banco, mesma query)", async () => {
    mockUserFindMany.mockResolvedValue([{ id: GESTOR.id, nome: GESTOR.nome }]);

    const resultado = await listarSolicitantesVisiveis(GESTOR);

    expect(resultado).toEqual([{ id: GESTOR.id, nome: GESTOR.nome }]);
  });
});
