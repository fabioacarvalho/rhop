# Dashboard de Visão Geral — Tasks

**Design**: `.specs/features/dashboard-visao-geral/design.md`
**Status**: Draft

---

## 0. Nota sobre TESTING.md

Não existe `.specs/codebase/TESTING.md`. Mesma inferência já usada em `solicitacoes/tasks.md`,
verificável no código atual (`autenticacao-usuarios`, `auditoria-logs`, `configuracao-fluxos`,
`aprovacoes` implementadas):

| Camada | Tipo de teste | Evidência |
| --- | --- | --- |
| `lib/validations/*.ts` | unit (vitest, `*.test.ts` colocado) | `lib/validations/aprovacao.test.ts`, `tipoFluxo.test.ts` |
| `lib/services/*.ts` | unit (vitest, `*.test.ts` colocado, Prisma mockado) | `aprovacaoService.test.ts`, `logService.test.ts`, `tipoFluxoService.test.ts` |
| `prisma/schema.prisma` | none — validado via `npx prisma validate` | nenhum teste de schema em nenhuma feature anterior |
| `app/api/**/route.ts` | none — sem teste de rota em nenhuma feature anterior | 0 arquivos `*.test.ts` em `app/api/**` |
| `app/(dashboard)/**/*.tsx` (páginas e componentes) | none — sem `@testing-library/*` instalado | 0 arquivos `*.test.tsx`, `package.json` sem lib de teste de componente |

**Gate Check Commands:**

- `quick` → `npm test` (vitest run; pode restringir ao arquivo específico durante o desenvolvimento)
- `build` → `npx prisma validate && npm run build` — mandatório em toda task (CLAUDE.md, "Como validar o trabalho")

Tasks em `lib/validations`/`lib/services` rodam **quick + build**; tasks em schema/rotas/UI rodam **só build**.

**Parallelism:** todas as camadas são parallel-safe entre arquivos diferentes. O que quebra
paralelismo é duas tasks tocando o mesmo arquivo.

---

## Execution Plan

### Phase 1: Foundation (Parallel)

Nenhuma depende de código novo desta feature.

```
T1 [P] ──┐
T2 [P] ──┤
T6 [P] ──┼──→ (Phase 2 / Phase 3)
T8 [P] ──┘
```

### Phase 2: Service Layer (Sequential após T1)

```
T1 ──→ T3
```

### Phase 3: Routes + componentes sem dependência de rota (Parallel)

```
        ┌→ T4  [P] (precisa T3)
T3 ─────┼→ T5  [P] (precisa T2 + T3)
T6 ─────┴→ T10 [P] (precisa T6)
```

### Phase 4: Componentes que dependem de rota (Parallel)

```
T4 ──→ T7  [P]
T5, T6 ──→ T9 [P]
```

### Phase 5: Composição final (Sequential)

```
T3, T7, T8, T9, T10 ──→ T11
```

---

## Task Breakdown

### T1: Adicionar `atrasada_em` ao `model Solicitacao` + migration

**What**: Adicionar `atrasada_em DateTime?` e o índice `@@index([atrasada_em])` ao `model
Solicitacao`; gerar e aplicar a migration. Mesmo nome/tipo já fixado em `sla-cobranca/design.md`
(ver design.md §0) — não redefine a regra de quando o campo é preenchido, só cria a coluna.
**Where**: `prisma/schema.prisma`, `prisma/migrations/**` (nova pasta gerada)
**Depends on**: None
**Reuses**: `model Solicitacao` existente
**Requirement**: DASH-01 (AC3, consumo do status "atrasado")

**Tools**:
- MCP: NONE
- Skill: `supabase-postgres-best-practices` (schema change em Postgres via Prisma)

