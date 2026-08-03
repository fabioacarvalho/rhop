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
    equipe_id: "clx1a2b3c0000ex1amplexid0001",
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

  it("aceita equipe_id ausente", () => {
    const { equipe_id: _equipeId, ...semEquipe } = usuarioValido();
    expect(cadastrarUsuarioInputSchema.safeParse(semEquipe).success).toBe(true);
  });

  it("aceita equipe_id nulo", () => {
    expect(
      cadastrarUsuarioInputSchema.safeParse(usuarioValido({ equipe_id: null }))
        .success
    ).toBe(true);
  });

  it("aceita equipe_id como string não vazia (não é UUID, é cuid)", () => {
    expect(
      cadastrarUsuarioInputSchema.safeParse(
        usuarioValido({ equipe_id: "clx1a2b3c0000ex1amplexid0002" })
      ).success
    ).toBe(true);
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
      editarUsuarioInputSchema.safeParse({ role: "GESTOR", equipe_id: null })
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
