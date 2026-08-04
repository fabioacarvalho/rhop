import Link from "next/link";
import { redirect } from "next/navigation";
import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import { listar } from "@/lib/services/tagService";
import { Role } from "@/lib/generated/prisma/client";
import TagForm from "./_components/TagForm";
import TagList from "./_components/TagList";
import styles from "./tags.module.css";

/**
 * Tela de Gestão de Tags (TAL-37, TAL-42) — Server Component, RH_ADMIN-only.
 *
 * Mesmo padrão de gate de `configuracao-fluxos/page.tsx`: a checagem roda no
 * backend antes de qualquer leitura de `Tag` — GESTOR/SOLICITANTE nunca
 * chegam a disparar `tagService.listar()`.
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

  const tags = await listar();

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Gestão de Tags</h1>
          <p className={styles.subtitle}>
            Tags usadas para classificar candidatos no Banco de Talentos.
          </p>
        </div>
        <Link href="/banco-de-talentos" className={`${styles.btn} ${styles.btnGhost}`}>
          Voltar
        </Link>
      </header>

      <TagForm modo="criar" />

      <div style={{ marginTop: "24px" }}>
        <TagList
          tags={tags.map((tag) => ({
            id: tag.id,
            nome: tag.nome,
            funcao: tag.funcao,
            ativo: tag.ativo,
          }))}
        />
      </div>
    </main>
  );
}
