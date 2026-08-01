import { describe, expect, it } from "vitest";
import { dashboardListaQuerySchema } from "./dashboardFiltros";

describe("dashboardListaQuerySchema", () => {
  it("aceita objeto vazio — todos os filtros são opcionais", () => {
    expect(dashboardListaQuerySchema.safeParse({}).success).toBe(true);
  });

  it("aceita tipo_fluxo_id válido", () => {
    expect(
      dashboardListaQuerySchema.safeParse({ tipo_fluxo_id: "abc123" }).success
    ).toBe(true);
  });

  it("rejeita tipo_fluxo_id vazio", () => {
    expect(
      dashboardListaQuerySchema.safeParse({ tipo_fluxo_id: "" }).success
    ).toBe(false);
  });

  it("aceita cada valor válido de status", () => {
    for (const status of ["PENDENTE", "ATRASADO", "APROVADA", "REJEITADA"]) {
      expect(dashboardListaQuerySchema.safeParse({ status }).success).toBe(
        true
      );
    }
  });

  it("rejeita status fora do enum", () => {
    expect(
      dashboardListaQuerySchema.safeParse({ status: "foo" }).success
    ).toBe(false);
  });

  it("aceita solicitante_id válido", () => {
    expect(
      dashboardListaQuerySchema.safeParse({ solicitante_id: "user-1" }).success
    ).toBe(true);
  });

  it("rejeita solicitante_id vazio", () => {
    expect(
      dashboardListaQuerySchema.safeParse({ solicitante_id: "" }).success
    ).toBe(false);
  });

  it("aceita page e pageSize numéricos positivos", () => {
    expect(
      dashboardListaQuerySchema.safeParse({ page: "2", pageSize: "10" })
        .success
    ).toBe(true);
  });

  it("rejeita page não numérico", () => {
    expect(
      dashboardListaQuerySchema.safeParse({ page: "abc" }).success
    ).toBe(false);
  });

  it("rejeita page <= 0", () => {
    expect(dashboardListaQuerySchema.safeParse({ page: "0" }).success).toBe(
      false
    );
  });

  it("rejeita pageSize <= 0", () => {
    expect(
      dashboardListaQuerySchema.safeParse({ pageSize: "-1" }).success
    ).toBe(false);
  });

  it("aceita todos os filtros combinados", () => {
    const resultado = dashboardListaQuerySchema.safeParse({
      tipo_fluxo_id: "abc123",
      status: "ATRASADO",
      solicitante_id: "user-1",
      page: "1",
      pageSize: "20",
    });
    expect(resultado.success).toBe(true);
  });
});
