import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import {
  reprocessarEmbedding,
  ErroNaoEncontrado,
  ErroReprocessamentoNaoPermitido,
} from "@/lib/services/candidatoService";
import { Role } from "@/lib/generated/prisma/client";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * `POST /api/candidatos/[id]/reprocessar` (TAL-29).
 *
 * - Sem sessao/papel SOLICITANTE -> 401/403.
 * - `id` inexistente (`ErroNaoEncontrado`) -> 404.
 * - `status_embedding` diferente de `falhou` (`ErroReprocessamentoNaoPermitido`)
 *   -> 409.
 * - Sucesso -> 200 com o `Candidato` atualizado.
 */
export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const usuario = await requireUser([Role.GESTOR, Role.RH_ADMIN]);

    const { id } = await params;
    const candidato = await reprocessarEmbedding(id, usuario.id);

    return Response.json({ candidato }, { status: 200 });
  } catch (erro) {
    if (erro instanceof ErroNaoAutenticado) {
      return Response.json({ error: erro.message }, { status: 401 });
    }
    if (erro instanceof ErroNaoAutorizado) {
      return Response.json({ error: erro.message }, { status: 403 });
    }
    if (erro instanceof ErroNaoEncontrado) {
      return Response.json({ error: erro.message }, { status: 404 });
    }
    if (erro instanceof ErroReprocessamentoNaoPermitido) {
      return Response.json({ error: erro.message }, { status: 409 });
    }
    throw erro;
  }
}
