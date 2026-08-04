# Pipeline Kanban Tasks

**Design**: `.specs/features/pipeline-kanban/design.md`
**Status**: Ready for execution

---

## Convenção de Testes (herdada de `integrar-login-google/tasks.md` — sem `.specs/codebase/TESTING.md`, confirmada pelo padrão real do repositório)

| Tipo de código | Teste exigido | Gate |
| --- | --- | --- |
| Função/serviço em `lib/**` (I/O mockado) | `unit` (vitest, mesmo padrão de `aprovacaoService.test.ts`/`dashboardService.test.ts`) | `npm run test` |
| Config pura em `lib/config/**` | `unit` (poucos casos — mapeamento é dado estático) | `npm run test` |
| Componente React (`app/**`) | Nenhum teste automatizado (sem infra de DOM no projeto) | `npm run build` + roteiro manual |
| Route Handler (`app/api/**/route.ts`) | Nenhum teste automatizado (convenção do projeto) | `npm run build` |
| `prisma/schema.prisma` (migration) | Nenhum teste automatizado | `npx prisma validate` + `npx prisma migrate dev` |

---

## Execution Plan

### Phase 1: Foundation (bloqueante — todo o resto depende do enum existir)

```
T1 ──→ (Phase 2)
```

### Phase 2 (depende de T1 onde indicado; resto é independente)

```
T2 [P] (dep T1) ──┐
T3 [P]            ─┤
T4 [P]            ─┼──→ (Phase 3)
T5 [P] (dep T1)    ─┤
T10 [P]            ─┤
T11 [P]            ─┤
T14 [P]           ──┘
```

### Phase 3 (depende de Phase 2)

```
T2, T3 completos, entao: T6
T5 completo, entao: T7
```

### Phase 4 (depende de Phase 3)

```
T6, T4 completos, entao: T8
T6, T4, T2 completos, entao: T9
T8, T9, T11, T7 completos, entao: T13
T7, T14 completos, entao: T15
```

### Phase 5 (depende de Phase 4)

```
T6, T13 completos, entao: T12
T15, T14 completos, entao: T16
```

---

## Task Breakdown

### T1: `prisma/schema.prisma` — novo status `CANCELADA`

**What**: Adiciona `CANCELADA` ao enum `StatusSolicitacao` (após `REJEITADA`). Gera e aplica a migration (`npx prisma migrate dev --name add_status_cancelada`).
**Where**: `prisma/schema.prisma`, `prisma/migrations/<timestamp>_add_status_cancelada/migration.sql`
**Depends on**: None
**Reuses**: N/A
**Requirement**: PIPE-05, PIPE-06, PIPE-09 (pré-requisito de dado para todas)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `StatusSolicitacao` inclui `CANCELADA` em `schema.prisma`
- [ ] Migration gerada e aplicada localmente sem erro
- [ ] `npx prisma validate` passa
- [ ] Nenhuma linha existente de `Solicitacao` é afetada (migration é só `ADD VALUE`, sem `UPDATE`)

**Tests**: none
**Gate**: `npx prisma validate` + `npx prisma migrate dev`

**Commit**: `feat(pipeline-kanban): adiciona status CANCELADA ao enum StatusSolicitacao`

---

### T2: `lib/config/kanbanColunas.ts` [P]

**What**: Config centralizada `KANBAN_COLUNAS_PADRAO` (4 colunas: pendente/em_aprovacao/aprovado/cancelado) + `colunaPorChave(chave)`. "Em aprovação" nasce com `statuses: []` (context.md #2); "Cancelado" agrupa `[REJEITADA, CANCELADA]` (context.md #5).
**Where**: `lib/config/kanbanColunas.ts` (+ `.test.ts`)
**Depends on**: T1 (usa `StatusSolicitacao.CANCELADA`)
**Reuses**: `@/lib/generated/prisma/enums` (`StatusSolicitacao`)
**Requirement**: PIPE-01, PIPE-02

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] 4 colunas na ordem exata: pendente, em_aprovacao, aprovado, cancelado
- [ ] `pendente.statuses === [PENDENTE]`, `em_aprovacao.statuses === []`, `aprovado.statuses === [APROVADA]`, `cancelado.statuses === [REJEITADA, CANCELADA]`
- [ ] `colunaPorChave("cancelado")` retorna a config; `colunaPorChave("inexistente")` retorna `undefined`
- [ ] `npm run test` passa
- [ ] Test count: pelo menos 3 casos

