import { describe, expect, it } from "vitest";
import { Role } from "@/lib/generated/prisma/enums";
import { buildGithubIssueUrl } from "./githubIssue";

describe("buildGithubIssueUrl", () => {
  it("monta URL basica com title e body corretos", () => {
    const url = buildGithubIssueUrl({
      repo: "sua-org/rhop",
      tipo: "Bug",
      tela: "Aprovações Pendentes",
      papel: Role.GESTOR,
      titulo: "Botão não responde",
      descricao: "Cliquei e nada aconteceu.",
    });

    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      "https://github.com/sua-org/rhop/issues/new",
    );
    expect(parsed.searchParams.get("title")).toBe(
      "[Bug] Botão não responde",
    );
    expect(parsed.searchParams.get("body")).toBe(
      "**Tipo:** Bug\n**Tela:** Aprovações Pendentes\n**Papel:** Gestor\n\nCliquei e nada aconteceu.",
    );
  });

  it("titulo vazio ou so espacos vira (sem título)", () => {
    const url = buildGithubIssueUrl({
      repo: "sua-org/rhop",
      tipo: "Melhoria",
      tela: "Dashboard",
      papel: Role.RH_ADMIN,
      titulo: "   ",
      descricao: "Seria bom ter um filtro extra.",
    });

    const parsed = new URL(url);
    expect(parsed.searchParams.get("title")).toBe(
      "[Melhoria] (sem título)",
    );
  });

  it("codifica caracteres especiais/acentos corretamente na URL", () => {
    const url = buildGithubIssueUrl({
      repo: "sua-org/rhop",
      tipo: "Dúvida",
      tela: "Configuração de Fluxos",
      papel: Role.SOLICITANTE,
      titulo: "Dúvida sobre é/ã & outros?",
      descricao: "O que significa \"pendente\"?",
    });

    expect(url).not.toContain(" ");
    const parsed = new URL(url);
    expect(parsed.searchParams.get("title")).toBe(
      "[Dúvida] Dúvida sobre é/ã & outros?",
    );
    expect(parsed.searchParams.get("body")).toContain(
      'O que significa "pendente"?',
    );
  });

  it("reflete o papel correto no corpo para cada Role", () => {
    const solicitante = new URL(
      buildGithubIssueUrl({
        repo: "sua-org/rhop",
        tipo: "Bug",
        tela: "Minhas Solicitações",
        papel: Role.SOLICITANTE,
        titulo: "x",
        descricao: "y",
      }),
    );
    const rhAdmin = new URL(
      buildGithubIssueUrl({
        repo: "sua-org/rhop",
        tipo: "Bug",
        tela: "Auditoria & Logs",
        papel: Role.RH_ADMIN,
        titulo: "x",
        descricao: "y",
      }),
    );

    expect(solicitante.searchParams.get("body")).toContain(
      "**Papel:** Solicitante",
    );
    expect(rhAdmin.searchParams.get("body")).toContain("**Papel:** RH_Admin");
  });

  it("nunca inclui e-mail ou nome — a assinatura da funcao nao aceita esses campos", () => {
    const url = buildGithubIssueUrl({
      repo: "sua-org/rhop",
      tipo: "Bug",
      tela: "Minhas Solicitações",
      papel: Role.GESTOR,
      titulo: "x",
      descricao: "y",
    });

    expect(url).not.toMatch(/@/);
  });
});
