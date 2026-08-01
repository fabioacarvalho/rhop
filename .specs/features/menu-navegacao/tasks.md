# Menu de Navegação (App Shell) — Tasks

**Design**: `.specs/features/menu-navegacao/design.md`
**Status**: Done (T1–T8 implementados; ver ressalvas de execução no final do arquivo)

---

## 0. Nota sobre TESTING.md

Não existe `.specs/codebase/TESTING.md`. Mesma inferência já usada em `dashboard-visao-geral/tasks.md` e `painel-insights/tasks.md`, verificável no código atual:

| Camada | Tipo de teste | Evidência |
| --- | --- | --- |
| `lib/**/*.ts` (dados puros, funções puras, services) | unit (vitest, `*.test.ts` colocado) | `authService.test.ts`, `logService.test.ts`, etc. |
| `lib/actions/*.ts` (Server Actions) | none — sem padrão de teste de Server Action em nenhuma feature anterior; comportamento coberto por checagem manual descrita na task | nenhuma feature anterior testa `'use server'` diretamente |
| `app/(dashboard)/**/*.tsx` (layout, componentes de UI) | none — sem `@testing-library/*` instalado, 0 arquivos `*.test.tsx` no projeto | mesma evidência já citada em `dashboard-visao-geral/tasks.md` |
| `app/globals.css` | none — validado visualmente | não é código testável por vitest |

**Gate Check Commands:**

- `quick` → `npm test` (vitest run, arquivo específico durante o desenvolvimento)
- `build` → `npx prisma validate && npm run build` — mandatório em toda task (`CLAUDE.md`, "Como validar o trabalho")

Tasks em `lib/navigation/*` rodam **quick + build**. Tasks de UI/layout/Server Action rodam **só build** + a checagem manual descrita em "Done when" (obrigatória por `CLAUDE.md` para qualquer alteração de autorização/fluxo — aqui o "fluxo" afetado é navegação/logout, não aprovação, mas o princípio de descrever o cenário testado manualmente se aplica).

**Parallelism:** camadas em arquivos diferentes são parallel-safe. T4 (Sidebar) e T5 (Topbar) tocam arquivos diferentes mas ambos **leem** `navConfig.ts` (T2) — não escrevem nele, então são `[P]` entre si desde que T2 esteja pronto.

---

## Execution Plan

### Phase 1: Fundação (Sequential)

```
T1 → T2
```

`T1` (tokens CSS globais) e `T2` (navConfig + testes) não dependem um do outro tecnicamente, mas T2 define os `href`/rótulos que T1 não usa — **na prática podem rodar em paralelo**. Ver diagrama corrigido abaixo.

### Phase 1 (corrigida): Fundação (Parallel)

```
T1 [P] ──┐
T2 [P] ──┼──→ Phase 2
T3 [P] ──┘
```

### Phase 2: Server Action + Layout (Sequential)

```
T2 ──→ T3 (logout action, independente de navConfig — ver nota abaixo)
T1, T2 ──→ T6 (layout.tsx precisa existir antes do shell montar)
```

Nota: `T3` (logout) não depende de `T1`/`T2` de fato — só precisa de `lib/supabase/server.ts` (já existe). Recolocado em Phase 1 no diagrama final.

### Phase 1 (final): Fundação (Parallel)

```
T1 [P] ──┐
T2 [P] ──┤
T3 [P] ──┼──→ Phase 2
```

### Phase 2: Componentes do Shell (Parallel após T2; Sidebar/Topbar também usam T3 para o botão Sair)

```
T2, T3 ──┬→ T4 [P] (Sidebar)
         └→ T5 [P] (Topbar + NotificationBell)
```

### Phase 3: Composição e integração (Sequential)

```
T4, T5 ──→ T6 (AppShell) ──→ T7 (layout.tsx)
```

### Phase 4: Verificação manual ponta a ponta (Sequential)

```
T7 ──→ T8
```

---

## Task Breakdown

### T1: Design tokens globais (`app/globals.css`) [P]

