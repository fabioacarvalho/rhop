"use client";

import { useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import styles from "../dashboard.module.css";

export interface TipoFluxoOpcao {
  id: string;
  nome: string;
}

export interface SolicitanteOpcao {
  id: string;
  nome: string;
}

type Props = {
  tiposDisponiveis: TipoFluxoOpcao[];
  solicitantesDisponiveis: SolicitanteOpcao[];
};

/**
 * Filtros da lista de solicitações (DASH-04 a DASH-07) — mesmo padrão de
 * `auditoria-logs/_components/LogFiltros.tsx`: estado de filtro vive na URL,
 * este componente só lê o valor atual e escreve um novo ao submeter.
 */
export default function SolicitacoesFiltros({
  tiposDisponiveis,
  solicitantesDisponiveis,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [tipoFluxoId, setTipoFluxoId] = useState(
    searchParams.get("tipo_fluxo_id") ?? "",
  );
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [solicitanteId, setSolicitanteId] = useState(
    searchParams.get("solicitante_id") ?? "",
  );

  function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    const params = new URLSearchParams();
    if (tipoFluxoId) params.set("tipo_fluxo_id", tipoFluxoId);
    if (status) params.set("status", status);
    if (solicitanteId) params.set("solicitante_id", solicitanteId);
    params.set("page", "1");

    router.push(`${pathname}?${params.toString()}`);
  }

  function handleLimpar() {
    setTipoFluxoId("");
    setStatus("");
    setSolicitanteId("");
    router.push(pathname);
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Filtros da lista de solicitações"
      className={styles.filtrosForm}
    >
      <div className={styles.filterBar}>
        <select
          value={tipoFluxoId}
          onChange={(e) => setTipoFluxoId(e.target.value)}
          aria-label="Tipo de fluxo"
        >
          <option value="">Todos os tipos</option>
          {tiposDisponiveis.map((tipo) => (
            <option key={tipo.id} value={tipo.id}>
              {tipo.nome}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Status"
        >
          <option value="">Todos os status</option>
          <option value="PENDENTE">Pendente</option>
          <option value="ATRASADO">Atrasado</option>
          <option value="APROVADA">Aprovada</option>
          <option value="REJEITADA">Rejeitada</option>
          <option value="CANCELADA">Cancelada</option>
        </select>

        <select
          value={solicitanteId}
          onChange={(e) => setSolicitanteId(e.target.value)}
          aria-label="Solicitante"
        >
          <option value="">Todos os solicitantes</option>
          {solicitantesDisponiveis.map((solicitante) => (
            <option key={solicitante.id} value={solicitante.id}>
              {solicitante.nome}
            </option>
          ))}
        </select>

        <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
          Filtrar
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnGhost}`}
          onClick={handleLimpar}
        >
          Limpar filtros
        </button>
      </div>
    </form>
  );
}
