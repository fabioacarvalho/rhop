import Link from "next/link";
import { redirect } from "next/navigation";
import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import { Role } from "@/lib/generated/prisma/client";
import TipoFluxoForm from "../_components/TipoFluxoForm";
import styles from "../configuracao-fluxos.module.css";

/**
 * Tela de criação de `TipoFluxo` (CONF-01, CONF-07) — Server Component.
 *
 * Mesmo padrão de gate de acesso de `auditoria-logs/page.tsx` e da listagem
 * (`configuracao-fluxos/page.tsx`): a checagem roda no backend, antes de
 * renderizar qualquer coisa — quem não é `RH_ADMIN` nunca chega a ver o
 * `TipoFluxoForm`.
 *
 * - Sem sessão (`ErroNaoAutenticado`) -> `redirect('/login')`.
 * - Sessão válida, papel diferente de `RH_ADMIN` (`ErroNaoAutorizado`) ->
 *   mensagem "Acesso restrito", sem renderizar o formulário.
 *
 * Sem dados pré-existentes (é criação) -> `TipoFluxoForm` em `modo="criar"`,
 * sem `tipoFluxoId`/`initialData`.
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

  return (
    <main className={styles.page}>
      <Link href="/configuracao-fluxos" className={styles.backLink}>
        ← Configuração de Fluxos
      </Link>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Novo tipo de fluxo</h1>
          <p className={styles.subtitle}>
            Defina o nome, as etapas de aprovação e os campos do formulário.
          </p>
        </div>
      </header>

      <TipoFluxoForm modo="criar" />
    </main>
  );
}
