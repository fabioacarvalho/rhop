import { z } from "zod";

/**
 * Payload de log automatico de erro nao tratado, disparado pelo error
 * boundary do Next (`app/error.tsx` / `app/global-error.tsx`).
 */
export const erroSistemaInputSchema = z.object({
  mensagem: z.string().max(2000),
  digest: z.string().max(200).nullable(),
  rota: z.string().max(200),
});

export type ErroSistemaInput = z.infer<typeof erroSistemaInputSchema>;
