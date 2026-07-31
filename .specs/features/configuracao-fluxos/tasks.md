# Configuração de Fluxos Tasks

**Design**: `.specs/features/configuracao-fluxos/design.md`
**Status**: Draft

---

## Nota sobre estratégia de execução e teste

`design.md` (seção 0) foi atualizado nesta sessão: a fundação que ele previa criar (`Role`, auth, `logService`) **já existe de verdade**, entregue por `autenticacao-usuarios` (`authService.getSessionUser`/`requireUser`) e `auditoria-logs` (`logService.registrar`) — esta feature só reusa, não recria. A única fundação real ainda faltante e criada aqui é o model `Solicitacao` (mínimo), necessário pra CONF-07.

Convenção de teste já estabelecida no repo (Vitest configurado em `vitest.config.mts`, `npm run test`, ver `autenticacao-usuarios/tasks.md`):

| Code Layer | Test Type | Parallel-Safe |
| --- | --- | --- |
| `lib/services/*.ts` (`tipoFluxoService`) | unit (Vitest, Prisma/logService mockados) | Yes |
| `lib/validations/*.ts` (Zod) | unit (Vitest) | Yes |
| `prisma/schema.prisma` | none — `prisma validate` + migration real | Yes |
| API Routes (`app/api/**/route.ts`) | none — são finas por convenção do `CLAUDE.md` (auth + Zod + chamada ao service, sem lógica própria); cobertura vem dos testes do service/validação + smoke manual | Yes |
| Componentes de UI | none — cenário manual (`npm run dev`) | Yes |

Gate check commands:
- `quick`: `npm run test`
- `build`: `npm run build` (+ `npx prisma validate` quando a task tocar `schema.prisma`)
- `full`: `npm run build && npx prisma validate && npm run test`

Banco real (Supabase) já está conectado nesta sessão (`.env`) — migrations desta feature podem ser aplicadas de verdade via `prisma migrate dev`/`deploy`, não só validadas.

---

## Execution Plan

```
Phase 1 (Parallel):
  ├── T1 [P] (schema: TipoFluxo + Solicitacao minimo)
  └── T2 [P] (validations Zod)

Phase 2 (Sequential):
  T1 done → T3 (tipoFluxoService)

Phase 3 (Parallel):
  T2,T3 done → T4 [P] (rotas)
  T3      done → T5 [P] (UI: lista)

Phase 4 (Sequential):
  T4 done → T6 (UI: form)

Phase 5 (Sequential):
  T6,T3 done → T7 (UI: paginas novo/editar)
```

---

## Task Breakdown

### T1: Modelo `TipoFluxo` + `Solicitacao` mínima [P]

**What**: Adicionar `model TipoFluxo` (`nome` único, `campos_formulario` Json, `etapas` Json, timestamps, relação inversa `solicitacoes`) e a fundação mínima `enum StatusSolicitacao` + `model Solicitacao` (`id`, `tipo_fluxo_id` com FK real pra `TipoFluxo`, `status`, `criado_em`) ao `schema.prisma`, exatamente como especificado em `design.md` (seção `prisma/schema.prisma`). Gerar e aplicar migration real.
**Where**: `prisma/schema.prisma` (append), `prisma/migrations/`
**Depends on**: None (`Role`/`User`/`Log` já existem — reusar, não recriar)
**Reuses**: nenhum model existente é alterado além da relação inversa em `TipoFluxo`
**Requirement**: CONF-02, CONF-03, CONF-04, CONF-05, CONF-07 (fundação de dados)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `model TipoFluxo` com `nome @unique`, `campos_formulario Json`, `etapas Json`, `criado_em`, `atualizado_em`, `solicitacoes Solicitacao[]`
- [ ] `enum StatusSolicitacao { PENDENTE APROVADA REJEITADA }` e `model Solicitacao` com `tipo_fluxo_id` como FK real (`@relation`), `status @default(PENDENTE)`, índices em `tipo_fluxo_id` e `status`
- [ ] `@@map` consistente com a convenção já usada (`tipos_fluxo`, `solicitacoes`)
- [ ] Migration gerada e aplicada sem erro contra o Supabase real
- [ ] Gate check passa: `npx prisma validate` + `prisma migrate status` (up to date)

