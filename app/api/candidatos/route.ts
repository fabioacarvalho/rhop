import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import {
  listar,
  cadastrar,
  ErroEmailDuplicado,
} from "@/lib/services/candidatoService";
import { candidatoInputSchema } from "@/lib/validations/candidato";
import { Role } from "@/lib/generated/prisma/client";

/**
 * `GET /api/candidatos` (TAL-08 a TAL-10).
 *
 * `requireUser([Role.GESTOR, Role.RH_ADMIN])` bloqueia antes de qualquer
 * consulta: sem sessao -> 401, papel SOLICITANTE -> 403.
 */
export async function GET() {
  try {
    await requireUser([Role.GESTOR, Role.RH_ADMIN]);
  } catch (erro) {
    if (erro instanceof ErroNaoAutenticado) {
      return Response.json({ error: erro.message }, { status: 401 });
    }
    if (erro instanceof ErroNaoAutorizado) {
      return Response.json({ error: erro.message }, { status: 403 });
    }
    throw erro;
  }

  const candidatos = await listar();

  return Response.json({ candidatos }, { status: 200 });
}

/**
 * `POST /api/candidatos` (TAL-01, TAL-02, TAL-06, TAL-07, TAL-28).
 *
 * - Sem sessao/papel SOLICITANTE -> 401/403, sem tocar Zod nem o service.
 * - Corpo invalido (`candidatoInputSchema`) -> 400, `candidatoService.cadastrar`
 *   nunca e chamado.
 * - E-mail duplicado (`ErroEmailDuplicado`) -> 409.
 * - Corpo valido -> `candidatoService.cadastrar(dados, usuario.id)` -> 201.
 */
export async function POST(request: Request) {
  try {
    const usuario = await requireUser([Role.GESTOR, Role.RH_ADMIN]);

    const corpo = await request.json();
    const resultado = candidatoInputSchema.safeParse(corpo);

    if (!resultado.success) {
      return Response.json(
        { error: "Dados invalidos.", detalhes: resultado.error.issues },
        { status: 400 },
      );
    }

    const candidato = await cadastrar(resultado.data, usuario.id);

    return Response.json({ candidato }, { status: 201 });
  } catch (erro) {
    if (erro instanceof ErroNaoAutenticado) {
      return Response.json({ error: erro.message }, { status: 401 });
    }
    if (erro instanceof ErroNaoAutorizado) {
      return Response.json({ error: erro.message }, { status: 403 });
    }
    if (erro instanceof ErroEmailDuplicado) {
      return Response.json({ error: erro.message }, { status: 409 });
    }
    throw erro;
  }
}
