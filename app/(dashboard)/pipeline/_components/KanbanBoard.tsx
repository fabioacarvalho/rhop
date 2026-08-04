"use client";

import { useState } from "react";
import type { KanbanColunaChave } from "@/lib/config/kanbanColunas";
import styles from "../pipeline.module.css";

/** Mesma projeção de `pipelineService.KanbanItem`, mas com `criado_em` como
 * string ISO — forma que atravessa a fronteira de `fetch`/JSON. */
interface KanbanItemClient {
  id: string;
  tipo_fluxo_nome: string;
  solicitante_nome: string;
  status: "PENDENTE" | "APROVADA" | "REJEITADA" | "CANCELADA";
  atrasada: boolean;
  criado_em: string;
}

interface KanbanColunaResultadoClient {
  chave: KanbanColunaChave;
  label: string;
  itens: KanbanItemClient[];
  total: number;
}

interface KanbanBoardClient {
  colunas: KanbanColunaResultadoClient[];
}

interface KanbanBoardProps {
  boardInicial: KanbanBoardClient;
  tiposFluxo: { id: string; nome: string }[];
  papel: "GESTOR" | "RH_ADMIN";
}

const PAGE_SIZE = 10;

const ROTULO_STATUS: Record<KanbanItemClient["status"], string> = {
  PENDENTE: "Pendente",
  APROVADA: "Aprovado",
  REJEITADA: "Rejeitado",
  CANCELADA: "Cancelado",
};

const STAMP_STATUS: Record<KanbanItemClient["status"], string> = {
  PENDENTE: "kanbanStampPendente",
  APROVADA: "kanbanStampAprovado",
  REJEITADA: "kanbanStampRejeitado",
  CANCELADA: "kanbanStampCancelado",
};

function formatarData(data: string): string {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(data));
}

function classeContador(chave: KanbanColunaChave): string {
  if (chave === "aprovado") {
    return `${styles.kanbanColumnCount} ${styles.kanbanColumnCountGood}`;
  }
  if (chave === "cancelado") {
    return `${styles.kanbanColumnCount} ${styles.kanbanColumnCountBad}`;
  }
  return styles.kanbanColumnCount;
}

/**
 * Board Pipeline Kanban (PIPE-01, PIPE-02, PIPE-11, PIPE-12, PIPE-14) —
 * Client Component que gerencia seu próprio estado (filtro de Tipo de
 * Fluxo, paginação "+N outras" por coluna e cancelamento inline do
 * RH_Admin), chamando as rotas JSON diretamente — não segue o padrão
 * URL-driven de `SolicitacoesFiltros.tsx`.
 */
