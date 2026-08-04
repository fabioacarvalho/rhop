import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import {
  buscarDetalhePorId,
  ErroNaoEncontrado,
  ErroAcessoNegado,
} from "@/lib/services/solicitacaoService";
import { Role } from "@/lib/generated/prisma/client";
import type { CampoFormularioDefinicao } from "@/lib/validations/tipoFluxo";
import styles from "../solicitacoes.module.css";

interface PageProps {
  params: Promise<{ id: string }>;
}

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
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(data));
}

function formatarValor(valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") {
    return "—";
  }
  return String(valor);
}

/**
 * Tela de Detalhe da Solicitação (SOL-10 a SOL-12, P2) — Server Component.
 *
 * `buscarDetalhePorId` já inclui `tipoFluxo.campos_formulario`, usado aqui
 * pra rotular `dados` (chave -> rótulo), sem round-trip extra a
 * `tipoFluxoService`.
 */
export default async function Page({ params }: PageProps) {
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

  const { id } = await params;

  let solicitacao;
  try {
    solicitacao = await buscarDetalhePorId(id, usuario.id);
  } catch (erro) {
    if (erro instanceof ErroNaoEncontrado) {
      notFound();
    }
    if (erro instanceof ErroAcessoNegado) {
      return (
        <main className={styles.restrito}>
          <h1>Acesso restrito</h1>
          <p>Você não tem acesso a esta solicitação.</p>
        </main>
      );
    }
    throw erro;
  }

  const campos =
    (solicitacao.tipoFluxo.campos_formulario as unknown as CampoFormularioDefinicao[]) ??
    [];
  const dados = (solicitacao.dados ?? {}) as Record<string, unknown>;

  return (
    <main className={styles.page}>
      <Link href="/solicitacoes" className={styles.backLink}>
        ← Minhas Solicitações
      </Link>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>
            {solicitacao.id.slice(0, 8).toUpperCase()}
          </h1>
          <p className={styles.subtitle}>{solicitacao.tipoFluxo.nome}</p>
        </div>
        <span
          className={`${styles.stamp} ${
            styles[STAMP_STATUS[solicitacao.status]]
          }`}
        >
          {ROTULO_STATUS[solicitacao.status]}
        </span>
      </header>

      <div className={`${styles.calloutIa} ${styles.calloutIaPage}`}>
        <div className={styles.calloutIaTag}>✦ Resumo por IA</div>
        {solicitacao.resumo_ia_solicitante ??
          "Resumo da IA indisponível no momento."}
      </div>

      <div className={styles.card}>
        <div className={styles.cardPad}>
          <div className={styles.detailGrid}>
            <div className={styles.detailField}>
              <span className={styles.detailLabel}>Etapa atual</span>
              <span className={styles.detailValue}>
                {solicitacao.status === "PENDENTE"
                  ? ROTULO_PAPEL[solicitacao.etapa_atual]
                  : "Encerrado"}
              </span>
            </div>
            <div className={styles.detailField}>
              <span className={styles.detailLabel}>Prazo de SLA</span>
              <span className={styles.detailValue}>
                {formatarData(solicitacao.prazo_sla)}
              </span>
            </div>
            <div className={styles.detailField}>
              <span className={styles.detailLabel}>Aberta em</span>
              <span className={styles.detailValue}>
                {formatarData(solicitacao.criado_em)}
              </span>
            </div>
          </div>

          <div className={styles.sectionDivider}>Dados da solicitação</div>

          <div className={styles.detailGrid}>
            {campos.length === 0 ? (
              <p className={styles.hint}>
                Este tipo de fluxo não tem campos configurados.
              </p>
            ) : (
              campos.map((campo) => (
                <div key={campo.chave} className={styles.detailField}>
                  <span className={styles.detailLabel}>{campo.rotulo}</span>
                  <span className={styles.detailValue}>
                    {formatarValor(dados[campo.chave])}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
