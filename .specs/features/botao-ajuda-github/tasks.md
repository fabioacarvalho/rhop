# Botão de Ajuda com Abertura de Issue no GitHub Tasks

**Design**: `.specs/features/botao-ajuda-github/design.md`
**Status**: Done — V1 (T1-T6) implementada e depois substituída por V2 (T7-T13) a pedido explícito do usuário. Ver "Verificação Final" (V1) e "Verificação Final V2" (abaixo).

---

## Convenção de Testes (inferida — não existe `.specs/codebase/TESTING.md`)

Não há matriz de cobertura documentada no projeto. Inferido a partir do código existente (`vitest.config.mts` roda só `environment: "node"`, sem `jsdom`/Testing Library instalado; `lib/navigation/navConfig.test.ts` e `middleware.test.ts` só testam funções puras):

| Tipo de código | Teste exigido | Gate |
| --- | --- | --- |
| Função pura em `lib/**` (sem DOM, sem I/O) | `unit` (vitest) | `npm run test` |
| Componente React (`components/**`, `app/**`) | Nenhum teste automatizado (sem infra de DOM no projeto) | `npm run build` + roteiro de teste manual descrito na task |

Isso é consistente com o próprio `menu-navegacao/design.md` (seus componentes `Sidebar`/`Topbar`/`AppShell` também não listam testes automatizados, só `navConfig.ts` tem `.test.ts`).

---

## Execution Plan

### Phase 1: Foundation (Parallel OK)

```
T1 [P] ──┐
T2 [P] ──┼──→ (Phase 2)
T6 [P] ──┘
```

### Phase 2: Core Implementation (Sequential — cada um consome o anterior)

```
T1, T2 completos, então:
  T3 ──→ T4
```

### Phase 3: Integration (Sequential)

```
T4 completo, então:
  T5
```

---

## Task Breakdown

### T1: Criar função pura `buildGithubIssueUrl` [P] — ✅ Complete

**What**: Função pura que monta a URL de `.../issues/new` (título `[tipo] titulo-ou-"(sem título)"`, corpo com tipo/tela/papel/descrição, sem e-mail/nome).
**Where**: `lib/helpers/githubIssue.ts` (+ `lib/helpers/githubIssue.test.ts`)
**Depends on**: None
**Reuses**: `Role` (`lib/generated/prisma/client`) só como tipo do parâmetro `papel`
**Requirement**: HELP-04, HELP-06, HELP-08

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `buildGithubIssueUrl(input)` retorna uma URL válida com `title`/`body` codificados via `encodeURIComponent`
- [ ] Título vazio/só espaços vira `"(sem título)"` no `title` final (HELP-06)
- [ ] Corpo contém exatamente tipo, tela, papel e descrição — assinatura da função não aceita e-mail nem nome, então é impossível o teste assar esses campos (HELP-08)
- [ ] `npm run test` passa
- [ ] Test count: pelo menos 4 casos (URL básica; título vazio → padrão; caracteres especiais/acentos codificados corretamente; papel refletido no corpo)

**Tests**: unit
**Gate**: quick (`npm run test`)

**Commit**: `feat(ajuda): adiciona buildGithubIssueUrl`

---

### T2: Criar `ajuda.module.css` [P] — ✅ Complete

**What**: CSS Module portando `.help-fab`, `.modal-overlay`, `.modal-card`, `.modal-head`, `.modal-close`, `.modal-body` do mockup, mais classes novas para o aviso de dados sensíveis e o fallback de link (não existentes no mockup).
**Where**: `components/ajuda/ajuda.module.css`
**Depends on**: None
**Reuses**: tokens de `app/globals.css` (`--azul-800`, `--azul-900`, `--amarelo-600`, `--linha`, `--radius`, `--shadow`, `--font-fraunces`, `--font-inter`, `--font-ibm-plex-mono`); estrutura de `.btn`/`.btnPrimary`/`.btnGhost`/`.field` de `app/(dashboard)/aprovacoes/aprovacoes.module.css`
**Requirement**: HELP-01, HELP-02, HELP-09, HELP-10

**Tools**:

- MCP: NONE
- Skill: `frontend-design`, `ui-ux-pro-max` (garantir hierarquia visual/consistência com o design system antes de fechar o CSS)

**Done when**:

