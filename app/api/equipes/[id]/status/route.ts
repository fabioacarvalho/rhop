import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import {
  definirStatus,
  ErroNaoEncontradoEquipe,
  ErroEdicaoBloqueadaEquipe,
} from "@/lib/services/equipeService";
import { definirStatusEquipeInputSchema } from "@/lib/validations/equipe";
import { Role } from "@/lib/generated/prisma/client";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * `PATCH /api/equipes/[id]/status` (gestao-equipes).
 *
 * - Sem sessao/papel != `RH_ADMIN` -> 401/403, sem tocar Zod nem o service.
 * - Corpo invalido (`definirStatusEquipeInputSchema`) -> 400,
 *   `equipeService.definirStatus` nunca e chamado.
 * - `id` inexistente (`ErroNaoEncontradoEquipe`) -> 404.
 * - Desativacao bloqueada por membro ativo vinculado
 *   (`ErroEdicaoBloqueadaEquipe`) -> 409.
 * - Corpo valido -> `equipeService.definirStatus(id, dados.ativo, usuario.id)`
 *   -> 200 com `{ equipe }`.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const usuario = await requireUser([Role.RH_ADMIN]);

    const { id } = await params;

    const corpo = await request.json();
    const resultado = definirStatusEquipeInputSchema.safeParse(corpo);

    if (!resultado.success) {
      return Response.json(
        { error: "Dados invalidos.", detalhes: resultado.error.issues },
        { status: 400 },
      );
    }

    const equipe = await definirStatus(id, resultado.data.ativo, usuario.id);

    return Response.json({ equipe }, { status: 200 });
  } catch (erro) {
    if (erro instanceof ErroNaoAutenticado) {
      return Response.json({ error: erro.message }, { status: 401 });
    }
    if (erro instanceof ErroNaoAutorizado) {
      return Response.json({ error: erro.message }, { status: 403 });
    }
    if (erro instanceof ErroNaoEncontradoEquipe) {
      return Response.json({ error: erro.message }, { status: 404 });
    }
    if (erro instanceof ErroEdicaoBloqueadaEquipe) {
      return Response.json({ error: erro.message }, { status: 409 });
    }
    throw erro;
  }
}
