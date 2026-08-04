import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { autenticarComGoogle } from "@/lib/services/authService";

/**
 * Troca o `code` OAuth (PKCE) por sessao Supabase e decide o redirect com
 * base em `autenticarComGoogle` (GAUTH-01, GAUTH-02, GAUTH-03).
 *
 * Precisa estar excluido do `matcher` de `middleware.ts` — no primeiro hit
 * ainda nao existe cookie de sessao.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (!code || searchParams.get("error")) {
    return NextResponse.redirect(`${origin}/login?erro=google`);
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error("exchangeCodeForSession falhou:", error);
    return NextResponse.redirect(`${origin}/login?erro=google`);
  }

  const resultado = await autenticarComGoogle(data.user);

  if (resultado.status === "negado") {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?erro=dominio`);
  }

  if (resultado.status === "onboarding_equipe") {
    return NextResponse.redirect(`${origin}/onboarding/equipe`);
  }

  return NextResponse.redirect(`${origin}/`);
}
