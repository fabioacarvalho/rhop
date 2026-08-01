import { describe, expect, it } from "vitest";
import { Role } from "@/lib/generated/prisma/enums";
import { montarIssuePayload } from "./githubIssue";

describe("montarIssuePayload", () => {
  it("monta title e body corretos", () => {
    const { title, body } = montarIssuePayload({
      tipo: "Bug",
      tela: "Aprovações Pendentes",
      papel: Role.GESTOR,
      titulo: "Botão não responde",
      descricao: "Cliquei e nada aconteceu.",
    });

    expect(title).toBe("[Bug] Botão não responde");
    expect(body).toBe(
      "**Tipo:** Bug\n**Tela:** Aprovações Pendentes\n**Papel:** Gestor\n\nCliquei e nada aconteceu.",
    );
  });

  it("titulo vazio ou so espacos vira (sem título)", () => {
    const { title } = montarIssuePayload({
      tipo: "Melhoria",
      tela: "Dashboard",
      papel: Role.RH_ADMIN,
      titulo: "   ",
      descricao: "Seria bom ter um filtro extra.",
    });

    expect(title).toBe("[Melhoria] (sem título)");
  });

  it("preserva acentos e caracteres especiais no body", () => {
    const { title, body } = montarIssuePayload({
      tipo: "Dúvida",
      tela: "Configuração de Fluxos",
      papel: Role.SOLICITANTE,
      titulo: "Dúvida sobre é/ã & outros?",
      descricao: 'O que significa "pendente"?',
    });

    expect(title).toBe("[Dúvida] Dúvida sobre é/ã & outros?");
    expect(body).toContain('O que significa "pendente"?');
  });

  it("reflete o papel correto no corpo para cada Role", () => {
    const solicitante = montarIssuePayload({
      tipo: "Bug",
      tela: "Minhas Solicitações",
      papel: Role.SOLICITANTE,
      titulo: "x",
      descricao: "y",
    });
    const rhAdmin = montarIssuePayload({
      tipo: "Bug",
      tela: "Auditoria & Logs",
      papel: Role.RH_ADMIN,
      titulo: "x",
      descricao: "y",
    });

    expect(solicitante.body).toContain("**Papel:** Solicitante");
    expect(rhAdmin.body).toContain("**Papel:** RH_Admin");
  });

  it("nunca inclui e-mail ou nome — a assinatura da funcao nao aceita esses campos", () => {
    const { title, body } = montarIssuePayload({
      tipo: "Bug",
      tela: "Minhas Solicitações",
      papel: Role.GESTOR,
      titulo: "x",
      descricao: "y",
    });

    expect(`${title}\n${body}`).not.toMatch(/@/);
  });
});
