import { z } from "zod";

/**
 * Payload de decisão de aprovação (`Aprovar`/`Rejeitar` em `design.md`).
 * `comentario` é opcional (útil sobretudo em rejeição) e limitado a 2000 chars.
 */
export const decisaoInputSchema = z.object({
  decisao: z.enum(["APROVADA", "REJEITADA"]),
  comentario: z.string().max(2000).optional(),
});

export type DecisaoInput = z.infer<typeof decisaoInputSchema>;
