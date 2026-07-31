import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente Supabase para uso em Server Components e Route Handlers (App Router).
 *
 * Lê/escreve a sessão via cookies do Next.js (`next/headers`). Deve ser
 * instanciado a cada request — nunca reusar/cachear a instância entre
 * requisições (recomendação oficial do `@supabase/ssr`).
 *
 * Nota: em Server Components a escrita de cookies (`cookieStore.set`) lança
 * erro em runtime (Server Components não podem escrever cookies) — por isso
 * o `setAll` abaixo contém a exceção em um `try/catch`. Nesses casos, é o
 * `middleware.ts` (ver `lib/supabase/middleware.ts`) quem fica responsável
 * por persistir o refresh de sessão na resposta.
 *
 * API confirmada em @supabase/ssr@0.12.4 (node_modules/@supabase/ssr/dist/module/createServerClient.d.ts
 * e types.d.ts) e na documentação oficial da Supabase para Next.js App Router
 * (https://supabase.com/docs/guides/auth/server-side/nextjs,
 * https://supabase.com/docs/guides/auth/server-side/creating-a-client):
 * o contrato atual de `cookies` é `{ getAll, setAll }` — os métodos legados
 * `get`/`set`/`remove` estão deprecados e não devem ser usados.
 */
export async function createServerClient() {
  const cookieStore = await cookies();

  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado a partir de um Server Component, que não pode
            // escrever cookies. Seguro ignorar aqui porque o
            // middleware.ts é responsável por revalidar/persistir a
            // sessão a cada requisição.
          }
        },
      },
    },
  );
}
