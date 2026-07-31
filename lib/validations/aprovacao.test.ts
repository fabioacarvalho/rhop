import { describe, expect, it } from "vitest";
import { decisaoInputSchema, type DecisaoInput } from "./aprovacao";

function decisaoValida(overrides: Partial<DecisaoInput> = {}): DecisaoInput {
  return {
    decisao: "APROVADA",
    comentario: "Ok",
    ...overrides,
  };
}

describe("decisaoInputSchema", () => {
  it("aceita um payload válido completo", () => {
    const resultado = decisaoInputSchema.safeParse(decisaoValida());
    expect(resultado.success).toBe(true);
  });

  it("aceita 'APROVADA' e 'REJEITADA'", () => {
    expect(
      decisaoInputSchema.safeParse(decisaoValida({ decisao: "APROVADA" })).success
    ).toBe(true);
    expect(
      decisaoInputSchema.safeParse(decisaoValida({ decisao: "REJEITADA" })).success
    ).toBe(true);
  });

  it("rejeita 'decisao' inválida", () => {
    const resultado = decisaoInputSchema.safeParse({
      decisao: "PENDENTE",
    });
    expect(resultado.success).toBe(false);
  });

  it("aceita payload sem 'comentario'", () => {
    const resultado = decisaoInputSchema.safeParse({ decisao: "APROVADA" });
    expect(resultado.success).toBe(true);
  });

  it("aceita 'comentario' string vazia", () => {
    const resultado = decisaoInputSchema.safeParse(
      decisaoValida({ comentario: "" })
    );
    expect(resultado.success).toBe(true);
  });

  it("rejeita 'comentario' com mais de 2000 caracteres", () => {
    const resultado = decisaoInputSchema.safeParse(
      decisaoValida({ comentario: "a".repeat(2001) })
    );
    expect(resultado.success).toBe(false);
  });
});
