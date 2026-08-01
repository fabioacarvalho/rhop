import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

// Mock do SDK OpenAI — unit test isolado, nunca deve bater na API real.
// Precisa ser `class`/`function` para funcionar com `new OpenAI(...)`.
vi.mock("openai", () => ({
  default: class {
    chat = {
      completions: {
        create: mockCreate,
      },
    };
  },
}));

vi.mock("@/lib/services/logService", () => ({
  registrar: vi.fn(),
}));

import { registrar } from "@/lib/services/logService";
import { Role } from "@/lib/generated/prisma/client";
import { gerarResumoInsights, gerarResumoSolicitacao } from "./iaService";

const mockRegistrar = vi.mocked(registrar);

const inputBase = {
  solicitacaoId: "sol-1",
  tipoFluxoNome: "Vaga",
  dados: { cargo: "Dev", area: "Engenharia" },
  etapa: Role.GESTOR,
};

const originalApiKey = process.env.OPENAI_API_KEY;

beforeEach(() => {
  mockCreate.mockReset();
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

describe("iaService.gerarResumoSolicitacao", () => {
  it("sucesso com conteudo nao-vazio -> retorna texto trimado e nao grava ERRO", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "  Resumo da vaga para aprovacao.  " } }],
    });

    const result = await gerarResumoSolicitacao(inputBase);

    expect(result).toBe("Resumo da vaga para aprovacao.");
    expect(mockRegistrar).not.toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o-mini",
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "system" }),
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("Vaga"),
          }),
        ]),
      }),
    );
  });

  it("falha/throw da OpenAI -> null + registrar ERRO FALHA_IA", async () => {
    mockCreate.mockRejectedValueOnce(new Error("rate limit"));

    const result = await gerarResumoSolicitacao(inputBase);

    expect(result).toBeNull();
    expect(mockRegistrar).toHaveBeenCalledTimes(1);
    expect(mockRegistrar).toHaveBeenCalledWith({
      tipo: "ERRO",
      entidade: "Aprovacao",
      entidade_id: "sol-1",
      acao: "FALHA_IA",
      detalhes: { motivo: "rate limit" },
    });
  });

  it("conteudo vazio da OpenAI -> null + registrar ERRO FALHA_IA", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "   " } }],
    });

    const result = await gerarResumoSolicitacao(inputBase);

    expect(result).toBeNull();
    expect(mockRegistrar).toHaveBeenCalledTimes(1);
    expect(mockRegistrar).toHaveBeenCalledWith({
      tipo: "ERRO",
      entidade: "Aprovacao",
      entidade_id: "sol-1",
      acao: "FALHA_IA",
      detalhes: { motivo: "conteudo vazio da OpenAI" },
    });
  });

  it("OPENAI_API_KEY ausente -> null + registrar ERRO sem chamar OpenAI", async () => {
    delete process.env.OPENAI_API_KEY;

    const result = await gerarResumoSolicitacao(inputBase);

    expect(result).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockRegistrar).toHaveBeenCalledWith({
      tipo: "ERRO",
      entidade: "Aprovacao",
      entidade_id: "sol-1",
      acao: "FALHA_IA",
      detalhes: { motivo: "OPENAI_API_KEY ausente" },
    });
  });
});

const insightsInputBase = {
  tipoFluxoNome: "Reembolso",
  periodo: "ULTIMOS_30_DIAS",
  dimensao: "STATUS",
  itens: [{ chave: "APROVADA", quantidade: 5 }],
  total: 5,
};

describe("iaService.gerarResumoInsights", () => {
  it("sucesso com conteudo nao-vazio -> retorna texto trimado e nao grava ERRO", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "  Maioria aprovada no periodo.  " } }],
    });

    const result = await gerarResumoInsights(insightsInputBase);

    expect(result).toBe("Maioria aprovada no periodo.");
    expect(mockRegistrar).not.toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o-mini",
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("Reembolso"),
          }),
        ]),
      }),
    );
  });

  it("falha/throw da OpenAI -> null + registrar ERRO FALHA_IA com entidade Insight", async () => {
    mockCreate.mockRejectedValueOnce(new Error("timeout"));

    const result = await gerarResumoInsights(insightsInputBase);

    expect(result).toBeNull();
    expect(mockRegistrar).toHaveBeenCalledTimes(1);
    expect(mockRegistrar).toHaveBeenCalledWith({
      tipo: "ERRO",
      entidade: "Insight",
      entidade_id: "Reembolso:ULTIMOS_30_DIAS:STATUS",
      acao: "FALHA_IA",
      detalhes: { motivo: "timeout" },
    });
  });
});
