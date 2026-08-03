import Link from "next/link";
import { redirect } from "next/navigation";
import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import { listarElegiveisComoGestor } from "@/lib/services/userService";
import { Role } from "@/lib/generated/prisma/client";
import EquipeForm from "../_components/EquipeForm";
import styles from "../equipes.module.css";

/**
 * Tela de criação de `Equipe` (T11, EQP-01) — Server Component, RH_Admin-only.
 *
 * `listarElegiveisComoGestor()` retorna `GESTOR`/`RH_ADMIN` ativos — filtrado
 * aqui para só `role === 'GESTOR'`, porque `RH_ADMIN` não é elegível como
 * responsável de `Equipe`.
 */
export default async function Page() {
  try {
    await requireUser([Role.RH_ADMIN]);
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

  const elegiveis = await listarElegiveisComoGestor();
  const gestoresElegiveis = elegiveis
    .filter((elegivel) => elegivel.role === Role.GESTOR)
    .map((elegivel) => ({ id: elegivel.id, nome: elegivel.nome }));

  return (
    <main className={styles.page}>
      <Link href="/equipes" className={styles.backLink}>
        ← Equipes
      </Link>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Nova equipe</h1>
          <p className={styles.subtitle}>Defina nome e gestor responsável.</p>
        </div>
      </header>

      <EquipeForm modo="criar" gestoresElegiveis={gestoresElegiveis} />
    </main>
  );
}
