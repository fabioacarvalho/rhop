import { z } from "zod";

/**
 * Payload de criacao de `Feedback` (HELP-02, HELP-03). `titulo` vazio e
 * aceito — vira "(sem titulo)" no service (HELP-06), nao e' um formulario
 * critico que deva bloquear o envio.
 */
export const feedbackInputSchema = z.object({
  tipo: z.enum(["Bug", "Melhoria", "Dúvida"]),
  titulo: z.string().max(200).optional().default(""),
  descricao: z.string().max(5000).optional().default(""),
  tela_contexto: z.string().min(1).max(200),
});

export type FeedbackInput = z.infer<typeof feedbackInputSchema>;
