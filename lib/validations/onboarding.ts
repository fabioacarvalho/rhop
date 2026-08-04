import { z } from "zod";

/**
 * Payload de `POST /api/onboarding/equipe` (GAUTH-10). `equipe_id` é `cuid()`
 * (`Equipe.id`), não `uuid` — diferente de `equipeInputSchema.gestor_id`, que
 * valida `User.id`.
 */
export const onboardingEquipeInputSchema = z.object({
  equipe_id: z.string().trim().min(1, "equipe_id é obrigatório."),
});

export type OnboardingEquipeInput = z.infer<typeof onboardingEquipeInputSchema>;
