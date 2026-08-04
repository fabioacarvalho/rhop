// Importa de `enums` (nao `client`) porque este modulo pode ser usado por
// Client Components (KanbanBoard) — `client.ts` traz o runtime do Prisma
// inteiro e quebra o bundle de browser. Mesmo padrao de `lib/navigation/navConfig.ts`.
import { StatusSolicitacao } from "@/lib/generated/prisma/enums";

export type KanbanColunaChave =
  | "pendente"
  | "em_aprovacao"
  | "aprovado"
  | "cancelado";

export interface KanbanColunaConfig {
  chave: KanbanColunaChave;
  label: string;
  statuses: StatusSolicitacao[]; // [] = coluna reservada, sempre vazia nesta versao
}

/**
 * Fonte unica de verdade das colunas do Pipeline Kanban (PIPE-01, PIPE-02).
 * "Em aprovacao" nasce com `statuses: []` (reservada para uma versao futura
 * com etapas intermediarias); "Cancelado" agrupa REJEITADA e CANCELADA.
 */
export const KANBAN_COLUNAS_PADRAO: KanbanColunaConfig[] = [
  { chave: "pendente", label: "Pendente", statuses: [StatusSolicitacao.PENDENTE] },
  { chave: "em_aprovacao", label: "Em aprovação", statuses: [] },
  { chave: "aprovado", label: "Aprovado", statuses: [StatusSolicitacao.APROVADA] },
  {
    chave: "cancelado",
    label: "Cancelado",
    statuses: [StatusSolicitacao.REJEITADA, StatusSolicitacao.CANCELADA],
  },
];

/**
 * Busca a config de uma coluna pela chave. Retorna `undefined` quando a
 * chave nao corresponde a nenhuma coluna conhecida.
 */
export function colunaPorChave(chave: string): KanbanColunaConfig | undefined {
  return KANBAN_COLUNAS_PADRAO.find((coluna) => coluna.chave === chave);
}
