import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

/**
 * Helper de sessão para uso dentro de `middleware.ts` (raiz do projeto).
 *
 * Diferente de `lib/supabase/server.ts` (que usa `next/headers` — só
 * disponível em Server Components/Route Handlers), o contexto de middleware
 * não tem acesso a `cookies()`: os cookies de sessão são lidos do
 * `NextRequest` recebido e escritos tanto no `NextRequest` (para propagar a
 * sessão renovada aos Server Components desta mesma requisição) quanto no
 * `NextResponse` retornado (para persistir no cookie do browser).
 *
 * Sempre chama `supabase.auth.getUser()` — nunca `getSession()` — porque
 * `getUser()` revalida o JWT contra o servidor do Supabase Auth a cada
 * chamada; ler só o cookie local não garante que a sessão ainda é válida
 * (ex.: usuário deletado, sessão revogada).
 *
 * `middleware.ts` (T6/T10, ainda não criado) consome este helper para
 * decidir redirect/401/passthrough com base em `user`, e deve sempre
 * retornar (ou repassar) o `response` produzido aqui, já que é nele que o
 * eventual refresh de token é persistido.
 *
 * API confirmada em @supabase/ssr@0.12.4
 * (node_modules/@supabase/ssr/dist/module/createServerClient.d.ts e
 * types.d.ts — contrato `CookieMethodsServer` com `getAll`/`setAll`) e na
 * documentação oficial da Supabase para Next.js App Router, seção
 * "Middleware" (https://supabase.com/docs/guides/auth/server-side/nextjs):
 * o padrão é criar o `NextResponse` com `NextResponse.next({ request })`,
 * espelhar os cookies recebidos de `setAll` no `request` e recriar o
 * `response` a partir dele antes de gravar os cookies também no `response`.
 */
export async function updateSession(
  request: NextRequest,
): Promise<{ user: User | null; response: NextResponse }> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { user, response };
}
