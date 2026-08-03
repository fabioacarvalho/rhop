import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import {
  editar,
  ErroNaoEncontradoEquipe,
  ErroValidacaoEquipe,
} from "@/lib/services/equipeService";
import { equipeInputSchema } from "@/lib/validations/equipe";
import { Role } from "@/lib/generated/prisma/client";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * `PUT /api/equipes/[id]` (gestao-equipes).
 *
 * - Sem sessao/papel != `RH_ADMIN` -> 401/403, sem tocar Zod nem o service.
 * - Corpo invalido (`equipeInputSchema`) -> 400, `equipeService.editar`
 *   nunca e chamado.
 * - `id` inexistente (`ErroNaoEncontradoEquipe`) -> 404.
 * - `nome` duplicado ou `gestor_id` invalido (`ErroValidacaoEquipe`) -> 409.
 * - Corpo valido -> `equipeService.editar(id, dados, usuario.id)` -> 200
 *   com `{ equipe }`.
 */
export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const usuario = await requireUser([Role.RH_ADMIN]);

    const { id } = await params;

    const corpo = await request.json();
    const resultado = equipeInputSchema.safeParse(corpo);

    if (!resultado.success) {
      return Response.json(
        { error: "Dados invalidos.", detalhes: resultado.error.issues },
        { status: 400 },
      );
    }

    const equipe = await editar(id, resultado.data, usuario.id);

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
    if (erro instanceof ErroValidacaoEquipe) {
      return Response.json({ error: erro.message }, { status: 409 });
    }
    throw erro;
  }
}
