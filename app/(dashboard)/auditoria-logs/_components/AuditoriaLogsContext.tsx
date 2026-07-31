"use client";

import { useSyncExternalStore } from "react";

/**
 * Glue de estado interno da Tela de Auditoria/Logs (T6).
 *
 * O `design.md` (`.specs/features/auditoria-logs/design.md`, seção
 * "UI — app/(dashboard)/auditoria-logs/") lista `LogFiltros`, `LogTabela` e
 * `LogPaginacao` como componentes-irmãos, sem um componente pai dedicado
 * nesta task (a composição da árvore é `page.tsx`, T5). `LogTabela` é quem
 * dispara o `fetch` em `GET /api/logs` e conhece o `total`/`pageSize`
 * retornado; `LogPaginacao` precisa desses dois valores para desabilitar
 * corretamente "anterior"/"próxima" (AUD-11), mas é irmão, não filho, de
 * `LogTabela` — não há "prop drilling" possível sem um pai comum.
 *
 * Decisão de engenharia (documentada aqui e no relatório da task): em vez
 * de React Context + `Provider` — o que exigiria que `page.tsx` (T5)
 * envolvesse os três componentes com um wrapper adicional, um detalhe de
 * implementação que T5 não deveria precisar conhecer, já que o design só
 * fala em renderizar os três lado a lado — este arquivo expõe um "external
 * store" mínimo via `useSyncExternalStore`: `LogTabela` publica
 * `{ total, pageSize }` após cada fetch bem-sucedido (`definirPaginacaoInfo`),
 * `LogPaginacao` assina esse valor (`usePaginacaoInfo`) e re-renderiza
 * quando ele muda. Nenhum `Provider` é necessário na árvore — os dois
 * componentes só precisam estar montados na mesma página, que é exatamente
 * o que T5 já faz. Isso evita duplicar o fetch em dois lugares e evita
 * inventar um 4º componente de UI visível: isto é só "cola" de estado, não
 * uma peça de UI.
 *
 * `"use client"` aqui é proposital: garante que o estado do módulo (a
 * variável `estadoAtual`) só existe no browser (uma instância por
 * carregamento de página), nunca é avaliado durante SSR/RSC — onde uma
 * variável de módulo mutável vazaria estado entre requisições de usuários
 * diferentes, o que seria um bug real de isolamento, não só um detalhe
 * estético.
 */

/** Mesmo default de `logService.listar` (`lib/services/logService.ts`) — mantido aqui só como fallback de UI antes da primeira resposta da API. */
export const PAGE_SIZE_PADRAO = 20;

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

/**
 * Publica o `total`/`pageSize` da última busca de `LogTabela`. Só notifica
 * assinantes (`LogPaginacao`) quando o valor muda de fato, evitando
 * re-renders desnecessários a cada fetch (mesmo quando o resultado é igual).
 */
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

/** Lido por `LogPaginacao` para calcular os botões de anterior/próxima e o total de páginas. */
export function usePaginacaoInfo(): PaginacaoInfo {
  return useSyncExternalStore(inscrever, obterEstado, obterEstadoServidor);
}
