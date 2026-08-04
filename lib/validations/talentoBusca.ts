import { z } from "zod";

/**
 * Valida o envelope de busca/ranking de talentos (TAL-12, TAL-30). O teto
 * máximo de `n` (`TALENTO_BUSCA_N_MAXIMO`) depende de variável de ambiente
 * lida em runtime — não é validado aqui, e sim em `talentoSearchService`
 * (`design.md`).
 */
export const talentoBuscaInputSchema = z.object({
  texto: z.string().min(1, "texto é obrigatório."),
  n: z.number().int().positive().default(20),
  habilidades: z.string().optional(),
  localizacao: z.string().optional(),
  ferramentas: z.string().optional(),
  idiomas: z.string().optional(),
});

export type TalentoBuscaInput = z.infer<typeof talentoBuscaInputSchema>;
