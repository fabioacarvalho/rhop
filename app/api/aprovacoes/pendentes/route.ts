import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import { listarPendentes } from "@/lib/services/aprovacaoService";
import { Role } from "@/lib/generated/prisma/client";

/**
 * `GET /api/aprovacoes/pendentes` (APR-01, APR-05).
 *
 * `authService.requireUser([Role.GESTOR, Role.RH_ADMIN])` bloqueia antes
 * de qualquer consulta: sem sessao -> 401 (`ErroNaoAutenticado`), papel
 * diferente -> 403 (`ErroNaoAutorizado`). `listarPendentes` nunca e
 * chamado nesses casos.
 */
export async function GET() {
  try {
    const usuario = await requireUser([Role.GESTOR, Role.RH_ADMIN]);
    const pendentes = await listarPendentes(usuario);
    return Response.json({ pendentes }, { status: 200 });
  } catch (erro) {
    if (erro instanceof ErroNaoAutenticado) {
      return Response.json({ error: erro.message }, { status: 401 });
    }
    if (erro instanceof ErroNaoAutorizado) {
      return Response.json({ error: erro.message }, { status: 403 });
    }
    throw erro;
  }
}
