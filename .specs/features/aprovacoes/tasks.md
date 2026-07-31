# Aprovações — Tasks

**Design**: `.specs/features/aprovacoes/design.md`
**Context**: `.specs/features/aprovacoes/context.md`
**Status**: Complete (T1–T10)

---

## 0. Nota sobre TESTING.md

Mesmo padrão inferido em `solicitacoes/tasks.md` (sem `.specs/codebase/TESTING.md`):

| Camada | Tipo de teste | Gate |
| --- | --- | --- |
| `lib/validations/*.ts` | unit vitest | quick + build |
| `lib/services/*.ts` | unit vitest (mocks) | quick + build |
| `lib/events/*.ts` | unit leve ou none | build |
| `prisma/schema` | none | build (`prisma validate`) |
| `app/api/**` / UI | none | build |

**Gate commands**: `quick` = `npm test`; `build` = `npx prisma validate && npm run build` (obrigatório por `CLAUDE.md`).

---

## Execution Plan

### Phase 1: Foundation (Parallel)

```
T1 [P] ──┐
T2 [P] ──┤
T3 [P] ──┼──→ Phase 2
T4 [P] ──┘
```

### Phase 2: Core services (Sequential)

```
T3, T4 ──→ T5 ──→ T6
```

### Phase 3: Routes + UI (Parallel após T6)

```
        ┌→ T7 [P]
T6 ─────┼→ T8 [P]
        ├→ T9 [P]
        └→ T10 [P]
T6 ─────→ T11 (histórico P2, após T7)
```

---

## Task Breakdown

### T1: Schema `Solicitacao` completa + `Aprovacao` [P]

**What**: Estender `Solicitacao` (campos do design SOL/APR), criar `enum DecisaoAprovacao` + `model Aprovacao`, relações em `User`; migration.
**Where**: `prisma/schema.prisma`, `prisma/migrations/**`
**Depends on**: None
**Reuses**: `Role`, `StatusSolicitacao`, `User`, `TipoFluxo`
**Requirement**: APR-09 (modelo), pré-requisito APR-01…

**Done when**:
- [ ] `Solicitacao` tem `solicitante_id`, `dados`, `etapa_atual`, `prazo_sla`, `aprovacoes`
- [ ] `Aprovacao` com `etapa`, `aprovador_role`, `aprovador_id?`, `decisao?`, `comentario?`, `resumo_ia?`, `decidido_em?`, `@@unique([solicitacao_id, etapa])`
- [ ] `User` tem `solicitacoes` e `aprovacoes`
- [ ] Migration aplicada; `npx prisma validate && npm run build` passa

**Tests**: none  
**Gate**: build  
**Commit**: `feat(aprovacoes): adiciona schema Aprovacao e completa Solicitacao`

---

### T2: `decisaoInputSchema` (Zod) [P]

**What**: Schema Zod de decisão com `decisao` enum e `comentario` opcional max 2000.
**Where**: `lib/validations/aprovacao.ts`, `lib/validations/aprovacao.test.ts`
**Depends on**: None
**Requirement**: APR-03, APR-04 (validação)

**Done when**:
- [ ] Schema exportado; testes: válido, decisao inválida, comentario > 2000 falha, ausente ok
- [ ] `npm test` no arquivo + build passam (≥3 casos)

**Tests**: unit  
**Gate**: quick + build  
**Commit**: `feat(aprovacoes): adiciona schema zod de decisao`

---

### T3: Stub `emitirAvancoEtapa` [P]

**What**: Evento no-op documentado para `notificacoes`.
**Where**: `lib/events/solicitacaoEvents.ts` (+ teste opcional que resolve sem throw)
**Depends on**: None
**Requirement**: APR-10 (gatilho)

**Done when**:
- [ ] Função async exportada; não lança; JSDoc aponta feature futura
- [ ] Build passa

**Tests**: none (ou 1 unit)  
**Gate**: build  
**Commit**: `feat(aprovacoes): adiciona stub de evento avanco de etapa`

---

### T4: `iaService.gerarResumoSolicitacao` [P]

**What**: Chamar OpenAI `gpt-4o-mini` server-side; retornar texto ou `null`; `Log ERRO` em falha/vazio; instalar dep `openai`.
**Where**: `lib/services/iaService.ts`, `lib/services/iaService.test.ts`, `package.json`
**Depends on**: None (mock openai nos testes)
**Requirement**: APR-13, APR-14, APR-15

**Done when**:
- [ ] Sucesso → string; falha/timeout/vazio → `null` + `registrar({ tipo: 'ERRO', acao: 'FALHA_IA', ... })`
- [ ] Nunca lança para o chamador por erro da OpenAI
- [ ] Testes cobrem sucesso e falha (≥2); gate quick + build

**Tests**: unit  
**Gate**: quick + build  
**Commit**: `feat(aprovacoes): adiciona iaService para resumo gpt-4o-mini`

---

### T5: `aprovacaoService.listarPendentes` + stubs/resumo

**What**: Listar fila do aprovador (APR-01/05/14); garantir stub `Aprovacao` da etapa; gerar `resumo_ia` se ausente via `iaService`.
**Where**: `lib/services/aprovacaoService.ts`, `lib/services/aprovacaoService.test.ts` (casos de listagem)
**Depends on**: T1, T4
**Requirement**: APR-01, APR-05, APR-13, APR-14