**Tests**: none
**Gate**: build

**Commit**: `feat(config-fluxos): adiciona modelo TipoFluxo e Solicitacao minima`

---

### T2: Schemas Zod de `TipoFluxo` [P]

**What**: `lib/validations/tipoFluxo.ts` com `campoFormularioSchema` (valida `chave`, `rotulo`, `tipo` ∈ `{texto,numero,data,selecao}`, `obrigatorio`, `opcoes` obrigatório apenas quando `tipo === 'selecao'`, `min`/`max` só relevantes em `texto`/`numero`) e `tipoFluxoInputSchema` (`nome` não vazio/trim, `campos_formulario` com mínimo 1 item, `etapas` com mínimo 1 item, cada item ∈ `{GESTOR, RH_ADMIN}`).
**Where**: `lib/validations/tipoFluxo.ts`
**Depends on**: None
**Reuses**: nada
**Requirement**: CONF-03, CONF-04, CONF-08

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `nome` vazio ou só espaços → rejeitado
- [ ] `etapas` vazio → rejeitado
- [ ] `etapas` com papel fora de `{GESTOR, RH_ADMIN}` (incluindo `SOLICITANTE`) → rejeitado
- [ ] `campos_formulario` vazio → rejeitado (mínimo 1 campo, decisão do design)
- [ ] Campo `tipo: 'selecao'` sem `opcoes` → rejeitado; com `opcoes` → aceito
- [ ] Campo válido de cada tipo semântico (`texto`, `numero`, `data`, `selecao`) → aceito
- [ ] Gate check passa: `npm run test`

**Tests**: unit
**Gate**: quick

**Verify**:
```
npm run test -- tipoFluxo
```

**Commit**: `feat(config-fluxos): adiciona schemas Zod de TipoFluxo`

---

### T3: `tipoFluxoService`

**What**: `lib/services/tipoFluxoService.ts` com `listar()`, `buscarPorId(id)`, `criar(dados, usuarioId)`, `editar(id, dados, usuarioId)` — conforme contrato do `design.md`. `criar`/`editar` chamam `logService.registrar({ tipo: 'AUDITORIA', entidade: 'TipoFluxo', entidade_id, acao: 'CRIACAO'|'EDICAO', usuario_id: usuarioId })` no sucesso. `editar` conta `Solicitacao` com `tipo_fluxo_id = id` e `status = 'PENDENTE'` antes de atualizar; lança `ErroEdicaoBloqueada` se > 0. `nome` duplicado (`P2002`) traduzido em erro de validação legível.
**Where**: `lib/services/tipoFluxoService.ts`
**Depends on**: T1
**Reuses**: `lib/prisma.ts`, `logService.registrar` (já existe)
**Requirement**: CONF-02, CONF-05, CONF-06, CONF-07, CONF-09

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `listar()` retorna todos os `TipoFluxo` (id + nome, no mínimo)
- [ ] `buscarPorId(id)` retorna o registro completo; lança `ErroNaoEncontrado` se não existir
- [ ] `criar(dados, usuarioId)` persiste e chama `logService.registrar` com `tipo: 'AUDITORIA'`, `acao: 'CRIACAO'`
- [ ] `criar` com `nome` duplicado → erro de validação legível (não o erro bruto do Prisma), nada persistido além do já existente
- [ ] `editar(id, dados, usuarioId)` com `Solicitacao` `PENDENTE` vinculada → lança `ErroEdicaoBloqueada`, registro NÃO é alterado, `logService` NÃO é chamado
- [ ] `editar` sem pendências → atualiza e chama `logService.registrar` com `acao: 'EDICAO'`
- [ ] `editar` com `id` inexistente → lança `ErroNaoEncontrado`
- [ ] Gate check passa: `npm run test`