- [ ] `.fab` reproduz `docs/design-ux-ui/fluxorh-mockup.html` linhas 437-443 (posição fixa, círculo, borda amarela)
- [ ] `.overlay`/`.modalCard`/`.modalHead`/`.modalClose`/`.modalBody` reproduzem linhas 444-458
- [ ] Classe nova `.aviso` para o texto "não inclua dados pessoais..." (HELP-09) — estilo coerente com avisos existentes no produto (ex.: tom `--ink-soft`, tamanho pequeno)
- [ ] Classe nova `.fallbackLink` para o link copiável quando o pop-up é bloqueado (HELP-10)
- [ ] `npm run build` sem erros

**Tests**: none
**Gate**: build (`npm run build`)

**Commit**: `feat(ajuda): adiciona ajuda.module.css`

---

### T6: Adicionar `NEXT_PUBLIC_GITHUB_REPO` ao `.env.example` [P] — ✅ Complete

**What**: Documentar a nova variável de ambiente pública com placeholder e comentário explicativo, seguindo o padrão das demais entradas do arquivo.
**Where**: `.env.example` (modificar)
**Depends on**: None
**Reuses**: Formato de comentário já usado nas outras variáveis (`NEXT_PUBLIC_SUPABASE_URL`, etc.)
**Requirement**: N/A (infraestrutura, seção 8 do PRD)

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Linha `NEXT_PUBLIC_GITHUB_REPO=sua-org/rhop` adicionada com comentário explicando o uso (montagem da URL de issue, sem token envolvido)
- [ ] Nenhuma outra variável existente é alterada

**Tests**: none
**Gate**: none (revisão manual do arquivo)

**Commit**: `chore(ajuda): documenta NEXT_PUBLIC_GITHUB_REPO`

---

### T3: Criar `HelpModal.tsx` — ✅ Complete

**What**: Componente client com formulário (tipo/título/descrição), tela atual somente leitura (via `resolveScreenTitle` + `usePathname`), aviso de dados sensíveis, montagem/abertura da URL (via `buildGithubIssueUrl`) e fallback de link copiável se `window.open` retornar falsy.
**Where**: `components/ajuda/HelpModal.tsx`
**Depends on**: T1, T2
**Reuses**: `resolveScreenTitle` (`lib/navigation/navConfig.ts`), `buildGithubIssueUrl` (`lib/helpers/githubIssue.ts`), `ajuda.module.css`
**Requirement**: HELP-02, HELP-03, HELP-04, HELP-05, HELP-06, HELP-07, HELP-09, HELP-10

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Modal exibe seletor de tipo (Bug/Melhoria/Dúvida, um ativo por vez), input de título, textarea de descrição e "Tela atual: {titulo}" somente leitura
- [ ] Aviso "não inclua dados pessoais ou de solicitações específicas" visível no corpo do modal
- [ ] Botão "Cancelar" e clique fora do card fecham o modal sem chamar `window.open` (HELP-07)
- [ ] Botão "Abrir issue no GitHub ↗" monta a URL via `buildGithubIssueUrl`, chama `window.open(url, '_blank')`, limpa título/descrição e fecha o modal em caso de sucesso (retorno truthy)
- [ ] Se `window.open` retornar `null`/`undefined`, o modal permanece aberto exibindo a URL como texto selecionável + botão "Copiar link" (`navigator.clipboard.writeText` em `try/catch`, falha silenciosa se a API não existir)
- [ ] `npm run build` sem erros
- [ ] Roteiro de teste manual (documentar no resumo da task, ver CLAUDE.md): abrir modal em uma tela do `(dashboard)`, preencher e confirmar → nova aba abre com título/corpo corretos; deixar título vazio → título vira "(sem título)"; cancelar → nenhuma aba abre; bloquear pop-up no navegador → fallback com link aparece

**Tests**: none
**Gate**: build (`npm run build`)

**Commit**: `feat(ajuda): adiciona HelpModal`

---

### T4: Criar `HelpButton.tsx` — ✅ Complete

**What**: Componente client com o FAB fixo e o estado aberto/fechado do `HelpModal`.
**Where**: `components/ajuda/HelpButton.tsx`
**Depends on**: T2, T3
**Reuses**: `HelpModal`, `ajuda.module.css`
**Requirement**: HELP-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `HelpButton({ papel })` renderiza o botão "?" fixo e, ao clicar, monta `HelpModal` com `papel` repassado
- [ ] Fechar o modal (via `onClose`) desmonta/oculta o `HelpModal`, mantendo o FAB visível
- [ ] `npm run build` sem erros

