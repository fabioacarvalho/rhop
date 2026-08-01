import { describe, expect, it } from "vitest";
import { talentoBuscaInputSchema } from "./talentoBusca";

describe("talentoBuscaInputSchema", () => {
  it("aceita um envelope válido", () => {
    const resultado = talentoBuscaInputSchema.safeParse({
      texto: "engenheiro de dados senior",
      n: 10,
    });
    expect(resultado.success).toBe(true);
  });

  it("rejeita texto ausente", () => {
    expect(talentoBuscaInputSchema.safeParse({ n: 10 }).success).toBe(false);
  });

  it("rejeita texto vazio", () => {
    expect(
      talentoBuscaInputSchema.safeParse({ texto: "", n: 10 }).success,
    ).toBe(false);
  });

  it("aplica default 20 quando n está ausente", () => {
    const resultado = talentoBuscaInputSchema.safeParse({ texto: "vendas" });
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.n).toBe(20);
    }
  });

  it("rejeita n zero", () => {
    expect(
      talentoBuscaInputSchema.safeParse({ texto: "vendas", n: 0 }).success,
    ).toBe(false);
  });

  it("rejeita n negativo", () => {
    expect(
      talentoBuscaInputSchema.safeParse({ texto: "vendas", n: -5 }).success,
    ).toBe(false);
  });

  it("rejeita n não-inteiro", () => {
    expect(
      talentoBuscaInputSchema.safeParse({ texto: "vendas", n: 3.5 }).success,
    ).toBe(false);
  });
});