**Done when**:
- [ ] `Solicitacao.atrasada_em` é `DateTime?` (nullable)
- [ ] `@@index([atrasada_em])` adicionado
- [ ] Migration gerada (`npx prisma migrate dev --name add_atrasada_em_solicitacao`) e aplicada sem erro
- [ ] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(dashboard-visao-geral): adiciona campo atrasada_em em Solicitacao`

---

### T2: `dashboardListaQuerySchema` (Zod) [P]

**What**: Schema Zod dos query params de `GET /api/dashboard/solicitacoes`
(`tipo_fluxo_id`, `status` enum `PENDENTE|ATRASADO|APROVADA|REJEITADA`, `solicitante_id`, `page`,
`pageSize`), todos opcionais.
**Where**: `lib/validations/dashboardFiltros.ts` (+ `lib/validations/dashboardFiltros.test.ts`)
**Depends on**: None
**Reuses**: padrão de `queryLogsSchema` (`app/api/logs/route.ts`)
**Requirement**: DASH-04 a DASH-07 (validação de filtros antes da query)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `dashboardListaQuerySchema` valida os 5 campos, todos opcionais
- [ ] `status` fora do enum (ex: `"foo"`) falha
- [ ] `page`/`pageSize` não numéricos ou ≤0 falham
- [ ] Objeto vazio (`{}`) passa (todos os filtros são opcionais)
- [ ] Gate check passa: `npm test` (arquivo `dashboardFiltros.test.ts`)
- [ ] Gate check passa: `npx prisma validate && npm run build`
- [ ] Test count: ≥5 casos (sem deleção silenciosa)

**Tests**: unit
**Gate**: quick + build

**Commit**: `feat(dashboard-visao-geral): adiciona schema zod dos filtros da lista`

---

### T3: `dashboardService.ts` (contarPorStatus / listar / listarSolicitantesVisiveis)

**What**: Service completo — `visibilidadeSolicitacaoWhere` (helper interno: `RH_ADMIN` sem
filtro, `GESTOR` restrito a si + equipe), `contarPorStatus` (4 counts em paralelo, sempre com
visibilidade, nunca filtrado), `listar` (visibilidade + filtros combinados AND + paginação,
`status=ATRASADO` mapeado para `atrasada_em: { not: null }`), `listarSolicitantesVisiveis`
(opções do filtro de solicitante, mesma regra de visibilidade aplicada a `User`).
**Where**: `lib/services/dashboardService.ts` (+ `lib/services/dashboardService.test.ts`)
**Depends on**: T1 (campo `atrasada_em`)
**Reuses**: padrão de `where` condicional por papel de `aprovacaoService.listarPendentes`
**Requirement**: DASH-01 a DASH-08

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `contarPorStatus(usuario)`: `RH_ADMIN` conta todas; `GESTOR` conta só próprias+equipe; sem
      solicitações no escopo → todos os 4 contadores `0`
- [ ] Solicitação atrasada conta tanto em `pendentes` quanto em `atrasados` (não exclusivo)
- [ ] `listar(usuario, {})`: `orderBy criado_em desc`, `pageSize` padrão 20
- [ ] `listar` com `status: "PENDENTE"` inclui as atrasadas; com `status: "ATRASADO"` restringe a
      `atrasada_em != null`
- [ ] `listar` com `tipo_fluxo_id`/`solicitante_id` combinados aplica AND (interseção)
- [ ] `GESTOR` filtrando por `solicitante_id` de outra equipe → `{ solicitacoes: [], total: 0 }`,
      nunca lança erro nem retorna dados de fora do escopo
- [ ] `listarSolicitantesVisiveis`: `RH_ADMIN` → todos os `User`; `GESTOR` → ele mesmo + `equipe`
- [ ] `GESTOR` sem equipe (nenhum subordinado) → `listarSolicitantesVisiveis` retorna só ele mesmo;
      `listar`/`contarPorStatus` cobrem só as próprias solicitações
- [ ] Gate check passa: `npm test` (arquivo `dashboardService.test.ts`)
- [ ] Gate check passa: `npx prisma validate && npm run build`
- [ ] Test count: ≥12 casos (cobrindo os itens acima, RH_ADMIN e GESTOR)

**Tests**: unit
**Gate**: quick + build

**Commit**: `feat(dashboard-visao-geral): implementa dashboardService (contadores, lista, solicitantes)`

---

### T4: `GET /api/dashboard/contadores` [P]

**What**: `requireUser([GESTOR, RH_ADMIN])` → `dashboardService.contarPorStatus(usuario)` →
`200 ContadoresDashboard`. Sem query params.
**Where**: `app/api/dashboard/contadores/route.ts`
**Depends on**: T3
**Reuses**: padrão de rota de `app/api/logs/route.ts`
**Requirement**: DASH-01, DASH-03

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Sem sessão → 401
- [ ] Papel `SOLICITANTE` → 403
- [ ] `GESTOR`/`RH_ADMIN` autenticado → 200 com `{ pendentes, atrasados, aprovados, rejeitados }`
- [ ] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(dashboard-visao-geral): adiciona rota GET /api/dashboard/contadores`

