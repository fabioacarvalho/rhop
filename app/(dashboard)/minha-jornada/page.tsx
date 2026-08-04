import { requireUser } from "@/lib/services/authService";
import { redirect } from "next/navigation";
import { ErroNaoAutenticado, ErroNaoAutorizado } from "@/lib/services/authService";
import styles from "./minha-jornada.module.css";

export const metadata = {
  title: "Minha Jornada | FluxoRH",
};

export default async function MinhaJornadaPage() {
  let usuario;
  try {
    usuario = await requireUser();
  } catch (erro) {
    if (erro instanceof ErroNaoAutenticado) {
      redirect("/login");
    }
    if (erro instanceof ErroNaoAutorizado) {
      return (
        <main className={styles.page}>
          <h1>Acesso restrito</h1>
          <p>Você não tem permissão para acessar esta página.</p>
        </main>
      );
    }
    throw erro;
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Minha jornada</h1>
          <p className={styles.subtitle}>
            Acompanhe sua trajetória, desenvolvimento e marcos dentro da empresa.
          </p>
        </div>
      </header>

      <div className={`${styles.card} ${styles.emptyState}`}>
        <div className={styles.seal}>FR</div>
        <h2 className={styles.emptyTitle}>Em construção</h2>
        <p className={styles.emptyText}>
          Em breve, você poderá visualizar sua linha do tempo corporativa, histórico de feedbacks, 
          evolução de cargo e outros marcos importantes da sua jornada por aqui.
        </p>
      </div>
    </main>
  );
}
