"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "../dashboard.module.css";
import {
  PAGE_SIZE_PADRAO,
  definirPaginacaoInfo,
} from "./DashboardListaContext";

/** Formato de `SolicitacaoListItem` serializado em JSON (`criado_em` como string ISO). */
interface SolicitacaoRegistro {
  id: string;
  tipo_fluxo_nome: string;
  solicitante_nome: string;
  status: "PENDENTE" | "APROVADA" | "REJEITADA";
  atrasada: boolean;
  criado_em: string;
}

interface RespostaLista {
  solicitacoes: SolicitacaoRegistro[];
  total: number;
}

function formatarData(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) {
    return iso;
  }
  return data.toLocaleDateString("pt-BR");
}

function stampInfo(registro: SolicitacaoRegistro): {
  texto: string;
  classe: string;
} {
  if (registro.atrasada) {
    return { texto: "Atrasado", classe: styles.stampAtrasado };
  }
  if (registro.status === "APROVADA") {
    return { texto: "Aprovado", classe: styles.stampAprovado };
  }
  if (registro.status === "REJEITADA") {
    return { texto: "Rejeitado", classe: styles.stampRejeitado };
  }
  return { texto: "Pendente", classe: styles.stampPendente };
}

/**
 * Lista de solicitações (DASH-02, DASH-08, DASH-09) — lê `searchParams` e
 * refaz o fetch a cada mudança (mesmo padrão de
 * `auditoria-logs/_components/LogTabela.tsx`). Publica `{ total, pageSize }`
 * em `DashboardListaContext` para `DashboardPaginacao` (componente-irmão).
 */
export default function ListaSolicitacoes() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();

  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoRegistro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function buscar() {
      setCarregando(true);
      setErro(null);

      try {
        const resposta = await fetch(`/api/dashboard/solicitacoes?${queryString}`);

        if (!resposta.ok) {
          throw new Error(
            `Falha ao carregar solicitações (status ${resposta.status}).`,
          );
        }

        const dados: RespostaLista = await resposta.json();

        if (cancelado) {
          return;
        }

        setSolicitacoes(dados.solicitacoes);

        const pageSizeNaUrl = Number(searchParams.get("pageSize"));
        const pageSizeEfetivo =
          Number.isFinite(pageSizeNaUrl) && pageSizeNaUrl > 0
            ? pageSizeNaUrl
            : PAGE_SIZE_PADRAO;

        definirPaginacaoInfo({ total: dados.total, pageSize: pageSizeEfetivo });
      } catch {
        if (!cancelado) {
          setErro("Não foi possível carregar as solicitações. Tente novamente.");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

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
        <p className={styles.carregando}>Carregando solicitações...</p>
      </div>
    );
  }

  if (solicitacoes.length === 0) {
    return (
      <div className={styles.card}>
        <p className={styles.empty}>Nenhuma solicitação encontrada</p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Solicitante</th>
            <th>Status</th>
            <th>Data de abertura</th>
          </tr>
        </thead>
        <tbody>
          {solicitacoes.map((registro) => {
            const stamp = stampInfo(registro);
            return (
              <tr
                key={registro.id}
                className={styles.linhaClicavel}
                onClick={() => router.push(`/solicitacoes/${registro.id}`)}
              >
                <td>
                  <span className={styles.chipTipo}>
                    {registro.tipo_fluxo_nome}
                  </span>
                </td>
                <td>{registro.solicitante_nome}</td>
                <td>
                  <span className={`${styles.stamp} ${stamp.classe}`}>
                    {stamp.texto}
                  </span>
                </td>
                <td className={styles.mono}>{formatarData(registro.criado_em)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