---

### T5: `GET /api/dashboard/solicitacoes` [P]

**What**: `requireUser([GESTOR, RH_ADMIN])` → valida query com `dashboardListaQuerySchema` →
`dashboardService.listar(usuario, filtros)` → `200 { solicitacoes, total }`.
**Where**: `app/api/dashboard/solicitacoes/route.ts`
**Depends on**: T2, T3
**Reuses**: padrão de rota de `app/api/logs/route.ts`
**Requirement**: DASH-02, DASH-03 a DASH-08

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Sem sessão → 401
- [ ] Papel `SOLICITANTE` → 403
- [ ] `status` inválido na query → 400, `listar` não é chamado
- [ ] Query válida sem filtros → 200 com lista completa do escopo, paginada
- [ ] Query com todos os filtros combinados → 200 respeitando AND + visibilidade
- [ ] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(dashboard-visao-geral): adiciona rota GET /api/dashboard/solicitacoes`

---

### T6: `DashboardListaContext.tsx` (glue de paginação) [P]

**What**: Mesma "cola" de estado de `AuditoriaLogsContext.tsx` (`useSyncExternalStore`):
`definirPaginacaoInfo({ total, pageSize })` publicado por `ListaSolicitacoes`, lido por
`DashboardPaginacao`.
**Where**: `app/(dashboard)/_components/DashboardListaContext.tsx`
**Depends on**: None
**Reuses**: `app/(dashboard)/auditoria-logs/_components/AuditoriaLogsContext.tsx` (mesmo padrão,
adaptado de nome)
**Requirement**: DASH-02 (suporte a paginação da lista)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `definirPaginacaoInfo`/`usePaginacaoInfo` funcionam como no padrão de origem
- [ ] `"use client"` no topo (evita vazamento de estado de módulo entre requisições)
- [ ] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(dashboard-visao-geral): adiciona glue de paginacao da lista`

---

### T7: `ContadoresPainel.tsx` [P]

**What**: Client Component: no mount, `fetch('/api/dashboard/contadores')`; renderiza 4 cards
(pendentes/atrasados/aprovados/rejeitados); clique em um card escreve `status` na URL via
`router.push` (DASH-10), sem re-fetch dos próprios contadores.
**Where**: `app/(dashboard)/_components/ContadoresPainel.tsx`
**Depends on**: T4
**Reuses**: padrão de fetch-on-mount de `LogTabela.tsx`; navegação por `URLSearchParams` de
`LogFiltros.tsx`
**Requirement**: DASH-01, DASH-10

**Tools**:
- MCP: NONE
- Skill: `frontend-design`

**Done when**:
- [ ] 4 cards renderizados com os valores da API
- [ ] Estado de carregamento e erro tratados (mesmo padrão de `LogTabela`)
- [ ] Clique em um card seta `status` correspondente na URL (`PENDENTE`/`ATRASADO`/`APROVADA`/`REJEITADA`)
- [ ] Contadores não mudam ao clicar (não dependem de `searchParams`)
- [ ] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(dashboard-visao-geral): implementa painel de contadores`

---

### T8: `SolicitacoesFiltros.tsx` [P]

**What**: Client Component: dropdowns de tipo de fluxo, status (`Todos/Pendente/Atrasado/Aprovada/
Rejeitada`) e solicitante, recebendo `tiposDisponiveis`/`solicitantesDisponiveis` como props; ao
submeter, escreve os filtros na URL e força `page=1`; botão "Limpar filtros".
**Where**: `app/(dashboard)/_components/SolicitacoesFiltros.tsx`
**Depends on**: None (props-driven; página conecta as opções em T11)
**Reuses**: `app/(dashboard)/auditoria-logs/_components/LogFiltros.tsx` (estrutura idêntica, campos
diferentes)
**Requirement**: DASH-04 a DASH-07

**Tools**:
- MCP: NONE
- Skill: `frontend-design`

**Done when**:
- [ ] 3 dropdowns (tipo, status, solicitante) + botão filtrar + botão limpar
- [ ] Submeter escreve os filtros preenchidos na URL, omitindo os vazios, e `page=1`
- [ ] "Limpar filtros" volta para a URL sem query params
- [ ] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(dashboard-visao-geral): implementa filtros da lista de solicitacoes`

