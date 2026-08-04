"use client";

import { Fragment, useState, type MouseEvent } from "react";
import Link from "next/link";
import { Role } from "@/lib/generated/prisma/client";
import type { SolicitacaoResumo } from "@/lib/services/solicitacaoService";
import styles from "../solicitacoes.module.css";

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
  return new Intl.DateTimeFormat("pt-BR").format(new Date(data));
}

function rotuloSla(status: string, prazoSla: Date): string {
  if (status !== "PENDENTE") {
    return "—";
  }

  const horas = Math.round(
    (new Date(prazoSla).getTime() - Date.now()) / (1000 * 60 * 60),
  );

  if (horas < 0) {
    return `Atrasada há ${Math.abs(horas)}h`;
  }
  return `${horas}h restantes`;
}

interface SolicitacaoTableBodyProps {
  solicitacoes: SolicitacaoResumo[];
}

/**
 * Corpo da tabela de "Minhas Solicitações" (RIA-02, RIA-03) — Client
 * Component que alterna uma linha expandida por clique, mostrando
 * `resumo_ia_solicitante` já recebido via prop (sem nenhuma chamada de
 * rede/IA na interação).
 */
export default function SolicitacaoTableBody({
  solicitacoes,
}: SolicitacaoTableBodyProps) {
  const [idExpandido, setIdExpandido] = useState<string | null>(null);

  function alternarExpansao(
    evento: MouseEvent<HTMLTableRowElement>,
    id: string,
  ) {
    if ((evento.target as HTMLElement).closest("a")) {
      return;
    }
    setIdExpandido((atual) => (atual === id ? null : id));
  }

  return (
    <tbody>
      {solicitacoes.map((solicitacao) => (
        <Fragment key={solicitacao.id}>
          <tr
            onClick={(evento) => alternarExpansao(evento, solicitacao.id)}
            className={styles.rowClickable}
          >
            <td>
              <Link
                href={`/solicitacoes/${solicitacao.id}`}
                className={styles.proto}
              >
                {solicitacao.id.slice(0, 8).toUpperCase()}
              </Link>
            </td>
            <td>
              <span className={styles.chipTipo}>
                {solicitacao.tipoFluxo.nome}
              </span>
            </td>
            <td>
              {solicitacao.status === "PENDENTE"
                ? ROTULO_PAPEL[solicitacao.etapa_atual]
                : "Encerrado"}
            </td>
            <td>
              <span
                className={`${styles.stamp} ${
                  styles[STAMP_STATUS[solicitacao.status]]
                }`}
              >
                {ROTULO_STATUS[solicitacao.status]}
              </span>
            </td>
            <td
              className={
                solicitacao.status === "PENDENTE"
                  ? styles.slaAtraso
                  : styles.mono
              }
            >
              {rotuloSla(solicitacao.status, solicitacao.prazo_sla)}
            </td>
            <td className={styles.mono}>
              {formatarData(solicitacao.criado_em)}
            </td>
          </tr>
          {idExpandido === solicitacao.id && (
            <tr>
              <td colSpan={6}>
                <div className={styles.calloutIa}>
                  <div className={styles.calloutIaTag}>✦ Resumo por IA</div>
                  {solicitacao.resumo_ia_solicitante ??
                    "Resumo da IA indisponível no momento."}
                </div>
              </td>
            </tr>
          )}
        </Fragment>
      ))}
    </tbody>
  );
}
