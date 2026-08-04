# Integrar Login Google Tasks

**Design**: `.specs/features/integrar-login-google/design.md`
**Status**: Ready for execution

---

## Convenção de Testes (herdada de `botao-ajuda-github/tasks.md` — sem `.specs/codebase/TESTING.md`)

| Tipo de código | Teste exigido | Gate |
| --- | --- | --- |
| Função/serviço em `lib/**` (I/O mockado) | `unit` (vitest, mesmo padrão de `authService.test.ts`/`userService.test.ts`) | `npm run test` |
| `middleware.ts` (config + handler) | `unit` (mesmo padrão de `middleware.test.ts` já existente) | `npm run test` |
| Componente React (`app/**`) | Nenhum teste automatizado (sem infra de DOM no projeto) | `npm run build` + roteiro manual |
| Route Handler (`app/api/**/route.ts`) | Nenhum teste automatizado (convenção do projeto — só `cron/sla-check` tem `route.test.ts`; lógica de negócio já coberta nos services) | `npm run build` |

---

## Execution Plan

### Phase 1: Foundation (Parallel OK)

```
T1 [P] ──┐
T2 [P] ──┤
T3 [P] ──┼──→ (Phase 2)
T4 [P] ──┤
T5 [P] ──┘
```

### Phase 2 (depende de Phase 1)

```
T1, T4 completos, então:
  T6

T2, T5 completos, então:
  T7
```

### Phase 3 (depende de Phase 2)

```
T1, T5, T7 completos, então:
  T8

T1, T2, T3 completos, então:
  T9
```

### Phase 4 (depende de Phase 3)

```
T6 completo, então:
  T10
```

---

## Task Breakdown

### T1: `authService.ts` — `emailDominioValido`, `getSupabaseUser`, `autenticarComGoogle` [P]

**What**: Três adições ao arquivo existente (nenhuma função atual é alterada):
`emailDominioValido(email)` (checa sufixo `@01tec.com.br`, case-insensitive);
`getSupabaseUser()` (sessão Supabase sem exigir `User` no Prisma — `nome` via
`user_metadata.full_name ?? user_metadata.name ?? email`); `autenticarComGoogle(supabaseUser)`
retornando `{status: "permitido" | "onboarding_equipe" | "negado"}` (domínio/e-mail não
verificado → `negado`; `User` já existe → `permitido`; não existe → `onboarding_equipe`).
**Where**: `lib/services/authService.ts` (+ casos novos em `authService.test.ts`)
**Depends on**: None
**Reuses**: `createServerClient` (`lib/supabase/server.ts`), `prisma.user.findUnique` (mesmo padrão de `getSessionUser`)
**Requirement**: GAUTH-02, GAUTH-05 (via decisão de design — sem lógica de correlação), GAUTH-07, GAUTH-10, Edge case (e-mail não verificado)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `emailDominioValido("Fulano@01TEC.com.br")` → `true`; `emailDominioValido("fulano@gmail.com")` → `false`; `emailDominioValido(undefined)` → `false`
- [ ] `getSupabaseUser()` retorna `null` sem sessão; retorna `{id, email, nome}` com sessão válida, usando fallback de `nome` quando `user_metadata` não tem `full_name`
- [ ] `autenticarComGoogle` retorna `"negado"` para domínio fora de `@01tec.com.br` e para `email_confirmed_at`/`user_metadata.email_verified` ausente/falso, **sem** consultar o Prisma nesses casos (short-circuit)
- [ ] `autenticarComGoogle` retorna `"permitido"` quando `prisma.user.findUnique` encontra o `id`, e `"onboarding_equipe"` quando não encontra
- [ ] `npm run test` passa
- [ ] Test count: pelo menos 8 casos novos (2-3 por função)

**Tests**: unit
**Gate**: quick (`npm run test`)

**Commit**: `feat(login-google): adiciona autenticarComGoogle e getSupabaseUser em authService`

---

### T2: `lib/validations/onboarding.ts` [P]

**What**: `onboardingEquipeInputSchema` — `equipe_id: z.string().trim().min(1)` (é `cuid()`,
não `uuid` — não reusar `.uuid()` de `equipeInputSchema.gestor_id`, que valida `User.id`).
**Where**: `lib/validations/onboarding.ts` (+ `.test.ts`)
**Depends on**: None
**Reuses**: Estilo de `lib/validations/equipe.ts`
**Requirement**: GAUTH-10

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `equipe_id` vazio/ausente → erro de validação Zod
- [ ] `equipe_id` com string não-vazia → válido (não exige formato UUID)
- [ ] `npm run test` passa
- [ ] Test count: pelo menos 3 casos

