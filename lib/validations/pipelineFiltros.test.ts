import { describe, expect, it } from "vitest";
import {
  parsePipelineColunaQuery,
  parsePipelineFiltroQuery,
  pipelineColunaQuerySchema,
  pipelineFiltroQuerySchema,
} from "./pipelineFiltros";

describe("pipelineFiltroQuerySchema", () => {
  it("aceita objeto vazio — tipo_fluxo_id ausente é válido (filtro opcional)", () => {
    expect(pipelineFiltroQuerySchema.safeParse({}).success).toBe(true);
  });

  it("aceita tipo_fluxo_id válido", () => {
    expect(
      pipelineFiltroQuerySchema.safeParse({ tipo_fluxo_id: "abc123" }).success
    ).toBe(true);
  });

  it("rejeita tipo_fluxo_id vazio", () => {
    expect(
      pipelineFiltroQuerySchema.safeParse({ tipo_fluxo_id: "" }).success
    ).toBe(false);
  });
});

describe("pipelineColunaQuerySchema", () => {
  it("aceita objeto vazio — todos os filtros são opcionais", () => {
    expect(pipelineColunaQuerySchema.safeParse({}).success).toBe(true);
  });

  it("aceita tipo_fluxo_id, page e pageSize válidos", () => {
    expect(
      pipelineColunaQuerySchema.safeParse({
        tipo_fluxo_id: "abc123",
        page: "2",
        pageSize: "10",
      }).success
    ).toBe(true);
  });

  it("rejeita page não numérico", () => {
    expect(
      pipelineColunaQuerySchema.safeParse({ page: "abc" }).success
    ).toBe(false);
  });

  it("rejeita pageSize não numérico", () => {
    expect(
      pipelineColunaQuerySchema.safeParse({ pageSize: "xyz" }).success
    ).toBe(false);
  });

  it("rejeita page <= 0", () => {
    expect(pipelineColunaQuerySchema.safeParse({ page: "0" }).success).toBe(
      false
    );
  });

  it("rejeita pageSize <= 0", () => {
    expect(
      pipelineColunaQuerySchema.safeParse({ pageSize: "-5" }).success
    ).toBe(false);
  });
});

describe("parsePipelineFiltroQuery", () => {
  it("extrai tipo_fluxo_id de uma URL de teste", () => {
    const resultado = parsePipelineFiltroQuery(
      "http://localhost/api/pipeline?tipo_fluxo_id=abc123"
    );
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.tipo_fluxo_id).toBe("abc123");
    }
  });

  it("extrai objeto vazio quando não há query params", () => {
    const resultado = parsePipelineFiltroQuery("http://localhost/api/pipeline");
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.tipo_fluxo_id).toBeUndefined();
    }
  });
});

describe("parsePipelineColunaQuery", () => {
  it("extrai tipo_fluxo_id, page e pageSize de uma URL de teste", () => {
    const resultado = parsePipelineColunaQuery(
      "http://localhost/api/pipeline/coluna?tipo_fluxo_id=abc123&page=2&pageSize=10"
    );
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.tipo_fluxo_id).toBe("abc123");
      expect(resultado.data.page).toBe(2);
      expect(resultado.data.pageSize).toBe(10);
    }
  });

  it("retorna erro quando page não é numérico na URL", () => {
    const resultado = parsePipelineColunaQuery(
      "http://localhost/api/pipeline/coluna?page=abc"
    );
    expect(resultado.success).toBe(false);
  });
});
