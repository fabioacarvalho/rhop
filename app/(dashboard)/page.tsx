import { redirect } from "next/navigation";
import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import { listar as listarTiposFluxo } from "@/lib/services/tipoFluxoService";
import { listarSolicitantesVisiveis } from "@/lib/services/dashboardService";
import { Role } from "@/lib/generated/prisma/client";
import ContadoresPainel from "./_components/ContadoresPainel";
import SolicitacoesFiltros from "./_components/SolicitacoesFiltros";
import ListaSolicitacoes from "./_components/ListaSolicitacoes";
import DashboardPaginacao from "./_components/DashboardPaginacao";
import styles from "./dashboard.module.css";

/**
 * Dashboard de Visão Geral (DASH-01 a DASH-10) — Server Component, tela
 * inicial pós-login do route group `(dashboard)`.
 *
 * Gate de acesso no backend, mesmo bloco try/catch de
 * `auditoria-logs/page.tsx`: sem sessão -> `redirect('/login')`; papel
 * `SOLICITANTE` (`ErroNaoAutorizado`) -> `redirect('/solicitacoes')`, já que
 * este papel não tem acesso ao dashboard de visão geral.
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
      redirect("/solicitacoes");
    }
    throw erro;
  }

  const [tiposDisponiveis, solicitantesDisponiveis] = await Promise.all([
    listarTiposFluxo(),
    listarSolicitantesVisiveis(usuario),
  ]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.subtitle}>
            Contadores e lista das solicitações do seu escopo.
          </p>
        </div>
      </header>

      <ContadoresPainel />

      <SolicitacoesFiltros
        tiposDisponiveis={tiposDisponiveis}
        solicitantesDisponiveis={solicitantesDisponiveis}
      />

      <ListaSolicitacoes />

      <DashboardPaginacao />
    </main>
  );
}
