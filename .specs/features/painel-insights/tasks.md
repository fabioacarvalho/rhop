# Painel de Insights — Tasks

**Design**: `.specs/features/painel-insights/design.md`
**Context**: `.specs/features/painel-insights/context.md`
**Status**: T1–T6 implementadas e verificadas (testes automatizados + build). T7 parcial — ver nota na task.

---

## 0. Nota sobre TESTING.md

Sem `.specs/codebase/TESTING.md` — mesmo padrão inferido/usado em `aprovacoes/tasks.md` e `sla-cobranca/tasks.md`:

| Camada | Tipo de teste | Gate |
| --- | --- | --- |
| `lib/validations/*.ts` | unit vitest | quick + build |
| `lib/services/*.ts` | unit vitest (mocks) | quick + build |
| `app/api/**` / UI | none | build |

**Gate commands**: `quick` = `npm test`; `build` = `npx prisma validate && npm run build` (obrigatório por `CLAUDE.md`). Sem migration nesta feature (nenhum model novo), mas `prisma validate` roda igual por convenção do gate.

---

## Execution Plan

### Phase 1: Foundation (Parallel)

```
T1 [P] ──┐
T2 [P] ──┼──→ Phase 2
T3 [P] ──┘
```

### Phase 2: Core service (Sequential)

```
T1, T2, T3 ──→ T4
```

### Phase 3: Rota + UI (Parallel após T4)

```
        ┌→ T5 [P]
T4 ─────┼→ T6 [P] (depende também de T5 para tipagem da resposta)
```

`T7` depende de `T5`+`T6` (checagem manual ponta a ponta).

---

## Task Breakdown

### T1: `insightsFiltroSchema` (Zod) + `parseInsightsQuery` [P]

**What**: Schema Zod de filtro (`tipoFluxoId`, `periodo` enum, `dimensao` enum opcional default `STATUS`) + parser de querystring isolado (mesmo padrão de `queryLogsSchema`/`parseLogsQuery`).
**Where**: `lib/validations/insight.ts`, `lib/validations/insight.test.ts`
**Depends on**: None
**Reuses**: padrão `lib/validations/logs` (ver `app/api/logs/route.ts`)
**Requirement**: INSIGHT-04 (validação), INSIGHT-01/11 (enums de período/dimensão)

**Done when**:
- [x] `PERIODOS_INSIGHTS` / `DIMENSOES_INSIGHTS` exportados; `insightsFiltroSchema` valida os três campos; `dimensao` ausente → default `"STATUS"`
- [x] `parseInsightsQuery(url)` extrai de `URLSearchParams` e retorna `safeParse`
- [x] Testes: válido completo, válido sem `dimensao` (default), `tipoFluxoId` ausente falha, `periodo` fora do enum falha, `dimensao` fora do enum falha (≥5 casos)
- [x] `npm test` no arquivo + build passam

**Tests**: unit
**Gate**: quick + build
**Commit**: `feat(painel-insights): adiciona schema zod de filtro de insights`

---

### T2: Instalar `recharts` [P]

**What**: Adicionar dependência `recharts` (ainda não instalada — `package.json` não a lista) usada pelo gráfico do painel.
**Where**: `package.json`, `package-lock.json`
**Depends on**: None
**Requirement**: INSIGHT-03

**Done when**:
- [x] `recharts` em `dependencies`
- [x] `npm run build` passa (import ainda não existe até T6, mas a dependência resolve)

**Tests**: none
**Gate**: build
**Commit**: `chore(painel-insights): adiciona dependencia recharts`

---

### T3: `iaService.gerarResumoInsights` [P]

**What**: Nova função no `iaService.ts` existente — narra `itens`/`total` agregados via `gpt-4o-mini`; nunca lança; falha/vazio → `null` + `Log ERRO` (`entidade: "Insight"`, `acao: "FALHA_IA"`). Prompt instrui a não afirmar tendências fortes quando `total` for pequeno (ex.: ≤ 2).
**Where**: `lib/services/iaService.ts` (extensão), `lib/services/iaService.test.ts` (casos novos)
**Depends on**: None (mock `openai` já usado nos testes existentes do arquivo)
**Reuses**: `registrar` (`logService`), padrão de `gerarResumoSolicitacao`/`registrarFalhaIa`
**Requirement**: INSIGHT-06, INSIGHT-08

