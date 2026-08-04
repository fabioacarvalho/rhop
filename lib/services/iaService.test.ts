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
import {
  gerarJustificativaRanking,
  gerarResumoCandidato,
  gerarResumoInsights,
  gerarResumoSolicitacao,
  gerarResumoSolicitante,
} from "./iaService";

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

const solicitanteInputBase = {
  solicitacaoId: "sol-1",
  tipoFluxoNome: "Ferias",
  dados: { data_inicio: "2026-08-10", data_fim: "2026-08-20" },
  conflito: null,
};

describe("iaService.gerarResumoSolicitante", () => {
  it("sucesso com conteudo nao-vazio -> retorna texto trimado e nao grava ERRO", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "  Ferias de 10 a 20 de agosto.  " } }],
    });

    const result = await gerarResumoSolicitante(solicitanteInputBase);

    expect(result).toBe("Ferias de 10 a 20 de agosto.");
    expect(mockRegistrar).not.toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("falha/throw da OpenAI -> null + registrar ERRO (entidade Solicitacao)", async () => {
    mockCreate.mockRejectedValueOnce(new Error("timeout"));

    const result = await gerarResumoSolicitante(solicitanteInputBase);

    expect(result).toBeNull();
    expect(mockRegistrar).toHaveBeenCalledTimes(1);
    expect(mockRegistrar).toHaveBeenCalledWith({
      tipo: "ERRO",
      entidade: "Solicitacao",
      entidade_id: "sol-1",
      acao: "FALHA_IA",
      detalhes: { motivo: "timeout" },
    });
  });

  it("conteudo vazio da OpenAI -> null + registrar ERRO", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "   " } }],
    });

    const result = await gerarResumoSolicitante(solicitanteInputBase);

    expect(result).toBeNull();
    expect(mockRegistrar).toHaveBeenCalledWith({
      tipo: "ERRO",
      entidade: "Solicitacao",
      entidade_id: "sol-1",
      acao: "FALHA_IA",
      detalhes: { motivo: "conteudo vazio da OpenAI" },
    });
  });

  it("OPENAI_API_KEY ausente -> null + registrar ERRO sem chamar OpenAI", async () => {
    delete process.env.OPENAI_API_KEY;

    const result = await gerarResumoSolicitante(solicitanteInputBase);

    expect(result).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockRegistrar).toHaveBeenCalledWith({
      tipo: "ERRO",
      entidade: "Solicitacao",
      entidade_id: "sol-1",
      acao: "FALHA_IA",
      detalhes: { motivo: "OPENAI_API_KEY ausente" },
    });
  });

  it("com conflito !== null -> prompt inclui a periodoDescricao do conflito", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "Ferias marcadas, ha sobreposicao." } }],
    });

    await gerarResumoSolicitante({
      ...solicitanteInputBase,
      conflito: { periodoDescricao: "10/08/2026 a 20/08/2026" },
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("10/08/2026 a 20/08/2026"),
          }),
        ]),
      }),
    );
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

const rankingInputBase = {
  candidatoId: "cand-1",
  nome: "Marina Costa",
  curriculoTexto: "Engenheira de dados, 6 anos de experiencia.",
  transcricaoTexto: "Entrevista tecnica: forte em SQL e pipelines.",
  queryTexto: "engenheiro de dados senior",
};

