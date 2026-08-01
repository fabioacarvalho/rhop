import { verificarSla } from "@/lib/services/slaService";

/**
 * `GET /api/cron/sla-check` (SLA-01, SLA-06).
 *
 * Endpoint de sistema (Vercel Cron), sem sessao de usuario: autoriza via
 * `Authorization: Bearer ${CRON_SECRET}`. Sem `CRON_SECRET` configurado ou
 * com Bearer ausente/incorreto -> `401` sem chamar `verificarSla` (nenhum
 * efeito colateral). Autorizado -> executa o job e retorna o resumo.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const resumo = await verificarSla();

  return Response.json(resumo, { status: 200 });
}