**Done when**:
- [x] `gerarResumoInsights({ tipoFluxoNome, periodo, dimensao, itens, total })` retorna `string` em sucesso, `null` em falha/conteúdo vazio/chave ausente
- [x] Falha → `Log ERRO` com `entidade: "Insight"`, `entidade_id` = `` `${tipoFluxoNome}:${periodo}:${dimensao}` ``, `acao: "FALHA_IA"`
- [x] Nunca lança para o chamador por erro da OpenAI
- [x] Testes cobrem sucesso e falha (≥2); gate quick + build

**Tests**: unit
**Gate**: quick + build
**Commit**: `feat(painel-insights): adiciona gerarResumoInsights ao iaService`

---

### T4: `insightsService.agregar` + helpers

**What**: Agregação Postgres por `STATUS` (`groupBy`) ou `MES` (`$queryRaw` com `date_trunc`), visibilidade por papel, e orquestração da narração IA (skip se `total === 0`).
**Where**: `lib/services/insightsService.ts`, `lib/services/insightsService.test.ts`
**Depends on**: T1, T3
**Reuses**: `tipoFluxoService.buscarPorId` (e seu `ErroNaoEncontrado`), `prisma`, `gerarResumoInsights`
**Requirement**: INSIGHT-02, INSIGHT-05, INSIGHT-06, INSIGHT-08, INSIGHT-09, INSIGHT-11 (dados)

**Done when**:
- [x] `periodoParaIntervalo(periodo, agora?)` — `agora` injetável; `ULTIMOS_30_DIAS`/`ULTIMOS_90_DIAS` = janela relativa; `ANO_ATUAL` = 1º de janeiro do ano de `agora` até `agora`
- [x] `resolverIdsVisiveis(usuario)` — RH_ADMIN → `null`; GESTOR → `[usuario.id, ...idsDaEquipe]` (via `prisma.user.findMany({ gestor_id: usuario.id })`)
- [x] `agregar(usuario, filtro)`:
  - `tipoFluxoId` inexistente → propaga `ErroNaoEncontrado` (sem agregar)
  - `dimensao STATUS` → `groupBy(status)` respeitando `where` (tipo + período + visibilidade)
  - `dimensao MES` → `$queryRaw` com `date_trunc('month', criado_em)`, mesmo filtro de visibilidade traduzido para SQL parametrizado
  - `total === 0` → `itens: []`, `resumo_ia: null`, **sem** chamar `gerarResumoInsights`
  - `total > 0` → chama `gerarResumoInsights`; falha → `resumo_ia: null` sem lançar
  - GESTOR sem subordinados → `idsVisiveis = [usuario.id]` (não lança, não quebra)
- [x] Testes: RH_ADMIN vê global, GESTOR só equipe, tipo inexistente → erro, período vazio não chama IA (mock `gerarResumoInsights` e assert não-chamado), ambas dimensões retornam `itens` coerentes (≥6 casos)
- [x] `npm test` + build passam

**Tests**: unit
**Gate**: quick + build
**Commit**: `feat(painel-insights): implementa agregacao e narracao de insights`

---

### T5: `GET /api/insights` [P]

**What**: Rota que autentica, valida e delega ao `insightsService`.
**Where**: `app/api/insights/route.ts`
**Depends on**: T1, T4
**Requirement**: INSIGHT-04, INSIGHT-10

**Done when**:
- [x] `requireUser([Role.GESTOR, Role.RH_ADMIN])` — 401/403 antes de qualquer validação/agregação
- [x] `parseInsightsQuery` inválido → 400 com `issues`
- [x] `ErroNaoEncontrado` (tipo inválido) → 404
- [x] Sucesso → 200 com `InsightResultado`
- [x] Nenhum acesso direto a `prisma` nem lógica de agregação na rota
- [x] Build passa

**Tests**: none
**Gate**: build
**Commit**: `feat(painel-insights): adiciona rota GET de insights`

---

### T6: Página + `InsightsPanel` [P]

**What**: Server page com gate de papel + busca de tipos; Client component único com filtro, gráfico Recharts e callout de IA/estados vazio/aviso.
**Where**: `app/(dashboard)/insights/page.tsx`, `app/(dashboard)/insights/_components/InsightsPanel.tsx`
**Depends on**: T2, T4, T5
**Requirement**: INSIGHT-01, INSIGHT-03, INSIGHT-05, INSIGHT-07, INSIGHT-08, INSIGHT-11