describe("iaService.gerarJustificativaRanking", () => {
  it("sucesso com conteudo nao-vazio -> retorna texto trimado e nao grava ERRO", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "  Forte aderencia ao perfil.  " } }],
    });

    const result = await gerarJustificativaRanking(rankingInputBase);

    expect(result).toBe("Forte aderencia ao perfil.");
    expect(mockRegistrar).not.toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o-mini",
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("engenheiro de dados senior"),
          }),
        ]),
      }),
    );
  });

  it("OPENAI_API_KEY ausente -> null + registrar ERRO sem chamar OpenAI", async () => {
    delete process.env.OPENAI_API_KEY;

    const result = await gerarJustificativaRanking(rankingInputBase);

    expect(result).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockRegistrar).toHaveBeenCalledWith({
      tipo: "ERRO",
      entidade: "Candidato",
      entidade_id: "cand-1",
      acao: "FALHA_IA",
      detalhes: { motivo: "OPENAI_API_KEY ausente" },
    });
  });

  it("falha/throw da OpenAI -> null + registrar ERRO FALHA_IA com entidade Candidato", async () => {
    mockCreate.mockRejectedValueOnce(new Error("rate limit"));

    const result = await gerarJustificativaRanking(rankingInputBase);

    expect(result).toBeNull();
    expect(mockRegistrar).toHaveBeenCalledTimes(1);
    expect(mockRegistrar).toHaveBeenCalledWith({
      tipo: "ERRO",
      entidade: "Candidato",
      entidade_id: "cand-1",
      acao: "FALHA_IA",
      detalhes: { motivo: "rate limit" },
    });
  });

  it("conteudo vazio da OpenAI -> null + registrar ERRO FALHA_IA", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "   " } }],
    });

    const result = await gerarJustificativaRanking(rankingInputBase);

    expect(result).toBeNull();
    expect(mockRegistrar).toHaveBeenCalledTimes(1);
    expect(mockRegistrar).toHaveBeenCalledWith({
      tipo: "ERRO",
      entidade: "Candidato",
      entidade_id: "cand-1",
      acao: "FALHA_IA",
      detalhes: { motivo: "conteudo vazio da OpenAI" },
    });
  });
});

const resumoCandidatoInputBase = {
  candidatoId: "cand-1",
  nome: "Marina Costa",
  curriculoTexto: "Engenheira de dados, 6 anos de experiencia.",
  parecerTecnico: "Entrevista tecnica: forte em SQL e pipelines.",
};

describe("iaService.gerarResumoCandidato", () => {
  it("sucesso com conteudo nao-vazio -> retorna texto trimado e nao grava ERRO", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "  Perfil forte em dados.  " } }],
    });

    const result = await gerarResumoCandidato(resumoCandidatoInputBase);

    expect(result).toBe("Perfil forte em dados.");
    expect(mockRegistrar).not.toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o-mini",
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("Marina Costa"),
          }),
        ]),
      }),
    );
  });

  it("OPENAI_API_KEY ausente -> null + registrar ERRO sem chamar OpenAI", async () => {
    delete process.env.OPENAI_API_KEY;

    const result = await gerarResumoCandidato(resumoCandidatoInputBase);

    expect(result).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockRegistrar).toHaveBeenCalledWith({
      tipo: "ERRO",
      entidade: "Candidato",
      entidade_id: "cand-1",
      acao: "FALHA_IA",
      detalhes: { motivo: "OPENAI_API_KEY ausente" },
    });
  });

  it("falha/throw da OpenAI -> null + registrar ERRO FALHA_IA com entidade Candidato", async () => {
    mockCreate.mockRejectedValueOnce(new Error("rate limit"));

    const result = await gerarResumoCandidato(resumoCandidatoInputBase);

    expect(result).toBeNull();
    expect(mockRegistrar).toHaveBeenCalledTimes(1);
    expect(mockRegistrar).toHaveBeenCalledWith({
      tipo: "ERRO",
      entidade: "Candidato",
      entidade_id: "cand-1",
      acao: "FALHA_IA",
      detalhes: { motivo: "rate limit" },
    });
  });

  it("conteudo vazio da OpenAI -> null + registrar ERRO FALHA_IA", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "   " } }],
    });

    const result = await gerarResumoCandidato(resumoCandidatoInputBase);

    expect(result).toBeNull();
    expect(mockRegistrar).toHaveBeenCalledTimes(1);
    expect(mockRegistrar).toHaveBeenCalledWith({
      tipo: "ERRO",
      entidade: "Candidato",
      entidade_id: "cand-1",
      acao: "FALHA_IA",
      detalhes: { motivo: "conteudo vazio da OpenAI" },
    });
  });
});
