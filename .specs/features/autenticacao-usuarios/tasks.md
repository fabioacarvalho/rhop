# Autenticação e Usuários Tasks

**Design**: `.specs/features/autenticacao-usuarios/design.md`
**Spec**: `.specs/features/autenticacao-usuarios/spec.md`
**Status**: In Progress — T1, T2, T3, T4, T6, T9 executados e commitados (feitos fora de ordem, como pré-requisito real de `auditoria-logs`, que dependia de schema/User/authService). T5, T7, T8, T10-T14 ainda pendentes; T9 só validado por inspeção/mocks — sem projeto Supabase real configurado nesta sessão, o caminho de login real ainda não foi testado.

---

## Test Strategy (não havia `TESTING.md` — decisão tomada nesta sessão)

Projeto greenfield, sem `package.json` ainda. Decisão do usuário: introduzir **Vitest** para unit tests dos services e da lógica de decisão do middleware, mantendo o gate de build (`npm run build` + `npx prisma validate`) do `CLAUDE.md`. UI (formulários/componentes) e o script de seed permanecem sem teste automatizado no MVP — verificados por cenário manual descrito no `Done when`, conforme já convencionado em `CLAUDE.md` ("descrever manualmente o cenário de teste" para lógica de autorização).

> Nota: existia um `tasks.md` anterior nesta mesma pasta (de uma sessão anterior, antes do `/clear`) usando estratégia "manual" sem Vitest e um stub no-op de `logService`. Este arquivo o substitui — o usuário decidiu por Vitest nesta sessão, e o stub no-op não satisfazia de fato AUTH-07 (precisa persistir `Log`). O plano abaixo cria um `model Log` mínimo real em vez de um stub vazio.

### Test Coverage Matrix

| Code Layer | Test Type | Parallel-Safe |
| --- | --- | --- |
| `lib/services/*.ts` (authService, userService, logService) | unit (Vitest) | Yes |
| `middleware.ts` (decisão redirect / 401 / passthrough) | unit (Vitest, Supabase client mockado) | Yes |
| `prisma/schema.prisma` | none — `npx prisma validate` | Yes |
| Componentes de UI (LoginForm, LogoutButton, UserBadge, páginas) | none — cenário manual | Yes |
| `scripts/seed-users.ts` | none — execução manual contra Supabase local | No (muta estado externo real) |

### Gate Check Commands

| Gate | Command |
| --- | --- |
| `quick` | `npm run test` (vitest run) |
| `full` | `npm run build && npx prisma validate && npm run test` |
| `build` | `npm run build` (+ `npx prisma validate` quando a task tocar `prisma/schema.prisma`) |

---

## Execution Plan

```
Phase 1 (Sequential):
  T1

Phase 2 (Parallel):
  T1 done →
    ├── T2 [P]
    └── T4 [P]

Phase 3 (Parallel):
  T2 done → T3 [P]
  T4 done → T5 [P], T10 [P], T11 [P]

Phase 4 (Parallel):
  T5    done → T6 [P]
  T2,T3 done → T7 [P]
  T2,T3 done → T8 [P]

Phase 5 (Parallel):
  T2,T3,T4,T8 done → T9  [P]
  T7          done → T13 [P]

Phase 6 (Sequential):
  T9 done → T12

Phase 7 (Sequential):
  T6, T10, T11, T12, T13 done → T14
```

---

## Task Breakdown

### T1: Scaffold Next.js + tooling

