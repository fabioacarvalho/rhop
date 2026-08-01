import { redirect } from "next/navigation";
import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import { Role } from "@/lib/generated/prisma/client";
import { BuscaForm } from "./_components/BuscaForm";
import styles from "./busca.module.css";

/**
 * Tela Buscar Candidatos (TAL-18) — Server Component: mesmo gate de acesso
 * das demais telas do módulo.
 */
export default async function Page() {
  try {
    await requireUser([Role.GESTOR, Role.RH_ADMIN]);
  } catch (erro) {
    if (erro instanceof ErroNaoAutenticado) {
      redirect("/login");
    }
    if (erro instanceof ErroNaoAutorizado) {
      return (
        <main className={styles.restrito}>
          <h1>Acesso restrito</h1>
          <p>Apenas gestores e RH podem buscar candidatos.</p>
        </main>
      );
    }
    throw erro;
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Buscar Candidatos</h1>
        <p className={styles.subtitle}>
          Descreva o perfil desejado e veja o ranking de candidatos mais
          aderentes.
        </p>
      </header>

      <BuscaForm />
    </main>
  );
}
