import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import {
  listarMinhas,
  criar,
  ErroTipoFluxoNaoEncontrado,
  ErroDadosInvalidos,
} from "@/lib/services/solicitacaoService";
import { solicitacaoInputSchema } from "@/lib/validations/solicitacao";

/**
 * `GET /api/solicitacoes` (SOL-01).
 *
 * `authService.requireUser()` sem restrição de `roles` — qualquer papel
 * autenticado pode listar as próprias solicitações. Sem sessão -> 401,
 * `solicitacaoService.listarMinhas` nunca é chamado nesse caso.
 */
export async function GET() {
  let usuario;
  try {
    usuario = await requireUser();
  } catch (erro) {
    if (erro instanceof ErroNaoAutenticado) {
      return Response.json({ error: erro.message }, { status: 401 });
    }
    if (erro instanceof ErroNaoAutorizado) {
      return Response.json({ error: erro.message }, { status: 403 });
    }
    throw erro;
  }

  const solicitacoes = await listarMinhas(usuario.id);

  return Response.json({ solicitacoes }, { status: 200 });
}

/**
 * `POST /api/solicitacoes` (SOL-04 a SOL-08).
 *
 * - Sem sessão -> 401, sem tocar Zod nem o service.
 * - Corpo inválido (`solicitacaoInputSchema`) -> 400 com `detalhes`,
 *   `solicitacaoService.criar` nunca é chamado.
 * - `tipo_fluxo_id` inexistente (`ErroTipoFluxoNaoEncontrado`) -> 404.
 * - `dados` inválido contra `campos_formulario` (`ErroDadosInvalidos`) ->
 *   400 com `erros` por campo.
 * - Corpo válido -> `solicitacaoService.criar(dados, usuario.id)` -> 201 com
 *   a `Solicitacao` criada.
 */
export async function POST(request: Request) {
  try {
    const usuario = await requireUser();

    const corpo = await request.json();
    const resultado = solicitacaoInputSchema.safeParse(corpo);

    if (!resultado.success) {
      return Response.json(
        { error: "Dados invalidos.", detalhes: resultado.error.issues },
        { status: 400 },
      );
    }

    const solicitacao = await criar(resultado.data, usuario.id);

    return Response.json({ solicitacao }, { status: 201 });
  } catch (erro) {
    if (erro instanceof ErroNaoAutenticado) {
      return Response.json({ error: erro.message }, { status: 401 });
    }
    if (erro instanceof ErroNaoAutorizado) {
      return Response.json({ error: erro.message }, { status: 403 });
    }
    if (erro instanceof ErroTipoFluxoNaoEncontrado) {
      return Response.json({ error: erro.message }, { status: 404 });
    }
    if (erro instanceof ErroDadosInvalidos) {
      return Response.json(
        { error: erro.message, erros: erro.erros },
        { status: 400 },
      );
    }
    throw erro;
  }
}
