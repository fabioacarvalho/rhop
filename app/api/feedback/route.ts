import { requireUser, ErroNaoAutenticado } from "@/lib/services/authService";
import { feedbackInputSchema } from "@/lib/validations/feedback";
import { enviarFeedback } from "@/lib/services/feedbackService";

/**
 * `POST /api/feedback` (V2 do PRD, seção 9) — qualquer usuário autenticado
 * pode reportar (sem restrição de papel).
 *
 * - Sem sessão -> 401, sem tocar Zod nem o service.
 * - Corpo inválido (`feedbackInputSchema`) -> 400.
 * - Limite diário atingido -> 429.
 * - Falha na API do GitHub -> 502.
 * - Sucesso -> 201 com a URL/número da issue criada.
 */
export async function POST(request: Request) {
  try {
    const usuario = await requireUser();

    const corpo = await request.json();
    const resultado = feedbackInputSchema.safeParse(corpo);

    if (!resultado.success) {
      return Response.json(
        { error: "Dados inválidos.", detalhes: resultado.error.issues },
        { status: 400 },
      );
    }

    const envio = await enviarFeedback({
      usuarioId: usuario.id,
      papel: usuario.role,
      tipo: resultado.data.tipo,
      titulo: resultado.data.titulo,
      descricao: resultado.data.descricao,
      telaContexto: resultado.data.tela_contexto,
    });

    if (!envio.ok) {
      const status = envio.motivo === "LIMITE_DIARIO" ? 429 : 502;
      return Response.json({ error: envio.mensagem }, { status });
    }

    return Response.json(
      { url: envio.url, numero: envio.numero },
      { status: 201 },
    );
  } catch (erro) {
    if (erro instanceof ErroNaoAutenticado) {
      return Response.json({ error: erro.message }, { status: 401 });
    }
    throw erro;
  }
}
