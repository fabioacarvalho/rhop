"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PAGE_SIZE_PADRAO, usePaginacaoInfo } from "./AuditoriaLogsContext";
import styles from "../auditoria-logs.module.css";

/**
 * Paginação simples da tela de Auditoria/Logs (AUD-11).
 *
 * Lê a página atual da URL (`useSearchParams`) e o `total`/`pageSize` da
 * última busca de `LogTabela` — publicados via `AuditoriaLogsContext` (ver
 * esse arquivo para a decisão de engenharia sobre por que não é prop nem
 * React Context com Provider). Ao navegar, preserva todos os filtros já
 * presentes na URL — troca apenas `page`, mantendo a ordenação por
 * `criado_em` desc (que já vem da API, não é responsabilidade deste
 * componente).
 */
export default function LogPaginacao() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { total, pageSize: pageSizeInfo } = usePaginacaoInfo();

  const paginaAtual = Math.max(
    1,
    Number(searchParams.get("page") ?? "1") || 1
  );
  const pageSize = pageSizeInfo || PAGE_SIZE_PADRAO;
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));

  const podeVoltar = paginaAtual > 1;
  const podeAvancar = paginaAtual * pageSize < total;

  function irParaPagina(pagina: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(pagina));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <nav aria-label="Paginação de logs" className={styles.paginacao}>
      <button
        type="button"
        className={`${styles.btn} ${styles.btnGhost}`}
        onClick={() => irParaPagina(paginaAtual - 1)}
        disabled={!podeVoltar}
      >
        Anterior
      </button>
      <span>
        Página {paginaAtual} de {totalPaginas}
      </span>
      <button
        type="button"
        className={`${styles.btn} ${styles.btnGhost}`}
        onClick={() => irParaPagina(paginaAtual + 1)}
        disabled={!podeAvancar}
      >
        Próxima
      </button>
    </nav>
  );
}