**Tests**: unit
**Gate**: quick (`npm run test`)

**Commit**: `feat(login-google): adiciona onboardingEquipeInputSchema`

---

### T3: `userService.ts` — `provisionarViaGoogle` [P]

**What**: Nova função que reusa `provisionar` (mesma validação de `equipe_id` já
existente) para o auto-cadastro via Google: idempotente se o `User` já existir (retorna
sem gravar `Log` de novo); trata corrida de duas requisições simultâneas (`P2002` →
re-`findUnique` por `id` → retorna se a outra requisição já criou, repropaga senão);
grava `Log AUDITORIA` (`acao: "CRIACAO_AUTO_GOOGLE"`) só na criação nova.
**Where**: `lib/services/userService.ts` (+ casos novos em `userService.test.ts`)
**Depends on**: None
**Reuses**: `provisionar` (mesmo arquivo), `registrar` (`logService`)
**Requirement**: GAUTH-07, GAUTH-08, Edge case (corrida de criação simultânea)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `User` inexistente + `equipe_id` válido/ativo → cria via `provisionar`, grava `Log AUDITORIA` com `acao: "CRIACAO_AUTO_GOOGLE"` e `usuario_id: null`
- [ ] `User` já existente (mesmo `id`) → retorna o registro existente, **sem** chamar `provisionar` nem `registrar` de novo
- [ ] `equipe_id` inválido/inativo → propaga `ErroValidacaoUsuario` de `provisionar` (sem tratamento especial)
- [ ] Simulação de corrida (`provisionar` lança `P2002`/`ErroValidacaoUsuario` de e-mail duplicado, segundo `findUnique` encontra o registro) → retorna o registro em vez de lançar
- [ ] `npm run test` passa
- [ ] Test count: pelo menos 4 casos

**Tests**: unit
**Gate**: quick (`npm run test`)

**Commit**: `feat(login-google): adiciona userService.provisionarViaGoogle`

---

### T4: Middleware — excluir `/auth/callback` do matcher [P]

**What**: Adicionar `auth/callback` à mesma exclusão negativa de `/login` no
`config.matcher` de `middleware.ts`. Sem handler novo — o comportamento de
`middleware()` em si não muda, só o que é interceptado.
**Where**: `middleware.ts` (modificar), `middleware.test.ts` (modificar)
**Depends on**: None
**Reuses**: N/A
**Requirement**: GAUTH-01, GAUTH-03 (pré-requisito técnico — sem isso o callback nunca roda)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `config.matcher` exclui `https://example.com/auth/callback` (via `unstable_doesMiddlewareMatch`)
- [ ] Continua excluindo `/login` e os assets estáticos já cobertos (sem regressão)
- [ ] Continua interceptando páginas normais e `/api/*` (sem regressão)
- [ ] `npm run test` passa

**Tests**: unit
**Gate**: quick (`npm run test`)

**Commit**: `feat(login-google): exclui /auth/callback do matcher do middleware`

---

### T5: `equipe-onboarding.module.css` [P]

**What**: CSS Module para a tela de seleção obrigatória de equipe — reusa os tokens já
definidos em `app/globals.css` (`--azul-*`, `--linha`, `--radius`, `--shadow`,
`--font-fraunces`, `--font-inter`) e a estrutura visual de `login.module.css`
(`.screen`/`.card`/`.formWrap`/`.field`/`.input`/`.submit`/`.error`), sem duplicar
classes idênticas — só as que são específicas desta tela (`<select>` de equipe, link
"Sair").
**Where**: `app/onboarding/equipe/equipe-onboarding.module.css`
**Depends on**: None
**Reuses**: Tokens de `app/globals.css`; estrutura de `app/login/login.module.css`
**Requirement**: GAUTH-10

**Tools**:
- MCP: NONE
- Skill: `frontend-design`, `ui-ux-pro-max` (garantir consistência visual com a tela de Login antes de fechar o CSS)

**Done when**:
- [ ] Classes cobrem: contêiner centralizado (`.screen`/`.card` ou reuso direto do padrão de `login.module.css`), título, `<select>` de equipe com label, botão "Confirmar" (variante do `.submit`), mensagem de erro inline, link "Sair" discreto
- [ ] `npm run build` sem erros

**Tests**: none
**Gate**: build (`npm run build`)

**Commit**: `feat(login-google): adiciona equipe-onboarding.module.css`

---

### T6: `app/auth/callback/route.ts`

