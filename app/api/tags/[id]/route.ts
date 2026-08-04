import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import {
  alternarAtivo,
  editar,
  ErroNaoEncontrado,
  ErroTagDuplicada,
} from "@/lib/services/tagService";
import { tagInputSchema } from "@/lib/validations/tag";
import { Role } from "@/lib/generated/prisma/client";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * `PATCH /api/tags/[id]` (TAL-40, TAL-41, TAL-42) — RH_ADMIN-only.
 *
 * Corpo com `ativo` (e nenhum `nome`/`funcao`) -> `tagService.alternarAtivo`
 * (TAL-41). Caso contrário, valida como envelope completo (`nome`+`funcao`)
 * e chama `tagService.editar` (TAL-40).
 *
 * - Sem sessao/papel != `RH_ADMIN` -> 401/403.
 * - `id` inexistente -> 404.
 * - Nome duplicado (de outra Tag) -> 409.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    await requireUser([Role.RH_ADMIN]);

    const { id } = await params;
    const corpo = await request.json();

    if (
      typeof corpo === "object" &&
      corpo !== null &&
      "ativo" in corpo &&
      !("nome" in corpo) &&
      !("funcao" in corpo)
    ) {
      const tag = await alternarAtivo(id, Boolean(corpo.ativo));
      return Response.json({ tag }, { status: 200 });
    }

    const resultado = tagInputSchema.safeParse(corpo);

    if (!resultado.success) {
      return Response.json(
        { error: "Dados invalidos.", detalhes: resultado.error.issues },
        { status: 400 },
      );
    }

    const tag = await editar(id, resultado.data);

    return Response.json({ tag }, { status: 200 });
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
    if (erro instanceof ErroTagDuplicada) {
      return Response.json({ error: erro.message }, { status: 409 });
    }
    throw erro;
  }
}