**Tests**: none
**Gate**: build (`npm run build`)

**Commit**: `feat(ajuda): adiciona HelpButton`

---

### T5: Montar `HelpButton` no shell autenticado — ✅ Complete (SPEC_DEVIATION: montado em `AppShell.tsx`, não em `layout.tsx` — ver Verificação Final)

**What**: Garantir que `HelpButton` seja renderizado em toda rota do grupo `app/(dashboard)/*`, recebendo o papel do usuário autenticado.
**Where**: `app/(dashboard)/layout.tsx` (criar se não existir; modificar se `menu-navegacao` já o criou)
**Depends on**: T4
**Reuses**: `requireUser()` (`lib/services/authService.ts`) — mesmo contrato definido em `.specs/features/menu-navegacao/design.md` (chamado sem lista de papéis, só autenticação)
**Requirement**: HELP-01, HELP-02, HELP-03 (tela oculta em `/login`, fora do grupo)

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] **Se `app/(dashboard)/layout.tsx` já existir** (criado por `menu-navegacao`): adicionar `<HelpButton papel={usuario.role} />` como irmão de `{children}`, sem alterar a montagem do `AppShell`
- [ ] **Se `app/(dashboard)/layout.tsx` ainda não existir**: criar uma versão mínima — `requireUser()` sem papéis, `redirect('/login')` em caso de `ErroNaoAutenticado` (mesmo padrão de `menu-navegacao/design.md`), e `return <>{children}<HelpButton papel={usuario.role} /></>` — para não bloquear esta feature nem antecipar a implementação completa do `AppShell` (que fica a cargo de `menu-navegacao`)
- [ ] Botão aparece em pelo menos uma rota real do grupo (ex.: `/aprovacoes`) e não aparece em `/login`
- [ ] `npm run build` sem erros
- [ ] Roteiro de teste manual: autenticar com cada um dos três papéis (`SOLICITANTE`, `GESTOR`, `RH_ADMIN`) e confirmar que o botão aparece e se comporta igual para todos, em pelo menos duas rotas diferentes do grupo

**Tests**: none
**Gate**: build (`npm run build`)

**Commit**: `feat(ajuda): monta HelpButton no shell autenticado`

---

## Parallel Execution Map

```
Phase 1 (Parallel):
  T1 [P] ── função pura + teste unitário
  T2 [P] ── CSS Module
  T6 [P] ── .env.example

Phase 2 (Sequential — mesmo diretório/consumo direto):
  T1, T2 completos, então:
    T3 ──→ T4

Phase 3 (Sequential):
  T4 completo, então:
    T5
```

**Nota**: T3 depende de T1 (usa `buildGithubIssueUrl`) e T2 (usa classes do CSS Module); T4 depende de T2 (FAB usa `.fab`) e T3 (renderiza `HelpModal`) — por isso não são `[P]` entre si, mesmo sendo tecnicamente "componentes diferentes". T6 é totalmente independente do restante (arquivo de configuração, não código).

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: `buildGithubIssueUrl` | 1 função pura + 1 arquivo de teste | ✅ Granular |
| T2: `ajuda.module.css` | 1 arquivo CSS | ✅ Granular |
| T3: `HelpModal.tsx` | 1 componente (form + submit + fallback são partes coesas do mesmo fluxo de modal) | ✅ Granular (2-3 responsabilidades relacionadas no mesmo componente, aceitável por coesão) |
| T4: `HelpButton.tsx` | 1 componente | ✅ Granular |
| T5: montagem no layout | 1 arquivo (`layout.tsx`) | ✅ Granular |
| T6: `.env.example` | 1 arquivo de config | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Fase 1, sem seta de entrada | ✅ Match |
| T2 | None | Fase 1, sem seta de entrada | ✅ Match |
| T6 | None | Fase 1, sem seta de entrada | ✅ Match |
| T3 | T1, T2 | Seta de "T1, T2 completos" para T3 | ✅ Match |
| T4 | T2, T3 | Seta de T3 para T4 (T2 já satisfeito na fase anterior) | ✅ Match |
| T5 | T4 | Seta de T4 para T5 | ✅ Match |

---

## Test Co-location Validation