---

### T9: `ListaSolicitacoes.tsx` [P]

**What**: Client Component: lê `searchParams`, `fetch('/api/dashboard/solicitacoes?...')` a cada
mudança; tabela com tipo de fluxo, solicitante, status (badge "atrasado" quando aplicável), data de
criação; linha clicável navega para o detalhe da solicitação (DASH-09); estado vazio explícito;
publica `{ total, pageSize }` em `DashboardListaContext`.
**Where**: `app/(dashboard)/_components/ListaSolicitacoes.tsx`
**Depends on**: T5, T6
**Reuses**: `app/(dashboard)/auditoria-logs/_components/LogTabela.tsx` (fetch-on-searchParams-change,
loading/erro/vazio)
**Requirement**: DASH-02, DASH-08, DASH-09

**Tools**:
- MCP: NONE
- Skill: `frontend-design`

**Done when**:
- [ ] Refaz o fetch a cada mudança de `searchParams.toString()`
- [ ] Tabela mostra tipo, solicitante, status, indicador de atraso, data (formatada pt-BR)
- [ ] Lista vazia → mensagem explícita ("Nenhuma solicitação encontrada")
- [ ] Linha clicável navega para `/solicitacoes/[id]` (rota de outra feature — link renderizado
      mesmo que a rota ainda não exista nesta base, ver design.md Riscos)
- [ ] Publica `total`/`pageSize` via `definirPaginacaoInfo`
- [ ] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(dashboard-visao-geral): implementa lista de solicitacoes`

---

### T10: `DashboardPaginacao.tsx` [P]

**What**: Mesma lógica de `LogPaginacao.tsx`, lendo de `DashboardListaContext`.
**Where**: `app/(dashboard)/_components/DashboardPaginacao.tsx`
**Depends on**: T6
**Reuses**: `app/(dashboard)/auditoria-logs/_components/LogPaginacao.tsx`
**Requirement**: DASH-02 (paginação)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Botões "Anterior"/"Próxima" habilitam/desabilitam conforme `total`/`pageSize`/página atual
- [ ] Navegar preserva os demais filtros já presentes na URL, trocando só `page`
- [ ] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(dashboard-visao-geral): implementa paginacao da lista`

---

### T11: `app/(dashboard)/page.tsx`

**What**: Server Component: `requireUser([GESTOR, RH_ADMIN])` (mesmo bloco try/catch de
`auditoria-logs/page.tsx`); em sucesso, chama `tipoFluxoService.listar()` e
`dashboardService.listarSolicitantesVisiveis(usuario)` DIRETO; renderiza `ContadoresPainel`,
`SolicitacoesFiltros` (com as opções como props), `ListaSolicitacoes`, `DashboardPaginacao`.
**Where**: `app/(dashboard)/page.tsx`
**Depends on**: T3, T7, T8, T9, T10
**Reuses**: `app/(dashboard)/auditoria-logs/page.tsx` (gate de acesso + mensagem "Acesso restrito")
**Requirement**: DASH-01 a DASH-10 (composição final)

**Tools**:
- MCP: NONE
- Skill: `frontend-design`

**Done when**:
- [ ] Sem sessão → `redirect('/login')`
- [ ] Papel `SOLICITANTE` → "Acesso restrito", nenhum dos 4 componentes é renderizado
- [ ] `GESTOR`/`RH_ADMIN` → opções de tipo/solicitante carregadas via chamada direta ao service,
      passadas como props para `SolicitacoesFiltros`
- [ ] Os 4 componentes renderizados na página
- [ ] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(dashboard-visao-geral): implementa pagina de visao geral`

---

## Parallel Execution Map

```
Phase 1 (Parallel, sem dependencias):
  T1 [P] · T2 [P] · T6 [P] · T8 [P]

Phase 2 (Sequential):
  T1 completo ──→ T3

