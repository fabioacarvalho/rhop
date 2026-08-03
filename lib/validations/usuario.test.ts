import { describe, expect, it } from "vitest";
import {
  cadastrarUsuarioInputSchema,
  definirStatusInputSchema,
  editarUsuarioInputSchema,
  type CadastrarUsuarioInput,
} from "./usuario";

function usuarioValido(
  overrides: Partial<CadastrarUsuarioInput> = {}
): CadastrarUsuarioInput {
  return {
    nome: "Fulano de Tal",
    email: "fulano@example.com",
    role: "SOLICITANTE",
    gestor_id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    ...overrides,
  };
}

describe("cadastrarUsuarioInputSchema", () => {
  it("aceita um payload válido", () => {
    expect(cadastrarUsuarioInputSchema.safeParse(usuarioValido()).success).toBe(
      true
    );
  });

  it("rejeita nome vazio", () => {
    expect(
      cadastrarUsuarioInputSchema.safeParse(usuarioValido({ nome: "" })).success
    ).toBe(false);
  });

  it("rejeita nome só com espaços", () => {
    expect(
      cadastrarUsuarioInputSchema.safeParse(usuarioValido({ nome: "   " }))
        .success
    ).toBe(false);
  });

  it("rejeita email sem formato válido", () => {
    expect(
      cadastrarUsuarioInputSchema.safeParse(
        usuarioValido({ email: "nao-e-email" })
      ).success
    ).toBe(false);
  });

  it("rejeita role fora do enum", () => {
    expect(
      cadastrarUsuarioInputSchema.safeParse(
        usuarioValido({ role: "GERENTE_REGIONAL" as never })
      ).success
    ).toBe(false);
  });

  it("aceita gestor_id ausente", () => {
    const { gestor_id: _gestorId, ...semGestor } = usuarioValido();
    expect(cadastrarUsuarioInputSchema.safeParse(semGestor).success).toBe(true);
  });

  it("aceita gestor_id nulo", () => {
    expect(
      cadastrarUsuarioInputSchema.safeParse(usuarioValido({ gestor_id: null }))
        .success
    ).toBe(true);
  });

  it("rejeita gestor_id que não é UUID", () => {
    expect(
      cadastrarUsuarioInputSchema.safeParse(
        usuarioValido({ gestor_id: "nao-e-uuid" })
      ).success
    ).toBe(false);
  });
});

describe("editarUsuarioInputSchema", () => {
  it("rejeita objeto vazio", () => {
    expect(editarUsuarioInputSchema.safeParse({}).success).toBe(false);
  });

  it("aceita com ao menos 1 campo presente", () => {
    expect(
      editarUsuarioInputSchema.safeParse({ nome: "Novo Nome" }).success
    ).toBe(true);
  });

  it("aceita múltiplos campos parciais", () => {
    expect(
      editarUsuarioInputSchema.safeParse({ role: "GESTOR", gestor_id: null })
        .success
    ).toBe(true);
  });
});

describe("definirStatusInputSchema", () => {
  it("aceita ativo true", () => {
    expect(definirStatusInputSchema.safeParse({ ativo: true }).success).toBe(
      true
    );
  });

  it("aceita ativo false", () => {
    expect(definirStatusInputSchema.safeParse({ ativo: false }).success).toBe(
      true
    );
  });

  it("rejeita sem ativo", () => {
    expect(definirStatusInputSchema.safeParse({}).success).toBe(false);
  });

  it("rejeita ativo com tipo errado", () => {
    expect(
      definirStatusInputSchema.safeParse({ ativo: "true" }).success
    ).toBe(false);
  });
});