| Task | Código Criado/Modificado | Matriz Exige | Task Diz | Status |
| --- | --- | --- | --- | --- |
| T1: `buildGithubIssueUrl` | Função pura em `lib/helpers/` | unit | unit | ✅ OK |
| T2: `ajuda.module.css` | CSS (não é código testável) | none | none | ✅ OK |
| T3: `HelpModal.tsx` | Componente React | none (sem infra de DOM) | none | ✅ OK |
| T4: `HelpButton.tsx` | Componente React | none | none | ✅ OK |
| T5: `layout.tsx` | Componente React (Server Component) | none | none | ✅ OK |
| T6: `.env.example` | Config, não código | none | none | ✅ OK |

---

## Ferramentas por Task — Confirmar com o Usuário

Nenhuma task exige MCP externo. Skills recomendadas: `frontend-design` e `ui-ux-pro-max` na T2 (CSS Module), para garantir que o botão/modal fiquem visualmente consistentes com o restante do produto antes de escrever o componente React. Nenhuma outra skill/MCP é necessária para T1/T3/T4/T5/T6.

**Antes de executar**: confirmar que este plano (V1 client-side) segue aprovado (Questão em Aberto 1 do spec) e o valor real de `NEXT_PUBLIC_GITHUB_REPO` (Questão em Aberto 2), já que T5/T6 dependem desses dois pontos para não usar placeholder em produção.

---

## Verificação Final (execução)

Todas as 6 tasks implementadas e commitadas individualmente (`7c5daa0`, `66482b9`, `0069322`, `6093b9a`, `d93862a`, `6d543a3`).

**Gate checks**:

- `npm run test`: 465 testes passando (5 novos de `githubIssue.test.ts`, 0 falhas).
- `npm run build`: sucesso (Turbopack + TypeScript, 18 rotas geradas).
- `npx eslint lib/helpers components/ajuda app/(dashboard)/_components/AppShell.tsx`: sem problemas.

**QA manual real** (servidor `next dev` já em execução em `localhost:3000`, Playwright headless, usuário de teste `gestor@01tec.com.br` semeado por `scripts/seed-users.ts`):

1. FAB ausente em `/login` (0 ocorrências) — confirmado.
2. FAB presente após login (1 ocorrência) — confirmado.
3. Clique no FAB abre modal "Reportar algo" com tipo/título/descrição/tela atual — confirmado (tela "Dashboard" corretamente identificada via `resolveScreenTitle`).
4. "Cancelar" fecha o modal sem abrir nova aba — confirmado.
5. Reabrir, preencher só a descrição (título vazio) e confirmar → nova aba abriu de fato (popup NÃO bloqueado neste ambiente headless) apontando para:
   `https://github.com/sua-org/rhop/issues/new?title=%5BBug%5D+%28sem+t%C3%ADtulo%29&body=**Tipo%3A**+Bug%0A**Tela%3A**+Dashboard%0A**Papel%3A**+Gestor%0A%0ADescricao+de+teste+automatizado+via+Playwright.`
   — título usou corretamente o padrão `(sem título)` (HELP-06), corpo reflete tipo/tela/papel/descrição sem nenhum dado sensível (HELP-08).
   O caminho de fallback (pop-up bloqueado, HELP-10) não foi exercitado neste ambiente porque o Chromium headless não bloqueou o `window.open` — a lógica do fallback (`if (!novaAba)`) foi revisada no código mas não observada em execução real; recomendo um teste manual adicional em um navegador com bloqueador de pop-up ativo antes de considerar HELP-10 100% verificado em produção.
   Screenshots salvos em `scratchpad` da sessão (login, pós-login com FAB visível, modal aberto, estado pós-envio).

**SPEC_DEVIATION registrado** (ver T5): `design.md` previa montar `HelpButton` em `app/(dashboard)/layout.tsx`. Na hora de executar, `layout.tsx` e `AppShell.tsx` já existiam (feature `menu-navegacao` foi implementada entre o design e a execução desta feature). Como `AppShell.tsx` já recebe `usuario` e é o composable natural do shell, o `HelpButton` foi montado lá em vez de em `layout.tsx` — nenhuma duplicação de lógica de sessão, resultado funcional idêntico ao previsto.

**Bug de build descoberto e corrigido durante a execução**: `lib/helpers/githubIssue.ts` e os componentes client importavam `Role` de `@/lib/generated/prisma/client` (padrão majoritário no restante do projeto, usado em código server-side). Como `githubIssue.ts` é importado por um Client Component (`HelpModal`), isso quebrou o build do Turbopack (`node:module` não suportado no bundle do browser). Corrigido importando de `@/lib/generated/prisma/enums` — mesmo padrão já usado por `lib/navigation/navConfig.ts`, que também é consumido por componentes client. **Lição para specs futuras**: qualquer módulo importado (direta ou transitivamente) por um Client Component deve importar `Role`/enums de `prisma/enums`, nunca de `prisma/client`.

