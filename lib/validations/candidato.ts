import { z } from "zod";

/**
 * Valida o envelope de cadastro de candidato (TAL-06). `solicitacao_id` é
 * opcional — vínculo a `Solicitacao` é P2 (fora deste ciclo), mas o campo já
 * existe no schema (`design.md`).
 */
export const candidatoInputSchema = z.object({
  nome: z.string().min(1, "nome é obrigatório."),
  email: z.string().email("email inválido."),
  telefone: z.string().min(1, "telefone é obrigatório."),
  curriculo_texto: z.string().min(1, "curriculo_texto é obrigatório."),
  transcricao_texto: z.string().min(1, "transcricao_texto é obrigatório."),
  solicitacao_id: z.string().optional(),
});

export type CandidatoInput = z.infer<typeof candidatoInputSchema>;