**Tests**: unit
**Gate**: quick

**Verify**:
```
npm run test -- tipoFluxoService
```

**Commit**: `feat(config-fluxos): implementa tipoFluxoService com bloqueio de edicao e auditoria`

---

### T4: Rotas `app/api/tipos-fluxo` [P]

**What**: `app/api/tipos-fluxo/route.ts` (`GET` lista, `POST` cria) e `app/api/tipos-fluxo/[id]/route.ts` (`GET` busca, `PUT` edita) — `authService.requireUser(['RH_ADMIN'])` → Zod (`tipoFluxoInputSchema`, só em `POST`/`PUT`) → `tipoFluxoService`. Mapeamento de erro: `ErroNaoAutenticado`→401, `ErroNaoAutorizado`→403, Zod inválido→400, `ErroNaoEncontrado`→404, erro de `nome` duplicado→409, `ErroEdicaoBloqueada`→409.
**Where**: `app/api/tipos-fluxo/route.ts`, `app/api/tipos-fluxo/[id]/route.ts`
**Depends on**: T2, T3
**Reuses**: `authService.requireUser` (já existe), `tipoFluxoInputSchema` (T2), `tipoFluxoService` (T3)
**Requirement**: CONF-01, CONF-06, CONF-08

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Sem sessão ou papel ≠ `RH_ADMIN` → 401/403, `tipoFluxoService` nunca é chamado
- [ ] `POST`/`PUT` com corpo inválido (Zod) → 400, `tipoFluxoService` nunca é chamado
- [ ] `POST` válido → 201/200 com o `TipoFluxo` criado
- [ ] `PUT` em `id` inexistente → 404
- [ ] `PUT` bloqueado por pendência → 409 com mensagem citando quantidade de solicitações pendentes
- [ ] `nome` duplicado no `POST` → 409
- [ ] Gate check passa: `npm run build`

**Tests**: none
**Gate**: build

**Verify**: smoke manual via `npm run dev` + `curl`/fetch — confirmar cada status HTTP acima com uma sessão `RH_ADMIN` real já seedada nesta sessão (`rh.admin@01tec.com.br` / `Teste@123`) e com uma sessão `GESTOR`/`SOLICITANTE` pra confirmar o bloqueio.

**Commit**: `feat(config-fluxos): implementa rotas de tipos de fluxo com autorizacao RH_ADMIN`

---

### T5: UI — listagem de tipos de fluxo [P]

**What**: `app/(dashboard)/configuracao-fluxos/page.tsx` — Server Component: `authService.requireUser(['RH_ADMIN'])` (redirect/mensagem de acesso restrito, mesmo padrão de `auditoria-logs/page.tsx`); chama `tipoFluxoService.listar()` DIRETO (sem round-trip pela API — não há filtro/paginação nesta tela, diferente de `auditoria-logs`) e renderiza a lista (nome + link para editar); estado vazio explícito quando não há nenhum `TipoFluxo`; link/botão para "Novo tipo de fluxo".
**Where**: `app/(dashboard)/configuracao-fluxos/page.tsx`
**Depends on**: T3
**Reuses**: `tipoFluxoService.listar`, `authService.requireUser`
**Requirement**: CONF-01, CONF-06

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `RH_ADMIN` vê a lista de `TipoFluxo` cadastrados
- [ ] `GESTOR`/`SOLICITANTE` bloqueados no backend (mesmo padrão de `auditoria-logs`)
- [ ] Lista vazia → estado vazio explícito, sem erro
- [ ] Gate check passa: `npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(config-fluxos): implementa listagem de tipos de fluxo`

---

### T6: UI — formulário de `TipoFluxo`

