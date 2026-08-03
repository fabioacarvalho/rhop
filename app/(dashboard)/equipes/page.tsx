import Link from "next/link";
import { redirect } from "next/navigation";
import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import { listar } from "@/lib/services/equipeService";
import { Role } from "@/lib/generated/prisma/client";
import StatusToggleButton from "./_components/StatusToggleButton";
import styles from "./equipes.module.css";

/**
 * Tela de listagem de `Equipe` (T11, EQP) — Server Component.
 *
 * RH_Admin-only: mesmo padrão de gate de acesso de
 * `configuracao-fluxos/page.tsx` — a checagem roda no backend, antes de
 * qualquer leitura de `Equipe`.
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

  const equipes = await listar();

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Equipes</h1>
          <p className={styles.subtitle}>Times e seus gestores responsáveis.</p>
        </div>
        <Link href="/equipes/novo" className={`${styles.btn} ${styles.btnPrimary}`}>
          + Nova equipe
        </Link>
      </header>

      {equipes.length === 0 ? (
        <p className={styles.empty}>Nenhuma equipe cadastrada ainda.</p>
      ) : (
        <div className={styles.card}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Gestor responsável</th>
                <th>Membros</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {equipes.map((item) => (
                <tr key={item.id}>
                  <td className={styles.nome}>{item.nome}</td>
                  <td>{item.gestor_nome}</td>
                  <td>
                    <span className={styles.chipContagem}>
                      {item.membros_ativos}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`${styles.stamp} ${
                        item.ativo ? styles.stampAtivo : styles.stampInativo
                      }`}
                    >
                      {item.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td>
                    <div className={styles.acoes}>
                      <Link
                        href={`/equipes/${item.id}/editar`}
                        className={`${styles.btn} ${styles.btnGhost} ${styles.btnGhostSm}`}
                      >
                        Editar
                      </Link>
                      <StatusToggleButton equipeId={item.id} ativo={item.ativo} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
