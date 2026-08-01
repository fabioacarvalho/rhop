import { describe, expect, it } from "vitest";
import { insightsFiltroSchema, parseInsightsQuery } from "./insight";

describe("insightsFiltroSchema", () => {
  it("válido completo -> aceita tipoFluxoId, periodo e dimensao", () => {
    const resultado = insightsFiltroSchema.safeParse({
      tipoFluxoId: "tipo-1",
      periodo: "ULTIMOS_30_DIAS",
      dimensao: "MES",
    });

    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.dimensao).toBe("MES");
    }
  });

  it("válido sem dimensao -> default STATUS", () => {
    const resultado = insightsFiltroSchema.safeParse({
      tipoFluxoId: "tipo-1",
      periodo: "ANO_ATUAL",
    });

    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.dimensao).toBe("STATUS");
    }
  });

  it("tipoFluxoId ausente -> falha", () => {
    const resultado = insightsFiltroSchema.safeParse({
      periodo: "ULTIMOS_30_DIAS",
    });

    expect(resultado.success).toBe(false);
  });

  it("periodo fora do enum -> falha", () => {
    const resultado = insightsFiltroSchema.safeParse({
      tipoFluxoId: "tipo-1",
      periodo: "ONTEM",
    });

    expect(resultado.success).toBe(false);
  });

  it("dimensao fora do enum -> falha", () => {
    const resultado = insightsFiltroSchema.safeParse({
      tipoFluxoId: "tipo-1",
      periodo: "ULTIMOS_30_DIAS",
      dimensao: "AREA",
    });

    expect(resultado.success).toBe(false);
  });
});

describe("parseInsightsQuery", () => {
  it("extrai filtro válido da querystring", () => {
    const resultado = parseInsightsQuery(
      "https://app.local/api/insights?tipoFluxoId=tipo-1&periodo=ULTIMOS_90_DIAS&dimensao=MES",
    );

    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data).toEqual({
        tipoFluxoId: "tipo-1",
        periodo: "ULTIMOS_90_DIAS",
        dimensao: "MES",
      });
    }
  });

  it("sem tipoFluxoId na querystring -> falha", () => {
    const resultado = parseInsightsQuery(
      "https://app.local/api/insights?periodo=ULTIMOS_30_DIAS",
    );

    expect(resultado.success).toBe(false);
  });
});