**Tests**: unit
**Gate**: quick (`npm run test`)

**Commit**: `feat(pipeline-kanban): adiciona config KANBAN_COLUNAS_PADRAO`

---

### T3: `dashboardService.ts` — exportar `visibilidadeSolicitacaoWhere` [P]

**What**: Muda `function visibilidadeSolicitacaoWhere` para `export function visibilidadeSolicitacaoWhere`. Nenhuma outra linha do arquivo é alterada.
**Where**: `lib/services/dashboardService.ts`
**Depends on**: None
**Reuses**: N/A (só visibilidade de export)
**Requirement**: PIPE-03, PIPE-04 (pré-requisito de reuso)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `visibilidadeSolicitacaoWhere` é importável de `@/lib/services/dashboardService` em outro módulo
- [ ] Todos os testes já existentes de `dashboardService.test.ts` continuam passando sem alteração (comportamento idêntico, só visibilidade de export)
- [ ] `npm run test` passa

**Tests**: unit (regressão dos testes já existentes — nenhum caso novo exigido)
**Gate**: quick (`npm run test`)

**Commit**: `refactor(pipeline-kanban): exporta visibilidadeSolicitacaoWhere de dashboardService`

---

### T4: `lib/validations/pipelineFiltros.ts` [P]

**What**: `pipelineFiltroQuerySchema` (`tipo_fluxo_id` opcional) e `pipelineColunaQuerySchema` (estende o anterior com `page`/`pageSize` opcionais), mesmo estilo de `dashboardFiltros.ts` — inclui `parsePipelineFiltroQuery(url)`/`parsePipelineColunaQuery(url)` isolados do handler.
**Where**: `lib/validations/pipelineFiltros.ts` (+ `.test.ts`)
**Depends on**: None
**Reuses**: Estilo de `lib/validations/dashboardFiltros.ts`
**Requirement**: PIPE-11

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `tipo_fluxo_id` ausente → válido (filtro opcional)
- [ ] `page`/`pageSize` não numéricos → erro de validação
- [ ] `parsePipelineFiltroQuery`/`parsePipelineColunaQuery` extraem corretamente os query params de uma URL de teste
- [ ] `npm run test` passa
- [ ] Test count: pelo menos 5 casos

**Tests**: unit
**Gate**: quick (`npm run test`)

**Commit**: `feat(pipeline-kanban): adiciona pipelineFiltroQuerySchema e pipelineColunaQuerySchema`

---

### T5: `solicitacaoService.ts` — `cancelar` [P]

**What**: Nova função `cancelar(id, usuario)` + classes `ErroNaoAutorizadoCancelamento`, `ErroCancelamentoInvalido`. Autorização: `usuario.role === RH_ADMIN || solicitacao.solicitante_id === usuario.id`; estado: só `status === PENDENTE`; sucesso grava `status = CANCELADA` + `Log AUDITORIA` (`acao: "CANCELAMENTO"`).
**Where**: `lib/services/solicitacaoService.ts` (+ casos novos em `solicitacaoService.test.ts`)
**Depends on**: T1 (enum `CANCELADA` precisa existir)
**Reuses**: `ErroNaoEncontrado` (já existe no arquivo), `logService.registrar` (já importado)
**Requirement**: PIPE-05, PIPE-06, PIPE-07, PIPE-08, PIPE-09

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `id` inexistente → `ErroNaoEncontrado`
- [ ] Solicitante dono + `status=PENDENTE` → sucesso, `status` vira `CANCELADA`, `Log AUDITORIA` gravado com `acao: "CANCELAMENTO"` e `usuario_id` do solicitante
- [ ] `RH_ADMIN` + `status=PENDENTE` de outro solicitante → sucesso (mesmo efeito)
- [ ] `GESTOR` (mesmo sendo aprovador da etapa atual) → `ErroNaoAutorizadoCancelamento`
- [ ] Outro solicitante (não dono) → `ErroNaoAutorizadoCancelamento`
- [ ] `status` já `APROVADA`/`REJEITADA`/`CANCELADA` → `ErroCancelamentoInvalido`, sem alterar o registro
- [ ] `npm run test` passa
- [ ] Test count: pelo menos 6 casos

**Tests**: unit
**Gate**: quick (`npm run test`)

**Commit**: `feat(pipeline-kanban): adiciona solicitacaoService.cancelar`

---