**What**: Adicionar todas as CSS custom properties da tabela §1.1 de `docs/design-ux-ui/fluxorh-ui-layout-specs.md` (`--paper`, `--paper-raised`, `--ink`, `--ink-soft`, `--azul-900/800/700/500/200/100`, `--amarelo-700/600/400/100`, `--linha`, `--verde`, `--verde-bg`, `--vermelho`, `--vermelho-bg`, `--laranja`, `--laranja-bg`) ao `:root` de `app/globals.css`, sem remover nada que já exista.
**Where**: `app/globals.css`
**Depends on**: None
**Reuses**: valores hex exatos da tabela §1.1 já documentada.
**Requirement**: NAV-01

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Todos os 18 tokens da tabela §1.1 presentes em `:root`, com os hex exatos documentados.
- [ ] `npm run build` passa sem erro.

**Tests**: none
**Gate**: build
**Commit**: `feat(menu-navegacao): adiciona design tokens globais do produto`

---

### T2: `lib/navigation/navConfig.ts` — dados + funções puras [P]

**What**: Criar o array de `NavGroup`/`NavItem` (conteúdo exato da tabela de `design.md` — 4 grupos, 8 itens) e as funções puras `getVisibleGroups(role: Role): NavGroup[]` e `resolveScreenTitle(pathname: string): { eyebrow: string; titulo: string }`.
**Where**: `lib/navigation/navConfig.ts`, `lib/navigation/navConfig.test.ts`
**Depends on**: None
**Reuses**: `Role` de `lib/generated/prisma/client`
**Requirement**: NAV-02, NAV-03, NAV-04, NAV-05, NAV-10, NAV-16, NAV-17

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `getVisibleGroups(Role.SOLICITANTE)` retorna só o grupo "Meu trabalho" com 2 itens (Minhas Solicitações, Nova Solicitação) — sem Aprovações Pendentes.
- [ ] `getVisibleGroups(Role.GESTOR)` retorna "Meu trabalho" (3 itens), "Visão geral" (2 itens), "Recrutamento" (1 item) — sem "Administração".
- [ ] `getVisibleGroups(Role.RH_ADMIN)` retorna todos os 4 grupos, 8 itens no total.
- [ ] Grupo sem nenhum item visível não aparece no array retornado (testar explicitamente o caso `SOLICITANTE` não ter "Visão geral"/"Administração"/"Recrutamento" no resultado).
- [ ] `resolveScreenTitle('/aprovacoes')` retorna `{ eyebrow: 'Meu trabalho', titulo: 'Aprovações Pendentes' }` (ou par equivalente definido no dado).
- [ ] `resolveScreenTitle('/solicitacoes/abc123')` casa por prefixo mais longo e retorna o par de `/solicitacoes` (fallback, sem lançar erro).
- [ ] `resolveScreenTitle('/rota-inexistente')` retorna um fallback genérico definido (não `undefined`, não lança erro).
- [ ] Testes: ≥8 casos cobrindo os 3 papéis, grupo vazio omitido, prefixo exato, prefixo aproximado e rota desconhecida.
- [ ] `npm test -- navConfig` e `npm run build` passam.

**Tests**: unit
**Gate**: quick + build
**Commit**: `feat(menu-navegacao): adiciona navConfig com filtro de visibilidade por papel`

---

### T3: `lib/actions/logout.ts` — Server Action de logout [P]

**What**: Server Action `logout()` que chama `createServerClient().auth.signOut()` e redireciona para `/login`, com `try/catch` que loga a falha (se houver) mas sempre redireciona — implementa o contrato AUTH-13/AUTH-14 pela primeira vez no código.
**Where**: `lib/actions/logout.ts`
**Depends on**: None
**Reuses**: `createServerClient` (`lib/supabase/server.ts`)
**Requirement**: NAV-09

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Arquivo com `'use server'` no topo, exporta `async function logout(): Promise<void>`.
- [ ] Chama `supabase.auth.signOut()` antes de `redirect('/login')`.
- [ ] Falha em `signOut()` não impede o `redirect('/login')` (não deixa o usuário preso).
- [ ] `npm run build` passa (Server Actions são validadas em build).
- [ ] Cenário de teste manual descrito no resumo da task (ex.: "logar como GESTOR, acionar Sair, confirmar redirect para /login e que voltar para /aprovacoes exige novo login") — conforme `CLAUDE.md`.

