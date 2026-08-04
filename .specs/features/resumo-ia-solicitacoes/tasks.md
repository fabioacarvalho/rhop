# Resumo IA de Solicitações — Tasks

**Design**: `.specs/features/resumo-ia-solicitacoes/design.md`
**Status**: Concluido

---

## Test Coverage Matrix (inferido do codebase — não existe `.specs/codebase/TESTING.md`)

Não há `TESTING.md` no projeto. Inferido a partir do padrão real já em uso (confirmado em `lib/services/*.test.ts`, `lib/validations/tipoFluxo.test.ts`, ausência de qualquer `*.test.tsx`):

| Code Layer | Test Type | Parallel-Safe |
| --- | --- | --- |
| `lib/services/*.ts` (services) | unit (vitest, mocka `prisma`/`logService`/SDKs externos via `vi.mock`) | Sim |
| `lib/validations/*.ts` (Zod schemas) | unit (vitest) | Sim |
| `prisma/schema.prisma` / migrations | none (verificado via `prisma validate`, não por teste unitário) | Sim |
| `app/**/*.tsx` (páginas/componentes) | none (nenhum `*.test.tsx` existe hoje no projeto) | Sim |
| `app/api/**/route.ts` | none (só 1 exceção no projeto todo, `cron/sla-check`; rotas desta feature não mudam) | N/A (nenhuma rota é criada/alterada aqui) |

### Gate Check Commands

| Gate | Command |
| --- | --- |
| quick | `npx vitest run <arquivo>` |
| build | `npx prisma validate && npm run build` |
| full | `npm test && npx prisma validate && npm run build` |

---

## Execution Plan

### Phase 1: Foundation (Sequential)

```
T1 → T2
```

### Phase 2: Core Implementation (Parallel OK)

```
        ┌→ T3 ─┐
T1,T2 ──┼→ T4 ─┤
        └→ T5 ─┘
```

### Phase 3: Orchestration (Sequential)

```
T1, T5 → T6 → T7
```

### Phase 4: UI (Sequential, depende do schema)

```
T1 → T8
```

---

## Task Breakdown

### T1: Schema — `categoria` em TipoFluxo + `resumo_ia_solicitante` em Solicitacao

**What**: Adicionar `enum CategoriaTipoFluxo { PADRAO FERIAS DAYOFF }`, `TipoFluxo.categoria CategoriaTipoFluxo @default(PADRAO)` e `Solicitacao.resumo_ia_solicitante String?` ao schema; gerar e rodar a migration; regenerar o client Prisma.
**Where**: `prisma/schema.prisma` (+ nova pasta em `prisma/migrations/`)
**Depends on**: None
**Reuses**: Estrutura de enum/model já existente no arquivo (ex.: `enum StatusSolicitacao`, `model TipoFluxo`)
**Requirement**: RIA-11 (schema base também suporta RIA-01/RIA-15 — persistência do resumo)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `CategoriaTipoFluxo` e os 2 campos novos existem no schema, exatamente como no `design.md`
- [x] `npx prisma migrate dev --name add_categoria_resumo_ia_solicitante` executado com sucesso (migration versionada em `prisma/migrations/`)
- [x] `npx prisma generate` roda sem erro (client atualizado com os novos campos/enum)
- [x] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(resumo-ia-solicitacoes): adiciona categoria em TipoFluxo e resumo_ia_solicitante em Solicitacao`

---

### T2: Validação — `categoria` em `tipoFluxoInputSchema`

**What**: Adicionar `CATEGORIAS_TIPO_FLUXO` e o campo `categoria` (default `PADRAO`) ao schema Zod de `TipoFluxo`, com testes cobrindo os 3 valores válidos e o default.
**Where**: `lib/validations/tipoFluxo.ts` (+ `lib/validations/tipoFluxo.test.ts`)
**Depends on**: T1
**Reuses**: Padrão de `TIPOS_CAMPO`/`PAPEIS_APROVADOR` já no arquivo
**Requirement**: RIA-11

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `CATEGORIAS_TIPO_FLUXO = ["PADRAO", "FERIAS", "DAYOFF"] as const` exportado
- [x] `tipoFluxoInputSchema` aceita `categoria` opcional com default `"PADRAO"`, rejeita valor fora do enum
- [x] Teste novo cobre: default quando omitido, aceite dos 3 valores, rejeição de valor inválido
- [x] Gate check passa: `npx vitest run lib/validations/tipoFluxo.test.ts`
- [x] Test count: todos os testes existentes do arquivo + os novos passam (nenhuma deleção silenciosa)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(resumo-ia-solicitacoes): valida categoria no schema de TipoFluxo`

