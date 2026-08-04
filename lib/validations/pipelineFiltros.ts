import { z } from "zod";

/**
 * Query params de `GET /api/pipeline` (visão geral do Kanban).
 * `tipo_fluxo_id` é opcional — ausência do filtro retorna todos os fluxos.
 */
export const pipelineFiltroQuerySchema = z.object({
  tipo_fluxo_id: z.string().min(1).optional(),
});

/**
 * Query params de `GET /api/pipeline/coluna` (paginação de uma coluna do Kanban).
 * Estende o filtro base com paginação.
 */
export const pipelineColunaQuerySchema = pipelineFiltroQuerySchema.extend({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export type PipelineFiltro = z.infer<typeof pipelineFiltroQuerySchema>;
export type PipelineColunaFiltro = z.infer<typeof pipelineColunaQuerySchema>;

/**
 * Extrai e valida os query params de uma URL de `GET /api/pipeline`.
 * Isolado do handler para permitir teste direto do parsing.
 */
export function parsePipelineFiltroQuery(url: string) {
  const { searchParams } = new URL(url);
  return pipelineFiltroQuerySchema.safeParse({
    tipo_fluxo_id: searchParams.get("tipo_fluxo_id") ?? undefined,
  });
}

/**
 * Extrai e valida os query params de uma URL de `GET /api/pipeline/coluna`.
 * Isolado do handler para permitir teste direto do parsing.
 */
export function parsePipelineColunaQuery(url: string) {
  const { searchParams } = new URL(url);
  return pipelineColunaQuerySchema.safeParse({
    tipo_fluxo_id: searchParams.get("tipo_fluxo_id") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });
}