**What**: Inicializar o projeto Next.js (App Router, TypeScript) com `package.json`, `tsconfig.json`, `next.config.ts`, config do Vitest (`vitest.config.ts`), `.env.example` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`) e uma página placeholder (`app/layout.tsx`, `app/page.tsx`) só para o build passar.
**Where**: raiz do projeto, `app/layout.tsx`, `app/page.tsx`, `vitest.config.ts`, `.env.example`
**Depends on**: None
**Reuses**: N/A (primeiro código do projeto)
**Requirement**: N/A (fundação)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `npm install` roda sem erro
- [ ] Scripts em `package.json`: `dev`, `build`, `start`, `test` (`vitest run`)
- [ ] `.env.example` documenta as 4 variáveis com comentário do que cada uma faz
- [ ] `.gitignore` cobre `.env*` (exceto `.env.example`) e `node_modules`
- [ ] Gate check passa: `npm run build`

**Tests**: none
**Gate**: build

**Commit**: `chore(scaffold): inicializa projeto Next.js App Router com Vitest`

---

### T2: Prisma init [P]

**What**: `prisma/schema.prisma` com `datasource`/`generator` apontando para `DATABASE_URL`, e `lib/prisma.ts` como singleton do `PrismaClient` (padrão `globalThis` para evitar múltiplas conexões em hot-reload).
**Where**: `prisma/schema.prisma`, `lib/prisma.ts`
**Depends on**: T1
**Reuses**: N/A
**Requirement**: fundação para AUTH-04..08

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `npx prisma validate` passa
- [ ] `lib/prisma.ts` exporta uma única instância reusada entre chamadas (padrão oficial de singleton do Prisma com Next.js)
- [ ] Gate check passa: `npm run build` + `npx prisma validate`

**Tests**: none
**Gate**: build

**Commit**: `chore(prisma): configura client singleton e schema base`

---

### T3: `User` model + enum `Role` [P]

**What**: Adicionar `enum Role { SOLICITANTE GESTOR RH_ADMIN }` e `model User` (`id` uuid = id do Supabase Auth, `nome`, `email @unique`, `role`, `gestor_id` opcional, auto-relação `gestor`/`equipe`) ao `schema.prisma`, exatamente como especificado em `design.md`.
**Where**: `prisma/schema.prisma` (modificar)
**Depends on**: T2
**Reuses**: N/A
**Requirement**: AUTH-04, AUTH-05, AUTH-08

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `enum Role` com os 3 valores exatos
- [ ] `model User` com todos os campos e a auto-relação `gestor`/`equipe`
- [ ] `email` marcado `@unique`
- [ ] Gate check passa: `npx prisma validate`

**Tests**: none
**Gate**: build

**Commit**: `feat(auth): adiciona modelo User e enum Role`

---

### T4: Supabase clients (browser/server) [P]

**What**: `lib/supabase/client.ts` (`createBrowserClient`) e `lib/supabase/server.ts` (`createServerClient` lendo/escrevendo cookies via `next/headers`), usando `@supabase/ssr`.
**Where**: `lib/supabase/client.ts`, `lib/supabase/server.ts`
**Depends on**: T1
**Reuses**: N/A (primeira introdução do Supabase)
**Requirement**: fundação para AUTH-01, AUTH-06, AUTH-09..12

**Tools**:
- MCP: NONE (Context7 não conectado nesta sessão — confirmar a API do `@supabase/ssr` via WebSearch/documentação oficial antes de codar, per o risco já flagado em `design.md`)
- Skill: `research` (opcional, se quiser deixar registrado o resultado da verificação da API)

**Done when**:
- [ ] API exata de `createBrowserClient`/`createServerClient` confirmada na documentação oficial do `@supabase/ssr` (não assumir de memória)
- [ ] `createServerClient` usa o contrato de cookies confirmado (get/set/remove conforme a versão atual do pacote)
- [ ] Gate check passa: `npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(auth): cria clients Supabase de browser e servidor`

---

### T5: Supabase middleware helper [P]

**What**: `lib/supabase/middleware.ts` — helper que cria o client de servidor dentro do `middleware.ts` e revalida a sessão via `supabase.auth.getUser()` (não só checagem de cookie presente).
**Where**: `lib/supabase/middleware.ts`
**Depends on**: T4
**Reuses**: `lib/supabase/server.ts` (padrão de cliente)
**Requirement**: fundação para AUTH-11

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Helper retorna `{ user, response }` (ou equivalente) para o `middleware.ts` decidir com base em sessão revalidada, não em cookie bruto
- [ ] Gate check passa: `npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(auth): cria helper de refresh de sessão para middleware`

---

### T6: `middleware.ts` — proteção de rota [P]

**What**: Middleware que usa T5 para decidir: sem sessão + `/api/*` → 401 JSON sem invocar handler; sem sessão + página → `redirect('/login')`; sessão válida → passa adiante. Matcher exclui `/login`, assets estáticos, `_next/*`.
**Where**: `middleware.ts` (raiz)
**Depends on**: T5
**Reuses**: `lib/supabase/middleware.ts`
**Requirement**: AUTH-09, AUTH-10, AUTH-11, AUTH-12

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Sem sessão + rota de página → redirect para `/login`, conteúdo protegido não renderiza
- [ ] Sem sessão + rota `/api/*` → 401 JSON, handler não é invocado
- [ ] Sessão válida (revalidada) → passa adiante sem tocar Prisma
- [ ] `/login` e assets não são interceptados
- [ ] Gate check passa: `npm run test`
- [ ] Test count: 4 testes passam (no silent deletions)

**Tests**: unit
**Gate**: quick

**Verify**:
```
npm run test -- middleware
```
Espera-se 4 testes verdes cobrindo as 4 combinações de decisão acima.

**Commit**: `feat(auth): implementa middleware de proteção de rotas com testes`

---

### T7: `userService.provisionar` [P]

**What**: `lib/services/userService.ts` com `provisionar(input)` validando `role` no enum, `gestor_id` nulo só para `RH_ADMIN`, rejeição de auto-referência, rejeição de `gestor_id` inexistente, e tradução de `P2002` (e-mail duplicado) em erro de validação — antes de qualquer `prisma.user.create`.
**Where**: `lib/services/userService.ts`
**Depends on**: T2, T3
**Reuses**: `lib/prisma.ts`
**Requirement**: AUTH-05, AUTH-08, AUTH-15, AUTH-16, AUTH-17

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `role` fora do enum → rejeitado com erro descritivo
- [ ] `gestor_id` nulo + `role !== RH_ADMIN` → rejeitado
- [ ] `gestor_id` nulo + `role === RH_ADMIN` → aceito
- [ ] `gestor_id === id` (auto-referência) → rejeitado
- [ ] `gestor_id` apontando para usuário inexistente → rejeitado
- [ ] `email` duplicado (`P2002`) → traduzido para erro de validação
- [ ] Gate check passa: `npm run test`
- [ ] Test count: 6 testes passam (no silent deletions)

**Tests**: unit
**Gate**: quick

**Verify**:
```
npm run test -- userService
```
Espera-se 6 testes verdes, um por regra de validação acima.

**Commit**: `feat(auth): implementa userService.provisionar com validação de hierarquia`

---

### T8: `Log` model mínimo + `logService.registrar` [P]

**What**: Adicionar ao `schema.prisma` o `model Log` com o schema já especificado no contrato AUD-01 de `.specs/features/auditoria-logs/spec.md` (`id`, `tipo` enum `AUDITORIA`/`ERRO`, `entidade`, `entidade_id`, `acao`, `usuario_id` opcional, `detalhes` Json opcional, `criado_em` default `now()`), e `lib/services/logService.ts` com `registrar(input): Promise<void>` cumprindo AUD-01/02/03: persiste, preenche `criado_em` automaticamente, aceita `usuario_id` nulo, e contém qualquer falha de gravação sem propagar exceção ao chamador.
**Where**: `prisma/schema.prisma` (modificar), `lib/services/logService.ts`
**Depends on**: T2, T3
**Reuses**: `lib/prisma.ts`
**Requirement**: fundação de AUTH-07 (reusa o contrato AUD-01/02/03 já especificado em `auditoria-logs/spec.md`, sem implementar a feature completa — sem tela, sem filtros)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `model Log` no schema com os campos exatos do contrato AUD-01
- [ ] `registrar({ tipo: 'ERRO', ... })` e `registrar({ tipo: 'AUDITORIA', ... })` persistem corretamente
- [ ] `criado_em` preenchido automaticamente quando omitido
- [ ] `usuario_id` nulo é aceito
- [ ] Falha do Prisma ao gravar (mockada) é contida — `registrar` não lança
- [ ] Gate check passa: `npm run test`
- [ ] Test count: 5 testes passam (no silent deletions)

**Tests**: unit
**Gate**: quick

**Verify**:
```
npm run test -- logService
```
Espera-se 5 testes verdes.

**Nota**: este model/service é o mesmo contrato que a feature `auditoria-logs` vai especificar em detalhe (tela, filtros, paginação). Quando essa feature for implementada, ela estende este arquivo — não deve reescrevê-lo do zero. Substitui a abordagem de stub no-op de um draft anterior desta task list, que não persistia log real.

**Commit**: `feat(auth): adiciona model Log minimo e logService.registrar`

---

### T9: `authService.getSessionUser` + `requireUser`

**What**: `lib/services/authService.ts` com `getSessionUser()` (resolve `User` do Prisma a partir da sessão Supabase; sessão sem `User` correspondente → grava `Log` ERRO via `logService.registrar` e retorna `null`) e `requireUser(roles?)` (lança erro tipado que a route converte em 401/403).
**Where**: `lib/services/authService.ts`
**Depends on**: T2, T3, T4, T8
**Reuses**: `lib/supabase/server.ts`, `lib/prisma.ts`, `lib/services/logService.ts`
**Requirement**: AUTH-06, AUTH-07, AUTH-18

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Sessão válida + `User` existente → retorna `{ id, nome, email, role, gestor_id }` (inclui `gestor_id` — AUTH-18)
- [ ] Sessão válida sem `User` correspondente → retorna `null` e chama `logService.registrar` com `tipo: 'ERRO'`
- [ ] Sem sessão → retorna `null` sem chamar `logService`
- [ ] `requireUser(roles)` lança erro distinguível para "sem sessão/User" vs. "role não permitido"
- [ ] Gate check passa: `npm run test`
- [ ] Test count: 4 testes passam (no silent deletions)

**Tests**: unit
**Gate**: quick

**Verify**:
```
npm run test -- authService
```
Espera-se 4 testes verdes.

**Commit**: `feat(auth): implementa authService.getSessionUser e requireUser`

---

### T10: Login page + `LoginForm` [P]

**What**: `app/login/page.tsx` (server component de layout) + `app/login/LoginForm.tsx` (client component): campos obrigatórios bloqueiam submit sem chamar Supabase; erro de credenciais → mensagem genérica fixa; erro de rede → mensagem de retry com formulário reabilitado; sucesso → `router.push('/')` + `router.refresh()`.
**Where**: `app/login/page.tsx`, `app/login/LoginForm.tsx`
**Depends on**: T4
**Reuses**: `lib/supabase/client.ts`
**Requirement**: AUTH-01, AUTH-02, AUTH-03, AUTH-04

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Campo obrigatório em branco → submit bloqueado no client, nenhuma chamada ao Supabase (verificar manualmente: DevTools Network, submeter vazio, confirmar 0 requisições)
- [ ] Credenciais inválidas → mensagem fixa "E-mail ou senha inválidos", sem diferenciar causa (verificar manualmente com usuário inexistente e com senha errada — mesma mensagem nos dois casos)
- [ ] Erro de rede simulado (ex.: Supabase URL inválida temporariamente) → mensagem de retry, formulário reabilitado
- [ ] Login válido → redireciona para `/`
- [ ] Gate check passa: `npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(auth): implementa tela de login`

---

### T11: `LogoutButton` [P]

**What**: `components/auth/LogoutButton.tsx` — client component que chama `supabase.auth.signOut()` e então `router.push('/login')` + `router.refresh()`.
**Where**: `components/auth/LogoutButton.tsx`
**Depends on**: T4
**Reuses**: `lib/supabase/client.ts`
**Requirement**: AUTH-13, AUTH-14

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Clique aciona `signOut()` e redireciona para `/login`
- [ ] Gate check passa: `npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(auth): implementa botão de logout`

---

### T12: `UserBadge`

**What**: `components/layout/UserBadge.tsx` (server component) — chama `authService.getSessionUser()` e renderiza `nome` + rótulo legível do `role` (`SOLICITANTE`→"Solicitante", `GESTOR`→"Gestor", `RH_ADMIN`→"RH Admin").
**Where**: `components/layout/UserBadge.tsx`
**Depends on**: T9
**Reuses**: `authService.getSessionUser()`
**Requirement**: AUTH-19, AUTH-20

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Renderiza `nome` do usuário autenticado
- [ ] Renderiza rótulo legível do `role` (não o valor bruto do enum)
- [ ] Gate check passa: `npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(auth): implementa UserBadge de identidade do usuário`

---

### T13: `scripts/seed-users.ts` [P]

**What**: Script standalone que cria usuários no Supabase Auth (`admin.createUser`, service role key) e depois chama `userService.provisionar` com o mesmo `id` retornado, resolvendo `gestor_email → gestor_id` antes de cada chamada (RH_ADMIN sem `gestor_email` primeiro).
**Where**: `scripts/seed-users.ts`
**Depends on**: T7
**Reuses**: `userService.provisionar`
**Requirement**: fundação operacional para os "Independent Test" de `spec.md`

**Tools**:
- MCP: NONE (WebSearch/WebFetch se precisar confirmar API de `supabase.auth.admin.createUser`)
- Skill: NONE

**Done when**:
- [ ] Lista hardcoded/config de usuários cobre os 3 papéis, com hierarquia coerente (≥1 RH_ADMIN sem gestor, ≥1 GESTOR, ≥1 SOLICITANTE apontando pro GESTOR)
- [ ] Executar `npm run seed` contra um projeto Supabase de teste cria os usuários no Auth e os `User` correspondentes no banco, sem erro
- [ ] Rodar o script duas vezes não duplica usuários (idempotência básica — ex.: `email` já existe → pula ou reporta, não quebra)
- [ ] Gate check passa: `npm run build`

**Tests**: none
**Gate**: build

**Verify**: rodar `npm run seed` manualmente contra ambiente de teste e inspecionar as tabelas `auth.users` e `User`.

**Commit**: `feat(auth): implementa script de seed de usuários`

---

### T14: Integração final — home protegida + verificação manual ponta a ponta

**What**: Página `/` protegida (o middleware de T6 já cobre) com `UserBadge` (T12) e `LogoutButton` (T11) num layout compartilhado; execução do roteiro manual de ponta a ponta cobrindo login, persistência de sessão, expiração, logout e exibição de identidade.
**Where**: `app/layout.tsx` ou `app/page.tsx` (modificar)
**Depends on**: T6, T10, T11, T12, T13
**Reuses**: todos os componentes/serviços das tasks anteriores
**Requirement**: AUTH-01, AUTH-09, AUTH-10, AUTH-11, AUTH-12, AUTH-13, AUTH-14, AUTH-19, AUTH-20

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Rodar `npm run seed`, logar com um usuário provisionado → chega em `/` autenticado, `UserBadge` mostra nome e papel corretos
- [ ] Sem sessão, acessar `/` direto na URL → redirect para `/login`, conteúdo não renderiza
- [ ] Recarregar `/` após login → sessão persiste, sem novo login
- [ ] Invalidar/expirar a sessão (ex.: apagar cookie ou aguardar expiração) e navegar → redirect para `/login`
- [ ] Clicar "Sair" → volta para `/login`; tentar acessar `/` de novo → redirect (AUTH-14)
- [ ] Chamar uma rota `/api/*` qualquer sem sessão (ex.: `curl` sem cookie) → 401 JSON
- [ ] Gate check passa: `npm run build && npx prisma validate && npm run test`

**Tests**: none (integração — coberta pelo roteiro manual acima; unit tests de cada peça já rodam no gate `full`)
**Gate**: full

**Verify**: seguir o roteiro do `Done when` item a item e registrar o resultado no resumo da task, conforme convenção do `CLAUDE.md` para mudanças de autorização/fluxo.

**Commit**: `feat(auth): home protegida com exibição de identidade e fluxo completo de auth`

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T1

Phase 2 (Parallel):
  T1 done, then:
    ├── T2 [P]
    └── T4 [P]

Phase 3 (Parallel):
  T2 done → T3 [P]
  T4 done → T5 [P], T10 [P], T11 [P]

Phase 4 (Parallel):
  T5 done      → T6 [P]
  T2,T3 done   → T7 [P]
  T2,T3 done   → T8 [P]

Phase 5 (Parallel):
  T2,T3,T4,T8 done → T9 [P]
  T7 done          → T13 [P]

Phase 6 (Sequential):
  T9 done → T12

Phase 7 (Sequential):
  T6, T10, T11, T12, T13 done → T14
```

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Scaffold Next.js + tooling | 1 setup coeso (config only, sem lógica) | ✅ Granular |
| T2: Prisma init | 2 arquivos, 1 concern (client singleton) | ✅ Granular |
| T3: `User` model + `Role` enum | 1 arquivo, 1 model | ✅ Granular |
| T4: Supabase clients | 2 arquivos, 1 concern (client factory) | ✅ Granular |
| T5: Supabase middleware helper | 1 arquivo, 1 função | ✅ Granular |
| T6: `middleware.ts` | 1 arquivo, 1 função de decisão | ✅ Granular |
| T7: `userService.provisionar` | 1 arquivo, 1 função | ✅ Granular |
| T8: `Log` model + `logService.registrar` | 2 arquivos, 1 concern (contrato de log) | ✅ Granular |
| T9: `authService` | 1 arquivo, 2 funções relacionadas | ✅ Granular |
| T10: Login page + `LoginForm` | 2 arquivos, 1 concern (tela de login) | ✅ Granular |
| T11: `LogoutButton` | 1 componente | ✅ Granular |
| T12: `UserBadge` | 1 componente | ✅ Granular |
| T13: `scripts/seed-users.ts` | 1 script | ✅ Granular |
| T14: Integração final | 1 concern (wiring + verificação), sem código de negócio novo | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | (raiz da Phase 1) | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | T1 | T1 → T4 | ✅ Match |
| T5 | T4 | T4 → T5 | ✅ Match |
| T6 | T5 | T5 → T6 | ✅ Match |
| T7 | T2, T3 | T2,T3 → T7 | ✅ Match |
| T8 | T2, T3 | T2,T3 → T8 | ✅ Match |
| T9 | T2, T3, T4, T8 | T2,T3,T4,T8 → T9 | ✅ Match |
| T10 | T4 | T4 → T10 | ✅ Match |
| T11 | T4 | T4 → T11 | ✅ Match |
| T12 | T9 | T9 → T12 | ✅ Match |
| T13 | T7 | T7 → T13 | ✅ Match |
| T14 | T6, T10, T11, T12, T13 | T6,T10,T11,T12,T13 → T14 | ✅ Match |

Nenhum par marcado `[P]` depende um do outro dentro da mesma phase (checado: T2/T4; T3/T5/T10/T11; T6/T7/T8; T9/T13) — todos ✅. Nenhum par `[P]` escreve no mesmo arquivo dentro da mesma phase (T3 escreve `schema.prisma` isoladamente na Phase 3; T8 volta a tocar `schema.prisma` só na Phase 4, depois de T3 já ter fechado — sem concorrência real).

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1: Scaffold | tooling/config | none | none | ✅ OK |
| T2: Prisma init | `prisma/schema.prisma` | none | none | ✅ OK |
| T3: `User` model | `prisma/schema.prisma` | none | none | ✅ OK |
| T4: Supabase clients | `lib/supabase/*.ts` (wrapper fino) | none | none | ✅ OK |
| T5: middleware helper | `lib/supabase/middleware.ts` (wrapper fino) | none | none | ✅ OK |
| T6: `middleware.ts` | middleware (decisão de negócio) | unit | unit | ✅ OK |
| T7: `userService` | `lib/services/*.ts` | unit | unit | ✅ OK |
| T8: `logService` + `Log` model | `lib/services/*.ts` + schema | unit | unit | ✅ OK |
| T9: `authService` | `lib/services/*.ts` | unit | unit | ✅ OK |
| T10: Login page/form | Componente de UI | none | none | ✅ OK |
| T11: `LogoutButton` | Componente de UI | none | none | ✅ OK |
| T12: `UserBadge` | Componente de UI | none | none | ✅ OK |
| T13: seed script | `scripts/*.ts` (standalone, muta estado externo) | none | none | ✅ OK |
| T14: Integração | wiring, sem lógica nova | none (coberto por unit tests já existentes no gate `full`) | none | ✅ OK |

Nenhuma violação — nenhuma task usa "testado em outra task" como justificativa; toda camada com `unit` na matrix escreve seus testes na própria task que a cria (T6, T7, T8, T9).

---

## Requirement Traceability (atualização)

Todos os 20 requisitos `AUTH-01`..`AUTH-20` de `spec.md` estão mapeados nas tasks acima (ver campo `Requirement` de cada task). Ao iniciar a execução, atualizar `spec.md` mudando o `Status` de cada `AUTH-NN` de `In Design` para `In Tasks`.

| Requirement | Task(s) |
| --- | --- |
| AUTH-01 | T10, T14 |
| AUTH-02 | T10 |
| AUTH-03 | T10 |
| AUTH-04 | T3 |
| AUTH-05 | T3, T7 |
| AUTH-06 | T9 |
| AUTH-07 | T8, T9 |
| AUTH-08 | T3, T7 |
| AUTH-09 | T6, T14 |
| AUTH-10 | T6, T14 |
| AUTH-11 | T6, T14 |
| AUTH-12 | T6, T14 |
| AUTH-13 | T11, T14 |
| AUTH-14 | T11, T14 |
| AUTH-15 | T7 |
| AUTH-16 | T7 |
| AUTH-17 | T7 |
| AUTH-18 | T9 |
| AUTH-19 | T12, T14 |
| AUTH-20 | T12, T14 |

Coverage: 20/20 requisitos mapeados para pelo menos 1 task.

---

## Riscos carregados de `design.md`

- **API do `@supabase/ssr`**: não confirmada em código existente (projeto greenfield). T4 exige verificação na documentação oficial antes de codar — não fabricar assinatura de função.
- **Cross-feature `logService`**: `auditoria-logs` ainda está em status `Pending` (spec, sem design). T8 cria a versão mínima real do contrato AUD-01/02/03 (com persistência de fato, não um stub no-op) para não bloquear AUTH-07; quando `auditoria-logs` for desenhada/implementada, ela deve **estender** `lib/services/logService.ts` e o `model Log`, não recriá-los.
