import { requireUser, ErroNaoAutenticado } from "@/lib/services/authService";
import {
  cancelar,
  ErroNaoEncontrado,
  ErroNaoAutorizadoCancelamento,
  ErroCancelamentoInvalido,
} from "@/lib/services/solicitacaoService";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * `POST /api/solicitacoes/[id]/cancelar` (SOL-14 e similares).
 *
 * - Sem sessao -> 401, sem tocar o service.
 * - Nao e o solicitante dono nem RH_ADMIN (`ErroNaoAutorizadoCancelamento`)
 *   -> 403.
 * - Solicitacao inexistente (`ErroNaoEncontrado`) -> 404.
 * - `status` diferente de `PENDENTE` (`ErroCancelamentoInvalido`) -> 409.
 * - Sucesso -> 200 com a `Solicitacao` atualizada.
 */
export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const usuario = await requireUser();

    const { id } = await params;

    const solicitacao = await cancelar(id, usuario);

    return Response.json({ solicitacao }, { status: 200 });
  } catch (erro) {
    if (erro instanceof ErroNaoAutenticado) {
      return Response.json({ error: erro.message }, { status: 401 });
    }
    if (erro instanceof ErroNaoAutorizadoCancelamento) {
      return Response.json({ error: erro.message }, { status: 403 });
    }
    if (erro instanceof ErroNaoEncontrado) {
      return Response.json({ error: erro.message }, { status: 404 });
    }
    if (erro instanceof ErroCancelamentoInvalido) {
      return Response.json({ error: erro.message }, { status: 409 });
    }
    throw erro;
  }
}
