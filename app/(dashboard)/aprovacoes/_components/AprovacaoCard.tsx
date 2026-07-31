"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import type { AprovacaoPendenteCard } from "@/lib/services/aprovacaoService";
import styles from "../aprovacoes.module.css";

function rotuloSla(prazo: Date | string): {
  texto: string;
  variante: "pendente" | "atrasado";
} {
  const prazoDate = typeof prazo === "string" ? new Date(prazo) : prazo;
  const horas = Math.round((prazoDate.getTime() - Date.now()) / (1000 * 60 * 60));

  if (horas < 0) {
    return {
      texto: `Atrasada há ${Math.abs(horas)}h`,
      variante: "atrasado",
    };
  }
  if (horas <= 24) {
    return { texto: `SLA: ${horas}h restantes`, variante: "atrasado" };
  }
  return { texto: "Pendente", variante: "pendente" };
}

type Props = {
  card: AprovacaoPendenteCard;
};

export function AprovacaoCard({ card }: Props) {
  const router = useRouter();
  const [comentario, setComentario] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sla = rotuloSla(card.prazo_sla);
  const proto = card.solicitacao_id.slice(0, 8).toUpperCase();

  function decidir(decisao: "APROVADA" | "REJEITADA") {
    setErro(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/aprovacoes/${card.solicitacao_id}/decidir`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              decisao,
              comentario: comentario.trim() || undefined,
            }),
          },
        );

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          setErro(body?.error ?? "Nao foi possivel registrar a decisao.");
          return;
        }

        router.refresh();
      } catch {
        setErro("Falha de rede ao registrar a decisao.");
      }
    });
  }

  return (
    <article className={styles.card}>
      <div className={styles.head}>
        <div>
          <span className={styles.chip}>{card.tipo_fluxo_nome}</span>
          <h3 className={styles.solicitante}>
            {card.solicitante_nome}{" "}
            <span>· {card.solicitante_email}</span>
          </h3>
          <div className={styles.proto}>{proto}</div>
        </div>
        <span
          className={`${styles.stamp} ${
            sla.variante === "atrasado"
              ? styles.stampAtrasado
              : styles.stampPendente
          }`}
        >
          {sla.texto}
        </span>
      </div>

      {card.resumo_ia ? (
        <div className={styles.callout}>
          <div className={styles.calloutTag}>✦ Resumo por IA</div>
          {card.resumo_ia}
        </div>
      ) : (
        <div className={`${styles.callout} ${styles.calloutFallback}`}>
          <div className={styles.calloutTag}>Resumo indisponível</div>
          O resumo por IA ainda não está disponível. Você pode decidir com
          base nos dados completos da solicitação.
        </div>
      )}

      <div className={styles.perf} />

      <div className={styles.footer}>
        <Link
          href={`/solicitacoes/${card.solicitacao_id}`}
          className={styles.detalheLink}
        >
          Ver dados completos da solicitação →
        </Link>

        <div className={styles.actions}>
          <textarea
            className={styles.comentario}
            placeholder="Comentário opcional"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            maxLength={2000}
            disabled={pending}
            aria-label="Comentário opcional"
          />
          <div className={styles.btnRow}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnDanger}`}
              disabled={pending}
              onClick={() => decidir("REJEITADA")}
            >
              Rejeitar
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={pending}
              onClick={() => decidir("APROVADA")}
            >
              Aprovar
            </button>
          </div>
          {erro ? <p className={styles.erro}>{erro}</p> : null}
        </div>
      </div>
    </article>
  );
}
