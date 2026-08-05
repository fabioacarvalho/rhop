"use client";

import { useSyncExternalStore } from "react";

/**
 * Glue de estado da lista de solicitações do dashboard (T6) — mesmo padrão
 * de `auditoria-logs/_components/AuditoriaLogsContext.tsx`: `ListaSolicitacoes`
 * e `DashboardPaginacao` são irmãos (composição em `page.tsx`), sem pai
 * dedicado que permita passar `total`/`pageSize` via prop. Em vez de um
 * React Context com `Provider` — que obrigaria `page.tsx` a conhecer um
 * detalhe de implementação que o design não pede — este módulo expõe um
 * "external store" mínimo via `useSyncExternalStore`.
 *
 * `"use client"` é proposital: garante que o estado do módulo só existe no
 * browser, nunca avaliado durante SSR/RSC (onde vazaria entre requisições de
 * usuários diferentes).
 */

export const PAGE_SIZE_PADRAO = 5;

export interface PaginacaoInfo {
  total: number;
  pageSize: number;
}

const ESTADO_INICIAL: PaginacaoInfo = { total: 0, pageSize: PAGE_SIZE_PADRAO };

let estadoAtual: PaginacaoInfo = ESTADO_INICIAL;
const ouvintes = new Set<() => void>();

function inscrever(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

function obterEstado(): PaginacaoInfo {
  return estadoAtual;
}

function obterEstadoServidor(): PaginacaoInfo {
  return ESTADO_INICIAL;
}

/** Publica o `total`/`pageSize` da última busca de `ListaSolicitacoes`. */
export function definirPaginacaoInfo(info: PaginacaoInfo): void {
  if (
    estadoAtual.total === info.total &&
    estadoAtual.pageSize === info.pageSize
  ) {
    return;
  }
  estadoAtual = info;
  ouvintes.forEach((ouvinte) => ouvinte());
}

/** Lido por `DashboardPaginacao` para calcular anterior/próxima e total de páginas. */
export function usePaginacaoInfo(): PaginacaoInfo {
  return useSyncExternalStore(inscrever, obterEstado, obterEstadoServidor);
}