### T6: `pipelineService.ts` — `listarBoard` e `listarColuna`

**What**: `listarBoard(usuario, filtro)` monta as 4 colunas via `KANBAN_COLUNAS_PADRAO` + `visibilidadeSolicitacaoWhere`, pulando query para colunas com `statuses: []` (PIPE-02). `listarColuna(usuario, chave, filtro)` pagina uma coluna específica ("+N outras").
**Where**: `lib/services/pipelineService.ts` (+ `.test.ts`)
**Depends on**: T2 (`kanbanColunas.ts`), T3 (`visibilidadeSolicitacaoWhere` exportada)
**Reuses**: `dashboardService.visibilidadeSolicitacaoWhere`, `kanbanColunas.KANBAN_COLUNAS_PADRAO`/`colunaPorChave`
**Requirement**: PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-11, PIPE-14

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `GESTOR` → cada coluna contém só solicitações próprias + da(s) `Equipe`(s) geridas (mesmo escopo de `dashboardService`)
- [ ] `RH_ADMIN` → cada coluna contém todas as solicitações da empresa
- [ ] Coluna "em_aprovacao" retorna `{ itens: [], total: 0 }` sempre, sem query ao Prisma (mock deve confirmar zero chamadas para essa coluna)
- [ ] `filtro.tipo_fluxo_id` restringe todas as colunas ao tipo informado
- [ ] Coluna "cancelado" inclui solicitações `REJEITADA` e `CANCELADA` juntas
- [ ] Escopo sem nenhuma solicitação → todas as colunas com `itens: []`, `total: 0`, sem erro
- [ ] `listarColuna` pagina corretamente (`page`/`pageSize`) uma coluna específica
- [ ] `npm run test` passa
- [ ] Test count: pelo menos 8 casos

**Tests**: unit
**Gate**: quick (`npm run test`)

**Commit**: `feat(pipeline-kanban): adiciona pipelineService.listarBoard e listarColuna`

---

### T7: `app/api/solicitacoes/[id]/cancelar/route.ts`

**What**: `POST` que expõe `solicitacaoService.cancelar` com o contrato de erro `401/403/404/409`.
**Where**: `app/api/solicitacoes/[id]/cancelar/route.ts`
**Depends on**: T5 (`solicitacaoService.cancelar`)
**Reuses**: `authService.requireUser()`, mesmo padrão de `app/api/aprovacoes/[solicitacaoId]/decidir/route.ts`
**Requirement**: PIPE-10

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Sem sessão → `401`
- [ ] `ErroNaoAutorizadoCancelamento` → `403`
- [ ] `ErroNaoEncontrado` → `404`
- [ ] `ErroCancelamentoInvalido` → `409`
- [ ] Sucesso → `200 { solicitacao }`
- [ ] `npm run build` sem erros

**Tests**: none (route handler, ver convenção de testes acima)
**Gate**: build (`npm run build`)

**Commit**: `feat(pipeline-kanban): adiciona rota POST /api/solicitacoes/[id]/cancelar`

---

### T8: `app/api/pipeline/route.ts`

**What**: `GET` do board completo — `requireUser([GESTOR, RH_ADMIN])`, parse de `pipelineFiltroQuerySchema`, chama `pipelineService.listarBoard`.
**Where**: `app/api/pipeline/route.ts`
**Depends on**: T6 (`pipelineService.listarBoard`), T4 (`pipelineFiltroQuerySchema`)
**Reuses**: mesmo padrão de `app/api/dashboard/solicitacoes/route.ts`
**Requirement**: PIPE-01 a PIPE-04, PIPE-11, PIPE-15

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Sem sessão → `401`
- [ ] `SOLICITANTE` → `403`
- [ ] Query inválida → `400`
- [ ] `GESTOR`/`RH_ADMIN` válidos → `200 { board }` com as 4 colunas
- [ ] `npm run build` sem erros

**Tests**: none (route handler)
**Gate**: build (`npm run build`)

**Commit**: `feat(pipeline-kanban): adiciona rota GET /api/pipeline`

---

### T9: `app/api/pipeline/[coluna]/route.ts`

