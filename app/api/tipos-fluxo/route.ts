import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import {
  listar,
  criar,
  ErroValidacaoTipoFluxo,
} from "@/lib/services/tipoFluxoService";
import { tipoFluxoInputSchema } from "@/lib/validations/tipoFluxo";
import { Role } from "@/lib/generated/prisma/client";

/**
 * `GET /api/tipos-fluxo` (CONF-06).
 *
 * `authService.requireUser([Role.RH_ADMIN])` bloqueia antes de qualquer
 * consulta: sem sessao -> 401 (`ErroNaoAutenticado`), papel diferente de
 * `RH_ADMIN` -> 403 (`ErroNaoAutorizado`). `tipoFluxoService.listar` nunca e
 * chamado nesses casos.
 */
export async function GET() {
  try {
    await requireUser([Role.RH_ADMIN]);
  } catch (erro) {
    if (erro instanceof ErroNaoAutenticado) {
      return Response.json({ error: erro.message }, { status: 401 });
    }
    if (erro instanceof ErroNaoAutorizado) {
      return Response.json({ error: erro.message }, { status: 403 });
    }
    throw erro;
  }

  const tiposFluxo = await listar();

  return Response.json({ tiposFluxo }, { status: 200 });
}

/**
 * `POST /api/tipos-fluxo` (CONF-01 a CONF-05, CONF-08, CONF-09).
 *
 * - Sem sessao/papel != `RH_ADMIN` -> 401/403, sem tocar Zod nem o service.
 * - Corpo invalido (`tipoFluxoInputSchema`) -> 400, `tipoFluxoService.criar`
 *   nunca e chamado.
 * - `nome` duplicado (`ErroValidacaoTipoFluxo`) -> 409.
 * - Corpo valido -> `tipoFluxoService.criar(dados, usuario.id)` -> 201 com o
 *   `TipoFluxo` criado.
 */
export async function POST(request: Request) {
  try {
    const usuario = await requireUser([Role.RH_ADMIN]);

    const corpo = await request.json();
    const resultado = tipoFluxoInputSchema.safeParse(corpo);

    if (!resultado.success) {
      return Response.json(
        { error: "Dados invalidos.", detalhes: resultado.error.issues },
        { status: 400 },
      );
    }

    const tipoFluxo = await criar(resultado.data, usuario.id);

    return Response.json({ tipoFluxo }, { status: 201 });
  } catch (erro) {
    if (erro instanceof ErroNaoAutenticado) {
      return Response.json({ error: erro.message }, { status: 401 });
    }
    if (erro instanceof ErroNaoAutorizado) {
      return Response.json({ error: erro.message }, { status: 403 });
    }
    if (erro instanceof ErroValidacaoTipoFluxo) {
      return Response.json({ error: erro.message }, { status: 409 });
    }
    throw erro;
  }
}
