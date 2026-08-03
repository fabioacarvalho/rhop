import { describe, expect, it } from "vitest";
import { solicitacaoInputSchema } from "./solicitacao";

describe("solicitacaoInputSchema", () => {
  it("aceita um payload válido", () => {
    const resultado = solicitacaoInputSchema.safeParse({
      tipo_fluxo_id: "tipo-1",
      dados: { valor: "340,00", descricao: "Transporte" },
    });

    expect(resultado.success).toBe(true);
  });

  it("aceita 'dados' vazio (objeto sem chaves)", () => {
    const resultado = solicitacaoInputSchema.safeParse({
      tipo_fluxo_id: "tipo-1",
      dados: {},
    });

    expect(resultado.success).toBe(true);
  });

  it("rejeita 'tipo_fluxo_id' ausente", () => {
    const resultado = solicitacaoInputSchema.safeParse({
      dados: {},
    });

    expect(resultado.success).toBe(false);
  });

  it("rejeita 'tipo_fluxo_id' vazio", () => {
    const resultado = solicitacaoInputSchema.safeParse({
      tipo_fluxo_id: "",
      dados: {},
    });

    expect(resultado.success).toBe(false);
  });

  it("rejeita 'dados' que não é objeto (string)", () => {
    const resultado = solicitacaoInputSchema.safeParse({
      tipo_fluxo_id: "tipo-1",
      dados: "não é objeto",
    });

    expect(resultado.success).toBe(false);
  });

  it("rejeita 'dados' que não é objeto (array)", () => {
    const resultado = solicitacaoInputSchema.safeParse({
      tipo_fluxo_id: "tipo-1",
      dados: ["a", "b"],
    });

    expect(resultado.success).toBe(false);
  });

  it("rejeita 'dados' ausente", () => {
    const resultado = solicitacaoInputSchema.safeParse({
      tipo_fluxo_id: "tipo-1",
    });

    expect(resultado.success).toBe(false);
  });
});
