import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import {
  buscarPorId,
  editar,
  ErroNaoEncontrado,
  ErroEdicaoBloqueada,
  ErroValidacaoTipoFluxo,
} from "@/lib/services/tipoFluxoService";
import { tipoFluxoInputSchema } from "@/lib/validations/tipoFluxo";
import { Role } from "@/lib/generated/prisma/client";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * `GET /api/tipos-fluxo/[id]` (CONF-06).
 *
 * Qualquer usuario autenticado pode consultar (SOLICITANTE usa esta rota
 * para carregar `campos_formulario`/`etapas` ao montar Nova Solicitacao).
 * Sem sessao -> 401. `id` sem registro correspondente (`ErroNaoEncontrado`)
 * -> 404.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  try {
    await requireUser();
  } catch (erro) {
    if (erro instanceof ErroNaoAutenticado) {
      return Response.json({ error: erro.message }, { status: 401 });
    }
    if (erro instanceof ErroNaoAutorizado) {
      return Response.json({ error: erro.message }, { status: 403 });
    }
    throw erro;
  }

  const { id } = await params;

  try {
    const tipoFluxo = await buscarPorId(id);
    return Response.json({ tipoFluxo }, { status: 200 });
  } catch (erro) {
    if (erro instanceof ErroNaoEncontrado) {
      return Response.json({ error: erro.message }, { status: 404 });
    }
    throw erro;
  }
}

/**
 * `PUT /api/tipos-fluxo/[id]` (CONF-07, CONF-08, CONF-09).
 *
 * - Sem sessao/papel != `RH_ADMIN` -> 401/403, sem tocar Zod nem o service.
 * - Corpo invalido (`tipoFluxoInputSchema`) -> 400, `tipoFluxoService.editar`
 *   nunca e chamado.
 * - `id` inexistente (`ErroNaoEncontrado`) -> 404.
 * - Edicao bloqueada por `Solicitacao` pendente (`ErroEdicaoBloqueada`) -> 409,
 *   repassando a mensagem do erro (ja cita a quantidade de pendencias).
 * - `nome` duplicado (`ErroValidacaoTipoFluxo`) -> 409.
 * - Corpo valido -> `tipoFluxoService.editar(id, dados, usuario.id)` -> 200
 *   com o `TipoFluxo` atualizado.
 */
export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const usuario = await requireUser([Role.RH_ADMIN]);

    const { id } = await params;

    const corpo = await request.json();
    const resultado = tipoFluxoInputSchema.safeParse(corpo);

    if (!resultado.success) {
      return Response.json(
        { error: "Dados invalidos.", detalhes: resultado.error.issues },
        { status: 400 },
      );
    }

    const tipoFluxo = await editar(id, resultado.data, usuario.id);

    return Response.json({ tipoFluxo }, { status: 200 });
  } catch (erro) {
    if (erro instanceof ErroNaoAutenticado) {
      return Response.json({ error: erro.message }, { status: 401 });
    }
    if (erro instanceof ErroNaoAutorizado) {
      return Response.json({ error: erro.message }, { status: 403 });
    }
    if (erro instanceof ErroNaoEncontrado) {
      return Response.json({ error: erro.message }, { status: 404 });
    }
    if (erro instanceof ErroEdicaoBloqueada) {
      return Response.json({ error: erro.message }, { status: 409 });
    }
    if (erro instanceof ErroValidacaoTipoFluxo) {
      return Response.json({ error: erro.message }, { status: 409 });
    }
    throw erro;
  }
}
