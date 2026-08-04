import { redirect } from "next/navigation";
import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import { listar, type TipoFluxoResumo } from "@/lib/services/tipoFluxoService";
import { Role } from "@/lib/generated/prisma/client";
import { InsightsPanel } from "./_components/InsightsPanel";
import styles from "./insights.module.css";

export const dynamic = "force-dynamic";

/**
 * Tela Painel de Insights (INSIGHT-01, INSIGHT-10). Server Component —
 * mesmo padrão de gate de `auditoria-logs/page.tsx`: papel inválido nunca
 * chega a montar `InsightsPanel`/buscar `TipoFluxo`.
 *
 * Busca `tipoFluxoService.listar()` no servidor e passa como prop — evita
 * um endpoint extra só para popular o seletor de tipo (`design.md`).
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
          <p>Apenas gestores e RH podem acessar o Painel de Insights.</p>
        </main>
      );
    }
    throw erro;
  }

  let tipos: TipoFluxoResumo[] = [];
  try {
    const rawTipos = await listar();
    tipos = JSON.parse(JSON.stringify(rawTipos));
  } catch (erro) {
    console.error("Erro ao carregar tipos de fluxo no painel de insights:", erro);
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Painel de Insights</h1>
          <p className={styles.subtitle}>
            Distribuição quantitativa das solicitações, com leitura em
            linguagem natural gerada por IA.
          </p>
        </div>
      </header>

      <InsightsPanel tipos={tipos} />
    </main>
  );
}
