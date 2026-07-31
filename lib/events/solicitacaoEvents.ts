import type { Role } from "@/lib/generated/prisma/client";

export interface AvancoEtapaPayload {
  solicitacao_id: string;
  etapa_atual: Role;
}

/**
 * Gatilho consumido pela feature `notificacoes` (ainda nao implementada).
 * No-op intencional — nao lanca e nao tem side-effects.
 */
export async function emitirAvancoEtapa(_payload: AvancoEtapaPayload): Promise<void> {
  // no-op
}
