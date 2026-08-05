import type { AuthenticatedUser } from "@/lib/services/authService";
import { Role } from "@/lib/generated/prisma/client";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { HelpButton } from "@/components/ajuda/HelpButton";
import styles from "./AppShell.module.css";

const ROLE_LABELS: Record<Role, string> = {
  [Role.SOLICITANTE]: "Solicitante",
  [Role.GESTOR]: "Gestor",
  [Role.RH_ADMIN]: "RH_Admin",
};

interface AppShellProps {
  usuario: AuthenticatedUser;
  children: React.ReactNode;
}

export function AppShell({ usuario, children }: AppShellProps) {
  return (
    <div className={styles.shell}>
      <Sidebar role={usuario.role} />

      <div className={styles.main}>
        <Topbar nome={usuario.nome} papelLabel={ROLE_LABELS[usuario.role]} />

        <div className={styles.content}>{children}</div>
      </div>

      <HelpButton />
    </div>
  );
}
