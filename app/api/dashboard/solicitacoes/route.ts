import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import { listar } from "@/lib/services/dashboardService";
import { parseDashboardListaQuery } from "@/lib/validations/dashboardFiltros";
import { Role } from "@/lib/generated/prisma/client";

/**
 * `GET /api/dashboard/solicitacoes` (DASH-02 a DASH-08).
 *
 * `requireUser([GESTOR, RH_ADMIN])` bloqueia antes de qualquer
 * validação/consulta: sem sessão -> 401, papel diferente -> 403.
 * Query inválida -> 400, `listar` nunca é chamado.
 */
export async function GET(request: Request) {
  let usuario;
  try {
    usuario = await requireUser([Role.GESTOR, Role.RH_ADMIN]);
  } catch (erro) {
    if (erro instanceof ErroNaoAutenticado) {
      return Response.json({ error: erro.message }, { status: 401 });
    }
    if (erro instanceof ErroNaoAutorizado) {
      return Response.json({ error: erro.message }, { status: 403 });
    }
    throw erro;
  }

  const resultado = parseDashboardListaQuery(request.url);

  if (!resultado.success) {
    return Response.json(
      {
        error: "Parametros de consulta invalidos.",
        detalhes: resultado.error.issues,
      },
      { status: 400 },
    );
  }

  const { solicitacoes, total } = await listar(usuario, resultado.data);

  return Response.json({ solicitacoes, total }, { status: 200 });
}
