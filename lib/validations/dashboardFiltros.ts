import { z } from "zod";

/**
 * Query params de `GET /api/dashboard/solicitacoes` (DASH-04 a DASH-07).
 * Todos os campos são opcionais e combinados com AND lógico pelo
 * `dashboardService.listar`.
 */
export const dashboardListaQuerySchema = z.object({
  tipo_fluxo_id: z.string().min(1).optional(),
  status: z.enum(["PENDENTE", "ATRASADO", "APROVADA", "REJEITADA", "CANCELADA"]).optional(),
  solicitante_id: z.string().min(1).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export type DashboardListaFiltro = z.infer<typeof dashboardListaQuerySchema>;

/**
 * Extrai e valida os query params de uma URL de `GET /api/dashboard/solicitacoes`.
 * Isolado do handler para permitir teste direto do parsing.
 */
export function parseDashboardListaQuery(url: string) {
  const { searchParams } = new URL(url);
  return dashboardListaQuerySchema.safeParse({
    tipo_fluxo_id: searchParams.get("tipo_fluxo_id") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    solicitante_id: searchParams.get("solicitante_id") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });
}
