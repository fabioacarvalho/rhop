import type { CandidatoRankeado } from "@/lib/services/talentoSearchService";
import styles from "../busca.module.css";

type Props = {
  candidato: CandidatoRankeado;
};

/**
 * Card de apresentação de um candidato do ranking de busca (TAL-15, TAL-31)
 * — componente puro (props → JSX), sem busca de dados própria.
 */
export function CandidatoCard({ candidato }: Props) {
  const percentual = Math.round(candidato.score * 100);

  return (
    <article className={styles.card}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.nome}>{candidato.nome}</h3>
          <span className={styles.email}>{candidato.email}</span>
        </div>
        {candidato.solicitacao_id ? (
          <span className={styles.vagaTag}>
            Vaga: {candidato.solicitacao_id.slice(0, 8).toUpperCase()}
          </span>
        ) : null}
      </div>

      {candidato.tags.length > 0 ? (
        <div className={styles.tagBadges}>
          {candidato.tags.map((tag) => (
            <span key={tag.id} className={styles.tagBadge}>
              {tag.nome}
            </span>
          ))}
        </div>
      ) : null}

      <div className={styles.scoreRow}>
        <div className={styles.scoreBarTrack}>
          <div
            className={styles.scoreBarFill}
            style={{ width: `${percentual}%` }}
          />
        </div>
        <span className={styles.scorePercent}>{percentual}%</span>
      </div>

      {candidato.justificativa ? (
        <div className={styles.callout}>
          <div className={styles.calloutTag}>✦ Justificativa da IA</div>
          {candidato.justificativa}
        </div>
      ) : (
        <div className={`${styles.callout} ${styles.calloutFallback}`}>
          <div className={styles.calloutTag}>Justificativa indisponível</div>
          A IA não conseguiu gerar uma justificativa para este candidato
          agora. O restante do ranking permanece confiável.
        </div>
      )}
    </article>
  );
}
