import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    solicitacao: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/services/dashboardService", () => ({
  visibilidadeSolicitacaoWhere: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { Role, StatusSolicitacao } from "@/lib/generated/prisma/client";
import * as dashboardService from "@/lib/services/dashboardService";
import type { AuthenticatedUser } from "@/lib/services/authService";
import {
  ErroColunaInvalida,
  LIMITE_INICIAL_POR_COLUNA,
  listarBoard,
  listarColuna,
} from "./pipelineService";

const mockCount = vi.mocked(prisma.solicitacao.count);
const mockFindMany = vi.mocked(prisma.solicitacao.findMany);
const mockVisibilidade = vi.mocked(dashboardService.visibilidadeSolicitacaoWhere);

const GESTOR: AuthenticatedUser = {
  id: "gestor-1",
  nome: "Marina",
  email: "marina@ex.com",
  role: Role.GESTOR,
};

const RH: AuthenticatedUser = {
  id: "rh-1",
  nome: "RH Admin",
  email: "rh@ex.com",
  role: Role.RH_ADMIN,
};

const GESTOR_VISIBILIDADE = {
  OR: [
    { solicitante_id: GESTOR.id },
    { solicitante: { equipe_id: { in: ["equipe-1"] } } },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFindMany.mockResolvedValue([]);
  mockCount.mockResolvedValue(0);
  mockVisibilidade.mockResolvedValue({});
});

describe("listarBoard", () => {
  it("RH_ADMIN: cada coluna ativa usa visibilidade {} (todas as solicitacoes)", async () => {
    mockVisibilidade.mockResolvedValue({});

    const board = await listarBoard(RH, {});

    expect(board.colunas).toHaveLength(4);
    const colunasAtivas = board.colunas.filter((c) => c.chave !== "em_aprovacao");
    expect(colunasAtivas).toHaveLength(3);

    for (const chamada of mockFindMany.mock.calls) {
      const where = chamada[0]?.where as Record<string, unknown>;
      expect(where.OR).toBeUndefined();
    }
  });

  it("GESTOR: cada coluna ativa restringe as solicitacoes proprias + da(s) Equipe(s) geridas", async () => {
    mockVisibilidade.mockResolvedValue(GESTOR_VISIBILIDADE);

    await listarBoard(GESTOR, {});

    expect(mockFindMany).toHaveBeenCalledTimes(3);
    for (const chamada of mockFindMany.mock.calls) {
      const where = chamada[0]?.where as { OR?: unknown[] };
      expect(where.OR).toEqual(GESTOR_VISIBILIDADE.OR);
    }
    for (const chamada of mockCount.mock.calls) {
      const where = chamada[0]?.where as { OR?: unknown[] };
      expect(where.OR).toEqual(GESTOR_VISIBILIDADE.OR);
    }
  });

  it('coluna "em_aprovacao" retorna itens vazios/total 0 sem nenhuma chamada ao Prisma para ela (3 colunas ativas x findMany+count = 6 chamadas no total)', async () => {
    const board = await listarBoard(RH, {});

    const emAprovacao = board.colunas.find((c) => c.chave === "em_aprovacao");
    expect(emAprovacao).toEqual({
      chave: "em_aprovacao",
      label: "Em aprovação",
      itens: [],
      total: 0,
    });

    expect(mockFindMany).toHaveBeenCalledTimes(3);
    expect(mockCount).toHaveBeenCalledTimes(3);
    expect(mockFindMany.mock.calls.length + mockCount.mock.calls.length).toBe(6);
  });

  it("filtro.tipo_fluxo_id restringe todas as colunas ativas ao tipo informado", async () => {
    await listarBoard(RH, { tipo_fluxo_id: "tipo-1" });

    const colunasAtivasChamadas = mockFindMany.mock.calls;
    expect(colunasAtivasChamadas).toHaveLength(3);
    for (const chamada of colunasAtivasChamadas) {
      const where = chamada[0]?.where as { tipo_fluxo_id?: string };
      expect(where.tipo_fluxo_id).toBe("tipo-1");
    }
    for (const chamada of mockCount.mock.calls) {
      const where = chamada[0]?.where as { tipo_fluxo_id?: string };
      expect(where.tipo_fluxo_id).toBe("tipo-1");
    }
  });

  it('coluna "cancelado" agrupa REJEITADA e CANCELADA no mesmo filtro de status', async () => {
    await listarBoard(RH, {});

    const chamadaCancelado = mockFindMany.mock.calls.find((chamada) => {
      const where = chamada[0]?.where as { status?: { in?: StatusSolicitacao[] } };
      return where.status?.in?.includes(StatusSolicitacao.CANCELADA);
    });

    expect(chamadaCancelado).toBeDefined();
    const where = chamadaCancelado?.[0]?.where as { status?: { in?: StatusSolicitacao[] } };
    expect(where.status?.in).toEqual([
      StatusSolicitacao.REJEITADA,
      StatusSolicitacao.CANCELADA,
    ]);
  });

  it("escopo sem nenhuma solicitacao: todas as colunas retornam itens vazios e total 0, sem lancar erro", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    const board = await listarBoard(RH, {});

    expect(board.colunas).toHaveLength(4);
    for (const coluna of board.colunas) {
      expect(coluna.itens).toEqual([]);
      expect(coluna.total).toBe(0);
    }
  });

  it("mapeia os registros retornados para KanbanItem (mesma projecao de dashboardService.listar)", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "sol-1",
        tipoFluxo: { nome: "Reembolso" },
        solicitante: { nome: "Rafael" },
        status: StatusSolicitacao.PENDENTE,
        atrasada_em: new Date("2026-07-01"),
        criado_em: new Date("2026-07-30"),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    ]);
    mockCount.mockResolvedValue(1);

    const board = await listarBoard(RH, {});

    const pendente = board.colunas.find((c) => c.chave === "pendente");
    expect(pendente?.itens).toEqual([
      {
        id: "sol-1",
        tipo_fluxo_nome: "Reembolso",
        solicitante_nome: "Rafael",
        status: StatusSolicitacao.PENDENTE,
        atrasada: true,
        criado_em: new Date("2026-07-30"),
      },
    ]);
    expect(pendente?.total).toBe(1);
  });

  it("retorna as colunas na mesma ordem de KANBAN_COLUNAS_PADRAO", async () => {
    const board = await listarBoard(RH, {});

    expect(board.colunas.map((c) => c.chave)).toEqual([
      "pendente",
      "em_aprovacao",
      "aprovado",
      "cancelado",
    ]);
  });

  it("cada item ativo respeita LIMITE_INICIAL_POR_COLUNA via take", async () => {
    await listarBoard(RH, {});

    for (const chamada of mockFindMany.mock.calls) {
      expect(chamada[0]?.take).toBe(LIMITE_INICIAL_POR_COLUNA);
    }
  });
});