export default function KanbanBoard({
  boardInicial,
  tiposFluxo,
  papel,
}: KanbanBoardProps) {
  const [board, setBoard] = useState<KanbanBoardClient>(boardInicial);
  const [tipoFluxoId, setTipoFluxoId] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Próxima página a buscar por coluna quando "+N outras" é clicado
  // (página 1 já veio da carga inicial).
  const [paginaPorColuna, setPaginaPorColuna] = useState<
    Record<string, number>
  >({});
  const [carregandoColuna, setCarregandoColuna] = useState<string | null>(
    null,
  );
  const [erroPorColuna, setErroPorColuna] = useState<Record<string, string>>(
    {},
  );
  const [erroPorCard, setErroPorCard] = useState<Record<string, string>>({});
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);

  async function handleFiltroChange(novoTipoFluxoId: string) {
    setTipoFluxoId(novoTipoFluxoId);
    setCarregando(true);
    setErro(null);

    try {
      const query = novoTipoFluxoId
        ? `?tipo_fluxo_id=${encodeURIComponent(novoTipoFluxoId)}`
        : "";
      const resposta = await fetch(`/api/pipeline${query}`);

      if (!resposta.ok) {
        const corpo: { error?: string } = await resposta
          .json()
          .catch(() => ({}));
        setErro(
          corpo.error ??
            `Não foi possível carregar o pipeline (status ${resposta.status}).`,
        );
        return;
      }

      const dados = (await resposta.json()) as { board: KanbanBoardClient };
      setBoard(dados.board);
      setPaginaPorColuna({});
    } catch {
      setErro("Falha de rede ao carregar o pipeline.");
    } finally {
      setCarregando(false);
    }
  }

  async function handleMaisItens(chave: KanbanColunaChave) {
    const proximaPagina = (paginaPorColuna[chave] ?? 1) + 1;
    setCarregandoColuna(chave);
    setErroPorColuna((atual) => ({ ...atual, [chave]: "" }));

    try {
      const params = new URLSearchParams({
        page: String(proximaPagina),
        pageSize: String(PAGE_SIZE),
      });
      if (tipoFluxoId) {
        params.set("tipo_fluxo_id", tipoFluxoId);
      }

      const resposta = await fetch(`/api/pipeline/${chave}?${params}`);

      if (!resposta.ok) {
        const corpo: { error?: string } = await resposta
          .json()
          .catch(() => ({}));
        setErroPorColuna((atual) => ({
          ...atual,
          [chave]:
            corpo.error ??
            `Não foi possível carregar mais itens (status ${resposta.status}).`,
        }));
        return;
      }

      const dados = (await resposta.json()) as {
        itens: KanbanItemClient[];
        total: number;
      };

      setBoard((atual) => ({
        colunas: atual.colunas.map((coluna) =>
          coluna.chave === chave
            ? {
                ...coluna,
                itens: [...coluna.itens, ...dados.itens],
                total: dados.total,
              }
            : coluna,
        ),
      }));
      setPaginaPorColuna((atual) => ({ ...atual, [chave]: proximaPagina }));
    } catch {
      setErroPorColuna((atual) => ({
        ...atual,
        [chave]: "Falha de rede ao carregar mais itens.",
      }));
    } finally {
      setCarregandoColuna(null);
    }
  }

  async function handleCancelar(item: KanbanItemClient) {
    const confirmado = window.confirm(
      `Tem certeza que deseja cancelar a solicitação de ${item.solicitante_nome}?`,
    );
    if (!confirmado) {
      return;
    }

    setCancelandoId(item.id);
    setErroPorCard((atual) => ({ ...atual, [item.id]: "" }));

    try {
      const resposta = await fetch(`/api/solicitacoes/${item.id}/cancelar`, {
        method: "POST",
      });

      if (!resposta.ok) {
        const corpo: { error?: string } = await resposta
          .json()
          .catch(() => ({}));
        setErroPorCard((atual) => ({
          ...atual,
          [item.id]:
            corpo.error ??
            `Não foi possível cancelar (status ${resposta.status}).`,
        }));
        return;
      }

      setBoard((atual) => ({
        colunas: atual.colunas.map((coluna) => {
          if (coluna.chave === "pendente") {
            return {
              ...coluna,
              itens: coluna.itens.filter((i) => i.id !== item.id),
              total: Math.max(0, coluna.total - 1),
            };
          }
          if (coluna.chave === "cancelado") {
            return {
              ...coluna,
              itens: [
                { ...item, status: "CANCELADA" as const },
                ...coluna.itens,
              ],
              total: coluna.total + 1,
            };
          }
          return coluna;
        }),
      }));
    } catch {
      setErroPorCard((atual) => ({
        ...atual,
        [item.id]: "Falha de rede ao cancelar a solicitação.",
      }));
    } finally {
      setCancelandoId(null);
    }
  }

  function renderCard(item: KanbanItemClient, chave: KanbanColunaChave) {
    const status = item.atrasada ? "Atrasado" : ROTULO_STATUS[item.status];
    const stampClasse =
      item.status === "PENDENTE" && item.atrasada
        ? "kanbanStampAtrasado"
        : STAMP_STATUS[item.status];

    return (
      <div
        key={item.id}
        className={`${styles.kanbanCard} ${
          item.atrasada ? styles.kanbanCardLate : ""
        }`}
      >
        <div className={styles.kanbanCardHead}>
          <span className={styles.kanbanChipTipo}>{item.tipo_fluxo_nome}</span>
          <span className={`${styles.kanbanStamp} ${styles[stampClasse]}`}>
            {status}
          </span>
        </div>
        <div className={styles.kanbanSolicitante}>{item.solicitante_nome}</div>
        <div className={styles.kanbanProto}>
          {item.id.slice(0, 8).toUpperCase()}
        </div>
        <div className={styles.kanbanMeta}>
          {formatarData(item.criado_em)}
        </div>
        {papel === "RH_ADMIN" && chave === "pendente" ? (
          <button
            type="button"
            onClick={() => handleCancelar(item)}
            disabled={cancelandoId === item.id}
            style={{
              alignSelf: "flex-start",
              background: "transparent",
              border: "none",
              padding: 0,
              color: "var(--vermelho)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            {cancelandoId === item.id ? "Cancelando..." : "Cancelar"}
          </button>
        ) : null}
        {erroPorCard[item.id] ? (
          <div style={{ color: "var(--vermelho)", fontSize: "11.5px" }}>
            {erroPorCard[item.id]}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <label style={{ display: "inline-flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
        <span>Tipo de fluxo</span>
        <select
          value={tipoFluxoId}
          onChange={(e) => handleFiltroChange(e.target.value)}
          disabled={carregando}
        >
          <option value="">Todos os tipos</option>
          {tiposFluxo.map((tipo) => (
            <option key={tipo.id} value={tipo.id}>
              {tipo.nome}
            </option>
          ))}
        </select>
      </label>

      {erro ? (
        <p style={{ color: "var(--vermelho)", marginBottom: 12 }}>{erro}</p>
      ) : null}

      <div className={styles.kanbanBoard}>
        {board.colunas.map((coluna) => {
          const restantes = coluna.total - coluna.itens.length;
          const primeiraPagina = coluna.itens.slice(0, PAGE_SIZE);
          const extras = coluna.itens.slice(PAGE_SIZE);

          return (
            <div className={styles.kanbanColumn} key={coluna.chave}>
              <div className={styles.kanbanColumnHead}>
                <span>{coluna.label}</span>
                <span className={classeContador(coluna.chave)}>
                  {coluna.total}
                </span>
              </div>

              <div className={styles.kanbanList}>
                {coluna.itens.length === 0 ? (
                  <p className={styles.kanbanEmpty}>
                    Nenhuma solicitação nesta coluna.
                  </p>
                ) : (
                  <>
                    {primeiraPagina.map((item) => renderCard(item, coluna.chave))}
                    {extras.length > 0 ? (
                      <div className={styles.kanbanMoreList}>
                        {extras.map((item) => renderCard(item, coluna.chave))}
                      </div>
                    ) : null}
                  </>
                )}

                {erroPorColuna[coluna.chave] ? (
                  <p style={{ color: "var(--vermelho)", fontSize: "11.5px" }}>
                    {erroPorColuna[coluna.chave]}
                  </p>
                ) : null}

                {restantes > 0 ? (
                  <button
                    type="button"
                    className={styles.kanbanMoreBtn}
                    onClick={() => handleMaisItens(coluna.chave)}
                    disabled={carregandoColuna === coluna.chave}
                  >
                    {carregandoColuna === coluna.chave
                      ? "Carregando..."
                      : `+${restantes} outras`}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