---

### T3: Persistir `categoria` em `tipoFluxoService.criar`/`editar` [P]

**What**: Passar `categoria: dados.categoria` no `data` de `prisma.tipoFluxo.create` e `prisma.tipoFluxo.update`; atualizar fixtures dos testes existentes para incluir `categoria`.
**Where**: `lib/services/tipoFluxoService.ts` (+ `lib/services/tipoFluxoService.test.ts`)
**Depends on**: T1, T2
**Reuses**: Estrutura try/catch de `P2002`/`P2025` já existente, inalterada
**Requirement**: RIA-11

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `criar` e `editar` persistem `categoria` recebido em `TipoFluxoInput`
- [x] Testes existentes atualizados (fixtures ganham `categoria: "PADRAO"` por padrão) continuam passando
- [x] Novo caso de teste: criar/editar com `categoria: "FERIAS"` persiste o valor corretamente
- [x] Gate check passa: `npx vitest run lib/services/tipoFluxoService.test.ts`
- [x] Test count: todos os testes do arquivo passam (nenhuma deleção silenciosa)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(resumo-ia-solicitacoes): persiste categoria em tipoFluxoService`

---

### T4: Select de categoria em `TipoFluxoForm.tsx` [P]

**What**: Adicionar um `<select>` de categoria (`PADRAO` default, rótulos "Padrão"/"Férias"/"Day Off") entre o campo `nome` e `EtapasEditor`; incluir `categoria` no objeto `TipoFluxoInput` submetido.
**Where**: `app/(dashboard)/configuracao-fluxos/_components/TipoFluxoForm.tsx`
**Depends on**: T2
**Reuses**: Padrão de `useState` + submit já usado para `nome`/`etapas`/`campos_formulario` no mesmo componente
**Requirement**: RIA-11

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `<select>` de categoria renderiza as 3 opções, pré-preenchido por `initialData?.categoria` em modo editar
- [x] Submit envia `categoria` dentro do corpo de `POST`/`PUT`
- [x] Gate check passa: `npx prisma validate && npm run build` (sem teste `.tsx` — nenhum existe no projeto)

**Tests**: none
**Gate**: build

**Commit**: `feat(resumo-ia-solicitacoes): adiciona seletor de categoria no formulario de TipoFluxo`

---

### T5: `iaService.gerarResumoSolicitante` [P]

**What**: Nova função em `iaService.ts` que gera o resumo do solicitante (com ou sem menção a conflito), seguindo o mesmo contrato "nunca lança" de `gerarResumoSolicitacao`.
**Where**: `lib/services/iaService.ts` (+ `lib/services/iaService.test.ts`)
**Depends on**: None
**Reuses**: Client `OpenAI`/modelo `gpt-4o-mini` já configurado no arquivo; padrão de função de log por domínio (`registrarFalhaIa*`)
**Requirement**: RIA-04, RIA-07, RIA-08

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `gerarResumoSolicitante(input: { solicitacaoId, tipoFluxoNome, dados, conflito: { periodoDescricao: string } | null }): Promise<string | null>` implementada
- [x] Sucesso com conteúdo não-vazio → texto trimado, sem `Log`
- [x] Falha (chave ausente/erro de API/timeout/conteúdo vazio) → `null` + `Log ERRO` (`entidade: "Solicitacao"`, `acao: "FALHA_IA"`)
- [x] Quando `conflito !== null`, o prompt enviado à OpenAI inclui menção explícita ao período de conflito (verificável via `expect(mockCreate).toHaveBeenCalledWith(...)` contendo a `periodoDescricao`)
- [x] Gate check passa: `npx vitest run lib/services/iaService.test.ts`
- [x] Test count: todos os testes existentes do arquivo + os novos passam (nenhuma deleção silenciosa)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(resumo-ia-solicitacoes): adiciona gerarResumoSolicitante ao iaService`

---

### T6: `resumoSolicitanteService` (novo)