**What**: `GET` paginado de uma coluna (expandir "+N outras") — `requireUser([GESTOR, RH_ADMIN])`, valida `coluna` via `colunaPorChave`, parse de `pipelineColunaQuerySchema`, chama `pipelineService.listarColuna`.
**Where**: `app/api/pipeline/[coluna]/route.ts`
**Depends on**: T6, T4, T2 (`colunaPorChave`)
**Reuses**: mesmo padrão de T8
**Requirement**: PIPE-14 (expansão de coluna com volume alto)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `coluna` fora de `KanbanColunaChave` → `400`
- [ ] `coluna` válida + `page`/`pageSize` → `200 { itens, total }` paginado corretamente
- [ ] Guard de acesso idêntico a T8 (401/403)
- [ ] `npm run build` sem erros

**Tests**: none (route handler)
**Gate**: build (`npm run build`)

**Commit**: `feat(pipeline-kanban): adiciona rota GET /api/pipeline/[coluna]`

---

### T10: `lib/navigation/navConfig.ts` — item "Pipeline" [P]

**What**: Novo `NavItem` `{ label: "Pipeline", href: "/pipeline", roles: [Role.GESTOR, Role.RH_ADMIN] }` no grupo `visao-geral`, ao lado de "Dashboard"/"Painel de Insights".
**Where**: `lib/navigation/navConfig.ts`
**Depends on**: None
**Reuses**: Estrutura `NAV_GROUPS` já existente
**Requirement**: PIPE-01 (descoberta da tela)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `getVisibleGroups(Role.GESTOR)` inclui "Pipeline"
- [ ] `getVisibleGroups(Role.RH_ADMIN)` inclui "Pipeline"
- [ ] `getVisibleGroups(Role.SOLICITANTE)` não inclui "Pipeline"
- [ ] `npm run build` sem erros

**Tests**: none (config estática; sem `.test.ts` próprio no arquivo hoje — se `navConfig.test.ts` existir, adicionar caso; senão, validação manual via build é suficiente)
**Gate**: build (`npm run build`)

**Commit**: `feat(pipeline-kanban): adiciona item Pipeline ao menu de Gestor/RH_Admin`

---

### T11: `app/(dashboard)/pipeline/pipeline.module.css` [P]

**What**: CSS Module do board — reusa tokens de `app/globals.css` e classes conceituais de `dashboard.module.css` (`.stamp*`, `.chipTipo`, `.card`, `.btn*`, `.filterBar`); novas classes `.kanbanBoard` (scroll horizontal, 4 colunas), `.kanbanColumn`, `.kanbanColumnHead` (label + contador redondo), `.kanbanCard`, `.kanbanCardLate`, `.kanbanMoreList`, `.kanbanMoreBtn`.
**Where**: `app/(dashboard)/pipeline/pipeline.module.css`
**Depends on**: None
**Reuses**: Tokens de `app/globals.css`; estrutura visual de `dashboard.module.css`
**Requirement**: PIPE-01, PIPE-12, PIPE-14

**Tools**:
- MCP: NONE
- Skill: `frontend-design`, `ui-ux-pro-max` (garantir consistência visual com Dashboard/Aprovações antes de fechar o CSS; alinhar com `docs/design-ux-ui/fluxorh-mockup.html` Screen 5)

**Done when**:
- [ ] Classes cobrem: board com scroll horizontal, coluna com cabeçalho (label + contador), card (protocolo/tipo/solicitante/status), variante de atraso, lista expansível + botão "+N outras", estado vazio por coluna
- [ ] `npm run build` sem erros

**Tests**: none
**Gate**: build (`npm run build`)

**Commit**: `feat(pipeline-kanban): adiciona pipeline.module.css`

---

### T12: `app/(dashboard)/pipeline/page.tsx`

**What**: Server Component — `requireUser([GESTOR, RH_ADMIN])` (sem sessão → `redirect('/login')`; papel errado → tela "Acesso restrito", mesmo padrão de `solicitacoes/page.tsx`); `pipelineService.listarBoard(usuario, {})` + listagem de `TipoFluxo` ativos (nome exato da função a confirmar em `tipoFluxoService.ts` antes de importar — ver `design.md` "Riscos"); renderiza `<KanbanBoard boardInicial={board} tiposFluxo={tipos} papel={usuario.role} />`.
**Where**: `app/(dashboard)/pipeline/page.tsx`
**Depends on**: T6 (`pipelineService.listarBoard`), T13 (`KanbanBoard.tsx`, para importar o componente)
**Reuses**: `authService.requireUser`, `pipelineService.listarBoard`, `tipoFluxoService` (função já existente)
**Requirement**: PIPE-01, PIPE-15

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Sem sessão → `redirect('/login')`
- [ ] `SOLICITANTE` autenticado → "Acesso restrito" (sem vazar dados de solicitações)
- [ ] `GESTOR`/`RH_ADMIN` → board renderizado com dados da carga inicial
- [ ] `npm run build` sem erros

