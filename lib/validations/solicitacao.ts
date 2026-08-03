import { z } from "zod";

/**
 * Schema do ENVELOPE de `POST /api/solicitacoes` (SOL-06). Não valida os
 * campos dinâmicos de `dados` — isso depende do `TipoFluxo` buscado no banco
 * e por isso vive em `solicitacaoDados.ts` (chamado pelo service).
 */
export const solicitacaoInputSchema = z.object({
  tipo_fluxo_id: z.string().min(1, "tipo_fluxo_id é obrigatório."),
  dados: z.record(z.string(), z.unknown()),
});

export type SolicitacaoInput = z.infer<typeof solicitacaoInputSchema>;
