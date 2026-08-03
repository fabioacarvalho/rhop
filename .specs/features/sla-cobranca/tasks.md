# SLA e Cobrança — Tasks

**Design**: `.specs/features/sla-cobranca/design.md`
**Spec**: `.specs/features/sla-cobranca/spec.md`
**Status**: Implemented (worktree `.worktrees/sla-cobranca`, branch `sla-cobranca`)

---

## Test Strategy

`.specs/codebase/TESTING.md` não existe. Segue o precedente de `notificacoes`/`aprovacoes` + `package.json` (`vitest`).

### Test Coverage Matrix

| Code Layer | Test Type | Parallel-Safe |
| --- | --- | --- |
| `prisma/schema.prisma` | none — `npx prisma validate` | Yes |
| `lib/services/slaService.ts` | unit (Vitest; mock prisma, logService, notificacaoService) | Yes |
| `app/api/cron/sla-check/route.ts` | unit / request test (mock slaService; assert 401 vs 200) | Yes |
| `vercel.json` | none — validação manual / deploy | Yes |

### Gate Check Commands

| Gate | Command |
| --- | --- |
| `quick` | `npm run test` |
| `full` | `npm run build && npx prisma validate && npm run test` |
| `build` | `npm run build` / `npx prisma validate` |

---

## Execution Plan

### Phase 1: Foundation (Sequential)

```
T1
```

### Phase 2: Core service (Sequential)

```
T1 → T2 → T3
```

### Phase 3: HTTP + schedule

```
T3 → T4 → T5
```

```
Phase 1:  T1
Phase 2:  T1 ──→ T2 ──→ T3
Phase 3:  T3 ──→ T4 ──→ T5
```

Nenhum `[P]` interno: T2–T5 compartilham o mesmo fluxo e contrato; paralelismo real é com outras features (após stub de notificação).

---

## Task Breakdown

### T1: Campos de atraso/cobrança no schema

**What**: Adicionar `atrasada_em DateTime?`, `ultima_cobranca_em DateTime?` e índices `@@index([status, prazo_sla])`, `@@index([atrasada_em])` em `Solicitacao`.
**Where**: `prisma/schema.prisma`
**Depends on**: None (assume `Solicitacao` já existe — já no repo)
**Reuses**: model `Solicitacao` atual
**Requirement**: SLA-03 (persistência da flag), base para SLA-02/04

**Tools**:
- MCP: NONE
- Skill: `supabase-postgres-best-practices` (se alterar schema)

**Done when**:
- [x] Campos `atrasada_em` e `ultima_cobranca_em` opcionais no model
- [x] Índices adicionados
- [x] Gate check passa: `npx prisma validate`

**Tests**: none
**Gate**: build

**Commit**: `feat(sla): adiciona atrasada_em e ultima_cobranca_em em Solicitacao`

---

### T2: `resolveAprovadores` + marcação idempotente

**What**: Criar `lib/services/slaService.ts` com `resolveAprovadores` e a lógica de marcar `atrasada_em` (update condicional + `Log AUDITORIA` `MARCACAO_ATRASO` apenas na primeira vez). Ainda sem cobrança/orquestração completa — exportar helpers testáveis.
**Where**: `lib/services/slaService.ts`, `lib/services/slaService.test.ts`
**Depends on**: T1
**Reuses**: `lib/prisma.ts`, `logService.registrar`
**Requirement**: SLA-02, SLA-03

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `GESTOR` resolve para `solicitante.gestor_id` (ou `[]` se nulo)
- [x] `RH_ADMIN` resolve para todos users com esse role (ou `[]` se nenhum)
- [x] Marcação só grava `atrasada_em` + Log quando ainda `null` e `status=PENDENTE`
- [x] Segunda chamada não gera novo Log de transição
- [x] Gate check passa: `npm run test`
- [x] Test count: ≥ 4 testes novos passam (resolver GESTOR/RH/vazio; marcação idempotente)

**Tests**: unit
**Gate**: quick

**Verify**:
```
npm run test -- lib/services/slaService.test.ts
```

**Commit**: `feat(sla): marca solicitacao atrasada de forma idempotente`

---

### T3: Orquestração `verificarSla` (cobrança, resiliência, resumo)

**What**: Completar `verificarSla(now?)`: query de candidatas, loop isolado, throttle 24h via `ultima_cobranca_em`, disparo `notificarEvento(COBRANCA_SLA)`, `Log ERRO` em falhas/destinatário vazio, `SlaCheckResumo` + `Log AUDITORIA SLA_CHECK_RESUMO`. Stub de `notificarEvento` se o módulo real ainda não estiver no branch.
**Where**: `lib/services/slaService.ts`, `lib/services/slaService.test.ts` (expandir)
**Depends on**: T2
**Reuses**: contrato `notificacaoService.notificarEvento` / stub; `logService`
**Requirement**: SLA-01 (rotina), SLA-04, SLA-05, SLA-07

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Candidatas = `PENDENTE` + `prazo_sla < now`
- [x] Cobrança só se `ultima_cobranca_em` nulo ou ≥ 24h
- [x] Evento contém `solicitacao_id`, `usuario_id` (aprovador), tipo `COBRANCA_SLA`
- [x] Falha de notificação / item isolado → Log ERRO, demais processadas, marcação não revertida
- [x] Solicitação já decidida na corrida → ignorada
- [x] Resumo com `verificadas`, `marcadas_atrasadas`, `cobrancas_disparadas`, `erros` + Log de resumo
- [x] Gate check passa: `npm run test`
- [x] Test count: ≥ 8 testes no arquivo (inclui T2; sem deleção silenciosa)

