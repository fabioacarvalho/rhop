import { z } from "zod";

/** Valida o envelope de criação/edição de Tag (TAL-38). */
export const tagInputSchema = z.object({
  nome: z.string().min(1, "nome é obrigatório."),
  funcao: z.string().min(1, "funcao é obrigatório."),
});

export type TagInput = z.infer<typeof tagInputSchema>;
