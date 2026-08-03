import { z } from "zod";

/**
 * Payload de criação/edição de `Equipe` (EQP-01, EQP-03). `gestor_id` é
 * sempre obrigatório — diferente de `usuario.gestor_id` (legado), aqui não
 * existe "Equipe sem responsável" (decisão travada em `design.md`).
 */
export const equipeInputSchema = z.object({
  nome: z.string().trim().min(1, "nome é obrigatório."),
  gestor_id: z.string().uuid("gestor_id inválido."),
});

export type EquipeInput = z.infer<typeof equipeInputSchema>;

/** Payload de `PATCH /api/equipes/[id]/status` (EQP-07, EQP-09). */
export const definirStatusEquipeInputSchema = z.object({
  ativo: z.boolean(),
});

export type DefinirStatusEquipeInput = z.infer<
  typeof definirStatusEquipeInputSchema
>;
