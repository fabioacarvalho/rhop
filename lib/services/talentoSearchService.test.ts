import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    candidato: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/services/embeddingService", () => ({
  gerar: vi.fn(),
  formatarVetorLiteral: vi.fn((vetor: number[]) => `[${vetor.join(",")}]`),
}));

vi.mock("@/lib/services/iaService", () => ({
  gerarJustificativaRanking: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import * as embeddingService from "@/lib/services/embeddingService";
import { gerarJustificativaRanking } from "@/lib/services/iaService";
import {
  ErroBuscaIndisponivel,
  ErroNInvalido,
  N_MAXIMO_PADRAO,
  buscar,
} from "./talentoSearchService";

const mockQueryRaw = vi.mocked(prisma.$queryRaw);
const mockFindMany = vi.mocked(prisma.candidato.findMany);
const mockGerar = vi.mocked(embeddingService.gerar);
const mockGerarJustificativa = vi.mocked(gerarJustificativaRanking);

const originalTeto = process.env.TALENTO_BUSCA_N_MAXIMO;

beforeEach(() => {
  mockQueryRaw.mockReset();
  mockFindMany.mockReset();
  mockFindMany.mockResolvedValue([] as never);
  mockGerar.mockReset();
  mockGerarJustificativa.mockReset();
  delete process.env.TALENTO_BUSCA_N_MAXIMO;
});

afterEach(() => {
  if (originalTeto === undefined) {
    delete process.env.TALENTO_BUSCA_N_MAXIMO;
  } else {
    process.env.TALENTO_BUSCA_N_MAXIMO = originalTeto;
  }
});

const CANDIDATO_BRUTO = {
  id: "cand-1",
  nome: "Marina Costa",
  email: "marina@empresa.com",
  solicitacao_id: null,
  curriculo_texto: "Engenheira de dados.",
  parecer_tecnico: "Entrevista solida.",
  score: 0.87,
};

describe("talentoSearchService.buscar", () => {
  it("n invalido (zero) -> ErroNInvalido, sem gerar embedding", async () => {
    await expect(buscar("perfil", 0)).rejects.toThrow(ErroNInvalido);
    expect(mockGerar).not.toHaveBeenCalled();
  });

  it("n invalido (negativo) -> ErroNInvalido", async () => {
    await expect(buscar("perfil", -5)).rejects.toThrow(ErroNInvalido);
  });

  it("n acima do teto (fallback 100) -> ErroNInvalido", async () => {
    await expect(buscar("perfil", 101)).rejects.toThrow(ErroNInvalido);
    expect(mockGerar).not.toHaveBeenCalled();
  });

  it("embedding da query falha -> ErroBuscaIndisponivel", async () => {
    mockGerar.mockResolvedValueOnce(null);

    await expect(buscar("perfil", 10)).rejects.toThrow(ErroBuscaIndisponivel);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it("nenhum candidato processado -> disponivel false, sem lancar", async () => {
    mockGerar.mockResolvedValueOnce([0.1, 0.2]);
    mockQueryRaw.mockResolvedValueOnce([]);

    const resultado = await buscar("perfil", 10);

    expect(resultado).toEqual({ candidatos: [], disponivel: false });
    expect(mockGerarJustificativa).not.toHaveBeenCalled();
  });

  it("ranking feliz -> retorna candidatos com score, justificativa e tags", async () => {
    mockGerar.mockResolvedValueOnce([0.1, 0.2]);
    mockQueryRaw.mockResolvedValueOnce([CANDIDATO_BRUTO]);
    mockFindMany.mockResolvedValueOnce([
      { id: "cand-1", tags: [{ id: "tag-1", nome: "Sênior" }] },
    ] as never);
    mockGerarJustificativa.mockResolvedValueOnce("Forte aderencia ao perfil.");

    const resultado = await buscar("engenheiro de dados", 10);

    expect(resultado.disponivel).toBe(true);
    expect(resultado.candidatos).toEqual([
      {
        id: "cand-1",
        nome: "Marina Costa",
        email: "marina@empresa.com",
        solicitacao_id: null,
        score: 0.87,
        justificativa: "Forte aderencia ao perfil.",
        tags: [{ id: "tag-1", nome: "Sênior" }],
      },
    ]);
  });

  it("candidato sem tags vinculadas -> tags vem como array vazio", async () => {
    mockGerar.mockResolvedValueOnce([0.1, 0.2]);
    mockQueryRaw.mockResolvedValueOnce([CANDIDATO_BRUTO]);
    mockFindMany.mockResolvedValueOnce([
      { id: "cand-1", tags: [] },
    ] as never);
    mockGerarJustificativa.mockResolvedValueOnce("Forte aderencia ao perfil.");

    const resultado = await buscar("engenheiro de dados", 10);

    expect(resultado.candidatos[0].tags).toEqual([]);
  });

  it("justificativa falha isolada em um item -> nao interrompe os demais", async () => {
    const segundo = { ...CANDIDATO_BRUTO, id: "cand-2", nome: "Joao Prado" };
    mockGerar.mockResolvedValueOnce([0.1, 0.2]);
    mockQueryRaw.mockResolvedValueOnce([CANDIDATO_BRUTO, segundo]);
    mockGerarJustificativa
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("Boa aderencia.");

    const resultado = await buscar("engenheiro de dados", 10);

    expect(resultado.candidatos).toHaveLength(2);
    expect(resultado.candidatos[0].justificativa).toBeNull();
    expect(resultado.candidatos[1].justificativa).toBe("Boa aderencia.");
  });

  it("teto configuravel via TALENTO_BUSCA_N_MAXIMO", async () => {
    process.env.TALENTO_BUSCA_N_MAXIMO = "5";

    await expect(buscar("perfil", 6)).rejects.toThrow(/entre 1 e 5/);
  });

  it("teto cai para o fallback 100 quando env invalida", async () => {
    process.env.TALENTO_BUSCA_N_MAXIMO = "abc";

    await expect(buscar("perfil", 101)).rejects.toThrow(
      new RegExp(`entre 1 e ${N_MAXIMO_PADRAO}`),
    );
  });
});
