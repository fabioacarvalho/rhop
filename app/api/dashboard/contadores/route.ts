import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import { contarPorStatus } from "@/lib/services/dashboardService";
import { Role } from "@/lib/generated/prisma/client";

/**
 * `GET /api/dashboard/contadores` (DASH-01, DASH-03).
 *
 * Sem query params — os contadores sempre refletem o escopo de visibilidade
 * completo do usuário, independente dos filtros aplicados à lista
 * (design.md, seção 0, Q#2).
 */
export async function GET() {
  let usuario;
  try {
    usuario = await requireUser([Role.GESTOR, Role.RH_ADMIN]);
  } catch (erro) {
    if (erro instanceof Error && erro.name === "ErroNaoAutenticado") {
      return Response.json({ error: erro.message }, { status: 401 });
    }
    if (erro instanceof Error && erro.name === "ErroNaoAutorizado") {
      return Response.json({ error: erro.message }, { status: 403 });
    }
    throw erro;
  }

  const contadores = await contarPorStatus(usuario);

  return Response.json(contadores, { status: 200 });
}
