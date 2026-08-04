# Pipeline Kanban Design

**Spec**: `.specs/features/pipeline-kanban/spec.md`
**Context**: `.specs/features/pipeline-kanban/context.md`
**Status**: Draft

---

## SPEC_DEVIATION — decisões tomadas nesta fase (confirmadas com o usuário em `context.md`)

Duas decisões desta feature desviam de documentos de referência já existentes, sem alterá-los (mesma convenção usada em `integrar-login-google/design.md`):

1. **Novo status `CANCELADA`** — reabre a exclusão de escopo travada em `solicitacoes/spec.md` ("Editar ou cancelar... fora de escopo"). Mantido lá como registro histórico; aqui documentamos que a decisão evoluiu (ver `context.md` #1).
2. **`GESTOR` ganha acesso ao board** — `docs/design-ux-ui/fluxorh-ui-layout-specs.md` seção 3 (Matriz RBAC) lista `screen-pipeline` como `✗` para `GESTOR` (RH_Admin-only no mockup original). Esta feature entrega o board para `GESTOR` **e** `RH_ADMIN`, escopado por visibilidade (ver `context.md` #3). O arquivo do mockup/UI specs não é alterado — é referência de design congelada no tempo, não uma spec de feature versionada.

Nenhum texto de `spec.md`, `solicitacoes/spec.md` ou `fluxorh-ui-layout-specs.md` é reescrito por esta decisão.

---

## Contexto

Duas features já travam decisões que esta feature **reusa sem reabrir**:

- `dashboard-visao-geral/dashboardService.ts`: regra de visibilidade por papel (`GESTOR` = próprio + membros das `Equipe`s geridas; `RH_ADMIN` = tudo), hoje implementada em `visibilidadeSolicitacaoWhere` (função privada do módulo). Esta feature **exporta** essa função (sem mudar sua lógica) para reuso direto — evita duplicar a regra de visibilidade em um terceiro lugar.
- `aprovacoes/aprovacaoService.ts`: `assertPodeDecidir` já bloqueia qualquer decisão quando `solicitacao.status !== PENDENTE`. O novo status `CANCELADA` cai automaticamente nesse bloqueio — **nenhuma mudança é necessária** em `aprovacaoService` para impedir que um aprovador decida uma solicitação já cancelada.
- `solicitacoes/solicitacaoService.ts`: único ponto de escrita/leitura de `Solicitacao` para o solicitante. A nova ação `cancelar` entra neste mesmo arquivo, ao lado de `criar`/`listarMinhas`/`buscarDetalhePorId`.

---

## Architecture Overview

```mermaid
graph TD
    subgraph BOARD["Pipeline Kanban (Screen 5, GESTOR + RH_ADMIN)"]
        PG["app/(dashboard)/pipeline/page.tsx"] -->|requireUser GESTOR,RH_ADMIN| AUTH[authService]
        PG --> KB["KanbanBoard.tsx (client)"]
        KB -->|GET /api/pipeline?tipo_fluxo_id=| API_BOARD["app/api/pipeline/route.ts"]
        KB -->|GET /api/pipeline/[coluna]?page=| API_COL["app/api/pipeline/[coluna]/route.ts"]
        API_BOARD --> PS[pipelineService.listarBoard]
        API_COL --> PS2[pipelineService.listarColuna]
        PS --> VIS["dashboardService.visibilidadeSolicitacaoWhere (exportada)"]
        PS --> CFG["kanbanColunas.ts (config coluna->status[])"]
        PS2 --> VIS
        PS2 --> CFG
        PS --> DB[(Postgres via Prisma)]
        PS2 --> DB
    end

    subgraph CANCEL["Cancelamento (solicitante dono ou RH_Admin)"]
        MINHAS["app/(dashboard)/solicitacoes/page.tsx"] --> BTN["CancelarSolicitacaoButton.tsx (client)"]
        KB -->|"Cancelar" no card, so RH_Admin| BTN2["acao inline no KanbanCard"]
        BTN -->|POST| API_CANCEL["app/api/solicitacoes/[id]/cancelar/route.ts"]
        BTN2 -->|POST| API_CANCEL
        API_CANCEL --> SS["solicitacaoService.cancelar"]
        SS -->|status PENDENTE -> CANCELADA| DB
        SS -->|Log AUDITORIA acao=CANCELAMENTO| LOG[logService.registrar]
    end

    NAV["lib/navigation/navConfig.ts"] -.->|novo item "Pipeline", grupo Visao geral| PG
```

---

## Code Reuse Analysis

| Componente existente | Reuso nesta feature |
| --- | --- |
| `dashboardService.visibilidadeSolicitacaoWhere` | Exportada (era privada) e reusada tal como está por `pipelineService` — mesma regra de escopo GESTOR/RH_ADMIN, zero duplicação. |
| `equipeService.listarGeridasPor` | Reusado indiretamente via `visibilidadeSolicitacaoWhere` (sem mudança). |
| `authService.requireUser([Role.GESTOR, Role.RH_ADMIN])` | Guard de acesso ao board (PIPE-15) e às rotas de API — mesmo padrão de `aprovacoes`/`dashboard`. |
| `logService.registrar` | Reusado para o `Log AUDITORIA` do cancelamento (PIPE-07), mesmo formato de `aprovacaoService.decidir`. |
| `aprovacaoService.assertPodeDecidir` | **Sem alteração** — já cobre o edge case "decidir uma solicitação cancelada" por checar `status !== PENDENTE`. |
| `dashboard.module.css` (tokens `.stamp*`, `.chipTipo`, `.card`, `.btn*`) | Reusados por `pipeline.module.css` para manter consistência visual (carimbos, chips, botões) — só as classes específicas de Kanban (`.kanbanBoard`, `.kanbanColumn`, `.kanbanCard`) são novas. |
| `solicitacoes.module.css` (`.stamp`, `.stampPendente/Aprovada/Rejeitada`, `.chipTipo`) | Ganha uma variante `.stampCancelada` nova; resto reusado sem alteração. |
| Padrão de erro `{ error }` / `{ error, detalhes }` já usado em `app/api/aprovacoes/[solicitacaoId]/decidir/route.ts` | Reusado por `app/api/solicitacoes/[id]/cancelar/route.ts` e pelas rotas de `pipeline`. |

### Integration Points

| Sistema | Integração |
| --- | --- |
| `lib/navigation/navConfig.ts` | Novo `NavItem` "Pipeline" no grupo `visao-geral`, `roles: [Role.GESTOR, Role.RH_ADMIN]` — coordena com a feature `menu-navegacao` (ainda em fase Specify), mas a mudança em si é só uma linha de config, sem depender de nenhuma task daquela feature. |
| `prisma/schema.prisma` | Novo valor `CANCELADA` no enum `StatusSolicitacao` — requer `npx prisma migrate dev`. |

---

## Components

### `prisma/schema.prisma` (modificar)

```prisma
enum StatusSolicitacao {
  PENDENTE
  APROVADA
  REJEITADA
  CANCELADA
}
```

- **Purpose**: Suporta o novo status de cancelamento (PIPE-05/06).
- **Migration**: `npx prisma migrate dev --name add_status_cancelada` — `ALTER TYPE "StatusSolicitacao" ADD VALUE 'CANCELADA'`. Não afeta nenhuma linha existente (valor novo, sem default, sem coluna nova).
- **Reuses**: Nenhuma tabela nova; `Solicitacao.status` já é o campo alvo.

### `lib/config/kanbanColunas.ts` (novo)

- **Purpose**: Único ponto de configuração do mapeamento coluna → status. Fonte da verdade para "customizável depois" (context.md #5) — trocar/reordenar colunas no futuro é editar este array, não caçar strings pela UI.
- **Location**: `lib/config/kanbanColunas.ts`
- **Interface**:

```ts
export type KanbanColunaChave = "pendente" | "em_aprovacao" | "aprovado" | "cancelado";

export interface KanbanColunaConfig {
  chave: KanbanColunaChave;
  label: string;
  statuses: StatusSolicitacao[]; // [] = coluna reservada, sempre vazia nesta versao
}

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

export function colunaPorChave(chave: string): KanbanColunaConfig | undefined;
```

- **Dependencies**: `@/lib/generated/prisma/enums` (`StatusSolicitacao`).
- **Reuses**: N/A (módulo novo).

### `dashboardService.ts` (modificar — só visibilidade)

- **Purpose**: Expor `visibilidadeSolicitacaoWhere` para reuso por `pipelineService`, sem duplicar a regra de escopo GESTOR/RH_ADMIN.
- **Mudança**: `function visibilidadeSolicitacaoWhere` → `export function visibilidadeSolicitacaoWhere`. Nenhuma outra linha muda.
- **Dependencies**: inalteradas.
- **Reuses**: N/A.

### `pipelineService.ts` (novo)

- **Purpose**: Monta o board Kanban (PIPE-01 a PIPE-04, PIPE-11, PIPE-14) respeitando visibilidade por papel e o filtro opcional de `TipoFluxo`.
- **Location**: `lib/services/pipelineService.ts`
- **Interfaces**:

```ts
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
  itens: KanbanItem[]; // ate LIMITE_INICIAL_POR_COLUNA
  total: number;
}

export interface KanbanBoard {
  colunas: KanbanColunaResultado[];
}

export async function listarBoard(
  usuario: AuthenticatedUser,
  filtro: { tipo_fluxo_id?: string },
): Promise<KanbanBoard>;

export async function listarColuna(
  usuario: AuthenticatedUser,
  chave: KanbanColunaChave,
  filtro: { tipo_fluxo_id?: string; page?: number; pageSize?: number },
): Promise<{ itens: KanbanItem[]; total: number }>;
```

- **Lógica de `listarBoard`**:
  1. `usuario.role` não é `GESTOR`/`RH_ADMIN` → nunca é chamado (a rota/página já bloqueia via `requireUser`), mas a função em si não assume isso — recebe `AuthenticatedUser` já autorizado.
  2. `visibilidade = await dashboardService.visibilidadeSolicitacaoWhere(usuario)`.
  3. Para cada `KanbanColunaConfig` de `KANBAN_COLUNAS_PADRAO`:
     - `statuses.length === 0` (coluna "Em aprovação") → `{ chave, label, itens: [], total: 0 }`, **sem query** (PIPE-02).
     - Senão → `prisma.solicitacao.findMany({ where: { ...visibilidade, status: { in: statuses }, ...(filtro.tipo_fluxo_id && { tipo_fluxo_id: filtro.tipo_fluxo_id }) }, include: { tipoFluxo: { select: { nome: true } }, solicitante: { select: { nome: true } } }, orderBy: { criado_em: "desc" }, take: LIMITE_INICIAL_POR_COLUNA })` + `prisma.solicitacao.count({ where: mesmoWhere })` em paralelo (`Promise.all` nas 3 colunas ativas).
  4. Mapeia para `KanbanItem` (mesma projeção de `dashboardService.SolicitacaoListItem`).
- **Lógica de `listarColuna`**: mesma `where` de uma coluna específica, com `skip`/`take` de paginação — alimenta o "+N outras" (PIPE-14, Questão em Aberto #4 do spec).
- **`LIMITE_INICIAL_POR_COLUNA`**: `10` (mesma ordem de grandeza do exemplo do mockup, "+4 outras" com card inicial de poucos itens).
- **Dependencies**: `dashboardService.visibilidadeSolicitacaoWhere`, `kanbanColunas.ts`, `lib/prisma.ts`.
- **Reuses**: Regra de visibilidade de `dashboardService`; formato de item de `dashboardService.SolicitacaoListItem` (mesmos campos, tipo próprio para não acoplar os dois módulos).

### `lib/validations/pipelineFiltros.ts` (novo)

```ts
export const pipelineFiltroQuerySchema = z.object({
  tipo_fluxo_id: z.string().min(1).optional(),
});

export const pipelineColunaQuerySchema = pipelineFiltroQuerySchema.extend({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});
```

- Mesmo estilo de `dashboardFiltros.ts` (`parseX(url)` isolado do handler para teste direto do parsing).

### `app/api/pipeline/route.ts` (novo)

- **Purpose**: `GET` do board completo (PIPE-01 a PIPE-04, PIPE-11).
- **Comportamento**: `requireUser([Role.GESTOR, Role.RH_ADMIN])` (sem sessão → `401`; `SOLICITANTE` → `403`, PIPE-15) → parse de `pipelineFiltroQuerySchema` (inválido → `400`) → `pipelineService.listarBoard(usuario, filtro)` → `200 { board }`.
- **Reuses**: mesmo padrão de `app/api/dashboard/solicitacoes/route.ts`.

### `app/api/pipeline/[coluna]/route.ts` (novo)

- **Purpose**: `GET` paginado de uma coluna específica (expandir "+N outras").
- **Comportamento**: mesmo guard de acesso; `coluna` fora de `KanbanColunaChave` → `400`; sucesso → `200 { itens, total }`.
- **Reuses**: `pipelineService.listarColuna`, `kanbanColunas.colunaPorChave` para validar o parâmetro de rota.

### `solicitacaoService.ts` (modificar — adiciona, não altera o que já existe)

- **Purpose**: Nova ação `cancelar` (PIPE-05, PIPE-06, PIPE-07, PIPE-09).
- **Novas interfaces**:

```ts
export class ErroNaoAutorizadoCancelamento extends Error {
  constructor(message = "Usuario nao autorizado a cancelar esta solicitacao.") {
    super(message);
    this.name = "ErroNaoAutorizadoCancelamento";
  }
}

export class ErroCancelamentoInvalido extends Error {
  constructor(message = "Solicitacao ja encerrada; nao e possivel cancelar.") {
    super(message);
    this.name = "ErroCancelamentoInvalido";
  }
}

export async function cancelar(
  id: string,
  usuario: AuthenticatedUser,
): Promise<Solicitacao>;
```

  Lógica:
  1. `prisma.solicitacao.findUnique({ where: { id } })` → não existe → `ErroNaoEncontrado` (reusa a classe já existente neste arquivo).
  2. `usuario.role !== Role.RH_ADMIN && solicitacao.solicitante_id !== usuario.id` → `ErroNaoAutorizadoCancelamento` (bloqueia `GESTOR` mesmo sendo aprovador da etapa — PIPE-08, context.md #4).
  3. `solicitacao.status !== StatusSolicitacao.PENDENTE` → `ErroCancelamentoInvalido` (PIPE-09; cobre idempotência de corrida — a segunda requisição concorrente encontra o status já mudado).
  4. Sucesso → `prisma.solicitacao.update({ where: { id }, data: { status: CANCELADA } })` + `registrar({ tipo: "AUDITORIA", entidade: "Solicitacao", entidade_id: id, acao: "CANCELAMENTO", usuario_id: usuario.id })` (PIPE-07).
- **Dependencies**: `logService.registrar` (já importado no arquivo).
- **Reuses**: `ErroNaoEncontrado` já existente; mesmo estilo de classes de erro de `aprovacaoService.ts`.

### `app/api/solicitacoes/[id]/cancelar/route.ts` (novo)

- **Purpose**: `POST` que expõe `solicitacaoService.cancelar` (PIPE-10).
- **Comportamento**: `requireUser()` (sem restrição de papel — GESTOR chega a autenticar, mas é barrado pelo service) → sem sessão → `401`; `cancelar(id, usuario)`:
  - `ErroNaoEncontrado` → `404`.
  - `ErroNaoAutorizadoCancelamento` → `403`.
  - `ErroCancelamentoInvalido` → `409`.
  - Sucesso → `200 { solicitacao }`.
- **Reuses**: mesmo padrão de `app/api/aprovacoes/[solicitacaoId]/decidir/route.ts`.

### `app/(dashboard)/pipeline/page.tsx` (novo, server component)

- **Purpose**: Guard de acesso (PIPE-15) + primeira carga do board via SSR.
- **Comportamento**:
  1. `requireUser([Role.GESTOR, Role.RH_ADMIN])` — `ErroNaoAutenticado` → `redirect('/login')`; `ErroNaoAutorizado` → tela "Acesso restrito" (mesmo padrão de `solicitacoes/page.tsx`).
  2. `pipelineService.listarBoard(usuario, {})` (sem filtro na carga inicial) + `tipoFluxoService.listarAtivos()` (ou equivalente já existente, para popular o `<select>` de filtro — reusar o que `configuracao-fluxos`/`dashboard` já usam para listar tipos).
  3. Renderiza `<KanbanBoard boardInicial={board} tiposFluxo={tipos} papel={usuario.role} />`.
- **Dependencies**: `authService.requireUser`, `pipelineService.listarBoard`, `tipoFluxoService` (função de listagem já existente — confirmar nome exato em `tipoFluxoService.ts` na fase de Tasks).

### `KanbanBoard.tsx` (novo, client component)

- **Purpose**: Renderiza as 4 colunas, filtro por Tipo de Fluxo, "+N outras" por coluna e (só para `RH_ADMIN`) ação "Cancelar" inline no card de uma solicitação `PENDENTE`.
- **Location**: `app/(dashboard)/pipeline/_components/KanbanBoard.tsx`
- **Comportamento**:
  - Estado local: board atual, filtro selecionado, colunas expandidas.
  - Troca de filtro → `GET /api/pipeline?tipo_fluxo_id=...` → substitui o board.
  - "+N outras" em uma coluna → `GET /api/pipeline/[coluna]?page=2` → concatena itens.
  - Card de "Pendente" com `atrasada: true` → classe `.late` (PIPE-12).
  - `papel === "RH_ADMIN"` → botão "Cancelar" no card de "Pendente" → `POST /api/solicitacoes/[id]/cancelar` → remove o card da coluna "Pendente" e incrementa "Cancelado" otimisticamente (ou `router.refresh()` simples, mais barato de implementar — decisão de Tasks).
- **Dependencies**: `fetch` para as rotas acima.
- **Reuses**: tokens de `pipeline.module.css` (ver abaixo).

### `pipeline.module.css` (novo)

- Reusa tokens de `app/globals.css` (`--azul-*`, `--linha`, `--radius`, `--shadow`, `--laranja*`) e classes já existentes em `dashboard.module.css` (`.stamp*`, `.chipTipo`, `.card`, `.btn*`, `.filterBar`) via composição/CSS Modules `composes` ou import direto de estilo equivalente.
- Novas classes: `.kanbanBoard` (scroll horizontal, 4 colunas lado a lado — mesmo padrão do mockup `.kanban`), `.kanbanColumn`, `.kanbanColumnHead` (label + contador redondo), `.kanbanCard`, `.kanbanCardLate` (borda/indicador de atraso, PIPE-12), `.kanbanMoreList`, `.kanbanMoreBtn` (replica o "+N outras" do mockup).

### `app/(dashboard)/solicitacoes/page.tsx` (modificar) + `CancelarSolicitacaoButton.tsx` (novo)

- **Purpose**: Torna a ação de cancelamento acessível ao solicitante (PIPE-13).
- **Mudança em `page.tsx`**: adiciona `ROTULO_STATUS.CANCELADA = "Cancelada"`, `STAMP_STATUS.CANCELADA = "stampCancelada"`, e uma coluna/célula de ação renderizando `<CancelarSolicitacaoButton id={solicitacao.id} />` quando `solicitacao.status === "PENDENTE"`.
- **`CancelarSolicitacaoButton.tsx`** (client, novo): botão "Cancelar" com confirmação simples (`window.confirm` ou modal leve — decisão de Tasks) → `POST /api/solicitacoes/[id]/cancelar` → `router.refresh()` (Server Component pai busca `listarMinhas` de novo, refletindo o novo status).
- **`solicitacoes.module.css` (modificar)**: nova classe `.stampCancelada` — tom neutro (`--ink-soft` sobre `--linha`), visualmente distinto de `.stampRejeitada` (vermelho), já que cancelamento não é um julgamento negativo do aprovador.

### `lib/navigation/navConfig.ts` (modificar)

- Novo item no grupo `visao-geral`:

```ts
{
  label: "Pipeline",
  href: "/pipeline",
  roles: [Role.GESTOR, Role.RH_ADMIN],
},
```

---

## Data Models

Única mudança de schema: novo valor `CANCELADA` no enum `StatusSolicitacao` (ver Components acima). Nenhuma tabela, coluna ou índice novo — `Solicitacao.status` já é indexado (`@@index([status])`), então a nova coluna do Kanban não exige índice adicional.

---

## Error Handling Strategy

| Cenário | Tratamento | Requirement |
| --- | --- | --- |
| Cancelamento sem sessão | `401`, sem tocar `solicitacaoService` | PIPE-10 |
| Cancelamento por usuário não elegível (outro solicitante, `GESTOR`) | `ErroNaoAutorizadoCancelamento` → `403` | PIPE-08, PIPE-10 |
| Cancelamento de `id` inexistente | `ErroNaoEncontrado` → `404` | PIPE-10 |
| Cancelamento de solicitação não-`PENDENTE` (já decidida ou já cancelada) | `ErroCancelamentoInvalido` → `409` | PIPE-09, PIPE-10 |
| Corrida de dois cancelamentos concorrentes | Segunda requisição encontra `status != PENDENTE` no passo 3 de `cancelar` → `409` (idempotência natural, sem lock explícito) | Edge case do spec |
| `SOLICITANTE` acessando `/pipeline` ou `/api/pipeline` | `requireUser([GESTOR, RH_ADMIN])` → `403` | PIPE-15 |
| `tipo_fluxo_id` inválido no filtro do board | Zod (`pipelineFiltroQuerySchema`) → `400`, sem executar query | PIPE-11, Edge case |
| Coluna inexistente em `GET /api/pipeline/[coluna]` | `kanbanColunas.colunaPorChave` retorna `undefined` → `400` | Edge case |

---

## Tech Decisions (only non-obvious ones)

| Decisão | Escolha | Racional |
| --- | --- | --- |
| Mapeamento coluna→status | Array de config em `lib/config/kanbanColunas.ts`, sem tabela no banco | Pedido é "customizável **depois**", não uma tela de admin agora — um array central já elimina o hardcode espalhado pela UI, sem o custo de uma migration + CRUD de configuração que ninguém pediu ainda. |
| Coluna "Cancelado" agrupa `REJEITADA` + `CANCELADA` | `statuses: [REJEITADA, CANCELADA]` na mesma entrada de config | Decisão explícita do usuário (`context.md` #5) — os dois são "desfecho negativo" do ponto de vista do board, sem distinção visual adicional nesta versão. |
| `visibilidadeSolicitacaoWhere` exportada de `dashboardService` em vez de duplicada | Reuso direto, só adiciona `export` | Evita ter a mesma regra de visibilidade (GESTOR/RH_Admin) escrita em dois arquivos, que divergiriam silenciosamente em uma mudança futura. |
| `GESTOR` não pode cancelar, mesmo sendo aprovador da etapa | Checagem em `solicitacaoService.cancelar` é `role !== RH_ADMIN && solicitante_id !== usuario.id`, sem checar `etapa_atual`/`Equipe` | Decisão explícita do usuário (`context.md` #4) — cancelamento é ação do dono ou do RH, não do aprovador; simplifica a checagem (não precisa resolver `Equipe.gestor_id` aqui). |
| `aprovacaoService.assertPodeDecidir` não muda | Nenhum código novo | Já bloqueia por `status !== PENDENTE`; `CANCELADA` cai nesse mesmo guarda-chuva "não-pendente" sem exigir um `case` novo. |
| Paginação por coluna via `take`/`skip` simples (sem cursor) | `LIMITE_INICIAL_POR_COLUNA = 10` + "+N outras" | Mesmo padrão já visto no mockup original (Screen 5, "+4 outras concluídas"); volume esperado é baixo o suficiente para offset pagination, mesma escolha já feita em `dashboardService.listar`. |

---

## Requirement Traceability (atualização de status)

| Requirement ID | Status após Design | Nota |
| --- | --- | --- |
| PIPE-01 | In Design → In Tasks | `KanbanBoard.tsx` + `pipeline.module.css` |
| PIPE-02 | In Design → In Tasks | `kanbanColunas.ts` + `pipelineService.listarBoard` |
| PIPE-03 | In Design → In Tasks | Reuso de `dashboardService.visibilidadeSolicitacaoWhere` |
| PIPE-04 | In Design → In Tasks | Idem |
| PIPE-05 | In Design → In Tasks | `solicitacaoService.cancelar` |
| PIPE-06 | In Design → In Tasks | Idem (`role === RH_ADMIN`) |
| PIPE-07 | In Design → In Tasks | `logService.registrar` acao `CANCELAMENTO` |
| PIPE-08 | In Design → In Tasks | `ErroNaoAutorizadoCancelamento` |
| PIPE-09 | In Design → In Tasks | `ErroCancelamentoInvalido` |
| PIPE-10 | In Design → In Tasks | `app/api/solicitacoes/[id]/cancelar/route.ts` |
| PIPE-11 | In Design → In Tasks | `pipelineFiltroQuerySchema` + `listarBoard(filtro)` |
| PIPE-12 | In Design → In Tasks | `.kanbanCardLate` em `pipeline.module.css` |
| PIPE-13 | In Design → In Tasks | `CancelarSolicitacaoButton.tsx` em `solicitacoes/page.tsx` |
| PIPE-14 | In Design → In Tasks | Estado vazio por coluna em `KanbanBoard.tsx` |
| PIPE-15 | In Design → In Tasks | `requireUser([GESTOR, RH_ADMIN])` em `page.tsx` e nas rotas |

---

## Riscos / Pontos a verificar na fase de Tasks

- **Migration de enum em produção**: `ALTER TYPE ... ADD VALUE` não pode rodar dentro da mesma transação que outros comandos DDL em algumas versões do Postgres — confirmar que `prisma migrate dev`/`deploy` gera a migration isolada corretamente (Prisma já trata isso automaticamente na maioria dos casos, mas vale conferir o SQL gerado antes de aplicar em produção).
- **Nome exato da função de listagem de `TipoFluxo` ativos**: `design.md` assume que `tipoFluxoService` já expõe algo equivalente a `listarAtivos()`/`listarAtivasParaSelecao()` (mesmo padrão de `equipeService`) — confirmar o nome real no início da Task correspondente antes de importar.
- **UX de confirmação do cancelamento**: `window.confirm` é a opção mais barata, mas pode destoar visualmente do resto do produto (que usa modais próprios, ex. `botao-ajuda-github`). Decisão de estilo fica para quem executar a Task de `CancelarSolicitacaoButton.tsx`, com apoio de `/frontend-design`/`/ui-ux-pro-max` se optar por um modal customizado.
- **Coordenação com `menu-navegacao`**: a mudança em `navConfig.ts` desta feature é independente das tasks daquela feature (ainda não escritas), mas se `menu-navegacao` for reespecificada antes deste código ser implementado, revalidar que o item "Pipeline" proposto aqui não conflita com o que aquela feature decidir.
