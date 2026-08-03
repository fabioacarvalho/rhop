import { z } from "zod";

/**
<<<<<<< HEAD
 * Payload de criação/edição de `Equipe` (EQP-01, EQP-03). `gestor_id` é
 * sempre obrigatório — diferente de `usuario.gestor_id` (legado), aqui não
 * existe "Equipe sem responsável" (decisão travada em `design.md`).
 */
export const equipeInputSchema = z.object({
  nome: z.string().trim().min(1, "nome é obrigatório."),
  gestor_id: z.string().uuid("gestor_id inválido."),
=======
 * Payload de criação/edição de `Equipe`. `gestor_id` é obrigatório — toda
 * `Equipe` precisa de um responsável no momento em que é criada/editada
 * (diferente de `usuario.ts`, onde `gestor_id`/`equipe_id` é opcional).
 */
export const equipeInputSchema = z.object({
  nome: z.string().trim().min(1, "nome e obrigatorio."),
  gestor_id: z.string().uuid("gestor_id invalido."),
>>>>>>> 9e603c9 (specs;)
});

export type EquipeInput = z.infer<typeof equipeInputSchema>;

<<<<<<< HEAD
/** Payload de `PATCH /api/equipes/[id]/status` (EQP-07, EQP-09). */
=======
/** Payload de `PATCH /api/equipes/[id]/status`. */
>>>>>>> 9e603c9 (specs;)
export const definirStatusEquipeInputSchema = z.object({
  ativo: z.boolean(),
});

export type DefinirStatusEquipeInput = z.infer<
  typeof definirStatusEquipeInputSchema
>;