**Done when**:
- [ ] GESTOR: só equipe + `etapa_atual=GESTOR`
- [ ] RH_ADMIN: todas com `etapa_atual=RH_ADMIN`
- [ ] Sem resumo → card com `resumo_ia: null` (fluxo não quebra se IA falha)
- [ ] Testes unitários dos filtros + fallback IA; gate quick + build

**Tests**: unit  
**Gate**: quick + build  
**Commit**: `feat(aprovacoes): lista pendencias com filtro por papel`

---

### T6: `aprovacaoService.decidir` (authz + avanço)

**What**: Autorização APR-06/07/08; grava decisão; AUDITORIA; avança/finaliza/rejeita; stub próxima + IA + `emitirAvancoEtapa`.
**Where**: `lib/services/aprovacaoService.ts` (+ testes no mesmo `aprovacaoService.test.ts`)
**Depends on**: T1, T2, T3, T4, T5
**Requirement**: APR-03, APR-04, APR-06–12, APR-14

**Done when**:
- [ ] Papel errado / gestor errado / sem gestor_id / status final / já decidida → erro, sem mutação
- [ ] Aprovar com próxima etapa → `etapa_atual` avança, status PENDENTE, `Aprovacao` preenchida
- [ ] Aprovar última → status APROVADA
- [ ] Rejeitar → status REJEITADA
- [ ] `Log AUDITORIA` em toda decisão; IA falha não reverte decisão
- [ ] Testes cobrem authz + avanço + rejeição + race; gate quick + build

**Tests**: unit  
**Gate**: quick + build  
**Commit**: `feat(aprovacoes): implementa decisao com autorizacao e avanco`

---

### T7: Rotas API pendentes + decidir [P]

**What**: `GET /api/aprovacoes/pendentes` e `POST /api/aprovacoes/[solicitacaoId]/decidir`.
**Where**: `app/api/aprovacoes/pendentes/route.ts`, `app/api/aprovacoes/[solicitacaoId]/decidir/route.ts`
**Depends on**: T2, T5, T6
**Requirement**: APR-03–08 (exposição HTTP)

**Done when**:
- [ ] Auth 401/403; Zod 400; domain 403/404/409 mapeados
- [ ] Build passa

**Tests**: none  
**Gate**: build  
**Commit**: `feat(aprovacoes): adiciona rotas de fila e decisao`

---

### T8: Tokens CSS + tipografia mockup [P]

**What**: Aplicar tokens FluxoRH (mockup) e fontes Fraunces / Inter / IBM Plex Mono no app (layout/globals) para a tela de aprovações ficar fiel.
**Where**: `app/globals.css`, `app/layout.tsx` (fonts)
**Depends on**: None (pode paralelizar com T7; ideal antes/junto T9)
**Requirement**: UI mockup

**Done when**:
- [ ] CSS variables do mockup presentes; body usa Inter; headings usam Fraunces
- [ ] Sem dark-mode genérico conflitante na área do produto (alinhar ao paper claro do mockup)
- [ ] Build passa

**Tests**: none  
**Gate**: build  
**Commit**: `feat(aprovacoes): aplica tokens e tipografia do mockup`

---

### T9: Página Aprovações Pendentes + cards [P]

**What**: Server page + Client card (IA callout, SLA stamp, ações, empty state) conforme mockup.
**Where**: `app/(dashboard)/aprovacoes/page.tsx`, `app/(dashboard)/aprovacoes/_components/AprovacaoCard.tsx`, `aprovacoes.module.css`
**Depends on**: T5, T6, T7, T8
**Requirement**: APR-01–05, APR-14, APR-17

**Done when**:
- [ ] Gate GESTOR/RH_ADMIN; empty “Nenhuma aprovação pendente”
- [ ] Card: chip tipo, solicitante, id, stamp SLA, callout IA ou “resumo indisponível”, link detalhe, Aprovar/Rejeitar + comentário opcional via POST decidir
- [ ] Visual alinhado ao mockup (callout amarelo, botões primary/danger-ghost)
- [ ] Build passa

**Tests**: none  
**Gate**: build  
**Commit**: `feat(aprovacoes): adiciona tela de aprovacoes pendentes`

---

### T10: `listarHistorico` + rota [P] (P2)

**What**: Histórico de `Aprovacao` com checagem de visibilidade.
**Where**: `aprovacaoService.listarHistorico`, `app/api/aprovacoes/[solicitacaoId]/historico/route.ts`, testes
**Depends on**: T1, T6
**Requirement**: APR-16

**Done when**:
- [ ] Ordenado por `etapa`; nega quem não tem visibilidade (403)
- [ ] Testes de allow/deny; gate quick + build

**Tests**: unit  
**Gate**: quick + build  
**Commit**: `feat(aprovacoes): adiciona historico de decisoes`

---

## Traceability

| ID | Task(s) |
| --- | --- |
| APR-01 | T5, T9 |
| APR-02 | T9 |
| APR-03 | T2, T6, T7, T9 |
| APR-04 | T2, T6, T7, T9 |
| APR-05 | T5, T9 |
| APR-06 | T6, T7 |
| APR-07 | T6 |
| APR-08 | T6 |
| APR-09 | T1, T6 |
| APR-10 | T3, T6 |
| APR-11 | T6 |
| APR-12 | T6 |
| APR-13 | T4, T5, T6 |
| APR-14 | T4, T5, T6, T9 |
| APR-15 | T4 |
| APR-16 | T10 |
| APR-17 | T9 |

**Coverage:** 17/17 mapeados