describe("listarColuna", () => {
  it("pagina corretamente uma coluna especifica (page/pageSize -> skip/take)", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await listarColuna(RH, "pendente", { page: 3, pageSize: 5 });

    const args = mockFindMany.mock.calls[0][0];
    expect(args?.skip).toBe(10);
    expect(args?.take).toBe(5);
  });

  it("usa page=1/pageSize=10 como padrao quando nao informados", async () => {
    await listarColuna(RH, "pendente", {});

    const args = mockFindMany.mock.calls[0][0];
    expect(args?.skip).toBe(0);
    expect(args?.take).toBe(10);
  });

  it("com chave invalida lanca ErroColunaInvalida sem chamar o Prisma", async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      listarColuna(RH, "inexistente" as any, {}),
    ).rejects.toThrow(ErroColunaInvalida);

    expect(mockFindMany).not.toHaveBeenCalled();
    expect(mockCount).not.toHaveBeenCalled();
  });

  it("aplica a visibilidade do usuario e o filtro de tipo_fluxo_id na coluna paginada", async () => {
    mockVisibilidade.mockResolvedValue(GESTOR_VISIBILIDADE);

    await listarColuna(GESTOR, "aprovado", { tipo_fluxo_id: "tipo-9" });

    const where = mockFindMany.mock.calls[0][0]?.where as {
      OR?: unknown[];
      tipo_fluxo_id?: string;
    };
    expect(where.OR).toEqual(GESTOR_VISIBILIDADE.OR);
    expect(where.tipo_fluxo_id).toBe("tipo-9");
  });
});
