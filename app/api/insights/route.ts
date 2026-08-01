import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import { agregar } from "@/lib/services/insightsService";
import { ErroNaoEncontrado } from "@/lib/services/tipoFluxoService";
import { parseInsightsQuery } from "@/lib/validations/insight";
import { Role } from "@/lib/generated/prisma/client";

/**
 * `GET /api/insights` (INSIGHT-04, INSIGHT-10).
 *
 * - `requireUser([GESTOR, RH_ADMIN])` bloqueia antes de qualquer
 *   validação/agregação: sem sessão -> 401, papel fora da lista -> 403.
 * - Query inválida -> 400 com `issues`.
 * - `tipoFluxoId` inexistente (`ErroNaoEncontrado`) -> 404.
 * - Sucesso -> 200 com `InsightResultado`. Nenhuma lógica de agregação nem
 *   acesso a `prisma` nesta rota — tudo delegado a `insightsService`.
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

  const resultado = parseInsightsQuery(request.url);

  if (!resultado.success) {
    return Response.json(
      {
        error: "Parametros de consulta invalidos.",
        detalhes: resultado.error.issues,
      },
      { status: 400 },
    );
  }

  try {
    const insight = await agregar(usuario, resultado.data);
    return Response.json(insight, { status: 200 });
  } catch (erro) {
    if (erro instanceof ErroNaoEncontrado) {
      return Response.json({ error: erro.message }, { status: 404 });
    }
    throw erro;
  }
}
