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
import { FormattedIaSummary } from "@/components/FormattedIaSummary";
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
  CANCELADA: "Cancelado",
};

const STAMP_STATUS: Record<string, string> = {
  PENDENTE: "stampPendente",
  APROVADA: "stampAprovada",
  REJEITADA: "stampRejeitada",
  CANCELADA: "stampCancelada",
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
    solicitacao = await buscarDetalhePorId(id, usuario);
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

  const backHref = usuario.role !== Role.SOLICITANTE ? "/aprovacoes" : "/solicitacoes";
  const backLabel = usuario.role !== Role.SOLICITANTE ? "← Aprovações Pendentes" : "← Minhas Solicitações";

  return (
    <main className={styles.page}>
      <Link href={backHref} className={styles.backLink}>
        {backLabel}
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
        {solicitacao.resumo_ia_solicitante ? (
          <FormattedIaSummary text={solicitacao.resumo_ia_solicitante} />
        ) : (
          "Resumo da IA indisponível no momento."
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.cardPad}>
          <div className={styles.detailGrid}>
            {solicitacao.solicitante ? (
              <div className={styles.detailField}>
                <span className={styles.detailLabel}>Solicitante</span>
                <span className={styles.detailValue}>
                  {solicitacao.solicitante.nome} ({solicitacao.solicitante.email})
                </span>
              </div>
            ) : null}
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
                    {campo.tipo === "anexo" && dados[campo.chave] ? (
                      <a
                        href={String(dados[campo.chave])}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.btnAnexo}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                        Visualizar Anexo
                      </a>
                    ) : (
                      formatarValor(dados[campo.chave])
                    )}
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