**Tests**: none
**Gate**: build (`npm run build`)

**Commit**: `feat(pipeline-kanban): adiciona app/(dashboard)/pipeline/page.tsx`

---

### T13: `KanbanBoard.tsx`

**What**: Componente client — renderiza as 4 colunas (a partir de `boardInicial`), `<select>` de filtro por `TipoFluxo` (refaz `GET /api/pipeline?tipo_fluxo_id=`), botão "+N outras" por coluna (`GET /api/pipeline/[coluna]?page=`), indicador visual de atraso (`.kanbanCardLate` quando `atrasada: true`), e — só quando `papel === "RH_ADMIN"` — ação "Cancelar" inline nos cards da coluna "Pendente" (`POST /api/solicitacoes/[id]/cancelar` + atualização do board).
**Where**: `app/(dashboard)/pipeline/_components/KanbanBoard.tsx`
**Depends on**: T8 (`GET /api/pipeline`), T9 (`GET /api/pipeline/[coluna]`), T11 (`pipeline.module.css`), T7 (rota de cancelamento, para a ação inline do RH_Admin)
**Reuses**: `pipeline.module.css`; padrão de estados `carregando`/`erro` já usado em outros client components do projeto (`LoginForm.tsx`, `SolicitacoesFiltros.tsx`)
**Requirement**: PIPE-01, PIPE-02, PIPE-11, PIPE-12, PIPE-14

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Renderiza as 4 colunas na ordem certa, com contador e itens da carga inicial
- [ ] Coluna vazia exibe estado vazio explícito (PIPE-14)
- [ ] Troca de filtro de Tipo de Fluxo atualiza as 4 colunas
- [ ] "+N outras" concatena mais itens na coluna clicada
- [ ] Card com `atrasada: true` exibe indicador visual distinto
- [ ] `papel === "RH_ADMIN"` → botão "Cancelar" visível nos cards de "Pendente"; `papel === "GESTOR"` → botão ausente
- [ ] Cancelar com sucesso remove o card de "Pendente" e reflete em "Cancelado" (via atualização local ou `router.refresh()`, decisão de implementação)
- [ ] `npm run build` sem erros

**Tests**: none
**Gate**: build (`npm run build`)

**Commit**: `feat(pipeline-kanban): adiciona KanbanBoard.tsx`

---

### T14: `solicitacoes.module.css` — `.stampCancelada` [P]

**What**: Nova classe `.stampCancelada` (tom neutro — `--ink-soft` sobre `--linha`), visualmente distinta de `.stampRejeitada` (vermelho), já que cancelamento não é um julgamento negativo do aprovador.
**Where**: `app/(dashboard)/solicitacoes/solicitacoes.module.css`
**Depends on**: None
**Reuses**: Tokens já usados por `.stampPendente`/`.stampAprovada`/`.stampRejeitada`
**Requirement**: PIPE-13

**Tools**:
- MCP: NONE
- Skill: `frontend-design` (escolha de tom neutro consistente com o restante do sistema de carimbos)

**Done when**:
- [ ] `.stampCancelada` definida, visualmente distinta de `.stampRejeitada`
- [ ] `npm run build` sem erros

**Tests**: none
**Gate**: build (`npm run build`)

**Commit**: `feat(pipeline-kanban): adiciona estilo stampCancelada`

---

### T15: `CancelarSolicitacaoButton.tsx`

**What**: Componente client — botão "Cancelar" com confirmação simples; `POST /api/solicitacoes/[id]/cancelar`; sucesso → `router.refresh()` (a página pai, Server Component, busca `listarMinhas` de novo e reflete o novo status).
**Where**: `app/(dashboard)/solicitacoes/_components/CancelarSolicitacaoButton.tsx` (novo diretório `_components`, mesmo padrão de `aprovacoes/_components`)
**Depends on**: T7 (`POST /api/solicitacoes/[id]/cancelar`), T14 (`.stampCancelada`, usado pela tela que consome este botão)
**Reuses**: Nenhum client component equivalente hoje em `solicitacoes/` — segue o padrão geral de `carregando`/`erro` local já usado em outros componentes client do projeto
**Requirement**: PIPE-13

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Clique + confirmação → `POST /api/solicitacoes/[id]/cancelar`
- [ ] Sucesso (`200`) → `router.refresh()`
- [ ] Erro (`403`/`404`/`409`) → mensagem inline, sem quebrar a tela
- [ ] `npm run build` sem erros

