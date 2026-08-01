import { redirect } from "next/navigation";
import {
  requireUser,
  ErroNaoAutenticado,
} from "@/lib/services/authService";
import { AppShell } from "./_components/AppShell";

/**
 * Layout do grupo de rotas `(dashboard)` — resolve a sessao autenticada
 * (qualquer papel) e monta o App Shell (Sidebar + Topbar) em volta de todas
 * as telas (NAV-01, NAV-08). Cada `page.tsx` continua dona da sua propria
 * checagem de papel especifica (`requireUser([...])`), inalterada.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let usuario;
  try {
    usuario = await requireUser();
  } catch (erro) {
    if (erro instanceof ErroNaoAutenticado) {
      redirect("/login");
    }
    throw erro;
  }

  return <AppShell usuario={usuario}>{children}</AppShell>;
}
