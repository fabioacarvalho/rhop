import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import {
  buscarPorId,
  ErroNaoEncontrado,
} from "@/lib/services/candidatoService";
import { Role } from "@/lib/generated/prisma/client";
import styles from "./detalhe.module.css";

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatarData(data: Date): string {
  return new Date(data).toLocaleDateString("pt-BR");
}

function stampInfo(status: "pendente" | "processado" | "falhou"): {
  texto: string;
  classe: string;
} {
  if (status === "processado") {
    return { texto: "Processado", classe: styles.stampProcessado };
  }
  if (status === "falhou") {
    return { texto: "Falhou", classe: styles.stampFalhou };
  }
  return { texto: "Pendente", classe: styles.stampPendente };
}

/**
 * Tela de Detalhe do Candidato (TAL-52 a TAL-57) — Server Component.
 *
 * Mesmo padrão de `solicitacoes/[id]/page.tsx`: `buscarPorId` direto, sem
 * round-trip por API route; `ErroNaoEncontrado` -> `notFound()`; callout de
 * resumo de IA com fallback textual quando `resumo_ia` e `null` (falha de IA
 * ou candidato cadastrado antes desta funcionalidade existir).
 */
export default async function Page({ params }: PageProps) {
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
          <p>Apenas gestores e RH podem acessar o Banco de Talentos.</p>
        </main>
      );
    }
    throw erro;
  }

  const { id } = await params;

  let candidato;
  try {
    candidato = await buscarPorId(id);
  } catch (erro) {
    if (erro instanceof ErroNaoEncontrado) {
      notFound();
    }
    throw erro;
  }

  const stamp = stampInfo(candidato.status_embedding);

  return (
    <main className={styles.page}>
      <Link href="/banco-de-talentos" className={styles.backLink}>
        ← Banco de Talentos
      </Link>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{candidato.nome}</h1>
          <p className={styles.subtitle}>
            {candidato.email} · {candidato.telefone}
          </p>
        </div>
        <span className={`${styles.stamp} ${stamp.classe}`}>
          {stamp.texto}
        </span>
      </header>

      <div className={styles.calloutIa}>
        <div className={styles.calloutIaTag}>✦ Resumo por IA</div>
        {candidato.resumo_ia ?? "Resumo da IA indisponível no momento."}
      </div>

      <div className={styles.card}>
        <div className={styles.cardPad}>
          <div className={styles.detailGrid}>
            <div className={styles.detailField}>
              <span className={styles.detailLabel}>Cadastrado em</span>
              <span className={styles.detailValue}>
                {formatarData(candidato.criado_em)}
              </span>
            </div>
            <div className={styles.detailField}>
              <span className={styles.detailLabel}>Vaga vinculada</span>
              <span className={styles.detailValue}>
                {candidato.solicitacao
                  ? `${candidato.solicitacao.tipoFluxo.nome} (#${candidato.solicitacao.id.slice(0, 8).toUpperCase()})`
                  : "Nenhuma"}
              </span>
            </div>
            <div className={styles.detailField}>
              <span className={styles.detailLabel}>Tags</span>
              {candidato.tags.length > 0 ? (
                <div className={styles.tagBadges}>
                  {candidato.tags.map((tag) => (
                    <span key={tag.id} className={styles.tagBadge}>
                      {tag.nome}
                    </span>
                  ))}
                </div>
              ) : (
                <span className={styles.detailValue}>Nenhuma</span>
              )}
            </div>
          </div>

          <div className={styles.sectionDivider}>Currículo</div>
          <p className={styles.longText}>{candidato.curriculo_texto}</p>

          <div className={styles.sectionDivider}>Parecer técnico</div>
          <p className={styles.longText}>{candidato.parecer_tecnico}</p>
        </div>
      </div>
    </main>
  );
}