**Tests**: none
**Gate**: build
**Commit**: `feat(menu-navegacao): implementa server action de logout`

---

### T4: `Sidebar` (+ `Sidebar.module.css`) [P]

**What**: Client Component que renderiza marca "OP Conecta", os grupos de `getVisibleGroups(role)` (com colapso por grupo via `useState`, expandido por padrão), destaque do item cujo `href` casa com `usePathname()`, e um `<form action={logout}>` com o botão "Sair" no rodapé.
**Where**: `app/(dashboard)/_components/Sidebar.tsx`, `app/(dashboard)/_components/Sidebar.module.css`
**Depends on**: T2, T3
**Reuses**: `navConfig.getVisibleGroups`, `lib/actions/logout.ts`, tokens de T1 (`--azul-900` etc. via CSS Modules)
**Requirement**: NAV-01, NAV-02, NAV-03, NAV-04, NAV-05, NAV-06, NAV-07, NAV-09, NAV-14, NAV-15, NAV-18

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Renderiza apenas os grupos/itens retornados por `getVisibleGroups(role)` — nenhum item hardcoded fora desse dado.
- [ ] Item cujo `href` é prefixo mais longo do `pathname` atual recebe classe de destaque ativo.
- [ ] Clique no cabeçalho de um grupo alterna expandido/recolhido (estado local, sem persistência).
- [ ] Botão "Sair" dispara `logout` (Server Action) via `<form action={logout}>`.
- [ ] Abaixo de 860px de largura, sidebar assume estado compacto/oculto com gatilho explícito (NAV-18), reusando o breakpoint já documentado no login.
- [ ] `npm run build` passa.

**Tests**: none
**Gate**: build
**Commit**: `feat(menu-navegacao): adiciona Sidebar com navegação filtrada por papel`

---

### T5: `Topbar` + `NotificationBell` (+ CSS Modules) [P]

**What**: Client Component `Topbar` que exibe eyebrow/título via `resolveScreenTitle(usePathname())`, nome/papel do usuário (truncado com `text-overflow: ellipsis` se necessário) e o `NotificationBell` (wrapper `position: relative` em volta de `NotificacaoBadge` + `NotificacoesPopover`, sem modificar esses dois arquivos).
**Where**: `app/(dashboard)/_components/Topbar.tsx`, `app/(dashboard)/_components/Topbar.module.css`, `app/(dashboard)/_components/NotificationBell.tsx`, `app/(dashboard)/_components/NotificationBell.module.css`
**Depends on**: T2, T3 (recebe `nome`/`papelLabel` como props resolvidos no layout via `requireUser`; T3 não é dependência direta — mantido por paralelismo de phase, ver nota)
**Reuses**: `navConfig.resolveScreenTitle`, `components/notificacoes/NotificacaoBadge.tsx`, `components/notificacoes/NotificacoesPopover.tsx` (ambos reusados sem alteração)
**Requirement**: NAV-08, NAV-10, NAV-11, NAV-12, NAV-13

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Exibe eyebrow + título corretos para `/aprovacoes`, `/auditoria-logs`, `/configuracao-fluxos` (rotas já existentes) via `resolveScreenTitle`.
- [ ] Exibe nome e papel (label legível, ex.: "Gestor", não o enum cru `GESTOR`) do usuário autenticado.
- [ ] Nome muito longo trunca sem quebrar o layout da topbar (`overflow: hidden; text-overflow: ellipsis; white-space: nowrap` ou equivalente, testado com string de 60+ caracteres).
- [ ] `NotificationBell` renderiza `NotificacaoBadge` e `NotificacoesPopover` juntos, sem erro de import, visível em qualquer tela do shell.
- [ ] Com contagem de notificações igual a zero, nenhum badge numérico aparece (comportamento já garantido por `NotificacaoBadge`, só confirmar que a composição não quebra esse estado).
- [ ] `npm run build` passa.

