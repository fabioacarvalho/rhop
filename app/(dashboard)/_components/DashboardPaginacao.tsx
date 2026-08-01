"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import styles from "../dashboard.module.css";
import { PAGE_SIZE_PADRAO, usePaginacaoInfo } from "./DashboardListaContext";

/**
 * Paginação da lista de solicitações (DASH-02) — mesma lógica de
 * `auditoria-logs/_components/LogPaginacao.tsx`, lendo de
 * `DashboardListaContext`. Navegar preserva os demais filtros já presentes
 * na URL, trocando só `page`.
 */
export default function DashboardPaginacao() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { total, pageSize: pageSizeInfo } = usePaginacaoInfo();

  const paginaAtual = Math.max(
    1,
    Number(searchParams.get("page") ?? "1") || 1,
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
    <nav aria-label="Paginação de solicitações" className={styles.paginacao}>
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
