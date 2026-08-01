import { prisma } from "@/lib/prisma";
import { Prisma, Role } from "@/lib/generated/prisma/client";
import { buscarPorId } from "@/lib/services/tipoFluxoService";
import { gerarResumoInsights } from "@/lib/services/iaService";
import type { AuthenticatedUser } from "@/lib/services/authService";
import type { InsightsFiltro } from "@/lib/validations/insight";

export type PeriodoInsights = InsightsFiltro["periodo"];
export type DimensaoInsights = InsightsFiltro["dimensao"];

/** Item agregado — status ou "YYYY-MM", com a contagem correspondente. */
export interface InsightItem {
  chave: string;
  quantidade: number;
}

/** DTO de saída de `agregar` (INSIGHT-02, INSIGHT-06) — não persistido. */
export interface InsightResultado {
  tipo_fluxo_id: string;
  tipo_fluxo_nome: string;
  periodo: PeriodoInsights;
  dimensao: DimensaoInsights;
  total: number;
  itens: InsightItem[];
  resumo_ia: string | null;
}

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Traduz `periodo` num intervalo `[inicio, fim]` (INSIGHT-01, Questão #3 do
 * spec). `agora` é injetável para teste determinístico (mesmo padrão de
 * `slaService.verificarSla(now?)`).
 */
export function periodoParaIntervalo(
  periodo: PeriodoInsights,
  agora: Date = new Date(),
): { inicio: Date; fim: Date } {
  if (periodo === "ULTIMOS_30_DIAS") {
    return { inicio: new Date(agora.getTime() - 30 * MS_POR_DIA), fim: agora };
  }
  if (periodo === "ULTIMOS_90_DIAS") {
    return { inicio: new Date(agora.getTime() - 90 * MS_POR_DIA), fim: agora };
  }
  return { inicio: new Date(agora.getFullYear(), 0, 1), fim: agora };
}

/**
 * Resolve o escopo de visibilidade da agregação (INSIGHT-09).
 *
 * - `RH_ADMIN` -> `null` (sem filtro, agregação global).
 * - `GESTOR` -> `[usuario.id, ...idsDaEquipe]`. Sem subordinados, retorna
 *   `[usuario.id]` — não lança, não quebra (edge case do spec.md).
 */
export async function resolverIdsVisiveis(
  usuario: AuthenticatedUser,
): Promise<string[] | null> {
  if (usuario.role === Role.RH_ADMIN) {
    return null;
  }

  const equipe = await prisma.user.findMany({
    where: { gestor_id: usuario.id },
    select: { id: true },
  });

  return [usuario.id, ...equipe.map((u) => u.id)];
}

type LinhaMes = { mes: Date; quantidade: bigint };

/**
 * Agrega `Solicitacao` por tipo/período/dimensão e narra o resultado via IA
 * (INSIGHT-02, INSIGHT-05, INSIGHT-06, INSIGHT-08, INSIGHT-09).
 *
 * - `tipoFluxoId` inexistente -> propaga `ErroNaoEncontrado` (nenhuma
 *   agregação é executada).
 * - `total === 0` -> `itens: []`, `resumo_ia: null`, sem chamar a IA
 *   (economia de custo/latência, INSIGHT-05).
 * - `total > 0` -> chama `gerarResumoInsights`; falha vira `resumo_ia: null`
 *   sem lançar (o próprio `iaService` já grava o `Log ERRO`).
 */
export async function agregar(
  usuario: AuthenticatedUser,
  filtro: InsightsFiltro,
): Promise<InsightResultado> {
  const tipoFluxo = await buscarPorId(filtro.tipoFluxoId);
  const { inicio, fim } = periodoParaIntervalo(filtro.periodo);
  const idsVisiveis = await resolverIdsVisiveis(usuario);

  const itens =
    filtro.dimensao === "STATUS"
      ? await agregarPorStatus(filtro.tipoFluxoId, inicio, fim, idsVisiveis)
      : await agregarPorMes(filtro.tipoFluxoId, inicio, fim, idsVisiveis);

  const total = itens.reduce((soma, item) => soma + item.quantidade, 0);

  const resumo_ia =
    total === 0
      ? null
      : await gerarResumoInsights({
          tipoFluxoNome: tipoFluxo.nome,
          periodo: filtro.periodo,
          dimensao: filtro.dimensao,
          itens,
          total,
        });

  return {
    tipo_fluxo_id: tipoFluxo.id,
    tipo_fluxo_nome: tipoFluxo.nome,
    periodo: filtro.periodo,
    dimensao: filtro.dimensao,
    total,
    itens,
    resumo_ia,
  };
}

async function agregarPorStatus(
  tipoFluxoId: string,
  inicio: Date,
  fim: Date,
  idsVisiveis: string[] | null,
): Promise<InsightItem[]> {
  const grupos = await prisma.solicitacao.groupBy({
    by: ["status"],
    where: {
      tipo_fluxo_id: tipoFluxoId,
      criado_em: { gte: inicio, lte: fim },
      ...(idsVisiveis !== null && { solicitante_id: { in: idsVisiveis } }),
    },
    _count: { _all: true },
  });

  return grupos.map((grupo) => ({
    chave: grupo.status,
    quantidade: grupo._count._all,
  }));
}

async function agregarPorMes(
  tipoFluxoId: string,
  inicio: Date,
  fim: Date,
  idsVisiveis: string[] | null,
): Promise<InsightItem[]> {
  const filtroVisibilidade =
    idsVisiveis !== null
      ? Prisma.sql`AND solicitante_id = ANY(${idsVisiveis})`
      : Prisma.empty;

  const linhas = await prisma.$queryRaw<LinhaMes[]>`
    SELECT date_trunc('month', criado_em) AS mes, COUNT(*) AS quantidade
    FROM solicitacoes
    WHERE tipo_fluxo_id = ${tipoFluxoId}
      AND criado_em >= ${inicio}
      AND criado_em <= ${fim}
      ${filtroVisibilidade}
    GROUP BY mes
    ORDER BY mes ASC
  `;

  return linhas.map((linha) => ({
    chave: formatoAnoMes(linha.mes),
    quantidade: Number(linha.quantidade),
  }));
}

function formatoAnoMes(data: Date): string {
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}