**What**: `GET` que troca o `code` OAuth por sessão (`exchangeCodeForSession`) e decide o
redirect com base em `autenticarComGoogle`: sem `code`/erro na troca → `/login?erro=google`;
`"negado"` → `signOut()` + `/login?erro=dominio`; `"permitido"` → `/`; `"onboarding_equipe"`
→ `/onboarding/equipe`.
**Where**: `app/auth/callback/route.ts`
**Depends on**: T1 (`autenticarComGoogle`), T4 (sem a exclusão do matcher, esta rota nunca executa)
**Reuses**: `createServerClient` (`lib/supabase/server.ts`), `authService.autenticarComGoogle`
**Requirement**: GAUTH-01, GAUTH-02, GAUTH-03, Edge case (cancelamento do consentimento)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Sem `code` na query (ou `error=` presente, caso de cancelamento) → redirect para `/login?erro=google` sem chamar Supabase
- [ ] `exchangeCodeForSession` retorna erro → redirect para `/login?erro=google`
- [ ] `autenticarComGoogle` retorna `"negado"` → `supabase.auth.signOut()` chamado **antes** do redirect para `/login?erro=dominio`
- [ ] `autenticarComGoogle` retorna `"permitido"` → redirect para `/`
- [ ] `autenticarComGoogle` retorna `"onboarding_equipe"` → redirect para `/onboarding/equipe`
- [ ] `npm run build` sem erros

**Tests**: none (route handler, ver convenção de testes acima)
**Gate**: build (`npm run build`)

**Commit**: `feat(login-google): adiciona app/auth/callback/route.ts`

---

### T7: `EquipeOnboardingForm.tsx`

**What**: Componente client com `<select>` de equipes ativas (recebido via prop) +
"Confirmar" (obrigatório, sem opção de pular) + link "Sair" (`signOut()` +
`router.push('/login')`). Submit chama `POST /api/onboarding/equipe`; sucesso →
`router.push('/')` + `router.refresh()`; erro → mensagem inline, formulário preservado.
**Where**: `app/onboarding/equipe/EquipeOnboardingForm.tsx`
**Depends on**: T2 (formato de `{ equipe_id }` consumido pela rota que este form chama), T5 (`equipe-onboarding.module.css`)
**Reuses**: Padrão de estados `carregando`/`erro` de `app/login/LoginForm.tsx`; `createBrowserClient` (`lib/supabase/client.ts`) só para o "Sair"
**Requirement**: GAUTH-10

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `<select required>` bloqueia submit sem equipe selecionada (nenhuma chamada de rede)
- [ ] Submit válido → `POST /api/onboarding/equipe` com `{ equipe_id }`; sucesso (`201`) → `router.push('/')` + `router.refresh()`
- [ ] Erro (`400`) → mensagem inline (equipe inválida/inativa), formulário reabilitado, **sem** redirect
- [ ] "Sair" → `signOut()` + `router.push('/login')`
- [ ] `npm run build` sem erros

**Tests**: none
**Gate**: build (`npm run build`)

**Commit**: `feat(login-google): adiciona EquipeOnboardingForm`

---

### T8: `app/onboarding/equipe/page.tsx`

**What**: Server component — `getSupabaseUser()` (`null` → `redirect('/login')`);
`prisma.user.findUnique({ id })` já existe → `redirect('/')`; senão →
`equipeService.listarAtivasParaSelecao()` → renderiza `<EquipeOnboardingForm equipes={...} />`.
**Where**: `app/onboarding/equipe/page.tsx`
**Depends on**: T1 (`getSupabaseUser`), T5 (CSS), T7 (renderiza `EquipeOnboardingForm`)
**Reuses**: `authService.getSupabaseUser`, `equipeService.listarAtivasParaSelecao` (sem alteração), `lib/prisma.ts`
**Requirement**: GAUTH-10

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Sem sessão Supabase → `redirect('/login')`
- [ ] Sessão Supabase + `User` já existente para esse `id` → `redirect('/')` (não mostra o formulário de novo)
- [ ] Sessão Supabase + sem `User` → renderiza `EquipeOnboardingForm` com a lista de equipes ativas
- [ ] `npm run build` sem erros

**Tests**: none
**Gate**: build (`npm run build`)

**Commit**: `feat(login-google): adiciona app/onboarding/equipe/page.tsx`

---

### T9: `app/api/onboarding/equipe/route.ts`