Phase 3 (Parallel, dependem de T3/T2/T6):
    ├── T4  [P] (precisa T3)
    ├── T5  [P] (precisa T2, T3)
    └── T10 [P] (precisa T6)

Phase 4 (Parallel, dependem de rota):
    ├── T7 [P] (precisa T4)
    └── T9 [P] (precisa T5, T6)

Phase 5 (Sequential):
  T3, T7, T8, T9, T10 completos ──→ T11
```

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Schema + migration | 1 arquivo de schema + 1 migration | ✅ Granular |
| T2: dashboardListaQuerySchema | 1 schema Zod | ✅ Granular |
| T3: dashboardService | 3 funções cohesivas no mesmo arquivo (mesmo padrão de `aprovacaoService.ts`) | ✅ Granular (cohesivo, mesmo arquivo) |
| T4: rota contadores | 1 arquivo de rota | ✅ Granular |
| T5: rota solicitacoes | 1 arquivo de rota | ✅ Granular |
| T6: DashboardListaContext | 1 arquivo de glue | ✅ Granular |
| T7: ContadoresPainel | 1 componente | ✅ Granular |
| T8: SolicitacoesFiltros | 1 componente | ✅ Granular |
| T9: ListaSolicitacoes | 1 componente | ✅ Granular |
| T10: DashboardPaginacao | 1 componente | ✅ Granular |
| T11: page.tsx | 1 página (composição) | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Phase 1, sem seta de entrada | ✅ Match |
| T2 | None | Phase 1, sem seta de entrada | ✅ Match |
| T6 | None | Phase 1, sem seta de entrada | ✅ Match |
| T8 | None | Phase 1, sem seta de entrada | ✅ Match |
| T3 | T1 | `T1 ──→ T3` | ✅ Match |
| T4 | T3 | `T3 ──→ T4` | ✅ Match |
| T5 | T2, T3 | `T3 ──→ T5` + T2 anotado | ✅ Match |
| T10 | T6 | `T6 ──→ T10` | ✅ Match |
| T7 | T4 | `T4 ──→ T7` | ✅ Match |
| T9 | T5, T6 | `T5, T6 ──→ T9` | ✅ Match |
| T11 | T3, T7, T8, T9, T10 | `T3, T7, T8, T9, T10 ──→ T11` | ✅ Match |

Nenhuma task `[P]` depende de outra na mesma fase — T4/T5/T10 dependem todas de fases anteriores
(T3/T6), nunca entre si; T7/T9 idem em relação a T4/T5/T6.

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | `prisma/schema.prisma` | none | none | ✅ OK |
| T2 | `lib/validations/dashboardFiltros.ts` | unit | unit | ✅ OK |
| T3 | `lib/services/dashboardService.ts` | unit | unit | ✅ OK |
| T4 | `app/api/dashboard/contadores/route.ts` | none | none | ✅ OK |
| T5 | `app/api/dashboard/solicitacoes/route.ts` | none | none | ✅ OK |
| T6 | `app/(dashboard)/_components/DashboardListaContext.tsx` | none | none | ✅ OK |
| T7 | `app/(dashboard)/_components/ContadoresPainel.tsx` | none | none | ✅ OK |
| T8 | `app/(dashboard)/_components/SolicitacoesFiltros.tsx` | none | none | ✅ OK |
| T9 | `app/(dashboard)/_components/ListaSolicitacoes.tsx` | none | none | ✅ OK |
| T10 | `app/(dashboard)/_components/DashboardPaginacao.tsx` | none | none | ✅ OK |
| T11 | `app/(dashboard)/page.tsx` | none | none | ✅ OK |

Todos ✅ — nenhuma restruturação necessária.

---

## Riscos / Notas herdadas do design.md

- `atrasada_em` é criado por esta feature "adiantado" em relação a `sla-cobranca` — quando aquela
  feature for para Tasks/Execute, sua migration não deve recriar o campo.
- T9 (DASH-09) aponta para uma rota de detalhe (`/solicitacoes/[id]`) que ainda não existe nesta
  base — comportamento aceitável (P3, não bloqueia as demais tasks).
- Nenhuma task grava `Log` — tela é somente leitura, sem transição de status para auditar.
