import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import {
  buscarDetalhePorId,
  ErroNaoEncontrado,
  ErroAcessoNegado,
} from "@/lib/services/solicitacaoService";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * `GET /api/solicitacoes/[id]` (SOL-10 a SOL-12).
 *
 * `authService.requireUser()` sem restrição de `roles` — sem sessão -> 401.
 * `id` inexistente (`ErroNaoEncontrado`) -> 404; de outro solicitante
 * (`ErroAcessoNegado`) -> 403.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  let usuario;
  try {
    usuario = await requireUser();
  } catch (erro) {
    if (erro instanceof ErroNaoAutenticado) {
      return Response.json({ error: erro.message }, { status: 401 });
    }
    if (erro instanceof ErroNaoAutorizado) {
      return Response.json({ error: erro.message }, { status: 403 });
    }
    throw erro;
  }

  const { id } = await params;

  try {
    const solicitacao = await buscarDetalhePorId(id, usuario);
    return Response.json({ solicitacao }, { status: 200 });
  } catch (erro) {
    if (erro instanceof ErroNaoEncontrado) {
      return Response.json({ error: erro.message }, { status: 404 });
    }
    if (erro instanceof ErroAcessoNegado) {
      return Response.json({ error: erro.message }, { status: 403 });
    }
    throw erro;
  }
}
