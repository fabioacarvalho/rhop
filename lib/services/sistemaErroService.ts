import { randomUUID } from "crypto";
import { getSessionUser } from "@/lib/services/authService";
import { registrar } from "@/lib/services/logService";
import type { ErroSistemaInput } from "@/lib/validations/erroSistema";

/**
 * Grava em `Log` (tipo ERRO, entidade "Sistema") um erro nao tratado
 * capturado pelo error boundary do Next (`app/error.tsx` /
 * `app/global-error.tsx`). Nunca lanca: `registrar` ja engole falha de
 * persistencia internamente, e este service nao adiciona nenhuma checagem
 * que possa travar o boundary do cliente (mesmo principio de "log nunca
 * trava o fluxo" aplicado em `feedbackService`).
 */
export async function registrarErroNaoTratado(
  input: ErroSistemaInput,
): Promise<void> {
  const usuario = await getSessionUser();

  await registrar({
    tipo: "ERRO",
    entidade: "Sistema",
    entidade_id: input.digest ?? randomUUID(),
    acao: "ERRO_CLIENTE_NAO_TRATADO",
    usuario_id: usuario?.id ?? null,
    detalhes: {
      mensagem: input.mensagem,
      digest: input.digest,
      rota: input.rota,
    },
  });
}
