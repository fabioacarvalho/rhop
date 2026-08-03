import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import {
  cadastrar,
  ErroPermissaoUsuario,
  ErroValidacaoUsuario,
} from "@/lib/services/userService";
import { cadastrarUsuarioInputSchema } from "@/lib/validations/usuario";
import { Role } from "@/lib/generated/prisma/client";

/**
 * `POST /api/usuarios` (USR-01, USR-05, USR-06).
 *
 * - Sem sessao/papel != GESTOR/RH_ADMIN -> 401/403, sem tocar Zod nem o
 *   service.
 * - Corpo invalido (`cadastrarUsuarioInputSchema`) -> 400, `userService.cadastrar`
 *   nunca e chamado.
 * - Gestor fora do escopo (tentando outro `role`) -> 403.
 * - Hierarquia invalida/e-mail duplicado (`ErroValidacaoUsuario`) -> 409.
 * - Corpo valido -> `userService.cadastrar(dados, usuario)` -> 201 com
 *   `{ usuario, emailEnviado }`.
 */
export async function POST(request: Request) {
  try {
    const usuario = await requireUser([Role.GESTOR, Role.RH_ADMIN]);

    const corpo = await request.json();
    const resultado = cadastrarUsuarioInputSchema.safeParse(corpo);

    if (!resultado.success) {
      return Response.json(
        { error: "Dados invalidos.", detalhes: resultado.error.issues },
        { status: 400 },
      );
    }

    const { usuario: usuarioCriado, emailEnviado } = await cadastrar(
      resultado.data,
      usuario,
    );

    return Response.json(
      { usuario: usuarioCriado, emailEnviado },
      { status: 201 },
    );
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
    if (erro instanceof ErroValidacaoUsuario) {
      return Response.json({ error: erro.message }, { status: 409 });
    }
    throw erro;
  }
}