**What**: Novo service que busca a `Solicitacao` + `TipoFluxo.categoria` + `solicitante.equipe_id`, detecta conflito de datas com colegas de equipe (mesma categoria, status `APROVADA`/`PENDENTE`), chama `iaService.gerarResumoSolicitante` e persiste `resumo_ia_solicitante`.
**Where**: `lib/services/resumoSolicitanteService.ts` (+ `lib/services/resumoSolicitanteService.test.ts`)
**Depends on**: T1, T5
**Reuses**: Estilo de `SolicitacaoComRelacoes`/funções privadas pequenas de `aprovacaoService.ts`
**Requirement**: RIA-01, RIA-06, RIA-09, RIA-10, RIA-16, RIA-17, RIA-18, RIA-19

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `extrairPeriodo(categoria, dados)` retorna `{inicio, fim}` para FERIAS (`data_inicio`/`data_fim`) e DAYOFF (`data` → `inicio === fim`); retorna `null` se ausente/inválido (RIA-19)
- [x] `haSobreposicao(a, b)` cobre igualdade exata e interseção parcial (RIA-16)
- [x] `buscarConflito` retorna `null` cedo quando `categoria === PADRAO` (RIA-10) ou `equipe_id === null` (RIA-09)
- [x] `buscarConflito` filtra concorrentes por `status: { in: ['APROVADA','PENDENTE'] }`, excluindo `REJEITADA` (RIA-17) e excluindo a própria `Solicitacao`/o próprio solicitante
- [x] Erro de banco em `buscarConflito` é capturado, grava `Log ERRO`, retorna `null` (RIA-18)
- [x] `gerarEPersistir(solicitacaoId)` nunca lança (mesmo em erro inesperado); em sucesso da IA, faz `prisma.solicitacao.update` com `resumo_ia_solicitante`
- [x] Gate check passa: `npx vitest run lib/services/resumoSolicitanteService.test.ts`
- [x] Test count: cobre ao menos os 8 cenários acima (nenhuma deleção silenciosa)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(resumo-ia-solicitacoes): adiciona resumoSolicitanteService com deteccao de conflito de equipe`

---

### T7: Disparar `gerarEPersistir` em `solicitacaoService.criar`

**What**: Após persistir a `Solicitacao` e gravar o `Log AUDITORIA` de criação, chamar `void gerarEPersistir(solicitacao.id)` (fire-and-forget, não bloqueia o retorno de `criar`).
**Where**: `lib/services/solicitacaoService.ts` (+ `lib/services/solicitacaoService.test.ts`)
**Depends on**: T6
**Reuses**: Mesmo padrão fire-and-forget de `aprovacaoService.decidir` (`void preencherResumoIa(...)`)
**Requirement**: RIA-01

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `criar` chama `gerarEPersistir(solicitacao.id)` sem `await` (não bloqueante)
- [x] Teste confirma que `criar` resolve/retorna mesmo se `gerarEPersistir` demorar ou rejeitar (mock com `Promise` pendente/rejeitada não trava o teste)
- [x] Testes existentes de `criar` continuam passando sem alteração de comportamento observável (retorno da função inalterado)
- [x] Gate check passa: `npx vitest run lib/services/solicitacaoService.test.ts`
- [x] Test count: todos os testes existentes + o novo passam (nenhuma deleção silenciosa)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(resumo-ia-solicitacoes): dispara geracao de resumo do solicitante na criacao`

---

### T8: UI — expandir linha com o resumo em "Minhas Solicitações"

**What**: Extrair o `<tbody>` de `page.tsx` para um novo Client Component `SolicitacaoTableBody` que alterna expansão por linha (clique fora do link de protocolo) e mostra `resumo_ia_solicitante` (ou o fallback "Resumo da IA indisponível no momento." quando `null`); adicionar o estilo da linha expandida ao CSS module.
**Where**: `app/(dashboard)/solicitacoes/_components/SolicitacaoTableBody.tsx` (novo), `app/(dashboard)/solicitacoes/page.tsx` (modificado), `app/(dashboard)/solicitacoes/solicitacoes.module.css` (modificado)
**Depends on**: T1
**Reuses**: Estrutura de `<tr>`/classes já existentes em `page.tsx`; estilo `.callout-ia` do mockup (`docs/design-ux-ui/fluxorh-ui-layout-specs.md`) como referência visual
**Requirement**: RIA-02, RIA-03

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `page.tsx` renderiza `<SolicitacaoTableBody solicitacoes={solicitacoes} />` no lugar do `<tbody>` estático, mantendo `<thead>` e o restante do layout idênticos
- [x] Clicar numa linha (fora do link de protocolo) expande/colapsa uma linha extra com `colSpan` cobrindo todas as colunas, mostrando o resumo salvo
- [x] Quando `resumo_ia_solicitante` é `null`, mostra o fallback textual, sem erro
- [x] Nenhuma chamada de rede é feita ao expandir (dado já veio em `solicitacoes` via prop)
- [x] Gate check passa: `npx prisma validate && npm run build` (sem teste `.tsx` — nenhum existe no projeto)

