import { describe, expect, it } from "vitest";
import { feedbackInputSchema, type FeedbackInput } from "./feedback";

function feedbackValido(
  overrides: Partial<FeedbackInput> = {},
): Partial<FeedbackInput> {
  return {
    tipo: "Bug",
    titulo: "Botão não responde",
    descricao: "Cliquei e nada aconteceu.",
    tela_contexto: "Dashboard",
    ...overrides,
  };
}

describe("feedbackInputSchema", () => {
  it("aceita um payload válido completo", () => {
    const resultado = feedbackInputSchema.safeParse(feedbackValido());
    expect(resultado.success).toBe(true);
  });

  it("aceita os três tipos válidos", () => {
    for (const tipo of ["Bug", "Melhoria", "Dúvida"] as const) {
      expect(
        feedbackInputSchema.safeParse(feedbackValido({ tipo })).success,
      ).toBe(true);
    }
  });

  it("rejeita 'tipo' inválido", () => {
    const resultado = feedbackInputSchema.safeParse(
      feedbackValido({ tipo: "Sugestão" as never }),
    );
    expect(resultado.success).toBe(false);
  });

  it("rejeita payload sem 'tela_contexto'", () => {
    const { tela_contexto: _omitido, ...semTela } = feedbackValido();
    const resultado = feedbackInputSchema.safeParse(semTela);
    expect(resultado.success).toBe(false);
  });

  it("aceita 'titulo' e 'descricao' ausentes, default para string vazia", () => {
    const resultado = feedbackInputSchema.safeParse({
      tipo: "Bug",
      tela_contexto: "Dashboard",
    });
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.titulo).toBe("");
      expect(resultado.data.descricao).toBe("");
    }
  });

  it("rejeita 'titulo' com mais de 200 caracteres", () => {
    const resultado = feedbackInputSchema.safeParse(
      feedbackValido({ titulo: "a".repeat(201) }),
    );
    expect(resultado.success).toBe(false);
  });

  it("rejeita 'descricao' com mais de 5000 caracteres", () => {
    const resultado = feedbackInputSchema.safeParse(
      feedbackValido({ descricao: "a".repeat(5001) }),
    );
    expect(resultado.success).toBe(false);
  });
});
