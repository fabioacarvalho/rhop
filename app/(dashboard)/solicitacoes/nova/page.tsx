import Link from "next/link";
import { redirect } from "next/navigation";
import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import { listar as listarTiposFluxo } from "@/lib/services/tipoFluxoService";
import NovaSolicitacaoForm from "./_components/NovaSolicitacaoForm";
import styles from "../solicitacoes.module.css";

/**
 * Tela Nova Solicitação (SOL-03 a SOL-05) — Server Component.
 *
 * `requireUser()` sem restrição de papel; chama `tipoFluxoService.listar()`
 * DIRETO (sem round-trip), mesmo padrão de `configuracao-fluxos/page.tsx`.
 */
export default async function Page() {
  try {
    await requireUser();
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

  const tiposDisponiveis = await listarTiposFluxo();

  return (
    <main className={styles.page}>
      <Link href="/solicitacoes" className={styles.backLink}>
        ← Minhas Solicitações
      </Link>
      <h1 className={styles.title}>Nova Solicitação</h1>
      <p className={styles.subtitle} style={{ marginBottom: 22 }}>
        Escolha o tipo de fluxo. Os campos abaixo mudam de acordo com a
        escolha.
      </p>

      {tiposDisponiveis.length === 0 ? (
        <p className={styles.empty}>
          Nenhum tipo de fluxo disponível no momento.
        </p>
      ) : (
        <NovaSolicitacaoForm tiposDisponiveis={tiposDisponiveis} />
      )}
    </main>
  );
}
