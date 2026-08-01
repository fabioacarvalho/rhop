"use client";

import { Fragment, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PAGE_SIZE_PADRAO, definirPaginacaoInfo } from "./AuditoriaLogsContext";
import styles from "../auditoria-logs.module.css";

interface LogUsuarioResumo {
  nome: string;
  email: string;
}

/**
 * Formato de um registro `Log` como retornado por `GET /api/logs`
 * (`logService.LogComUsuario` serializado em JSON — `criado_em` chega como
 * string ISO, não `Date`).
 */
interface LogRegistro {
  id: string;
  tipo: "AUDITORIA" | "ERRO";
  entidade: string;
  entidade_id: string;
  acao: string;
  usuario_id: string | null;
  usuario: LogUsuarioResumo | null;
  detalhes: unknown;
  criado_em: string;
}

interface RespostaLogs {
  logs: LogRegistro[];
  total: number;
}

function formatarData(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) {
    return iso;
  }
  return data.toLocaleString("pt-BR");
}

/** `detalhes` nulo/ausente ou objeto vazio conta como "sem detalhes" (AUD-10). */
function temDetalhes(detalhes: unknown): boolean {
  if (detalhes === null || detalhes === undefined) {
    return false;
  }
  if (typeof detalhes === "object") {
    return Object.keys(detalhes).length > 0;
  }
  return true;
}

function nomeUsuario(log: LogRegistro): string {
  if (log.usuario_id === null) {
    return "Sistema";
  }
  return log.usuario?.nome ?? log.usuario_id;
}

function tipoClasse(tipo: LogRegistro["tipo"]): string {
  return tipo === "AUDITORIA" ? styles.logTipoAuditoria : styles.logTipoErro;
}

function tipoRotulo(tipo: LogRegistro["tipo"]): string {
  return tipo === "AUDITORIA" ? "Auditoria" : "Erro";
}

/**
 * Tabela de logs (AUD-09) — lê os filtros/página atuais da URL
 * (`useSearchParams`) e busca `GET /api/logs` a cada mudança (efeito com
 * dependência em `searchParams.toString()`, conforme decisão de design).
 * Ordenação por `criado_em` desc já vem da API — não reordena no client.
 *
 * Linha expansível mostra `detalhes` formatado sem nova chamada de rede
 * (estado local `expandidos`, por linha).
 *
 * Publica `{ total, pageSize }` no store de `AuditoriaLogsContext` (ver esse
 * arquivo para a decisão de engenharia) para `LogPaginacao` — componente-
 * irmão, não filho — calcular os botões de navegação sem duplicar o fetch.
 */
export default function LogTabela() {
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();

  const [logs, setLogs] = useState<LogRegistro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelado = false;

    async function buscar() {
      setCarregando(true);
      setErro(null);

      try {
        const resposta = await fetch(`/api/logs?${queryString}`);

        if (!resposta.ok) {
          throw new Error(
            `Falha ao carregar logs (status ${resposta.status}).`
          );
        }

        const dados: RespostaLogs = await resposta.json();

        if (cancelado) {
          return;
        }

        setLogs(dados.logs);

        const pageSizeNaUrl = Number(searchParams.get("pageSize"));
        const pageSizeEfetivo =
          Number.isFinite(pageSizeNaUrl) && pageSizeNaUrl > 0
            ? pageSizeNaUrl
            : PAGE_SIZE_PADRAO;

        definirPaginacaoInfo({ total: dados.total, pageSize: pageSizeEfetivo });
      } catch {
        if (!cancelado) {
          setErro("Não foi possível carregar os logs. Tente novamente.");
        }
      } finally {
        if (!cancelado) {
          setCarregando(false);
        }
      }
    }

    buscar();

    return () => {
      cancelado = true;
    };
    // Dependência intencionalmente restrita à string da query (decisão de
    // design): `searchParams` muda de identidade a cada navegação, mas só a
    // string efetivamente importa para decidir se refaz o fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  function alternarExpandido(id: string) {
    setExpandidos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) {
        proximo.delete(id);
      } else {
        proximo.add(id);
      }
      return proximo;
    });
  }

  if (erro) {
    return (
      <div className={styles.card}>
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      </div>
    );
  }

  if (carregando) {
    return (
      <div className={styles.card}>
        <p className={styles.carregando}>Carregando logs...</p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className={styles.card}>
        <p className={styles.empty}>Nenhum log encontrado</p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.expandCol}></th>
            <th>Quando</th>
            <th>Tipo</th>
            <th>Entidade</th>
            <th>Ação</th>
            <th>Usuário</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const expandido = expandidos.has(log.id);
            return (
              <Fragment key={log.id}>
                <tr>
                  <td>
                    <button
                      type="button"
                      className={styles.expandBtn}
                      onClick={() => alternarExpandido(log.id)}
                      aria-expanded={expandido}
                      aria-label={
                        expandido ? "Recolher detalhes" : "Expandir detalhes"
                      }
                    >
                      {expandido ? "−" : "+"}
                    </button>
                  </td>
                  <td className={styles.mono}>{formatarData(log.criado_em)}</td>
                  <td>
                    <span className={`${styles.logTipo} ${tipoClasse(log.tipo)}`}>
                      {tipoRotulo(log.tipo)}
                    </span>
                  </td>
                  <td className={styles.proto}>
                    {log.entidade} #{log.entidade_id}
                  </td>
                  <td>{log.acao}</td>
                  <td>{nomeUsuario(log)}</td>
                </tr>
                {expandido && (
                  <tr className={styles.detalheRow}>
                    <td colSpan={6}>
                      {temDetalhes(log.detalhes) ? (
                        <pre className={styles.detalhePre}>
                          {JSON.stringify(log.detalhes, null, 2)}
                        </pre>
                      ) : (
                        <p className={styles.semDetalhes}>
                          Sem detalhes adicionais.
                        </p>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
