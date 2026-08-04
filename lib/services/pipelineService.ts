import { prisma } from "@/lib/prisma";
import { StatusSolicitacao, type Prisma } from "@/lib/generated/prisma/client";
import { visibilidadeSolicitacaoWhere } from "@/lib/services/dashboardService";
import {
  KANBAN_COLUNAS_PADRAO,
  colunaPorChave,
  type KanbanColunaChave,
  type KanbanColunaConfig,
} from "@/lib/config/kanbanColunas";
import type { AuthenticatedUser } from "@/lib/services/authService";

/** Quantidade de itens carregados de imediato por coluna do board (PIPE-14). */
export const LIMITE_INICIAL_POR_COLUNA = 10;

/** Lançado por `listarColuna` quando `chave` não corresponde a nenhuma coluna conhecida. */
export class ErroColunaInvalida extends Error {
  constructor(chave: string) {
    super(`Coluna invalida: ${chave}`);
    this.name = "ErroColunaInvalida";
  }
}

/** Item do board — mesma projeção de `dashboardService.SolicitacaoListItem`. */
export interface KanbanItem {
  id: string;
  tipo_fluxo_nome: string;
  solicitante_nome: string;
  status: StatusSolicitacao;
  atrasada: boolean;
  criado_em: Date;
}

export interface KanbanColunaResultado {
  chave: KanbanColunaChave;
  label: string;
  itens: KanbanItem[];
  total: number;
}

export interface KanbanBoard {
  colunas: KanbanColunaResultado[];
}

function montarWhere(
  visibilidade: Prisma.SolicitacaoWhereInput,
  statuses: StatusSolicitacao[],
  filtro: { tipo_fluxo_id?: string },
): Prisma.SolicitacaoWhereInput {
  return {
    ...visibilidade,
    status: { in: statuses },
    ...(filtro.tipo_fluxo_id ? { tipo_fluxo_id: filtro.tipo_fluxo_id } : {}),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapearItem(registro: any): KanbanItem {
  return {
    id: registro.id,
    tipo_fluxo_nome: registro.tipoFluxo.nome,
    solicitante_nome: registro.solicitante.nome,
    status: registro.status,
    atrasada: registro.atrasada_em !== null,
    criado_em: registro.criado_em,
  };
}

/**
 * Monta o board completo do Pipeline Kanban (PIPE-01, PIPE-02): 4 colunas,
 * na ordem de `KANBAN_COLUNAS_PADRAO`, respeitando a visibilidade por papel
 * (PIPE-03, PIPE-04). A coluna "em_aprovacao" (`statuses: []`) é sempre
 * `{ itens: [], total: 0 }` sem nenhuma chamada ao Prisma — reservada para
 * uma versão futura com etapas intermediárias.
 */
export async function listarBoard(
  usuario: AuthenticatedUser,
  filtro: { tipo_fluxo_id?: string },
): Promise<KanbanBoard> {
  const visibilidade = await visibilidadeSolicitacaoWhere(usuario);

  const resultados = await Promise.all(
    KANBAN_COLUNAS_PADRAO.map(
      async (config: KanbanColunaConfig): Promise<KanbanColunaResultado> => {
        if (config.statuses.length === 0) {
          return { chave: config.chave, label: config.label, itens: [], total: 0 };
        }

        const where = montarWhere(visibilidade, config.statuses, filtro);

        const [registros, total] = await Promise.all([
          prisma.solicitacao.findMany({
            where,
            include: {
              tipoFluxo: { select: { nome: true } },
              solicitante: { select: { nome: true } },
            },
            orderBy: { criado_em: "desc" },
            take: LIMITE_INICIAL_POR_COLUNA,
          }),
          prisma.solicitacao.count({ where }),
        ]);

        return {
          chave: config.chave,
          label: config.label,
          itens: registros.map(mapearItem),
          total,
        };
      },
    ),
  );

  return { colunas: resultados };
}

/**
 * Pagina uma coluna específica do board ("+N outras", PIPE-14). Lança
 * `ErroColunaInvalida` quando `chave` não corresponde a nenhuma coluna
 * conhecida (a rota futura mapeia isso para `400`).
 */
export async function listarColuna(
  usuario: AuthenticatedUser,
  chave: KanbanColunaChave,
  filtro: { tipo_fluxo_id?: string; page?: number; pageSize?: number },
): Promise<{ itens: KanbanItem[]; total: number }> {
  const config = colunaPorChave(chave);

  if (!config) {
    throw new ErroColunaInvalida(chave);
  }

  const visibilidade = await visibilidadeSolicitacaoWhere(usuario);
  const where = montarWhere(visibilidade, config.statuses, filtro);

  const pageSize = filtro.pageSize ?? 10;
  const page = filtro.page ?? 1;

  const [registros, total] = await Promise.all([
    prisma.solicitacao.findMany({
      where,
      include: {
        tipoFluxo: { select: { nome: true } },
        solicitante: { select: { nome: true } },
      },
      orderBy: { criado_em: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.solicitacao.count({ where }),
  ]);

  return { itens: registros.map(mapearItem), total };
}
