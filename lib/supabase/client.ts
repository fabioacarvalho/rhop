import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase para uso em Client Components (browser).
 *
 * Diferente do cliente de servidor (`lib/supabase/server.ts`), o
 * `@supabase/ssr` gerencia a leitura/escrita dos cookies de sessão
 * automaticamente no browser — não é necessário (nem recomendado)
 * configurar `options.cookies` manualmente aqui.
 *
 * API confirmada em @supabase/ssr@0.12.4
 * (node_modules/@supabase/ssr/dist/module/createBrowserClient.d.ts) e na
 * documentação oficial da Supabase para Next.js App Router
 * (https://supabase.com/docs/guides/auth/server-side/creating-a-client):
 * `createBrowserClient(supabaseUrl, supabaseKey, options?)` retorna um
 * `SupabaseClient` já configurado para persistir sessão via cookies do
 * browser.
 */
export function createBrowserClient() {
  return createSupabaseBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