---

## V2 — Criação via API (substitui V1)

**Motivação**: usuário pediu explicitamente "que a issue fosse criada direto no github sem que o usuario tenha que interagir com a pagina do github". V1 (redirect client-side) não atende isso por definição — precisa de V2 (PRD, seção 9).

## Task Breakdown V2

### T7: Model `Feedback` + migration — ✅ Complete

**What**: `enum TipoRelato` (`BUG`/`MELHORIA`/`DUVIDA`), `enum FeedbackStatus` (`ENVIADO`/`ERRO`), `model Feedback` (`usuario_id`, `tipo`, `titulo`, `descricao`, `tela_contexto`, `github_issue_url?`, `github_issue_numero?`, `status`, `criado_em`) + relação `feedbacks Feedback[]` em `User`.
**Where**: `prisma/schema.prisma`, `prisma/migrations/20260801131954_add_feedback_model/`
**Depends on**: None
**Requirement**: HELP-12

**Done when**: `npx prisma migrate dev` aplicado no Supabase real (confirmado via `SELECT count(*) FROM feedbacks`), `npx prisma generate` rodado.
**Tests**: none (schema)
**Gate**: migration aplicada sem erro + client gerado

---

### T8: `feedbackInputSchema` [P] — ✅ Complete

**What**: Zod schema (`tipo` enum de 3 valores, `titulo`/`descricao` opcionais com default `""`, `tela_contexto` obrigatório).
**Where**: `lib/validations/feedback.ts` (+ `.test.ts`)
**Depends on**: None
**Requirement**: HELP-04, HELP-06

**Tests**: unit (7 casos)
**Gate**: quick (`npm run test`)

---

### T9: `githubService.criarIssue` [P] — ✅ Complete

**What**: `POST /repos/{GITHUB_REPO}/issues` via `fetch`, com `GITHUB_TOKEN`. Lança `ErroGithubApi` se token/repo ausente ou resposta não-ok.
**Where**: `lib/services/githubService.ts` (+ `.test.ts`)
**Depends on**: None
**Requirement**: HELP-05, HELP-10

**Tests**: unit (4 casos, `fetch` mockado via `vi.stubGlobal`)
**Gate**: quick

---

### T10: Refatora `githubIssue.ts` (`buildGithubIssueUrl` → `montarIssuePayload`) — ✅ Complete

**What**: A função pura passa a devolver `{title, body}` em vez de montar uma URL — V2 não abre aba, só precisa do payload para o POST da API.
**Where**: `lib/helpers/githubIssue.ts` (+ `.test.ts` reescrito)
**Depends on**: None
**Requirement**: HELP-04, HELP-08

**Tests**: unit (5 casos, mesma cobertura de V1 adaptada)
**Gate**: quick

---

### T11: `feedbackService.enviarFeedback` — ✅ Complete

**What**: Orquestra rate limit (5/dia via `prisma.feedback.count`), chama `githubService`, persiste `Feedback` (ENVIADO ou ERRO), grava `Log ERRO` em falha. Retorna `{ok: true, url, numero}` ou `{ok: false, motivo, mensagem}` — nunca lança.
**Where**: `lib/services/feedbackService.ts` (+ `.test.ts`)
**Depends on**: T9, T10
**Requirement**: HELP-10, HELP-11, HELP-12

**Tests**: unit (3 casos: sucesso, limite diário, falha do GitHub — prisma/githubService/logService mockados)
**Gate**: quick

---

### T12: `POST /api/feedback` — ✅ Complete

**What**: `requireUser()` (qualquer papel) → `feedbackInputSchema` → `feedbackService`. Mapeia `429` (limite), `502` (erro GitHub), `401` (sem sessão), `400` (payload inválido), `201` (sucesso).
**Where**: `app/api/feedback/route.ts`
**Depends on**: T8, T11
**Requirement**: HELP-05

**Tests**: none (mesma convenção das demais routes do projeto — só `cron/sla-check` tem `route.test.ts`; lógica de negócio já coberta em `feedbackService.test.ts`)
**Gate**: build

---

### T13: Atualiza `HelpModal`/`HelpButton`/`AppShell`/CSS + env vars — ✅ Complete

