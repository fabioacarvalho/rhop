import { redirect } from "next/navigation";
import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import { Role } from "@/lib/generated/prisma/client";
import { NovoCandidatoForm } from "./_components/NovoCandidatoForm";
import styles from "./novo.module.css";

/**
 * Tela Novo Candidato (TAL-02) — Server Component: mesmo gate de acesso das
 * demais telas do módulo.
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
          <p>Apenas gestores e RH podem cadastrar candidatos.</p>
        </main>
      );
    }
    throw erro;
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Novo Candidato</h1>
        <p className={styles.subtitle}>
          Cole o currículo e a transcrição da entrevista do candidato.
        </p>
      </header>

      <NovoCandidatoForm />
    </main>
  );
}
