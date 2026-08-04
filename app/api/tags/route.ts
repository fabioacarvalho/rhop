import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import { criar, listar, ErroTagDuplicada } from "@/lib/services/tagService";
import { tagInputSchema } from "@/lib/validations/tag";
import { Role } from "@/lib/generated/prisma/client";

/**
 * `GET /api/tags` (TAL-36, TAL-37).
 *
 * `?ativo=true` filtra só Tags ativas — usado pelo formulário de cadastro de
 * candidato (TAL-36). Sem o filtro, retorna todas (ativas e inativas).
 * GESTOR e RH_ADMIN podem ler; só RH_ADMIN pode escrever (TAL-42).
 */
export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const somenteAtivas = searchParams.get("ativo") === "true";

  const tags = await listar(somenteAtivas);

  return Response.json({ tags }, { status: 200 });
}

/**
 * `POST /api/tags` (TAL-38, TAL-39, TAL-42) — RH_ADMIN-only (`context.md`).
 *
 * - Sem sessao/papel != `RH_ADMIN` -> 401/403.
 * - Corpo invalido (`tagInputSchema`) -> 400.
 * - Nome duplicado (case-insensitive) -> 409.
 * - Sucesso -> 201 com `{ tag }`.
 */
export async function POST(request: Request) {
  try {
    await requireUser([Role.RH_ADMIN]);

    const corpo = await request.json();
    const resultado = tagInputSchema.safeParse(corpo);

    if (!resultado.success) {
      return Response.json(
        { error: "Dados invalidos.", detalhes: resultado.error.issues },
        { status: 400 },
      );
    }

    const tag = await criar(resultado.data);

    return Response.json({ tag }, { status: 201 });
  } catch (erro) {
    if (erro instanceof ErroNaoAutenticado) {
      return Response.json({ error: erro.message }, { status: 401 });
    }
    if (erro instanceof ErroNaoAutorizado) {
      return Response.json({ error: erro.message }, { status: 403 });
    }
    if (erro instanceof ErroTagDuplicada) {
      return Response.json({ error: erro.message }, { status: 409 });
    }
    throw erro;
  }
}
