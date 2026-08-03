import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client administrativo do Supabase Auth (service role) para uso no
 * runtime da aplicacao (API routes) — mesma configuracao ja usada em
 * `scripts/seed-users.ts`, extraida para reuso. Diferente de
 * `lib/supabase/server.ts` (sessao via cookies), este client usa a
 * service role key e nao deve ser exposto a nenhum Client Component.
 *
 * Instanciar por chamada (sem singleton em modulo), mesmo padrao de
 * `createServerClient`.
 */
export function createAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar definidos (.env) para usar o client admin do Supabase Auth.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
