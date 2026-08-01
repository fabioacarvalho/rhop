import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import {
  buscar,
  ErroNInvalido,
  ErroBuscaIndisponivel,
} from "@/lib/services/talentoSearchService";
import { talentoBuscaInputSchema } from "@/lib/validations/talentoBusca";
import { Role } from "@/lib/generated/prisma/client";

/**
 * `POST /api/candidatos/busca` (TAL-12 a TAL-19, TAL-26, TAL-30).
 *
 * - Sem sessao/papel SOLICITANTE -> 401/403, sem tocar Zod nem o service.
 * - Corpo invalido (`talentoBuscaInputSchema`) -> 400.
 * - `n` fora do teto (`ErroNInvalido`) -> 400, mensagem cita o teto atual.
 * - Embedding da query indisponivel (`ErroBuscaIndisponivel`) -> 422.
 * - Sucesso -> 200 com `ResultadoBusca`.
 */
export async function POST(request: Request) {
  try {
    await requireUser([Role.GESTOR, Role.RH_ADMIN]);

    const corpo = await request.json();
    const resultado = talentoBuscaInputSchema.safeParse(corpo);

    if (!resultado.success) {
      return Response.json(
        { error: "Dados invalidos.", detalhes: resultado.error.issues },
        { status: 400 },
      );
    }

    const busca = await buscar(resultado.data.texto, resultado.data.n);

    return Response.json(busca, { status: 200 });
  } catch (erro) {
    if (erro instanceof ErroNaoAutenticado) {
      return Response.json({ error: erro.message }, { status: 401 });
    }
    if (erro instanceof ErroNaoAutorizado) {
      return Response.json({ error: erro.message }, { status: 403 });
    }
    if (erro instanceof ErroNInvalido) {
      return Response.json({ error: erro.message }, { status: 400 });
    }
    if (erro instanceof ErroBuscaIndisponivel) {
      return Response.json({ error: erro.message }, { status: 422 });
    }
    throw erro;
  }
}