**What**: `_components/TipoFluxoForm.tsx` (Client Component: campo `nome` + `EtapasEditor` + `CampoFormularioEditor`, submete `POST`/`PUT` pra `app/api/tipos-fluxo` conforme modo criar/editar) + `_components/EtapasEditor.tsx` (lista ordenável de `GESTOR`/`RH_ADMIN`, add/remove/reordenar) + `_components/CampoFormularioEditor.tsx` (lista de `CampoFormularioDefinicao`, add/remove/reordenar, campos condicionais por `tipo`). Os 3 arquivos tratados como uma task só — cohesivos (mesmo formulário, estado compartilhado de "lista de etapas"/"lista de campos" sobe pro componente pai `TipoFluxoForm`), mesma justificativa de granularidade usada em `auditoria-logs` T6.
**Where**: `app/(dashboard)/configuracao-fluxos/_components/TipoFluxoForm.tsx`, `.../_components/EtapasEditor.tsx`, `.../_components/CampoFormularioEditor.tsx`
**Depends on**: T4
**Reuses**: `POST`/`PUT /api/tipos-fluxo` (T4)
**Requirement**: CONF-02, CONF-03, CONF-04

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `EtapasEditor`: adicionar/remover/reordenar papéis; bloqueia submit se lista vazia (mensagem inline, sem chamar API)
- [ ] `CampoFormularioEditor`: adicionar/remover/reordenar campos; campo `opcoes` só aparece quando `tipo === 'selecao'`; bloqueia submit se lista vazia
- [ ] Submit válido → `POST` (modo criar) ou `PUT` (modo editar); erro do backend (400/409) exibido de forma legível, sem crash
- [ ] Sucesso → redireciona pra listagem (T5)
- [ ] Gate check passa: `npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(config-fluxos): implementa formulario de tipo de fluxo (etapas e campos)`

---

### T7: UI — páginas de criação/edição

**What**: `app/(dashboard)/configuracao-fluxos/novo/page.tsx` (Server Component: gate RH_ADMIN, renderiza `TipoFluxoForm` em modo criar) e `app/(dashboard)/configuracao-fluxos/[id]/editar/page.tsx` (Server Component: gate RH_ADMIN, chama `tipoFluxoService.buscarPorId(id)` DIRETO pra pré-carregar os dados, passa como prop pro `TipoFluxoForm` em modo editar; `id` inexistente → 404).
**Where**: `app/(dashboard)/configuracao-fluxos/novo/page.tsx`, `app/(dashboard)/configuracao-fluxos/[id]/editar/page.tsx`
**Depends on**: T6, T3
**Reuses**: `TipoFluxoForm` (T6), `tipoFluxoService.buscarPorId` (T3), `authService.requireUser`
**Requirement**: CONF-01, CONF-07

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `RH_ADMIN` acessa `/novo` → formulário vazio em modo criar
- [ ] `RH_ADMIN` acessa `/[id]/editar` com id existente → formulário pré-preenchido com os dados reais
- [ ] `/[id]/editar` com id inexistente → 404
- [ ] `GESTOR`/`SOLICITANTE` bloqueados em ambas
- [ ] Gate check passa: `npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(config-fluxos): implementa paginas de criacao e edicao de tipo de fluxo`

---

## Parallel Execution Map

```
Phase 1 (Parallel):
  ├── T1 [P]
  └── T2 [P]

Phase 2 (Sequential):
  T1 done → T3

Phase 3 (Parallel):
  T2,T3 done → T4 [P]
  T3      done → T5 [P]

Phase 4 (Sequential):
  T4 done → T6

Phase 5 (Sequential):
  T6,T3 done → T7
```

