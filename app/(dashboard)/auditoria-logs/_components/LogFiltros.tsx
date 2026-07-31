"use client";

import { useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
    <form onSubmit={handleSubmit} aria-label="Filtros de logs">
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          gap: "0.75rem",
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          Tipo
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos</option>
            <option value="AUDITORIA">AUDITORIA</option>
            <option value="ERRO">ERRO</option>
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          Entidade
          <input
            type="text"
            value={entidade}
            onChange={(e) => setEntidade(e.target.value)}
            placeholder="ex: Solicitacao"
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          Usuário (ID)
          <input
            type="text"
            value={usuarioId}
            onChange={(e) => setUsuarioId(e.target.value)}
            placeholder="id do usuario"
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          Data início
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          Data fim
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
          />
        </label>

        <button type="submit">Filtrar</button>
        <button type="button" onClick={handleLimpar}>
          Limpar filtros
        </button>
      </div>

      {erro && (
        <p role="alert" style={{ color: "#b91c1c", marginTop: "0.5rem" }}>
          {erro}
        </p>
      )}
    </form>
  );
}
