import { z } from "zod";

/** Faixas de período aceitas pelo Painel de Insights (INSIGHT-01, Questão #3 do spec). */
export const PERIODOS_INSIGHTS = [
  "ULTIMOS_30_DIAS",
  "ULTIMOS_90_DIAS",
  "ANO_ATUAL",
] as const;

/** Dimensões de agregação disponíveis (INSIGHT-11, Questão #2 do spec). */
export const DIMENSOES_INSIGHTS = ["STATUS", "MES"] as const;

/**
 * Filtro de `GET /api/insights` (INSIGHT-04). `dimensao` é opcional e
 * assume `STATUS` como default — o seletor de dimensão sempre existe na UI
 * (`design.md`), mas o backend não deve exigir o parâmetro.
 */
export const insightsFiltroSchema = z.object({
  tipoFluxoId: z.string().min(1, "tipoFluxoId é obrigatório."),
  periodo: z.enum(PERIODOS_INSIGHTS),
  dimensao: z.enum(DIMENSOES_INSIGHTS).optional().default("STATUS"),
});

export type InsightsFiltro = z.infer<typeof insightsFiltroSchema>;

/**
 * Extrai e valida os query params de uma URL de `GET /api/insights`. Mesmo
 * padrão de `parseLogsQuery` (`app/api/logs/route.ts`) — isolado do handler
 * para permitir teste direto do parsing sem simular `Request`.
 */
export function parseInsightsQuery(url: string) {
  const { searchParams } = new URL(url);
  return insightsFiltroSchema.safeParse({
    tipoFluxoId: searchParams.get("tipoFluxoId") ?? undefined,
    periodo: searchParams.get("periodo") ?? undefined,
    dimensao: searchParams.get("dimensao") ?? undefined,
  });
}