Execução real desta sessão é sequencial (um subagente por vez, mesmo padrão de `auditoria-logs`/`autenticacao-usuarios`) — o paralelismo acima documenta dependências reais, não implica execução concorrente de fato.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Schema TipoFluxo + Solicitacao mínima | 2 models coesos (1 novo + 1 fundação mínima) | ✅ Granular |
| T2: Schemas Zod | 1 arquivo, 2 schemas relacionados | ✅ Granular |
| T3: tipoFluxoService | 1 arquivo, 4 funções coesas (mesmo domínio) | ✅ Granular |
| T4: Rotas tipos-fluxo | 2 arquivos, 1 concern (CRUD HTTP) | ✅ Granular |
| T5: UI listagem | 1 arquivo | ✅ Granular |
| T6: UI formulário | 3 arquivos, 1 concern coeso (estado do formulário) | ✅ Granular (2-3 coisas relacionadas) |
| T7: UI páginas novo/editar | 2 arquivos, 1 concern (wrapper fino do formulário) | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Fase 1, sem seta de entrada | ✅ Match |
| T2 | None | Fase 1, sem seta de entrada | ✅ Match |
| T3 | T1 | Fase 2 ← T1 | ✅ Match |
| T4 | T2, T3 | Fase 3 ← T2,T3 | ✅ Match |
| T5 | T3 | Fase 3 ← T3 | ✅ Match |
| T6 | T4 | Fase 4 ← T4 | ✅ Match |
| T7 | T6, T3 | Fase 5 ← T6,T3 | ✅ Match |

Nenhuma task `[P]` depende de outra `[P]` na mesma fase (T1/T2 independentes; T4/T5 ambas só dependem de tasks de fases anteriores, não uma da outra) — verificado.

---

## Test Co-location Validation

| Task | Código Criado/Modificado | Convenção Exige | Task Diz | Status |
| --- | --- | --- | --- | --- |
| T1: Schema | schema (sem lógica própria) | none | none | ✅ OK |
| T2: Zod schemas | `lib/validations/*.ts` | unit | unit | ✅ OK |
| T3: tipoFluxoService | `lib/services/*.ts` | unit | unit | ✅ OK |
| T4: Rotas | API route (fina, sem lógica própria) | none | none | ✅ OK |
| T5: UI listagem | Componente de UI | none | none | ✅ OK |
| T6: UI formulário | Componente de UI | none | none | ✅ OK |
| T7: UI páginas | Componente de UI (wrapper) | none | none | ✅ OK |

Nenhuma violação — nenhuma task usa "testado em outra task" como justificativa pra pular teste onde a convenção exige `unit` (T2, T3 escrevem seus próprios testes).

---

## Requirement Traceability (atualização)

| Requirement ID | Task(s) |
| --- | --- |
| CONF-01 | T4, T5, T7 |
| CONF-02 | T1, T2, T3 |
| CONF-03 | T1, T2, T6 |
| CONF-04 | T1, T2, T6 |
| CONF-05 | T1, T3 |
| CONF-06 | T3, T4, T5 |
| CONF-07 | T1, T3, T7 |
| CONF-08 | T2, T4 |
| CONF-09 | T3 |

Coverage: 9/9 requisitos mapeados para pelo menos 1 task.

---

## Riscos / Pontos a verificar na fase de Execute

- `design.md` seção 0 foi reconciliada nesta sessão (nomes reais `authService.requireUser`/`logService.registrar` em vez de `getUsuarioAutenticado`/`requireRole`/`registrarLog`) — os diagramas mermaid do `design.md` ainda usam os nomes antigos como ilustração histórica, não corrigidos linha a linha; a implementação segue os nomes reais desta tasks.md.
- Model `Solicitacao` criado aqui é mínimo (só `tipo_fluxo_id`/`status`) — quando a feature `solicitacoes` for desenhada, deve estender esse model (não recriar), conforme já registrado em `design.md`.
- Nenhuma decisão de "Questão em Aberto" ficou pendente no spec (#1-#4 resolvidas em `context.md`/`design.md`); #5 (exclusão/desativação) e #6 (SLA por fluxo) permanecem fora de escopo, sem impacto nestas tasks.
