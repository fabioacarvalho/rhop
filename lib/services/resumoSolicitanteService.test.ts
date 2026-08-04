import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    solicitacao: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/services/logService", () => ({
  registrar: vi.fn(),
}));

vi.mock("@/lib/services/iaService", () => ({
  gerarResumoSolicitante: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { registrar } from "@/lib/services/logService";
import { gerarResumoSolicitante } from "@/lib/services/iaService";
import {
  extrairPeriodo,
  gerarEPersistir,
  haSobreposicao,
} from "./resumoSolicitanteService";

const mockFindUnique = vi.mocked(prisma.solicitacao.findUnique);
const mockFindMany = vi.mocked(prisma.solicitacao.findMany);
const mockUpdate = vi.mocked(prisma.solicitacao.update);
const mockRegistrar = vi.mocked(registrar);
const mockGerarResumo = vi.mocked(gerarResumoSolicitante);

beforeEach(() => {
  mockFindUnique.mockReset();
  mockFindMany.mockReset();
  mockUpdate.mockReset();
  mockRegistrar.mockReset();
  mockRegistrar.mockResolvedValue(undefined);
  mockGerarResumo.mockReset();
});

function solicitacaoBase(overrides: Record<string, unknown> = {}) {
  return {
    id: "sol-1",
    dados: { data_inicio: "2026-08-10", data_fim: "2026-08-20" },
    solicitante_id: "user-1",
    tipoFluxo: { nome: "Ferias", categoria: "FERIAS" },
    solicitante: { id: "user-1", equipe_id: "equipe-1" },
    ...overrides,
  };
}

describe("resumoSolicitanteService.extrairPeriodo", () => {
  it("FERIAS: le data_inicio/data_fim", () => {
    const periodo = extrairPeriodo("FERIAS", {
      data_inicio: "2026-08-10",
      data_fim: "2026-08-20",
    });
    expect(periodo).toEqual({
      inicio: new Date("2026-08-10"),
      fim: new Date("2026-08-20"),
    });
  });

  it("DAYOFF: le 'data' e inicio === fim", () => {
    const periodo = extrairPeriodo("DAYOFF", { data: "2026-08-15" });
    expect(periodo).toEqual({
      inicio: new Date("2026-08-15"),
      fim: new Date("2026-08-15"),
    });
  });

  it("retorna null quando campo esperado esta ausente", () => {
    expect(extrairPeriodo("FERIAS", {})).toBeNull();
    expect(extrairPeriodo("DAYOFF", {})).toBeNull();
  });

  it("retorna null quando campo esperado esta malformado", () => {
    expect(
      extrairPeriodo("FERIAS", { data_inicio: "nao-e-data", data_fim: "2026-08-20" }),
    ).toBeNull();
  });

  it("retorna null para categoria PADRAO", () => {
    expect(extrairPeriodo("PADRAO", { data: "2026-08-15" })).toBeNull();
  });
});

describe("resumoSolicitanteService.haSobreposicao", () => {
  it("cobre igualdade exata", () => {
    const a = { inicio: new Date("2026-08-10"), fim: new Date("2026-08-20") };
    expect(haSobreposicao(a, { ...a })).toBe(true);
  });

  it("cobre intersecao parcial", () => {
    const a = { inicio: new Date("2026-08-10"), fim: new Date("2026-08-20") };
    const b = { inicio: new Date("2026-08-18"), fim: new Date("2026-08-25") };
    expect(haSobreposicao(a, b)).toBe(true);
  });

  it("retorna false quando nao ha sobreposicao", () => {
    const a = { inicio: new Date("2026-08-10"), fim: new Date("2026-08-20") };
    const b = { inicio: new Date("2026-08-21"), fim: new Date("2026-08-25") };
    expect(haSobreposicao(a, b)).toBe(false);
  });
});

describe("resumoSolicitanteService.gerarEPersistir", () => {
  it("categoria PADRAO -> nao busca concorrentes, gera resumo com conflito null", async () => {
    mockFindUnique.mockResolvedValueOnce(
      solicitacaoBase({ tipoFluxo: { nome: "Reembolso", categoria: "PADRAO" } }) as never,
    );
    mockGerarResumo.mockResolvedValueOnce("Resumo sem conflito.");

    await gerarEPersistir("sol-1");

    expect(mockFindMany).not.toHaveBeenCalled();
    expect(mockGerarResumo).toHaveBeenCalledWith(
      expect.objectContaining({ conflito: null }),
    );
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "sol-1" },
      data: { resumo_ia_solicitante: "Resumo sem conflito." },
    });
  });

  it("solicitante sem equipe_id -> nao busca concorrentes, conflito null", async () => {
    mockFindUnique.mockResolvedValueOnce(
      solicitacaoBase({ solicitante: { id: "user-1", equipe_id: null } }) as never,
    );
    mockGerarResumo.mockResolvedValueOnce("Resumo sem conflito.");

    await gerarEPersistir("sol-1");

    expect(mockFindMany).not.toHaveBeenCalled();
    expect(mockGerarResumo).toHaveBeenCalledWith(
      expect.objectContaining({ conflito: null }),
    );
  });

  it("periodo proprio ausente/malformado -> nao busca concorrentes, conflito null", async () => {
    mockFindUnique.mockResolvedValueOnce(solicitacaoBase({ dados: {} }) as never);
    mockGerarResumo.mockResolvedValueOnce("Resumo sem conflito.");

    await gerarEPersistir("sol-1");

    expect(mockFindMany).not.toHaveBeenCalled();
    expect(mockGerarResumo).toHaveBeenCalledWith(
      expect.objectContaining({ conflito: null }),
    );
  });

  it("busca concorrentes filtrando status APROVADA/PENDENTE, excluindo a propria solicitacao/solicitante", async () => {
    mockFindUnique.mockResolvedValueOnce(solicitacaoBase() as never);
    mockFindMany.mockResolvedValueOnce([]);
    mockGerarResumo.mockResolvedValueOnce("Resumo sem conflito.");

    await gerarEPersistir("sol-1");

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        id: { not: "sol-1" },
        solicitante_id: { not: "user-1" },
        status: { in: ["APROVADA", "PENDENTE"] },
        tipoFluxo: { categoria: "FERIAS" },
        solicitante: { equipe_id: "equipe-1" },
      },
      select: { dados: true },
    });
  });

  it("sobreposicao encontrada -> gera resumo com conflito preenchido (periodoDescricao)", async () => {
    mockFindUnique.mockResolvedValueOnce(solicitacaoBase() as never);
    mockFindMany.mockResolvedValueOnce([
      { dados: { data_inicio: "2026-08-15", data_fim: "2026-08-25" } },
    ] as never);
    mockGerarResumo.mockResolvedValueOnce("Resumo com conflito.");

    await gerarEPersistir("sol-1");

    expect(mockGerarResumo).toHaveBeenCalledWith(
      expect.objectContaining({
        conflito: { periodoDescricao: expect.any(String) },
      }),
    );
  });

  it("sem sobreposicao entre concorrentes -> conflito null", async () => {
    mockFindUnique.mockResolvedValueOnce(solicitacaoBase() as never);
    mockFindMany.mockResolvedValueOnce([
      { dados: { data_inicio: "2026-09-01", data_fim: "2026-09-05" } },
    ] as never);
    mockGerarResumo.mockResolvedValueOnce("Resumo sem conflito.");

    await gerarEPersistir("sol-1");

    expect(mockGerarResumo).toHaveBeenCalledWith(
      expect.objectContaining({ conflito: null }),
    );
  });

  it("erro de banco ao buscar concorrentes -> Log ERRO (FALHA_CONFLITO) + segue sem conflito", async () => {
    mockFindUnique.mockResolvedValueOnce(solicitacaoBase() as never);
    mockFindMany.mockRejectedValueOnce(new Error("timeout"));
    mockGerarResumo.mockResolvedValueOnce("Resumo sem conflito.");

    await gerarEPersistir("sol-1");

    expect(mockRegistrar).toHaveBeenCalledWith({
      tipo: "ERRO",
      entidade: "Solicitacao",
      entidade_id: "sol-1",
      acao: "FALHA_CONFLITO",
      detalhes: { motivo: "timeout" },
    });
    expect(mockGerarResumo).toHaveBeenCalledWith(
      expect.objectContaining({ conflito: null }),
    );
  });

  it("erro inesperado (ex: falha ao buscar a propria Solicitacao) -> nunca lanca, grava Log ERRO", async () => {
    mockFindUnique.mockRejectedValueOnce(new Error("conexao perdida"));

    await expect(gerarEPersistir("sol-1")).resolves.toBeUndefined();

    expect(mockRegistrar).toHaveBeenCalledWith({
      tipo: "ERRO",
      entidade: "Solicitacao",
      entidade_id: "sol-1",
      acao: "FALHA_IA",
      detalhes: { motivo: "conexao perdida" },
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("Solicitacao inexistente -> nao faz nada, nao lanca", async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    await expect(gerarEPersistir("sol-inexistente")).resolves.toBeUndefined();

    expect(mockGerarResumo).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("IA retorna null -> nao persiste resumo_ia_solicitante", async () => {
    mockFindUnique.mockResolvedValueOnce(
      solicitacaoBase({ tipoFluxo: { nome: "Reembolso", categoria: "PADRAO" } }) as never,
    );
    mockGerarResumo.mockResolvedValueOnce(null);

    await gerarEPersistir("sol-1");

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