**Tests**: none
**Gate**: build (`npm run build`)

**Commit**: `feat(pipeline-kanban): adiciona CancelarSolicitacaoButton`

---

### T16: `app/(dashboard)/solicitacoes/page.tsx` — integra cancelamento

**What**: Adiciona `ROTULO_STATUS.CANCELADA = "Cancelada"`, `STAMP_STATUS.CANCELADA = "stampCancelada"`, e renderiza `<CancelarSolicitacaoButton id={solicitacao.id} />` na linha da tabela quando `solicitacao.status === "PENDENTE"`.
**Where**: `app/(dashboard)/solicitacoes/page.tsx` (modificar)
**Depends on**: T15 (`CancelarSolicitacaoButton.tsx`), T14 (`.stampCancelada`)
**Reuses**: Estrutura de tabela já existente (`ROTULO_STATUS`, `STAMP_STATUS`, `styles.table`)
**Requirement**: PIPE-13

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Solicitação `PENDENTE` exibe o botão "Cancelar" na própria linha
- [ ] Solicitação `APROVADA`/`REJEITADA`/`CANCELADA` não exibe o botão
- [ ] Solicitação `CANCELADA` exibe o carimbo "Cancelada" com o estilo `.stampCancelada`
- [ ] `npm run build` sem erros
- [ ] Roteiro de teste manual (documentar no resumo da task): como solicitante, cancelar uma solicitação pendente própria e ver o status mudar para "Cancelada" na lista; confirmar que solicitações de outro status não exibem o botão; como RH_Admin, cancelar uma solicitação de outro solicitante a partir do Pipeline Kanban (T13) e confirmar que ela sai de "Pendente" e aparece em "Cancelado"

**Tests**: none
**Gate**: build (`npm run build`)

**Commit**: `feat(pipeline-kanban): integra cancelamento em Minhas Solicitações`

---

## Parallel Execution Map

```
Phase 1:
  T1 ── prisma/schema.prisma: status CANCELADA + migration

Phase 2 (Parallel):
  T2  [P] (dep T1) ── kanbanColunas.ts
  T3  [P]          ── dashboardService: exporta visibilidadeSolicitacaoWhere
  T4  [P]          ── pipelineFiltros.ts
  T5  [P] (dep T1) ── solicitacaoService.cancelar
  T10 [P]          ── navConfig.ts: item Pipeline
  T11 [P]          ── pipeline.module.css
  T14 [P]          ── solicitacoes.module.css: .stampCancelada

Phase 3 (Sequencial dentro de cada ramo):
  T2, T3 completos, entao: T6 (pipelineService)
  T5 completo, entao: T7 (rota cancelar)

Phase 4 (Sequencial):
  T6, T4 completos, entao: T8 (rota GET /api/pipeline)
  T6, T4, T2 completos, entao: T9 (rota GET /api/pipeline/[coluna])
  T8, T9, T11, T7 completos, entao: T13 (KanbanBoard.tsx)
  T7, T14 completos, entao: T15 (CancelarSolicitacaoButton.tsx)

Phase 5 (Sequencial):
  T6, T13 completos, entao: T12 (pipeline/page.tsx)
  T15, T14 completos, entao: T16 (solicitacoes/page.tsx integra cancelamento)
```

