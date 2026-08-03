import Link from "next/link";
import { redirect } from "next/navigation";
import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import { listarElegiveisComoGestor } from "@/lib/services/userService";
import { Role } from "@/lib/generated/prisma/client";
import UsuarioForm from "../_components/UsuarioForm";
import styles from "../usuarios.module.css";

/**
 * Tela de criação de `User` (USR-01, USR-07) — Server Component.
 *
 * Mesmo padrão de gate de acesso das demais telas desta feature. Só carrega
 * `listarElegiveisComoGestor()` quando o ator é `RH_ADMIN` — Gestor não
 * escolhe gestor/papel (fixos no backend), então não precisa dessa lista.
 */
export default async function Page() {
  let usuario;
  try {
    usuario = await requireUser([Role.GESTOR, Role.RH_ADMIN]);
  } catch (erro) {
    if (erro instanceof ErroNaoAutenticado) {
      redirect("/login");
    }
    if (erro instanceof ErroNaoAutorizado) {
      return (
        <main className={styles.restrito}>
          <h1>Acesso restrito</h1>
          <p>Você não tem permissão para acessar esta página.</p>
        </main>
      );
    }
    throw erro;
  }

  const ehRhAdmin = usuario.role === Role.RH_ADMIN;
  const gestoresElegiveis = ehRhAdmin
    ? await listarElegiveisComoGestor()
    : undefined;

  return (
    <main className={styles.page}>
      <Link href="/usuarios" className={styles.backLink}>
        ← {ehRhAdmin ? "Usuários" : "Minha equipe"}
      </Link>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Novo usuário</h1>
          <p className={styles.subtitle}>
            {ehRhAdmin
              ? "Defina nome, e-mail, papel e gestor."
              : "Defina nome e e-mail do novo colaborador da sua equipe."}
          </p>
        </div>
      </header>

      <UsuarioForm
        modo="criar"
        atorRole={usuario.role}
        gestoresElegiveis={gestoresElegiveis}
      />
    </main>
  );
}
