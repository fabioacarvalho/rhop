import { erroSistemaInputSchema } from "@/lib/validations/erroSistema";
import { registrarErroNaoTratado } from "@/lib/services/sistemaErroService";

/**
 * `POST /api/erros/log` — chamado (fire-and-forget) pelo error boundary do
 * Next quando captura um erro nao tratado no cliente. Sempre responde `204`:
 * este endpoint so grava auditoria, nunca deve travar o boundary por causa
 * de corpo invalido ou falha de log.
 */
export async function POST(request: Request) {
  try {
    const corpo = await request.json().catch(() => null);
    const resultado = erroSistemaInputSchema.safeParse(corpo);

    if (resultado.success) {
      await registrarErroNaoTratado(resultado.data).catch(() => null);
    }
  } catch {
    // Fire-and-forget: nunca falha com 500 se ocorrer erro ao processar o log
  }

  return new Response(null, { status: 204 });
}
