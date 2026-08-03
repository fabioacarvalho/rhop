import { prisma } from "@/lib/prisma";
import {
  Role,
  StatusSolicitacao,
  type Prisma,
} from "@/lib/generated/prisma/client";
import * as equipeService from "@/lib/services/equipeService";
import type { AuthenticatedUser } from "@/lib/services/authService";
import type { DashboardListaFiltro } from "@/lib/validations/dashboardFiltros";

const PAGE_SIZE_PADRAO = 20;

/** Contadores agregados do escopo de visibilidade do usuário (DASH-01). */
export interface ContadoresDashboard {
  pendentes: number;
  atrasados: number;
  aprovados: number;
  rejeitados: number;
}

/** Item de `listar()` — projeção mínima exigida por DASH-02. */
export interface SolicitacaoListItem {
  id: string;
  tipo_fluxo_nome: string;
  solicitante_nome: string;
  status: StatusSolicitacao;
  atrasada: boolean;
  criado_em: Date;
}

export interface ListarResultado {
  solicitacoes: SolicitacaoListItem[];
  total: number;
}

/** Opção do filtro "solicitante" (DASH-06). */
export interface SolicitanteOpcao {
  id: string;
  nome: string;
}

/**
 * Regra de visibilidade por papel (DASH-03), aplicada em todas as queries
 * desta feature: `RH_ADMIN` vê tudo (sem filtro); `GESTOR` só vê as próprias
 * solicitações mais as dos usuários membros das `Equipe`s que ele gere
 * (ver `equipeService.listarGeridasPor`). Sem equipe gerida, o escopo cai
 * para só as próprias solicitações — não lança, não quebra.
 */
async function visibilidadeSolicitacaoWhere(
  usuario: AuthenticatedUser,
): Promise<Prisma.SolicitacaoWhereInput> {
  if (usuario.role === Role.RH_ADMIN) {
    return {};
  }

  const equipes = await equipeService.listarGeridasPor(usuario.id);

  return {
    OR: [
      { solicitante_id: usuario.id },
      { solicitante: { equipe_id: { in: equipes.map((e) => e.id) } } },
    ],
  };
}

/**
 * Contadores por status (DASH-01, DASH-08). Sempre reflete o escopo de
 * visibilidade completo — nunca aceita filtro (ver design.md, seção 0, Q#2).
 *
 * "Atrasado" é aditivo sobre "pendente": uma solicitação atrasada é
 * contabilizada tanto em `pendentes` quanto em `atrasados` (context.md #3).
 */
export async function contarPorStatus(
  usuario: AuthenticatedUser,
): Promise<ContadoresDashboard> {
  const visibilidade = await visibilidadeSolicitacaoWhere(usuario);

  const [pendentes, atrasados, aprovados, rejeitados] = await Promise.all([
    prisma.solicitacao.count({
      where: { ...visibilidade, status: StatusSolicitacao.PENDENTE },
    }),
    prisma.solicitacao.count({
      where: { ...visibilidade, atrasada_em: { not: null } },
    }),
    prisma.solicitacao.count({
      where: { ...visibilidade, status: StatusSolicitacao.APROVADA },
    }),
    prisma.solicitacao.count({
      where: { ...visibilidade, status: StatusSolicitacao.REJEITADA },
    }),
  ]);

  return { pendentes, atrasados, aprovados, rejeitados };
}

/**
 * Lista paginada de solicitações do escopo de visibilidade do usuário,
 * combinando os filtros de tipo/status/solicitante via AND (DASH-02, DASH-04
 * a DASH-07).
 *
 * `status=ATRASADO` restringe a `atrasada_em != null`; qualquer outro valor
 * de `status` filtra por `StatusSolicitacao` puro — inclusive as atrasadas,
 * já que "atrasado" não é exclusivo de "pendente" (mesma regra aditiva do
 * contador).
 */
export async function listar(
  usuario: AuthenticatedUser,
  filtro: DashboardListaFiltro,
): Promise<ListarResultado> {
  const visibilidade = await visibilidadeSolicitacaoWhere(usuario);

  const statusWhere: Prisma.SolicitacaoWhereInput =
    filtro.status === "ATRASADO"
      ? { atrasada_em: { not: null } }
      : filtro.status
        ? { status: filtro.status as StatusSolicitacao }
        : {};

  const where: Prisma.SolicitacaoWhereInput = {
    ...visibilidade,
    ...statusWhere,
    ...(filtro.tipo_fluxo_id ? { tipo_fluxo_id: filtro.tipo_fluxo_id } : {}),
    ...(filtro.solicitante_id
      ? { solicitante_id: filtro.solicitante_id }
      : {}),
  };

  const pageSize = filtro.pageSize ?? PAGE_SIZE_PADRAO;
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

  const solicitacoes: SolicitacaoListItem[] = registros.map((solicitacao) => ({
    id: solicitacao.id,
    tipo_fluxo_nome: solicitacao.tipoFluxo.nome,
    solicitante_nome: solicitacao.solicitante.nome,
    status: solicitacao.status,
    atrasada: solicitacao.atrasada_em !== null,
    criado_em: solicitacao.criado_em,
  }));

  return { solicitacoes, total };
}

/**
 * Opções do filtro "solicitante" (DASH-06): `RH_ADMIN` vê todos os `User`;
 * `GESTOR` vê ele mesmo mais a própria equipe (mesma regra de visibilidade
 * de `visibilidadeSolicitacaoWhere`, aplicada a `User` em vez de
 * `Solicitacao`).
 */
export async function listarSolicitantesVisiveis(
  usuario: AuthenticatedUser,
): Promise<SolicitanteOpcao[]> {
  if (usuario.role === Role.RH_ADMIN) {
    return prisma.user.findMany({
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    });
  }

  const equipes = await equipeService.listarGeridasPor(usuario.id);

  return prisma.user.findMany({
    where: {
      OR: [
        { id: usuario.id },
        { equipe_id: { in: equipes.map((e) => e.id) } },
      ],
    },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
}
