import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import {
  editar,
  ErroEdicaoBloqueadaUsuario,
  ErroNaoEncontradoUsuario,
  ErroPermissaoUsuario,
  ErroValidacaoUsuario,
} from "@/lib/services/userService";
import { editarUsuarioInputSchema } from "@/lib/validations/usuario";
import { Role } from "@/lib/generated/prisma/client";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * `PUT /api/usuarios/[id]` (USR-16, USR-17, USR-18, USR-20).
 *
 * - Sem sessao/papel != GESTOR/RH_ADMIN -> 401/403, sem tocar Zod nem o
 *   service.
 * - Corpo invalido (`editarUsuarioInputSchema`) -> 400, `userService.editar`
 *   nunca e chamado.
 * - `id` inexistente ou fora do escopo do Gestor (`ErroNaoEncontradoUsuario`)
 *   -> 404.
 * - Fora do escopo/autoedicao (`ErroPermissaoUsuario`) -> 403.
 * - Troca de role bloqueada por equipe dependente
 *   (`ErroEdicaoBloqueadaUsuario`) -> 409.
 * - Hierarquia invalida (`ErroValidacaoUsuario`) -> 409.
 * - Corpo valido -> `userService.editar(id, dados, usuario)` -> 200 com
 *   `{ usuario }`.
 */
export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const usuario = await requireUser([Role.GESTOR, Role.RH_ADMIN]);

    const { id } = await params;

    const corpo = await request.json();
    const resultado = editarUsuarioInputSchema.safeParse(corpo);

    if (!resultado.success) {
      return Response.json(
        { error: "Dados invalidos.", detalhes: resultado.error.issues },
        { status: 400 },
      );
    }

    const usuarioEditado = await editar(id, resultado.data, usuario);

    return Response.json({ usuario: usuarioEditado }, { status: 200 });
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
    if (
      erro instanceof ErroEdicaoBloqueadaUsuario ||
      erro instanceof ErroValidacaoUsuario
    ) {
      return Response.json({ error: erro.message }, { status: 409 });
    }
    throw erro;
  }
}