**What**: `POST` — `getSupabaseUser()` (`null` → `401`); defesa em profundidade
(`!emailDominioValido` → `403`); `onboardingEquipeInputSchema` (inválido → `400`);
`provisionarViaGoogle` (`ErroValidacaoUsuario` → `400`; sucesso → `201 { usuario }`).
**Where**: `app/api/onboarding/equipe/route.ts`
**Depends on**: T1 (`getSupabaseUser`, `emailDominioValido`), T2 (`onboardingEquipeInputSchema`), T3 (`provisionarViaGoogle`)
**Reuses**: Formato de erro `{ error }`/`{ error, detalhes }` já usado em `app/api/equipes/route.ts`
**Requirement**: GAUTH-07, GAUTH-08, GAUTH-10

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Sem sessão Supabase → `401`, sem tocar Zod nem `userService`
- [ ] Sessão com e-mail fora de `@01tec.com.br` (defesa em profundidade) → `403`
- [ ] Corpo inválido (`equipe_id` ausente) → `400`, `provisionarViaGoogle` nunca é chamado
- [ ] `equipe_id` inválido/inativo → `400` com a mensagem de `ErroValidacaoUsuario`
- [ ] `equipe_id` válido → `201 { usuario }`
- [ ] `npm run build` sem erros

**Tests**: none (route handler, ver convenção de testes acima)
**Gate**: build (`npm run build`)

**Commit**: `feat(login-google): adiciona app/api/onboarding/equipe/route.ts`

---

### T10: `LoginForm.tsx` + `login/page.tsx` + `login.module.css` — botão "Entrar com Google"