**Tests**: unit
**Gate**: quick

**Verify**:
```
npm run test -- lib/services/slaService.test.ts
# Esperado: falha forçada de notificarEvento em 1 de N → erros>=1, outras marcadas
```

**Commit**: `feat(sla): orquestra check de SLA com cobrança resiliente`

---

### T4: Endpoint `GET /api/cron/sla-check` com `CRON_SECRET`

**What**: Route que valida `Authorization: Bearer ${CRON_SECRET}` (secret obrigatório), chama `verificarSla`, retorna 200 + resumo ou 401 sem efeitos.
**Where**: `app/api/cron/sla-check/route.ts`, `app/api/cron/sla-check/route.test.ts`
**Depends on**: T3
**Reuses**: padrão de route handlers do projeto; design Vercel Cron
**Requirement**: SLA-01, SLA-06

**Tools**:
- MCP: NONE
- Skill: `next-best-practices` (route handler)

**Done when**:
- [x] Sem header / Bearer errado / `CRON_SECRET` unset → 401 e `verificarSla` **não** chamado
- [x] Bearer válido → 200 JSON com campos do `SlaCheckResumo`
- [x] Gate check passa: `npm run test`
- [x] Test count: ≥ 2 testes da route passam

**Tests**: unit
**Gate**: quick

**Verify**:
```
npm run test -- app/api/cron/sla-check/route.test.ts
```

**Commit**: `feat(sla): protege endpoint de check SLA com CRON_SECRET`

---

### T5: Agendar cron no Vercel + gate full

**What**: Criar/atualizar `vercel.json` com cron diário (`0 3 * * *`) em `/api/cron/sla-check` — plano Vercel Hobby não libera frequência maior. Documentar `CRON_SECRET` em comentário curto no route ou README de env existente (sem commit de secret). Rodar gate full.
**Where**: `vercel.json`
**Depends on**: T4
**Reuses**: design § vercel.json
**Requirement**: SLA-01 (acionamento periódico)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `vercel.json` contém cron `0 3 * * *` → `/api/cron/sla-check`
- [x] Gate check passa: `npm run build && npx prisma validate && npm run test`
- [x] Test count: suite completa passa (sem deleção silenciosa vs. baseline da branch)

**Tests**: none
**Gate**: full

**Commit**: `feat(sla): agenda Vercel Cron diário para sla-check`

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T1

Phase 2 (Sequential):
  T1 ──→ T2 ──→ T3

Phase 3 (Sequential):
  T3 ──→ T4 ──→ T5
```

**Parallelism constraint:** Nenhum task marcado `[P]` — test types são parallel-safe, mas dependências de código são estritamente sequenciais no mesmo service/route.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Schema fields + indexes | 1 file, schema only | ✅ Granular |
| T2: Resolver + marcação | 1 service concern + tests | ✅ Granular |
| T3: Orquestração cobrança/resumo | 1 function `verificarSla` + tests | ✅ Granular (coeso) |
| T4: Route + auth cron | 1 endpoint + tests | ✅ Granular |
| T5: vercel.json + full gate | 1 config file | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Raiz | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | T3 | T3 → T4 | ✅ Match |
| T5 | T4 | T4 → T5 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | prisma schema | none | none | ✅ OK |
| T2 | slaService | unit | unit | ✅ OK |
| T3 | slaService | unit | unit | ✅ OK |
| T4 | cron route | unit | unit | ✅ OK |
| T5 | vercel.json | none | none | ✅ OK |

---

## Requirement Traceability (Tasks)

| Requirement ID | Task(s) | Status |
| --- | --- | --- |
| SLA-01 | T3, T4, T5 | Verified |
| SLA-02 | T2, T3 | Verified |
| SLA-03 | T1, T2 | Verified |
| SLA-04 | T3 | Verified |
| SLA-05 | T3 | Verified |
| SLA-06 | T4 | Verified |
| SLA-07 | T3 | Verified |

**Coverage:** 7 total, 7 mapeados ✅

---

## Cross-feature follow-up (não é task desta feature)

`aprovacoes` deve, no avanço de etapa: `prazo_sla = now + SLA_HORAS`, `atrasada_em = null`, `ultima_cobranca_em = null`. Sem isso, etapas subsequentes podem nascer já vencidas. Registrar como patch em `aprovacoes` antes/durante Execute se ainda não existir.