**Tests**: none
**Gate**: build
**Commit**: `feat(menu-navegacao): adiciona Topbar com identidade do usuário e notificações`

---

### T6: `AppShell` (composição)

**What**: Componente que recebe `usuario: AuthenticatedUser` e `children`, resolve `papelLabel` (mapa `Role -> string legível`, ex. `GESTOR -> "Gestor"`) e renderiza `Sidebar` + `Topbar` + área de conteúdo (`.screen-container`-like) com `children` dentro.
**Where**: `app/(dashboard)/_components/AppShell.tsx`, `app/(dashboard)/_components/AppShell.module.css`
**Depends on**: T4, T5
**Reuses**: `Sidebar`, `Topbar`, tipo `AuthenticatedUser` (`lib/services/authService.ts`)
**Requirement**: NAV-01, NAV-08

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `AppShell` é Server Component (não precisa de `'use client'` — delega interatividade para `Sidebar`/`Topbar`).
- [ ] Layout de grid/flex: sidebar fixa à esquerda (250px conforme mockup), topbar + conteúdo ocupando o restante.
- [ ] `children` renderiza dentro da área de conteúdo, sem a Sidebar/Topbar re-montarem a cada navegação (herdado do Next.js layout, só confirmar visualmente).
- [ ] `npm run build` passa.

**Tests**: none
**Gate**: build
**Commit**: `feat(menu-navegacao): adiciona AppShell compondo Sidebar e Topbar`

---

### T7: `app/(dashboard)/layout.tsx`

**What**: Layout do grupo de rotas que chama `requireUser()` (sem papéis), redireciona para `/login` em `ErroNaoAutenticado`, mapeia `role -> papelLabel` e renderiza `<AppShell usuario={usuario}>{children}</AppShell>`.
**Where**: `app/(dashboard)/layout.tsx`
**Depends on**: T6
**Reuses**: `requireUser`, `ErroNaoAutenticado` (`lib/services/authService.ts`), `redirect` (`next/navigation`)
**Requirement**: NAV-01, NAV-08

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `requireUser()` chamado sem argumento de papéis (aceita os 3 papéis).
- [ ] `ErroNaoAutenticado` capturado → `redirect('/login')`, sem renderizar `AppShell`.
- [ ] As 3 rotas já existentes (`/aprovacoes`, `/auditoria-logs`, `/configuracao-fluxos`) passam a renderizar dentro do shell automaticamente, sem qualquer edição nos respectivos `page.tsx`.
- [ ] `npx prisma validate && npm run build` passam.

**Tests**: none
**Gate**: build
**Commit**: `feat(menu-navegacao): integra app shell ao grupo de rotas (dashboard)`

---

### T8: Verificação manual ponta a ponta (checklist RBAC)

**What**: Checklist manual (sem código novo) confirmando a matriz de visibilidade completa e o fluxo de logout nas 3 rotas já implementadas, documentando os cenários testados conforme exigido por `CLAUDE.md` para mudanças de autorização/fluxo.
**Where**: N/A (verificação; resultado registrado no resumo da execução, não em arquivo novo)
**Depends on**: T7
**Requirement**: NAV-02 a NAV-13 (verificação end-to-end)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Logar como `SOLICITANTE`: sidebar mostra só "Meu trabalho" (Minhas Solicitações, Nova Solicitação); tentar acessar `/aprovacoes` direto pela URL → bloqueado pela página (comportamento já existente, só confirmar que o shell não abre brecha).
- [ ] Logar como `GESTOR`: sidebar mostra "Meu trabalho" completo, "Visão geral", "Recrutamento"; sem "Administração"; acessar `/configuracao-fluxos` direto pela URL → "Acesso restrito" dentro do shell.
- [ ] Logar como `RH_ADMIN`: sidebar mostra os 4 grupos completos.
- [ ] Em qualquer papel: nome/papel corretos na topbar; título muda ao navegar entre `/aprovacoes`, `/auditoria-logs`, `/configuracao-fluxos`.
- [ ] Acionar "Sair": sessão encerra, redirect para `/login`; tentar voltar para `/aprovacoes` → exige novo login.
- [ ] `npm run build` final passa sem regressão.

