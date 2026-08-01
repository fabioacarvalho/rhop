import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

// Mock do SDK OpenAI — unit test isolado, nunca deve bater na API real.
vi.mock("openai", () => ({
  default: class {
    embeddings = {
      create: mockCreate,
    };
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $executeRaw: vi.fn(),
    candidato: {
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/services/logService", () => ({
  registrar: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { registrar } from "@/lib/services/logService";
import { gerar, marcarFalha, persistirEmbedding } from "./embeddingService";

const mockExecuteRaw = vi.mocked(prisma.$executeRaw);
const mockUpdate = vi.mocked(prisma.candidato.update);
const mockRegistrar = vi.mocked(registrar);

const originalApiKey = process.env.OPENAI_API_KEY;

beforeEach(() => {
  mockCreate.mockReset();
  mockExecuteRaw.mockReset();
  mockUpdate.mockReset();
  mockRegistrar.mockReset();
  mockRegistrar.mockResolvedValue(undefined);
  process.env.OPENAI_API_KEY = "test-key";
});

afterEach(() => {
  if (originalApiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalApiKey;
  }
});

describe("embeddingService.gerar", () => {
  it("sucesso -> retorna o vetor de embedding", async () => {
    mockCreate.mockResolvedValueOnce({
      data: [{ embedding: [0.1, 0.2, 0.3] }],
    });

    const result = await gerar("texto do candidato");

    expect(result).toEqual([0.1, 0.2, 0.3]);
    expect(mockRegistrar).not.toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledWith({
      model: "text-embedding-3-small",
      input: "texto do candidato",
    });
  });

  it("OPENAI_API_KEY ausente -> null + registrar ERRO sem chamar OpenAI", async () => {
    delete process.env.OPENAI_API_KEY;

    const result = await gerar("texto");

    expect(result).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockRegistrar).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "ERRO",
        entidade: "Candidato",
        acao: "FALHA_IA",
        detalhes: { motivo: "OPENAI_API_KEY ausente" },
      }),
    );
  });

  it("erro da API -> null + registrar ERRO", async () => {
    mockCreate.mockRejectedValueOnce(new Error("rate limit"));

    const result = await gerar("texto");

    expect(result).toBeNull();
    expect(mockRegistrar).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "ERRO",
        acao: "FALHA_IA",
        detalhes: { motivo: "rate limit" },
      }),
    );
  });

  it("embedding vazio -> null + registrar ERRO", async () => {
    mockCreate.mockResolvedValueOnce({ data: [{ embedding: [] }] });

    const result = await gerar("texto");

    expect(result).toBeNull();
    expect(mockRegistrar).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "ERRO",
        acao: "FALHA_IA",
        detalhes: { motivo: "embedding vazio da OpenAI" },
      }),
    );
  });
});

describe("embeddingService.persistirEmbedding", () => {
  it("formata o vetor como literal e chama $executeRaw com o cast ::vector", async () => {
    await persistirEmbedding("cand-1", [0.1, 0.2, 0.3]);

    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
    const chamada = mockExecuteRaw.mock.calls[0];
    const [strings, ...valores] = chamada as unknown as [
      TemplateStringsArray,
      ...unknown[],
    ];
    expect(strings.join("")).toContain("::vector");
    expect(strings.join("")).toContain("status_embedding = 'processado'");
    expect(valores).toContain("[0.1,0.2,0.3]");
    expect(valores).toContain("cand-1");
  });
});

describe("embeddingService.marcarFalha", () => {
  it("atualiza status_embedding para 'falhou'", async () => {
    await marcarFalha("cand-1");

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "cand-1" },
      data: { status_embedding: "falhou" },
    });
  });
});
