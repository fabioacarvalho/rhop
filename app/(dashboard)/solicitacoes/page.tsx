import Link from "next/link";
import { redirect } from "next/navigation";
import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import { listarMinhas } from "@/lib/services/solicitacaoService";
import SolicitacaoTableBody from "./_components/SolicitacaoTableBody";
import styles from "./solicitacoes.module.css";

/**
 * Tela Minhas Solicitações (SOL-01 a SOL-03, SOL-14, SOL-15) — Server
 * Component. Visual alinhado a `docs/design-ux-ui/fluxorh-mockup.html`
 * (`#screen-minhas`).
 *
 * Gate de acesso no backend, mesmo padrão de `configuracao-fluxos/page.tsx`:
 * sem sessão -> `redirect('/login')`. Sem restrição de papel — qualquer
 * colaborador autenticado tem suas próprias solicitações.
 */
export default async function Page() {
  let usuario;
  try {
    usuario = await requireUser();
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

  const solicitacoes = await listarMinhas(usuario.id);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Minhas Solicitações</h1>
          <p className={styles.subtitle}>
            Tudo que você abriu, do pedido até a decisão final.
          </p>
        </div>
        <Link
          href="/solicitacoes/nova"
          className={`${styles.btn} ${styles.btnPrimary}`}
        >
          + Nova Solicitação
        </Link>
      </header>

      {solicitacoes.length === 0 ? (
        <p className={styles.empty}>
          Você ainda não abriu nenhuma solicitação.
        </p>
      ) : (
        <div className={styles.card}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Protocolo</th>
                <th>Tipo</th>
                <th>Etapa atual</th>
                <th>Status</th>
                <th>SLA</th>
                <th>Aberta em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <SolicitacaoTableBody solicitacoes={solicitacoes} />
          </table>
        </div>
      )}
    </main>
  );
}
