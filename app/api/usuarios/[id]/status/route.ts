import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import {
  definirStatus,
  ErroNaoEncontradoUsuario,
  ErroPermissaoUsuario,
} from "@/lib/services/userService";
import { definirStatusInputSchema } from "@/lib/validations/usuario";
import { Role } from "@/lib/generated/prisma/client";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * `PATCH /api/usuarios/[id]/status` (USR-21, USR-24).
 *
 * - Sem sessao/papel != GESTOR/RH_ADMIN -> 401/403, sem tocar Zod nem o
 *   service.
 * - Corpo invalido (`definirStatusInputSchema`) -> 400,
 *   `userService.definirStatus` nunca e chamado.
 * - `id` inexistente ou fora do escopo do Gestor (`ErroNaoEncontradoUsuario`)
 *   -> 404.
 * - Fora do escopo/autoacao (`ErroPermissaoUsuario`) -> 403.
 * - Corpo valido -> `userService.definirStatus(id, ativo, usuario)` -> 200
 *   com `{ usuario }`.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const usuario = await requireUser([Role.GESTOR, Role.RH_ADMIN]);

    const { id } = await params;

    const corpo = await request.json();
    const resultado = definirStatusInputSchema.safeParse(corpo);

    if (!resultado.success) {
      return Response.json(
        { error: "Dados invalidos.", detalhes: resultado.error.issues },
        { status: 400 },
      );
    }

    const usuarioAtualizado = await definirStatus(
      id,
      resultado.data.ativo,
      usuario,
    );

    return Response.json({ usuario: usuarioAtualizado }, { status: 200 });
  } catch (erro) {
    if (erro instanceof ErroNaoAutenticado) {
      return Response.json({ error: erro.message }, { status: 401 });
    }
    if (erro instanceof ErroNaoAutorizado) {
      return Response.json({ error: erro.message }, { status: 403 });
    }
    if (erro instanceof ErroPermissaoUsuario) {
      return Response.json({ error: erro.message }, { status: 403 });
    }
    if (erro instanceof ErroNaoEncontradoUsuario) {
      return Response.json({ error: erro.message }, { status: 404 });
    }
    throw erro;
  }
}
