import { z } from "zod";
import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import { listar } from "@/lib/services/logService";
import { Role } from "@/lib/generated/prisma/client";

/**
 * Query params aceitos por `GET /api/logs` (AUD-06 a AUD-09, AUD-11).
 *
 * Todos os campos são opcionais e combinados com AND lógico pelo
 * `logService.listar`. `refine` garante `data_inicio <= data_fim` quando
 * ambos estão presentes — falha aqui responde `400` sem chamar `listar`.
 */
export const queryLogsSchema = z
  .object({
    tipo: z.enum(["AUDITORIA", "ERRO"]).optional(),
    entidade: z.string().min(1).optional(),
    usuario_id: z.string().min(1).optional(),
    data_inicio: z.coerce.date().optional(),
    data_fim: z.coerce.date().optional(),
    page: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().positive().optional(),
  })
  .refine(
    (dados) =>
      !dados.data_inicio ||
      !dados.data_fim ||
      dados.data_inicio <= dados.data_fim,
    {
      message: "data_inicio deve ser anterior ou igual a data_fim.",
      path: ["data_inicio"],
    }
  );

/**
 * Extrai e valida os query params de uma URL de `GET /api/logs`. Isolado do
 * handler para permitir teste direto (sem precisar simular sessão/`Request`)
 * do parsing real usado em produção.
 */
export function parseLogsQuery(url: string) {
  const { searchParams } = new URL(url);
  return queryLogsSchema.safeParse({
    tipo: searchParams.get("tipo") ?? undefined,
    entidade: searchParams.get("entidade") ?? undefined,
    usuario_id: searchParams.get("usuario_id") ?? undefined,
    data_inicio: searchParams.get("data_inicio") ?? undefined,
    data_fim: searchParams.get("data_fim") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });
}

/**
 * `GET /api/logs` (AUD-05 a AUD-09, AUD-11).
 *
 * - `authService.requireUser(['RH_ADMIN'])` bloqueia antes de qualquer
 *   validação/consulta: sem sessão -> 401 (`ErroNaoAutenticado`), papel
 *   diferente de `RH_ADMIN` -> 403 (`ErroNaoAutorizado`). `logService.listar`
 *   nunca é chamado nesses casos.
 * - Query inválida (incluindo `data_inicio > data_fim`) -> 400, sem chamar
 *   `listar`.
 * - Query válida -> `logService.listar(filtros)` -> `200` com
 *   `{ logs, total }`.
 */
export async function GET(request: Request) {
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

  const resultado = parseLogsQuery(request.url);

  if (!resultado.success) {
    return Response.json(
      { error: "Parametros de consulta invalidos.", detalhes: resultado.error.issues },
      { status: 400 }
    );
  }

  const { logs, total } = await listar(resultado.data);

  return Response.json({ logs, total }, { status: 200 });
}