**What**: `HelpModal` faz `fetch POST /api/feedback` em vez de `window.open`; estados `enviando`/`sucesso` (número + link)/`erro` (mensagem inline, formulário preservado). `papel` removido de `HelpModal`/`HelpButton`/`AppShell` (servidor resolve via sessão). `.sucesso`/`.sucessoLink`/`.erro` em `ajuda.module.css` substituem `.fallback*` (mortos, removidos). `NEXT_PUBLIC_GITHUB_REPO` trocado por `GITHUB_REPO`+`GITHUB_TOKEN` (server-only) em `.env`/`.env.example`/`README.md`.
**Where**: `components/ajuda/HelpModal.tsx`, `components/ajuda/HelpButton.tsx`, `components/ajuda/ajuda.module.css`, `app/(dashboard)/_components/AppShell.tsx`, `.env`, `.env.example`, `README.md`
**Depends on**: T12
**Requirement**: HELP-01, HELP-05, HELP-07, HELP-09, HELP-10

**Tests**: none (componentes React, mesma convenção já estabelecida em V1)
**Gate**: build

---

## Verificação Final V2

Commits: `686e19e` (schema+migration), `081386a` (validação), `df96a8c` (refactor helper), `57882ff` (githubService), `50003e3`+`467de6f` (feedbackService), `a86af9c` (route), `48ba96f` (HelpModal/HelpButton/AppShell/CSS), `e7828b1` (env vars).

**Gate checks**:

- `npx vitest run`: 479 testes passando (14 novos: 7 `feedbackInputSchema` + 4 `githubService` + 3 `feedbackService`; `githubIssue.test.ts` reescrito, ainda 5 casos), 0 falhas.
- `npm run build`: sucesso, rota `/api/feedback` presente no manifest.
- `npx eslint` nos arquivos alterados: 0 erros (1 warning corrigido — `no-unused-vars` num destructure de teste, teste reescrito).

**QA manual real** (servidor `next dev` reiniciado após mudança de env vars, Playwright headless, usuário `rh.admin@01tec.com.br`):

1. Login → clique no FAB → preenche descrição (sem título) → clica "Abrir issue no GitHub".
2. **Sem `GITHUB_TOKEN` configurado** (estado real no momento do teste — token real não gerado ainda): `POST /api/feedback` respondeu `502` com `{"error": "Não foi possível criar a issue agora. Tente novamente em instantes."}` — comportamento correto e esperado (HELP-10).
3. Modal permaneceu aberto, exibindo o banner de erro inline (vermelho, tokens `--vermelho`/`--vermelho-bg`), formulário preservado, resto do FluxoRH (sidebar, dashboard atrás do overlay) continuou renderizado normalmente — nenhum crash.
4. Screenshot confirmando o estado salvo em `scratchpad` da sessão.

**Não verificado ao vivo (requer ação humana fora do alcance do agente)**:

- **Caminho de sucesso real** (issue de fato criada em `fabioacarvalho/rhop`): exige um `GITHUB_TOKEN` real. O agente não pode gerar tokens do GitHub em nome do usuário. Ação pendente: gerar um Personal Access Token fine-grained (escopo `Issues: write`, restrito ao repositório `fabioacarvalho/rhop`) em `github.com/settings/tokens`, colocar em `GITHUB_TOKEN` no `.env` local, reiniciar `npm run dev` e testar novamente o mesmo fluxo — o banner de sucesso (`.sucesso`, verde, com link `Ver issue ↗`) e a criação real da issue devem aparecer.
- **Limite diário (5/dia)**: coberto por teste unitário (mockado); não exercitado ao vivo, pois exigiria 5 envios reais bem-sucedidos primeiro (o que por sua vez depende do `GITHUB_TOKEN` acima).
- **Papel `SOLICITANTE`**: QA ao vivo cobriu `GESTOR` (V1) e `RH_ADMIN` (V2); `SOLICITANTE` não foi testado, mas a rota não distingue papel (`requireUser()` sem lista de papéis) — risco baixo.

**SPEC_DEVIATION**: nenhuma além da já registrada em V1 (montagem em `AppShell.tsx`). A remoção do prop `papel` de `HelpButton`/`HelpModal` não estava no `design.md` original de V1, mas é consequência direta e esperada da migração para V2 (servidor passa a resolver o papel via sessão) — documentada nas Tech Decisions de V2 acima.
