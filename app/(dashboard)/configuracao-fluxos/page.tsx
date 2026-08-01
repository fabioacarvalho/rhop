import Link from "next/link";
import { redirect } from "next/navigation";
import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import { listar } from "@/lib/services/tipoFluxoService";
import { Role } from "@/lib/generated/prisma/client";
import type { PapelAprovador } from "@/lib/validations/tipoFluxo";
import styles from "./configuracao-fluxos.module.css";

const ROTULO_PAPEL: Record<PapelAprovador, string> = {
  GESTOR: "Gestor",
  RH_ADMIN: "RH_Admin",
};

/**
 * Tela de Configuração de Fluxos (CONF-01, CONF-06) — Server Component.
 *
 * Mesmo padrão de gate de acesso de `auditoria-logs/page.tsx`: a checagem
 * roda no backend, antes de qualquer leitura de `TipoFluxo` — quem não é
 * `RH_ADMIN` nunca chega a disparar `tipoFluxoService.listar()`.
 *
 * - Sem sessão (`ErroNaoAutenticado`) -> `redirect('/login')`.
 * - Sessão válida, papel diferente de `RH_ADMIN` (`ErroNaoAutorizado`) ->
 *   mensagem "Acesso restrito", sem renderizar a lista.
 *
 * Diferente de `auditoria-logs`, esta tela não tem filtro/paginação, então
 * `tipoFluxoService.listar()` é chamado direto aqui (Server Component), sem
 * round-trip por `GET /api/tipos-fluxo` e sem Client Component de listagem.
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

  const tiposFluxo = await listar();

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Configuração de Fluxos</h1>
          <p className={styles.subtitle}>
            Tipos de fluxo, campos de formulário e etapas de aprovação.
          </p>
        </div>
        <Link href="/configuracao-fluxos/novo" className={`${styles.btn} ${styles.btnPrimary}`}>
          + Novo tipo de fluxo
        </Link>
      </header>

      {tiposFluxo.length === 0 ? (
        <p className={styles.empty}>Nenhum tipo de fluxo cadastrado ainda.</p>
      ) : (
        <div className={styles.stack}>
          {tiposFluxo.map((tipoFluxo) => {
            const etapas = tipoFluxo.etapas as PapelAprovador[];
            return (
              <div key={tipoFluxo.id} className={styles.card}>
                <div className={styles.cardHead}>
                  <strong className={styles.nome}>{tipoFluxo.nome}</strong>
                  <Link
                    href={`/configuracao-fluxos/${tipoFluxo.id}/editar`}
                    className={`${styles.btn} ${styles.btnGhost}`}
                  >
                    Editar
                  </Link>
                </div>
                <div className={styles.eyebrow}>Etapas de aprovação</div>
                <div className={styles.stepsRow}>
                  {etapas.map((papel, indice) => (
                    <span key={indice} style={{ display: "contents" }}>
                      {indice > 0 && <span className={styles.stepArrow}>→</span>}
                      <span className={styles.stepPill}>
                        {indice + 1} · {ROTULO_PAPEL[papel]}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