**What**: Botão que chama `signInWithOAuth({ provider: 'google', options: { redirectTo:
\`${origin}/auth/callback\`, queryParams: { hd: '01tec.com.br', prompt: 'select_account'
} } })`; `login/page.tsx` passa a aceitar `searchParams: Promise<{ erro?: string }>`,
resolve a mensagem (`"google"` → erro genérico de conexão; `"dominio"` → "Use uma conta
Google @01tec.com.br.") e repassa como prop `erroInicial` para `LoginForm`. Novas classes
`.divider`/`.googleButton` em `login.module.css` (variante outline do `.submit`
existente).
**Where**: `app/login/LoginForm.tsx` (modificar), `app/login/page.tsx` (modificar), `app/login/login.module.css` (modificar)
**Depends on**: T6 (o botão só faz sentido apontando pra um callback que já existe — dependência funcional, sem import direto)
**Reuses**: `createBrowserClient` (já usado por `signInWithPassword`), estado `erro`/`carregando` já existente em `LoginForm`
**Requirement**: GAUTH-01, GAUTH-04 (zero regressão no login por senha)

**Tools**:
- MCP: NONE
- Skill: `frontend-design`, `ui-ux-pro-max` (posicionamento/hierarquia do botão Google vs. o formulário de senha)

**Done when**:
- [ ] Botão "Entrar com Google" visível abaixo do formulário de senha, com separador visual ("ou")
- [ ] Clique chama `signInWithOAuth` com o `redirectTo` e `queryParams.hd` corretos — navega o browser inteiro (sem `preventDefault` de submit, já que não é um `<form>`)
- [ ] `?erro=google`/`?erro=dominio` na URL de `/login` exibem a mensagem correta via `erroInicial`
- [ ] Login por e-mail/senha continua funcionando exatamente como antes — nenhuma linha do handler `handleSubmit` existente foi alterada (GAUTH-04)
- [ ] `npm run build` sem erros
- [ ] Roteiro de teste manual (documentar no resumo da task): com o provider Google configurado no Supabase (pré-requisito externo, ver `design.md` "Riscos"), clicar no botão, autenticar com conta `@01tec.com.br` de teste sem `User` prévio → cair em `/onboarding/equipe`; selecionar equipe → chegar em `/`; repetir login (mesma conta, agora já com `User`) → cair direto em `/`; testar com conta fora do domínio → voltar para `/login?erro=dominio`, sem sessão persistida; confirmar login por senha ainda funciona

**Tests**: none
**Gate**: build (`npm run build`)

**Commit**: `feat(login-google): adiciona botão Entrar com Google no Login`

---

## Parallel Execution Map

```
Phase 1 (Parallel):
  T1 [P] ── authService: emailDominioValido, getSupabaseUser, autenticarComGoogle
  T2 [P] ── onboardingEquipeInputSchema
  T3 [P] ── userService.provisionarViaGoogle
  T4 [P] ── middleware matcher (auth/callback)
  T5 [P] ── equipe-onboarding.module.css

Phase 2 (Sequential dentro de cada ramo):
  T1, T4 completos, então: T6 (callback route)
  T2, T5 completos, então: T7 (EquipeOnboardingForm)

Phase 3 (Sequential):
  T1, T5, T7 completos, então: T8 (onboarding page)
  T1, T2, T3 completos, então: T9 (onboarding API route)

Phase 4 (Sequential):
  T6 completo, então: T10 (botão Google no Login)
```

**Nota**: T8 depende de T7 porque a página renderiza o componente (mesma lógica de
`HelpButton`/`HelpModal` em `botao-ajuda-github/tasks.md`). T9 não depende de T7/T8 —
a rota de API não importa nada da página/formulário, só dos services/validação de T1-T3.
T10 depende só funcionalmente de T6 (aponta o `redirectTo` para uma rota que precisa
existir para o fluxo fazer sentido em teste manual), não via import.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: `authService.ts` (3 funções relacionadas) | 1 arquivo, mesma responsabilidade (resolução de identidade Google) | ✅ Granular (coeso, mesmo padrão de `getSessionUser`/`requireUser` no mesmo arquivo) |
| T2: `onboarding.ts` (validação) | 1 arquivo | ✅ Granular |
| T3: `userService.provisionarViaGoogle` | 1 função nova em arquivo existente | ✅ Granular |
| T4: middleware matcher | 1 linha de config + teste | ✅ Granular |
| T5: CSS Module | 1 arquivo | ✅ Granular |
| T6: callback route | 1 arquivo | ✅ Granular |
| T7: `EquipeOnboardingForm` | 1 componente | ✅ Granular |
| T8: onboarding page | 1 arquivo | ✅ Granular |
| T9: onboarding API route | 1 arquivo | ✅ Granular |
| T10: botão Google no Login | 3 arquivos, mesma feature de UI coesa (botão + página + CSS) | ✅ Granular (mesmo padrão de coesão aceito em T3 de `botao-ajuda-github`) |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagrama Mostra | Status |
| --- | --- | --- | --- |
| T1 | None | Fase 1, sem seta de entrada | ✅ Match |
| T2 | None | Fase 1, sem seta de entrada | ✅ Match |
| T3 | None | Fase 1, sem seta de entrada | ✅ Match |
| T4 | None | Fase 1, sem seta de entrada | ✅ Match |
| T5 | None | Fase 1, sem seta de entrada | ✅ Match |
| T6 | T1, T4 | Seta de "T1, T4 completos" para T6 | ✅ Match |
| T7 | T2, T5 | Seta de "T2, T5 completos" para T7 | ✅ Match |
| T8 | T1, T5, T7 | Seta de "T1, T5, T7 completos" para T8 | ✅ Match |
| T9 | T1, T2, T3 | Seta de "T1, T2, T3 completos" para T9 | ✅ Match |
| T10 | T6 | Seta de "T6 completo" para T10 | ✅ Match |

---

## Test Co-location Validation

| Task | Código Criado/Modificado | Matriz Exige | Task Diz | Status |
| --- | --- | --- | --- | --- |
| T1 | Funções em `lib/services/authService.ts` | unit | unit | ✅ OK |
| T2 | Schema em `lib/validations/onboarding.ts` | unit | unit | ✅ OK |
| T3 | Função em `lib/services/userService.ts` | unit | unit | ✅ OK |
| T4 | `middleware.ts` (config) | unit | unit | ✅ OK |
| T5 | CSS Module | none | none | ✅ OK |
| T6 | Route Handler | none | none | ✅ OK |
| T7 | Componente React | none | none | ✅ OK |
| T8 | Server Component | none | none | ✅ OK |
| T9 | Route Handler | none | none | ✅ OK |
| T10 | Componentes React + CSS | none | none | ✅ OK |

---

## Ferramentas por Task — Confirmar com o Usuário

Nenhuma task exige MCP externo. Skills recomendadas: `frontend-design`/`ui-ux-pro-max` em
T5 (CSS da tela de onboarding) e T10 (posicionamento do botão Google no Login), para
manter consistência visual com o restante do produto. Nenhuma outra skill/MCP é
necessária para T1-T4/T6-T9.

**Antes de executar**: confirmar o pré-requisito de infraestrutura fora do repositório —
provider Google habilitado no painel do Supabase + OAuth client no Google Cloud Console
com os redirect URIs corretos (Questão em Aberto 2 do `spec.md`, detalhado em
`design.md` "Riscos"). Sem isso, T1-T9 podem ser implementadas e testadas via unit
tests/build normalmente, mas o roteiro de teste manual end-to-end de T10 fica bloqueado
até a configuração externa existir.