**Tests**: none
**Gate**: build
**Commit**: nenhum (task de verificação, sem alteração de código)

---

## Parallel Execution Map

```
Phase 1 (Parallel):
  T1 [P] ──┐
  T2 [P] ──┤
  T3 [P] ──┼──→ Phase 2
                (nenhuma depende de código nova desta feature)

Phase 2 (Parallel após T2 + T3):
  T2, T3 ──┬→ T4 [P] (Sidebar)
           └→ T5 [P] (Topbar + NotificationBell)

Phase 3 (Sequential):
  T4, T5 ──→ T6 (AppShell) ──→ T7 (layout.tsx)

Phase 4 (Sequential):
  T7 ──→ T8 (verificação manual)
```

---

## Task Granularity Check

| Task | Escopo | Status |
| --- | --- | --- |
| T1: Design tokens globais | 1 arquivo CSS, 1 conceito (tokens) | ✅ Granular |
| T2: navConfig + funções puras | 1 módulo + 1 teste, 2 funções coesas | ✅ Granular (2 funções relacionadas no mesmo arquivo — OK por coesão) |
| T3: Server Action de logout | 1 arquivo, 1 função | ✅ Granular |
| T4: Sidebar | 1 componente + seu CSS Module | ✅ Granular |
| T5: Topbar + NotificationBell | 2 componentes pequenos e fortemente acoplados (bell só existe para a topbar) | ✅ Granular (cohesão justifica agrupar) |
| T6: AppShell | 1 componente de composição | ✅ Granular |
| T7: layout.tsx | 1 arquivo | ✅ Granular |
| T8: Verificação manual | 0 arquivos de código, 1 checklist | ✅ Granular (task de verificação) |

---

## Diagram-Definition Cross-Check

| Task | Depends On (corpo da task) | Diagrama Mostra | Status |
| --- | --- | --- | --- |
| T1 | None | Nenhuma seta de entrada (Phase 1) | ✅ Match |
| T2 | None | Nenhuma seta de entrada (Phase 1) | ✅ Match |
| T3 | None | Nenhuma seta de entrada (Phase 1) | ✅ Match |
| T4 | T2, T3 | T2 → T4, T3 → T4 | ✅ Match |
| T5 | T2, T3 | T2 → T5, T3 → T5 | ✅ Match |
| T6 | T4, T5 | T4 → T6, T5 → T6 | ✅ Match |
| T7 | T6 | T6 → T7 | ✅ Match |
| T8 | T7 | T7 → T8 | ✅ Match |

Nenhuma task marcada `[P]` depende de outra task `[P]` na mesma fase (T1/T2/T3 independentes entre si; T4/T5 independentes entre si).

---

## Test Co-location Validation

| Task | Camada Criada/Modificada | Matriz Exige | Task Diz | Status |
| --- | --- | --- | --- | --- |
| T1: Design tokens | `app/globals.css` | none | none | ✅ OK |
| T2: navConfig | `lib/navigation/*.ts` (funções puras) | unit | unit | ✅ OK |
| T3: logout action | `lib/actions/*.ts` (Server Action) | none (sem padrão de teste de Server Action no projeto) | none | ✅ OK |
| T4: Sidebar | `app/(dashboard)/_components/*.tsx` | none | none | ✅ OK |
| T5: Topbar/NotificationBell | `app/(dashboard)/_components/*.tsx` | none | none | ✅ OK |
| T6: AppShell | `app/(dashboard)/_components/*.tsx` | none | none | ✅ OK |
| T7: layout.tsx | `app/(dashboard)/layout.tsx` | none | none | ✅ OK |
| T8: Verificação | N/A | N/A | none | ✅ OK |

