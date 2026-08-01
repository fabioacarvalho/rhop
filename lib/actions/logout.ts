"use server";

import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Encerra a sessao Supabase e redireciona para o Login (AUTH-13/AUTH-14,
 * NAV-09). Falha em `signOut()` nunca impede o redirect — nunca deixa o
 * usuario preso numa tela autenticada.
 */
export async function logout(): Promise<void> {
  try {
    const supabase = await createServerClient();
    await supabase.auth.signOut();
  } catch (erro) {
    console.error("Falha ao encerrar sessao no logout", erro);
  }

  redirect("/login");
}
