import { describe, expect, it } from "vitest";
import { candidatoInputSchema, type CandidatoInput } from "./candidato";

function candidatoValido(
  overrides: Partial<CandidatoInput> = {},
): CandidatoInput {
  return {
    nome: "Marina Costa",
    email: "marina.costa@empresa.com",
    telefone: "11999998888",
    curriculo_texto: "Engenheira de software com 8 anos de experiência.",
    parecer_tecnico: "Entrevista: candidata demonstrou forte domínio técnico.",
    ...overrides,
  };
}

describe("candidatoInputSchema", () => {
  it("aceita um envelope válido", () => {
    expect(candidatoInputSchema.safeParse(candidatoValido()).success).toBe(true);
  });

  it("aceita solicitacao_id ausente (campo opcional)", () => {
    const resultado = candidatoInputSchema.safeParse(candidatoValido());
    expect(resultado.success).toBe(true);
  });

  it("aceita solicitacao_id quando informado", () => {
    const resultado = candidatoInputSchema.safeParse(
      candidatoValido({ solicitacao_id: "sol-123" }),
    );
    expect(resultado.success).toBe(true);
  });

  it("rejeita nome ausente", () => {
    const { nome: _nome, ...semNome } = candidatoValido();
    expect(candidatoInputSchema.safeParse(semNome).success).toBe(false);
  });

  it("rejeita nome vazio", () => {
    expect(
      candidatoInputSchema.safeParse(candidatoValido({ nome: "" })).success,
    ).toBe(false);
  });

  it("rejeita email mal formatado", () => {
    expect(
      candidatoInputSchema.safeParse(candidatoValido({ email: "nao-e-email" }))
        .success,
    ).toBe(false);
  });

  it("rejeita telefone vazio", () => {
    expect(
      candidatoInputSchema.safeParse(candidatoValido({ telefone: "" })).success,
    ).toBe(false);
  });

  it("rejeita curriculo_texto vazio", () => {
    expect(
      candidatoInputSchema.safeParse(
        candidatoValido({ curriculo_texto: "" }),
      ).success,
    ).toBe(false);
  });

  it("rejeita parecer_tecnico vazio", () => {
    expect(
      candidatoInputSchema.safeParse(
        candidatoValido({ parecer_tecnico: "" }),
      ).success,
    ).toBe(false);
  });

  it("aceita tag_ids ausente (campo opcional)", () => {
    expect(candidatoInputSchema.safeParse(candidatoValido()).success).toBe(
      true,
    );
  });

  it("aceita tag_ids com array vazio", () => {
    expect(
      candidatoInputSchema.safeParse(candidatoValido({ tag_ids: [] })).success,
    ).toBe(true);
  });

  it("aceita tag_ids com múltiplos ids", () => {
    expect(
      candidatoInputSchema.safeParse(
        candidatoValido({ tag_ids: ["tag-1", "tag-2"] }),
      ).success,
    ).toBe(true);
  });
});
