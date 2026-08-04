import { describe, expect, it } from "vitest";
import { tagInputSchema, type TagInput } from "./tag";

function tagValida(overrides: Partial<TagInput> = {}): TagInput {
  return {
    nome: "Sênior",
    funcao: "Nível de experiência do candidato",
    ...overrides,
  };
}

describe("tagInputSchema", () => {
  it("aceita um envelope válido", () => {
    expect(tagInputSchema.safeParse(tagValida()).success).toBe(true);
  });

  it("rejeita nome ausente", () => {
    const { nome: _nome, ...semNome } = tagValida();
    expect(tagInputSchema.safeParse(semNome).success).toBe(false);
  });

  it("rejeita nome vazio", () => {
    expect(tagInputSchema.safeParse(tagValida({ nome: "" })).success).toBe(
      false,
    );
  });

  it("rejeita funcao ausente", () => {
    const { funcao: _funcao, ...semFuncao } = tagValida();
    expect(tagInputSchema.safeParse(semFuncao).success).toBe(false);
  });

  it("rejeita funcao vazia", () => {
    expect(
      tagInputSchema.safeParse(tagValida({ funcao: "" })).success,
    ).toBe(false);
  });
});
