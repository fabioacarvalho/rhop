import { describe, expect, it } from "vitest";
import {
  definirStatusEquipeInputSchema,
  equipeInputSchema,
  type EquipeInput,
} from "./equipe";

function equipeValida(overrides: Partial<EquipeInput> = {}): EquipeInput {
  return {
<<<<<<< HEAD
    nome: "Equipe Comercial",
=======
    nome: "Equipe de Vendas",
>>>>>>> 9e603c9 (specs;)
    gestor_id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    ...overrides,
  };
}

describe("equipeInputSchema", () => {
  it("aceita um payload válido", () => {
    expect(equipeInputSchema.safeParse(equipeValida()).success).toBe(true);
  });

  it("rejeita nome vazio", () => {
<<<<<<< HEAD
    expect(equipeInputSchema.safeParse(equipeValida({ nome: "" })).success).toBe(
      false
    );
=======
    expect(
      equipeInputSchema.safeParse(equipeValida({ nome: "" })).success
    ).toBe(false);
>>>>>>> 9e603c9 (specs;)
  });

  it("rejeita nome só com espaços", () => {
    expect(
      equipeInputSchema.safeParse(equipeValida({ nome: "   " })).success
    ).toBe(false);
  });

  it("rejeita gestor_id ausente", () => {
    const { gestor_id: _gestorId, ...semGestor } = equipeValida();
    expect(equipeInputSchema.safeParse(semGestor).success).toBe(false);
  });

  it("rejeita gestor_id que não é UUID", () => {
    expect(
      equipeInputSchema.safeParse(equipeValida({ gestor_id: "nao-e-uuid" }))
        .success
    ).toBe(false);
  });
<<<<<<< HEAD
=======

  it("aceita gestor_id UUID válido", () => {
    expect(
      equipeInputSchema.safeParse(
        equipeValida({ gestor_id: "550e8400-e29b-41d4-a716-446655440000" })
      ).success
    ).toBe(true);
  });
>>>>>>> 9e603c9 (specs;)
});

describe("definirStatusEquipeInputSchema", () => {
  it("aceita ativo true", () => {
    expect(
      definirStatusEquipeInputSchema.safeParse({ ativo: true }).success
    ).toBe(true);
  });

  it("aceita ativo false", () => {
    expect(
      definirStatusEquipeInputSchema.safeParse({ ativo: false }).success
    ).toBe(true);
  });

  it("rejeita sem ativo", () => {
    expect(definirStatusEquipeInputSchema.safeParse({}).success).toBe(false);
  });

  it("rejeita ativo com tipo errado", () => {
    expect(
      definirStatusEquipeInputSchema.safeParse({ ativo: "true" }).success
    ).toBe(false);
  });
});
