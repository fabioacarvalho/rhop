import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    feedback: {
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/services/logService", () => ({
  registrar: vi.fn(),
}));

vi.mock("@/lib/services/githubService", () => ({
  criarIssue: vi.fn(),
  ErroGithubApi: class ErroGithubApi extends Error {},
}));

import { prisma } from "@/lib/prisma";
import { registrar } from "@/lib/services/logService";
import { criarIssue, ErroGithubApi } from "@/lib/services/githubService";
import { Role } from "@/lib/generated/prisma/enums";
import { enviarFeedback } from "./feedbackService";

const mockCount = vi.mocked(prisma.feedback.count);
const mockCreate = vi.mocked(prisma.feedback.create);
const mockCriarIssue = vi.mocked(criarIssue);
const mockRegistrar = vi.mocked(registrar);

const inputBase = {
  usuarioId: "user-1",
  papel: Role.GESTOR,
  tipo: "Bug" as const,
  titulo: "Botão quebrado",
  descricao: "Não abre o modal.",
  telaContexto: "Dashboard",
};

beforeEach(() => {
  mockCount.mockReset();
  mockCreate.mockReset();
  mockCriarIssue.mockReset();
  mockRegistrar.mockReset();
  mockRegistrar.mockResolvedValue(undefined);
  mockCount.mockResolvedValue(0);
});

describe("feedbackService.enviarFeedback", () => {
  it("sucesso -> cria issue, grava Feedback ENVIADO, retorna ok:true", async () => {
    mockCriarIssue.mockResolvedValueOnce({
      url: "https://github.com/fabioacarvalho/rhop/issues/7",
      numero: 7,
    });
    mockCreate.mockResolvedValueOnce({ id: "fb-1" } as never);

    const resultado = await enviarFeedback(inputBase);

    expect(resultado).toEqual({
      ok: true,
      url: "https://github.com/fabioacarvalho/rhop/issues/7",
      numero: 7,
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ENVIADO",
          github_issue_url: "https://github.com/fabioacarvalho/rhop/issues/7",
          github_issue_numero: 7,
        }),
      }),
    );
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it("limite diario atingido -> nao chama GitHub nem cria Feedback", async () => {
    mockCount.mockResolvedValueOnce(5);

    const resultado = await enviarFeedback(inputBase);

    expect(resultado.ok).toBe(false);
    expect(mockCriarIssue).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("falha do GitHub -> grava Feedback ERRO + Log ERRO, retorna ok:false sem lancar", async () => {
    mockCriarIssue.mockRejectedValueOnce(new ErroGithubApi("GitHub API respondeu 401"));
    mockCreate.mockResolvedValueOnce({ id: "fb-2" } as never);

    const resultado = await enviarFeedback(inputBase);

    expect(resultado.ok).toBe(false);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ERRO" }),
      }),
    );
    expect(mockRegistrar).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "ERRO",
        entidade: "Feedback",
        entidade_id: "fb-2",
        acao: "FALHA_CRIAR_ISSUE_GITHUB",
      }),
    );
  });
});
