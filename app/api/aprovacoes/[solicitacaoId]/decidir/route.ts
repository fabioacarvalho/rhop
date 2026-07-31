import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import {
  decidir,
  ErroNaoEncontrado,
  ErroNaoAutorizadoAprovacao,
  ErroDecisaoInvalida,
} from "@/lib/services/aprovacaoService";
import { decisaoInputSchema } from "@/lib/validations/aprovacao";
import { Role } from "@/lib/generated/prisma/client";

interface RouteContext {
  params: Promise<{ solicitacaoId: string }>;
}

/**
 * `POST /api/aprovacoes/[solicitacaoId]/decidir` (APR-03 a APR-08).
 *
 * - Sem sessao/papel != GESTOR|RH_ADMIN -> 401/403, sem tocar Zod nem o service.
 * - Corpo invalido (`decisaoInputSchema`) -> 400.
 * - Nao autorizado a decidir (`ErroNaoAutorizadoAprovacao`) -> 403.
 * - Solicitacao inexistente (`ErroNaoEncontrado`) -> 404.
 * - Decisao invalida para o estado atual (`ErroDecisaoInvalida`) -> 409.
 * - Sucesso -> 200 com a `Solicitacao` atualizada.
 */
export async function POST(request: Request, { params }: RouteContext) {
  try {
    const usuario = await requireUser([Role.GESTOR, Role.RH_ADMIN]);

    const { solicitacaoId } = await params;

    const corpo = await request.json();
    const resultado = decisaoInputSchema.safeParse(corpo);

    if (!resultado.success) {
      return Response.json(
        { error: "Dados invalidos.", detalhes: resultado.error.issues },
        { status: 400 },
      );
    }

    const solicitacao = await decidir(
      solicitacaoId,
      usuario,
      resultado.data,
    );

    return Response.json({ solicitacao }, { status: 200 });
  } catch (erro) {
    if (erro instanceof ErroNaoAutenticado) {
      return Response.json({ error: erro.message }, { status: 401 });
    }
    if (erro instanceof ErroNaoAutorizado) {
      return Response.json({ error: erro.message }, { status: 403 });
    }
    if (erro instanceof ErroNaoAutorizadoAprovacao) {
      return Response.json({ error: erro.message }, { status: 403 });
    }
    if (erro instanceof ErroNaoEncontrado) {
      return Response.json({ error: erro.message }, { status: 404 });
    }
    if (erro instanceof ErroDecisaoInvalida) {
      return Response.json({ error: erro.message }, { status: 409 });
    }
    throw erro;
  }
}
