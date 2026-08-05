import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Ponto único de proteção de rota (AUTH-09, AUTH-10, AUTH-11, AUTH-12) —
 * decide entre 401 JSON, redirect e passthrough com base apenas em existir
 * (ou não) uma sessão Supabase válida, revalidada por `updateSession`
 * (`supabase.auth.getUser()`, nunca só o cookie presente — cobre AUTH-11).
 *
 * A resolução de `User` (Prisma) e de `role` específico NÃO acontece aqui —
 * fica a cargo de `authService.requireUser` dentro de cada route/página, para
 * que o middleware nunca precise tocar Prisma (design.md, seção
 * `middleware.ts`).
 *
 * - Sem sessão + rota `/api/*` → responde `401` JSON diretamente (a resposta
 *   é produzida e devolvida aqui mesmo — o handler da rota nunca é invocado,
 *   diferente de deixar passar via `NextResponse.next()`).
 * - Sem sessão + rota de página → `NextResponse.redirect` para `/login`.
 * - Sessão válida → `return response` de `updateSession`, que já equivale a
 *   `NextResponse.next()` (com o eventual refresh de cookie persistido).
 */
export async function middleware(request: NextRequest) {
  const { user, response } = await updateSession(request);

  if (user) {
    return response;
  }

  if (request.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  return NextResponse.redirect(new URL("/login", request.url));
}

/**
 * Adaptado do exemplo oficial de "Negative matching" da documentação do
 * Next.js para middleware/proxy
 * (https://nextjs.org/docs/app/api-reference/file-conventions/proxy#negative-matching):
 * exclui assets estáticos/arquivos de metadata, a página pública `/login` e
 * `auth/callback` (GAUTH-01, GAUTH-03) — sem essa exclusão, o primeiro hit ao
 * callback (ainda sem cookie de sessão) seria redirecionado para `/login`
 * pelo próprio middleware antes de `exchangeCodeForSession` rodar.
 *
 * Diferente do exemplo padrão da doc — que também exclui `api` — aqui `/api`
 * NÃO é excluído: o middleware precisa correr em `/api/*` para devolver 401
 * sem sessão (AUTH-10/AUTH-12).
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|login|auth/callback|api/mcp|api/dev).*)",
  ],
};
