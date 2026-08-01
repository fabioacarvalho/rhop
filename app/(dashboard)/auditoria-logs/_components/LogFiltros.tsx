"use client";

import { useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import styles from "../auditoria-logs.module.css";

/**
 * Filtros de tipo/entidade/usuário/período da tela de Auditoria/Logs
 * (AUD-06, AUD-07, AUD-08).
 *
 * O estado de filtro/página vive na URL (`searchParams`) — padrão idiomático
 * do App Router — em vez de um `useState` local elevado a um componente
 * pai. Este componente só lê o estado atual (para preencher os campos) e
 * escreve um novo estado via `router.push` ao submeter: monta um
 * `URLSearchParams` com os filtros preenchidos (omite os vazios) e força
 * `page=1` (reset de página ao mudar filtro, já que o conjunto de resultados
 * muda).
 *
 * Edge case do spec: `data_inicio > data_fim` é bloqueado aqui, antes de
 * tocar a URL — sem `router.push`, sem requisição à API.
 */
export default function LogFiltros() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [tipo, setTipo] = useState(searchParams.get("tipo") ?? "");
  const [entidade, setEntidade] = useState(searchParams.get("entidade") ?? "");
  const [usuarioId, setUsuarioId] = useState(
    searchParams.get("usuario_id") ?? ""
  );
  const [dataInicio, setDataInicio] = useState(
    searchParams.get("data_inicio") ?? ""
  );
  const [dataFim, setDataFim] = useState(searchParams.get("data_fim") ?? "");
  const [erro, setErro] = useState<string | null>(null);

  function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    // Bloqueio local: nunca chama a API com um período inválido (edge case
    // do spec.md — "data inicial posterior à final").
    if (dataInicio && dataFim && dataInicio > dataFim) {
      setErro("A data de início deve ser anterior ou igual à data de fim.");
      return;
    }

    setErro(null);

    const params = new URLSearchParams();
    if (tipo) params.set("tipo", tipo);
    if (entidade) params.set("entidade", entidade);
    if (usuarioId) params.set("usuario_id", usuarioId);
    if (dataInicio) params.set("data_inicio", dataInicio);
    if (dataFim) params.set("data_fim", dataFim);
    params.set("page", "1");

    router.push(`${pathname}?${params.toString()}`);
  }

  function handleLimpar() {
    setTipo("");
    setEntidade("");
    setUsuarioId("");
    setDataInicio("");
    setDataFim("");
    setErro(null);
    router.push(pathname);
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Filtros de logs"
      className={styles.filtrosForm}
    >
      <div className={styles.filterBar}>
        <label className={styles.field}>
          Tipo
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos os tipos</option>
            <option value="AUDITORIA">Auditoria</option>
            <option value="ERRO">Erro</option>
          </select>
        </label>

        <label className={styles.field}>
          Entidade
          <input
            type="text"
            value={entidade}
            onChange={(e) => setEntidade(e.target.value)}
            placeholder="ex: Solicitacao"
          />
        </label>

        <label className={styles.field}>
          Usuário (ID)
          <input
            type="text"
            value={usuarioId}
            onChange={(e) => setUsuarioId(e.target.value)}
            placeholder="id do usuario"
          />
        </label>

        <label className={styles.field}>
          Data início
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />
        </label>

        <label className={styles.field}>
          Data fim
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
          />
        </label>

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

      {erro && (
        <p role="alert" className={styles.erro}>
          {erro}
        </p>
      )}
    </form>
  );
}
