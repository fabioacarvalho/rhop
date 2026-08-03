import Link from "next/link";
import { redirect } from "next/navigation";
import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import { listarMinhas } from "@/lib/services/solicitacaoService";
import { Role } from "@/lib/generated/prisma/client";
import styles from "./solicitacoes.module.css";

const ROTULO_PAPEL: Record<Role, string> = {
  SOLICITANTE: "Solicitante",
  GESTOR: "Gestor",
  RH_ADMIN: "RH_Admin",
};

const ROTULO_STATUS: Record<string, string> = {
  PENDENTE: "Pendente",
  APROVADA: "Aprovado",
  REJEITADA: "Rejeitado",
};

const STAMP_STATUS: Record<string, string> = {
  PENDENTE: "stampPendente",
  APROVADA: "stampAprovada",
  REJEITADA: "stampRejeitada",
};

function formatarData(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(data));
}

function rotuloSla(status: string, prazoSla: Date): string {
  if (status !== "PENDENTE") {
    return "—";
  }

  const horas = Math.round(
    (new Date(prazoSla).getTime() - Date.now()) / (1000 * 60 * 60),
  );

  if (horas < 0) {
    return `Atrasada há ${Math.abs(horas)}h`;
  }
  return `${horas}h restantes`;
}

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
              </tr>
            </thead>
            <tbody>
              {solicitacoes.map((solicitacao) => (
                <tr key={solicitacao.id}>
                  <td>
                    <Link
                      href={`/solicitacoes/${solicitacao.id}`}
                      className={styles.proto}
                    >
                      {solicitacao.id.slice(0, 8).toUpperCase()}
                    </Link>
                  </td>
                  <td>
                    <span className={styles.chipTipo}>
                      {solicitacao.tipoFluxo.nome}
                    </span>
                  </td>
                  <td>
                    {solicitacao.status === "PENDENTE"
                      ? ROTULO_PAPEL[solicitacao.etapa_atual]
                      : "Encerrado"}
                  </td>
                  <td>
                    <span
                      className={`${styles.stamp} ${
                        styles[STAMP_STATUS[solicitacao.status]]
                      }`}
                    >
                      {ROTULO_STATUS[solicitacao.status]}
                    </span>
                  </td>
                  <td
                    className={
                      solicitacao.status === "PENDENTE" ? styles.slaAtraso : styles.mono
                    }
                  >
                    {rotuloSla(solicitacao.status, solicitacao.prazo_sla)}
                  </td>
                  <td className={styles.mono}>
                    {formatarData(solicitacao.criado_em)}
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