**Tests**: none
**Gate**: build

**Commit**: `feat(resumo-ia-solicitacoes): expande linha em Minhas Solicitacoes com resumo da IA`

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T1 ──→ T2

Phase 2 (Parallel, apos T1+T2):
    ├── T3 [P]
    ├── T4 [P]
    └── T5 [P]  (T5 na pratica so depende de nada, mas roda junto por conveniencia de fase)

Phase 3 (Sequential, apos T1+T5):
  T6 ──→ T7

Phase 4 (apos T1, pode rodar em paralelo as fases 2/3):
  T8
```

**Nota**: `T8` só depende de `T1` (schema) — pode ser executado em paralelo com as Fases 2/3, já que não consome `resumoSolicitanteService` nem `iaService` diretamente (só lê o campo já tipado). Mantido como fase separada acima só por clareza de leitura, não por dependência real.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Schema categoria + resumo_ia_solicitante | 1 arquivo (schema) + 1 migration | ✅ Granular |
| T2: Validação categoria (Zod) | 1 arquivo + 1 teste | ✅ Granular |
| T3: Persistir categoria no service | 1 arquivo + 1 teste (2 funções relacionadas no mesmo arquivo) | ✅ Granular (coeso) |
| T4: Select de categoria na UI | 1 componente | ✅ Granular |
| T5: iaService.gerarResumoSolicitante | 1 função + 1 teste | ✅ Granular |
| T6: resumoSolicitanteService | 1 arquivo novo, funções coesas de um único conceito (conflito + persistência) | ✅ Granular (coeso) |
| T7: Wire fire-and-forget em criar | 1 linha em 1 arquivo + teste | ✅ Granular |
| T8: UI de expansão | 1 componente novo + 1 page.tsx modificado + 1 CSS (mesmo conceito visual) | ✅ Granular (coeso) |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Nenhuma seta de entrada | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T1, T2 | T1,T2 → T3 | ✅ Match |
| T4 | T2 | T1,T2 → T4 (T1 é superset harmless — T4 na pratica só usa T2; mantido no mesmo agrupamento de fase por leitura) | ✅ Match |
| T5 | None | Agrupado na Fase 2 apenas por conveniência; nenhuma seta de dependência real | ✅ Match |
| T6 | T1, T5 | T1, T5 → T6 | ✅ Match |
| T7 | T6 | T6 → T7 | ✅ Match |
| T8 | T1 | T1 → T8 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1: Schema | `prisma/schema.prisma` | none | none | ✅ OK |
| T2: Validação categoria | `lib/validations/*.ts` | unit | unit | ✅ OK |
| T3: tipoFluxoService | `lib/services/*.ts` | unit | unit | ✅ OK |
| T4: TipoFluxoForm | `app/**/*.tsx` | none | none | ✅ OK |
| T5: iaService | `lib/services/*.ts` | unit | unit | ✅ OK |
| T6: resumoSolicitanteService | `lib/services/*.ts` | unit | unit | ✅ OK |
| T7: solicitacaoService (wire) | `lib/services/*.ts` | unit | unit | ✅ OK |
| T8: SolicitacaoTableBody + page.tsx | `app/**/*.tsx` | none | none | ✅ OK |

---

## Parallelism constraint check

Todos os `[P]` (T3, T4, T5) são parallel-safe (matriz confirma "Sim" para services/validations/UI), não compartilham estado mutável entre si (arquivos diferentes) e não dependem uns dos outros — apenas de T1/T2, já concluídos antes da Fase 2 começar.