**Nota**: T12 depende de T13 (não só de T6) porque a página importa e renderiza `<KanbanBoard>` diretamente — mesma lógica de dependência já usada em `botao-ajuda-github/tasks.md` (página depende do componente que ela renderiza). T16 depende de T15 pela mesma razão.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: schema + migration | 1 arquivo + 1 migration | ✅ Granular |
| T2: kanbanColunas.ts | 1 arquivo | ✅ Granular |
| T3: dashboardService export | 1 linha em arquivo existente | ✅ Granular |
| T4: pipelineFiltros.ts | 1 arquivo | ✅ Granular |
| T5: solicitacaoService.cancelar | 1 função + 2 classes de erro, mesmo arquivo existente | ✅ Granular (mesmo padrão de coesão de T1 em `integrar-login-google/tasks.md`) |
| T6: pipelineService.ts | 2 funções relacionadas (mesma responsabilidade: montar o board) | ✅ Granular |
| T7: rota cancelar | 1 arquivo | ✅ Granular |
| T8: rota GET /api/pipeline | 1 arquivo | ✅ Granular |
| T9: rota GET /api/pipeline/[coluna] | 1 arquivo | ✅ Granular |
| T10: navConfig.ts | poucas linhas em arquivo existente | ✅ Granular |
| T11: pipeline.module.css | 1 arquivo | ✅ Granular |
| T12: pipeline/page.tsx | 1 arquivo | ✅ Granular |
| T13: KanbanBoard.tsx | 1 componente | ✅ Granular |
| T14: solicitacoes.module.css (nova classe) | poucas linhas em arquivo existente | ✅ Granular |
| T15: CancelarSolicitacaoButton.tsx | 1 componente | ✅ Granular |
| T16: solicitacoes/page.tsx (integração) | poucas linhas em arquivo existente | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagrama Mostra | Status |
| --- | --- | --- | --- |
| T1 | None | Fase 1, sem seta de entrada | ✅ Match |
| T2 | T1 | Fase 2, seta de T1 | ✅ Match |
| T3 | None | Fase 2, sem seta de entrada | ✅ Match |
| T4 | None | Fase 2, sem seta de entrada | ✅ Match |
| T5 | T1 | Fase 2, seta de T1 | ✅ Match |
| T6 | T2, T3 | Seta de "T2, T3 completos" para T6 | ✅ Match |
| T7 | T5 | Seta de "T5 completo" para T7 | ✅ Match |
| T8 | T6, T4 | Seta de "T6, T4 completos" para T8 | ✅ Match |
| T9 | T6, T4, T2 | Seta de "T6, T4, T2 completos" para T9 | ✅ Match |
| T10 | None | Fase 2, sem seta de entrada | ✅ Match |
| T11 | None | Fase 2, sem seta de entrada | ✅ Match |
| T12 | T6, T13 | Seta de "T6, T13 completos" para T12 | ✅ Match |
| T13 | T8, T9, T11, T7 | Seta de "T8, T9, T11, T7 completos" para T13 | ✅ Match |
| T14 | None | Fase 2, sem seta de entrada | ✅ Match |
| T15 | T7, T14 | Seta de "T7, T14 completos" para T15 | ✅ Match |
| T16 | T15, T14 | Seta de "T15, T14 completos" para T16 | ✅ Match |

---

## Test Co-location Validation

| Task | Código Criado/Modificado | Matriz Exige | Task Diz | Status |
| --- | --- | --- | --- | --- |
| T1 | `schema.prisma` + migration | none | none | ✅ OK |
| T2 | `lib/config/kanbanColunas.ts` | unit | unit | ✅ OK |
| T3 | `lib/services/dashboardService.ts` (export) | unit (regressão) | unit | ✅ OK |
| T4 | `lib/validations/pipelineFiltros.ts` | unit | unit | ✅ OK |
| T5 | `lib/services/solicitacaoService.ts` | unit | unit | ✅ OK |
| T6 | `lib/services/pipelineService.ts` | unit | unit | ✅ OK |
| T7 | Route Handler | none | none | ✅ OK |
| T8 | Route Handler | none | none | ✅ OK |
| T9 | Route Handler | none | none | ✅ OK |
| T10 | `lib/navigation/navConfig.ts` | none | none | ✅ OK |
| T11 | CSS Module | none | none | ✅ OK |
| T12 | Server Component | none | none | ✅ OK |
| T13 | Client Component | none | none | ✅ OK |
| T14 | CSS Module (classe nova) | none | none | ✅ OK |
| T15 | Client Component | none | none | ✅ OK |
| T16 | Server Component (integração) | none | none | ✅ OK |

---

## Ferramentas por Task — Confirmar com o Usuário

Nenhuma task exige MCP externo. Skills recomendadas: `frontend-design`/`ui-ux-pro-max` em T11 (CSS do board Kanban, alinhado a `docs/design-ux-ui/fluxorh-mockup.html` Screen 5) e T14 (tom visual do carimbo "Cancelada"). Nenhuma outra skill/MCP é necessária para as demais tasks.

**Antes de executar**: confirmar em T12 o nome exato da função de listagem de `TipoFluxo` ativos em `tipoFluxoService.ts` (ver `design.md`, "Riscos") — não bloqueia T1-T11, só T12 em diante.