---

## Tools per Task (a confirmar com o usuário)

Nenhuma task exige MCP ou skill externa para execução (todas as decisões de design/UX já foram tomadas nas fases Specify/Design com apoio de `frontend-design` e `ui-ux-pro-max`). Sugestão: executar sequencialmente por sub-agente único por task, sem necessidade de ferramentas adicionais além de leitura/edição de arquivo e `npm run build`/`npm test`.

---

## Execução — Resultado (T1–T8)

Todas as 8 tasks implementadas e commitadas individualmente. `npm run build` e `npx prisma validate` verdes ao final. `npm test -- lib/navigation/navConfig.test.ts` — 9/9 passando.

**Desvio de implementação (SPEC_DEVIATION):** `navConfig.ts` e `Sidebar.tsx` importam `Role` de `@/lib/generated/prisma/enums`, não de `.../client` como o restante do projeto. Motivo: `client.ts` (gerado pelo Prisma) importa `node:process`/`node:path` e o runtime completo do Prisma; como `Sidebar`/`Topbar` são Client Components, importar `Role` de `client.ts` quebrava o build do Turbopack ("chunking context does not support external modules"). `enums.ts` é o mesmo arquivo que `browser.ts` (entry point "para o browser" do próprio Prisma) reexporta — seguro para uso client-side.

**Ressalvas conhecidas (não resolvidas por esta feature — fora do seu escopo):**

1. **3 itens do menu apontam para rotas ainda não implementadas**: "Minhas Solicitações" (`/solicitacoes`), "Nova Solicitação" (`/solicitacoes/nova`) e "Banco de Talentos" (`/banco-de-talentos`). Confirmado via `find app/(dashboard)` — nenhum desses diretórios existe ainda. Isso viola o Success Criteria "0 links quebrados/404" *temporariamente*: qualquer usuário `SOLICITANTE` logado hoje vê um menu com 2 itens que 404iam ao clicar (o papel inteiro fica sem navegação funcional até `solicitacoes` ser executada — já tem `spec.md`/`design.md`/`tasks.md` prontos). Mantidos no menu porque NAV-02 exige exibi-los para `SOLICITANTE` e um menu vazio para esse papel seria pior. Assim que `solicitacoes` (e depois `banco-de-talentos`) forem executadas nos paths já assumidos aqui, o 404 desaparece sem tocar em `navConfig.ts`.
2. **Conflito de landing em `/` para `SOLICITANTE`**: já documentado em `design.md` ("Riscos/Observações") e confirmado no código — `app/(dashboard)/page.tsx` (Dashboard) chama `requireUser([GESTOR, RH_ADMIN])`. Um `SOLICITANTE` que acesse `/` diretamente recebe "Acesso restrito" em vez de pouso útil. Não é dono desta feature corrigir (arquivo pertence a `dashboard-visao-geral`).
3. **Verificação visual autenticada não foi feita via navegador automatizado** — Playwright não está instalado no projeto (`package.json` não lista `@playwright/test`) e instalá-lo não fazia parte do escopo das tasks. Verificado em vez disso: `npm run build` limpo, `npx prisma validate` ok, suíte unit de `navConfig` (9/9), e via `curl` contra o dev server já em execução (porta 3000) que as 5 rotas reais (`/`, `/aprovacoes`, `/auditoria-logs`, `/configuracao-fluxos`, `/insights`) redirecionam corretamente para `/login` quando não autenticado, sem erro 500.
   **Recomendação de verificação manual** (contas de seed em `scripts/seed-users.ts`, senha `Teste@123` para todas): logar como `solicitante@01tec.com.br`, `gestor@01tec.com.br` e `rh.admin@01tec.com.br` e conferir a matriz de itens visíveis de T8, mais o fluxo de "Sair".