**Done when**:
- [x] Gate `[GESTOR, RH_ADMIN]` no `page.tsx` (mesmo padrão de `auditoria-logs/page.tsx`: `redirect('/login')` / bloco "Acesso restrito")
- [x] `page.tsx` busca `tipoFluxoService.listar()` e passa como prop — sem endpoint extra só para o select
- [x] `InsightsPanel`: selects de tipo/período/dimensão sempre visíveis; ao mudar, refaz `fetch('/api/insights?...')`
- [x] Recharts `BarChart` renderiza `itens` (eixo X `chave`, eixo Y `quantidade`)
- [x] `total === 0` → estado vazio claro, sem callout de IA
- [x] `total > 0` e `resumo_ia` presente → callout com o texto
- [x] `total > 0` e `resumo_ia === null` → aviso "resumo não pôde ser gerado", gráfico continua visível
- [x] Build passa

**Tests**: none
**Gate**: build
**Commit**: `feat(painel-insights): adiciona tela do painel de insights`

---

### T7: Verificação manual ponta a ponta

**What**: Confirmar cenários de autorização e de IA descritos no `spec.md`, já que autorização/fluxo de aprovação de acesso é regra sensível (`CLAUDE.md`).
**Where**: N/A (verificação, sem código novo)
**Depends on**: T5, T6

**Done when**:
- [ ] RH_ADMIN: tipo + período com dados → gráfico + resumo coerente
- [ ] RH_ADMIN: período sem dados → estado vazio, nenhuma chamada à OpenAI (checar ausência de novo `Log` de `FALHA_IA`/sucesso)
- [ ] GESTOR: números batem só com a própria equipe (comparar com uma segunda equipe, que não deve aparecer)
- [ ] SOLICITANTE tentando acessar `/api/insights` → 403
- [ ] Falha forçada da OpenAI (chave inválida) → gráfico permanece, aviso de resumo indisponível, exatamente um `Log ERRO` novo
- [ ] Descrever os cenários testados no resumo da task (regra do `CLAUDE.md` para mudanças de autorização/fluxo)

**Nota de execução (2026-07-31):** click-through real no navegador (login Supabase + OpenAI real) **não foi executado** nesta sessão — ambiente sem sessão autenticada disponível para dirigir o browser. Em vez disso, cada cenário acima tem um equivalente coberto por teste automatizado, todos passando:
- RH_ADMIN vê agregação global / GESTOR só enxerga a própria equipe (ids do gestor + subordinados) → `lib/services/insightsService.test.ts` ("RH_ADMIN vê global", "GESTOR só equipe").
- Tipo de fluxo inexistente → `ErroNaoEncontrado` propagado, sem agregar → mesmo arquivo.
- Período sem dados → `resumo_ia: null`, `gerarResumoInsights` **não** chamado (asserção explícita de `not.toHaveBeenCalled()`) → mesmo arquivo (dimensões STATUS e MES).
- SOLICITANTE bloqueado → `requireUser([GESTOR, RH_ADMIN])` já teria papel fora da lista → `ErroNaoAutorizado` → rota converte em 403 (`app/api/insights/route.ts`); a checagem `roles.includes(user.role)` é genérica e já coberta por `lib/services/authService.test.ts`.
- Falha da OpenAI (throw/timeout/conteúdo vazio/chave ausente) → `resumo_ia: null` + exatamente um `Log ERRO` (`entidade: "Insight"`, `acao: "FALHA_IA"`), sem lançar → `lib/services/iaService.test.ts`.

Recomendação: antes da demo, rodar `npm run dev` e repetir os 5 cenários manualmente com dados reais (Supabase + `OPENAI_API_KEY`), já que teste automatizado não substitui UAT de UI real (fonte, layout, resposta de rede) — combina com a diretriz do projeto de nunca declarar uma feature de UI validada sem passar pelo navegador.

**Tests**: manual
**Gate**: none (documentação do resultado)
**Commit**: nenhum (ou incluído no commit de T6 se feito na mesma sessão)

---

## Traceability

| ID | Task(s) |
| --- | --- |
| INSIGHT-01 | T1, T6 |
| INSIGHT-02 | T4 |
| INSIGHT-03 | T2, T6 |
| INSIGHT-04 | T1, T5 |
| INSIGHT-05 | T4, T6 |
| INSIGHT-06 | T3, T4 |
| INSIGHT-07 | T6 |
| INSIGHT-08 | T3, T4, T6 |
| INSIGHT-09 | T4 |
| INSIGHT-10 | T5 |
| INSIGHT-11 | T1, T4, T6 |

**Coverage:** 11/11 mapeados.
