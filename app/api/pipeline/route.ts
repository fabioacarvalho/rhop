import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import { listarBoard } from "@/lib/services/pipelineService";
import { parsePipelineFiltroQuery } from "@/lib/validations/pipelineFiltros";
import { Role } from "@/lib/generated/prisma/client";

/**
 * `GET /api/pipeline` (PIPE-01 a PIPE-04).
 *
 * `requireUser([GESTOR, RH_ADMIN])` bloqueia antes de qualquer
 * validação/consulta: sem sessão -> 401, papel diferente -> 403.
 * Query inválida -> 400, `listarBoard` nunca é chamado.
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

  const resultado = parsePipelineFiltroQuery(request.url);

  if (!resultado.success) {
    return Response.json(
      {
        error: "Parametros de consulta invalidos.",
        detalhes: resultado.error.issues,
      },
      { status: 400 },
    );
  }

  const board = await listarBoard(usuario, resultado.data);

  return Response.json({ board }, { status: 200 });
}
