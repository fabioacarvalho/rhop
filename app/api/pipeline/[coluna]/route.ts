import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import { listarColuna } from "@/lib/services/pipelineService";
import { colunaPorChave, type KanbanColunaChave } from "@/lib/config/kanbanColunas";
import { parsePipelineColunaQuery } from "@/lib/validations/pipelineFiltros";
import { Role } from "@/lib/generated/prisma/client";

/**
 * `GET /api/pipeline/[coluna]` (PIPE-14 — "+N outras").
 *
 * `requireUser([GESTOR, RH_ADMIN])` bloqueia antes de qualquer
 * validação/consulta: sem sessão -> 401, papel diferente -> 403.
 * `coluna` fora de `KanbanColunaChave` -> 400, query invalida -> 400,
 * `listarColuna` nunca é chamado nesses casos.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ coluna: string }> },
) {
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

  const { coluna } = await params;

  if (!colunaPorChave(coluna)) {
    return Response.json({ error: `Coluna invalida: ${coluna}` }, { status: 400 });
  }

  const resultado = parsePipelineColunaQuery(request.url);

  if (!resultado.success) {
    return Response.json(
      {
        error: "Parametros de consulta invalidos.",
        detalhes: resultado.error.issues,
      },
      { status: 400 },
    );
  }

  const { itens, total } = await listarColuna(
    usuario,
    coluna as KanbanColunaChave,
    resultado.data,
  );

  return Response.json({ itens, total }, { status: 200 });
}
