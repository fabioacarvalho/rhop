import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import {
  listarHistorico,
  ErroNaoEncontrado,
  ErroNaoAutorizadoAprovacao,
} from "@/lib/services/aprovacaoService";
/**
 * `GET /api/aprovacoes/[solicitacaoId]/historico` (APR-16).
 *
 * Qualquer papel autenticado pode tentar; a visibilidade e aplicada no
 * service (`listarHistorico`).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ solicitacaoId: string }> },
) {
  try {
    const usuario = await requireUser();
    const { solicitacaoId } = await context.params;
    const historico = await listarHistorico(solicitacaoId, usuario);
    return Response.json({ historico }, { status: 200 });
  } catch (erro) {
    if (erro instanceof ErroNaoAutenticado) {
      return Response.json({ error: erro.message }, { status: 401 });
    }
    if (erro instanceof ErroNaoAutorizado) {
      return Response.json({ error: erro.message }, { status: 403 });
    }
    if (erro instanceof ErroNaoAutorizadoAprovacao) {
      return Response.json({ error: erro.message }, { status: 403 });
    }
    if (erro instanceof ErroNaoEncontrado) {
      return Response.json({ error: erro.message }, { status: 404 });
    }
    throw erro;
  }
}
