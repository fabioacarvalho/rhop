# MCP Integration Tasks

**Design**: `.specs/features/mcp-integration/design.md`
**Status**: Draft

---

## Execution Plan

### Phase 1: Foundation (Sequential)

```
T1 → T3 → T4
T2 → T3
```

`T1` (schema) e `T2` (registry) são independentes entre si, mas ambos precisam terminar antes de `T3` (`requireMcpUser` usa o campo novo de `ApiKey`/`User` e o registry). `T4` (handshake) depende de `T1`, `T2` e `T3` estarem prontos.

### Phase 2: Tools (Sequential — mesmo arquivo, sem `[P]`)

```
T4 → T5 → T6 → T7 → T8 → T9
```

T5–T9 são logicamente independentes (uma tool cada), mas todas editam `lib/services/mcpServerManager.ts` — marcar como `[P]` violaria a regra "sem estado mutável compartilhado entre tasks paralelas" (aqui, o mesmo arquivo). Executadas em sequência, cada uma sozinha.

### Phase 3: Seeds de apoio (Parallel OK)

```
T4 ──┬→ T10 [P]
     └→ T11 [P]
```

Depois do handshake (`T4`) suportar `usuario_id`, os dois scripts de seed podem ser ajustados em paralelo (arquivos diferentes, sem dependência entre si).

---

## Task Breakdown

### T1: Adicionar `usuario_id` ao model `ApiKey`

**What**: Adicionar campo `usuario_id String? @db.Uuid` + relação `usuario User?` ao `model ApiKey` em `prisma/schema.prisma`, gerar e aplicar a migration.
**Where**: `prisma/schema.prisma`, `prisma/migrations/`
**Depends on**: None
**Reuses**: mesmo padrão `@db.Uuid` de `Equipe.gestor_id`
**Requirement**: MCP-04

**Tools**:
- MCP: NONE
- Skill: `supabase-postgres-best-practices` (schema/migration em Postgres)

**Done when**:
- [ ] Campo `usuario_id` e relação `usuario` adicionados ao `model ApiKey`
- [ ] Migration aditiva gerada e aplicada, nullable (não quebra `ApiKey` existentes)
- [ ] `npx prisma validate` passa

**Tests**: none (mudança de schema; validada pelo gate abaixo, não por teste unitário)
**Gate**: `npx prisma validate`

---

### T2: Criar `mcpSessionRegistry.ts`

**What**: Novo módulo com `registrar(sessionId, usuarioId)`, `remover(sessionId)`, `obter(sessionId)` sobre um `Map<string, string>` em memória.
**Where**: `lib/services/mcpSessionRegistry.ts` (novo)
**Depends on**: None
**Reuses**: mesmo padrão do `Map<string, NextSSEServerTransport>` `transports` em `app/api/mcp/route.ts`
**Requirement**: MCP-05

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `registrar`/`remover`/`obter` implementados e exportados
- [ ] `obter` de um `sessionId` nunca registrado retorna `undefined` (não lança)
- [ ] Gate check passa: `npm test -- lib/services/mcpSessionRegistry.test.ts`
- [ ] Test count: 3+ testes passam (registrar+obter, remover, obter inexistente)

**Tests**: unit
**Gate**: quick

---

### T3: Adicionar `requireMcpUser` a `authService.ts`

**What**: Nova função `requireMcpUser(sessionId: string, roles?: Role[]): Promise<AuthenticatedUser>` — busca `usuarioId` via `mcpSessionRegistry.obter`, resolve `User` fresco no Prisma, valida `ativo` e `roles`, lança `ErroNaoAutenticado`/`ErroNaoAutorizado` (reusados) ou retorna `AuthenticatedUser`.
**Where**: `lib/services/authService.ts` (modificar, adicionar export novo)
**Depends on**: T1, T2
**Reuses**: `AuthenticatedUser`, `ErroNaoAutenticado`, `ErroNaoAutorizado`, `logService.registrar` (mesmo padrão de log de `getSessionUser`)
**Requirement**: MCP-06

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `sessionId` sem `usuarioId` registrado → `ErroNaoAutenticado`
- [ ] `usuarioId` registrado mas `User` não existe mais ou `ativo: false` → `ErroNaoAutenticado` + `Log` tipo `ERRO`
- [ ] `roles` informado e papel fora da lista → `ErroNaoAutorizado`
- [ ] Caminho feliz retorna `AuthenticatedUser` correto
- [ ] Gate check passa: `npm test -- lib/services/authService.test.ts`
- [ ] Test count: 4+ testes passam (os 4 cenários acima)

**Tests**: unit
**Gate**: quick

---

### T4: Handshake `GET /api/mcp` resolve e registra identidade

**What**: Depois de validar a `ApiKey`, se `apiKey.usuario_id` existir, buscar o `User` (checar `ativo`) e chamar `mcpSessionRegistry.registrar(transport.sessionId, usuario.id)`; no `transport.onclose`, chamar `mcpSessionRegistry.remover(...)` ao lado do `transports.delete(...)` já existente.
**Where**: `app/api/mcp/route.ts` (modificar)
**Depends on**: T1, T2, T3
**Reuses**: fluxo de validação de `ApiKey` já existente, `transport.onclose` já existente
**Requirement**: MCP-07

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `ApiKey` com `usuario_id` válido → sessão registrada no `mcpSessionRegistry`
- [ ] `ApiKey` sem `usuario_id` → conexão SSE segue normalmente, sem registrar identidade
- [ ] `usuario_id` aponta para `User` inexistente/inativo → conexão SSE é recusada (mesmo tratamento de `ApiKey` inválida, `401`) e `Log` tipo `ERRO` gravado
- [ ] `onclose` remove a entrada do registry
- [ ] Gate check passa: `npm test -- app/api/mcp/route.test.ts`
- [ ] Test count: 4+ testes passam (os 4 cenários acima)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(mcp): vincula ApiKey a User e resolve identidade real por sessao MCP`

---

### T5: Migrar `listar_pendentes` para `requireMcpUser`

**What**: Remover os parâmetros `usuario_id`/`papel` do schema Zod da tool; handler passa a chamar `requireMcpUser(extra.sessionId, [Role.GESTOR, Role.RH_ADMIN])` e usar o `AuthenticatedUser` retornado em vez do objeto fake atual.
**Where**: `lib/services/mcpServerManager.ts` (modificar)
**Depends on**: T4
**Reuses**: `dashboardService.listar` (sem mudança), `requireMcpUser` (T3)
**Requirement**: MCP-08

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Tool não aceita mais `usuario_id`/`papel` como input
- [ ] Sessão sem identidade → `isError: true`, `dashboardService.listar` não é chamado
- [ ] Sessão com papel `SOLICITANTE` → `isError: true` (papel não permitido)
- [ ] Sessão com `GESTOR`/`RH_ADMIN` válido → `dashboardService.listar` chamado com o `AuthenticatedUser` real
- [ ] Gate check passa: `npm test -- lib/services/mcpServerManager.test.ts`
- [ ] Test count: 3+ testes passam (os 3 cenários acima)

**Tests**: unit
**Gate**: quick

---

### T6: Tool `adicionar_curriculo`

**What**: Registrar tool nova com input = shape de `candidatoInputSchema`; handler exportado `handleAdicionarCurriculo` chama `requireMcpUser(extra.sessionId, [Role.GESTOR, Role.RH_ADMIN])` → `candidatoService.cadastrar(dados, usuario.id)`.
**Where**: `lib/services/mcpServerManager.ts` (modificar)
**Depends on**: T5
**Reuses**: `candidatoInputSchema` (`lib/validations/candidato.ts`), `candidatoService.cadastrar`, `requireMcpUser`
**Requirement**: MCP-09

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Sessão sem identidade → `isError: true`, service não chamado
- [ ] Papel `SOLICITANTE` → `isError: true` (papel não permitido)
- [ ] `email` duplicado → `isError: true` com mensagem de `ErroEmailDuplicado`
- [ ] Caminho feliz cria o `Candidato` e retorna o registro no `content`
- [ ] Gate check passa: `npm test -- lib/services/mcpServerManager.test.ts`
- [ ] Test count: 4+ novos testes passam (cumulativo com T5)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(mcp): adiciona tool adicionar_curriculo`

---

### T7: Tool `adicionar_solicitacao`

**What**: Registrar tool nova com input = shape de `solicitacaoInputSchema`; handler exportado `handleAdicionarSolicitacao` chama `requireMcpUser(extra.sessionId)` (sem restrição de papel) → `solicitacaoService.criar(input, usuario.id)`.
**Where**: `lib/services/mcpServerManager.ts` (modificar)
**Depends on**: T6
**Reuses**: `solicitacaoInputSchema` (`lib/validations/solicitacao.ts`), `solicitacaoService.criar`, `requireMcpUser`
**Requirement**: MCP-10

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Sessão sem identidade → `isError: true`, service não chamado
- [ ] `tipo_fluxo_id` inexistente → `isError: true` com mensagem de `ErroTipoFluxoNaoEncontrado`
- [ ] `dados` inválidos → `isError: true` incluindo detalhe por campo (`erro.erros`)
- [ ] Caminho feliz cria a `Solicitacao` e retorna `{ id, status, etapa_atual, prazo_sla }`
- [ ] Gate check passa: `npm test -- lib/services/mcpServerManager.test.ts`
- [ ] Test count: 4+ novos testes passam (cumulativo)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(mcp): adiciona tool adicionar_solicitacao`

---

### T8: Tool `aprovar_solicitacao`

**What**: Registrar tool nova com input `{ solicitacao_id: z.string() }` + shape de `decisaoInputSchema`; handler exportado `handleAprovarSolicitacao` chama `requireMcpUser(extra.sessionId, [Role.GESTOR, Role.RH_ADMIN])` → `aprovacaoService.decidir(solicitacao_id, usuario, { decisao, comentario })`.
**Where**: `lib/services/mcpServerManager.ts` (modificar)
**Depends on**: T7
**Reuses**: `decisaoInputSchema` (`lib/validations/aprovacao.ts`), `aprovacaoService.decidir`, `requireMcpUser`
**Requirement**: MCP-11

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Sessão sem identidade → `isError: true`, service não chamado
- [ ] Papel `SOLICITANTE` → `isError: true` antes de consultar a solicitação
- [ ] `solicitacao_id` inexistente → `isError: true` com mensagem de `ErroNaoEncontrado`
- [ ] `GESTOR` de outra equipe (ou papel ≠ etapa atual) → `isError: true` com mensagem de `ErroNaoAutorizadoAprovacao`, `Solicitacao` inalterada
- [ ] Solicitação já decidida → `isError: true` com mensagem de `ErroDecisaoInvalida`
- [ ] Caminho feliz decide a etapa e retorna a `Solicitacao` atualizada
- [ ] Gate check passa: `npm test -- lib/services/mcpServerManager.test.ts`
- [ ] Test count: 6+ novos testes passam (cumulativo)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(mcp): adiciona tool aprovar_solicitacao`

---

### T9: Tool `exibir_detalhes`

**What**: Registrar tool nova com input `{ tipo: z.enum(["solicitacao","curriculo"]), id: z.string() }`; handler exportado `handleExibirDetalhes` ramifica: `tipo: "solicitacao"` → `requireMcpUser(extra.sessionId)` → `solicitacaoService.buscarDetalhePorId(id, usuario)`; `tipo: "curriculo"` → `requireMcpUser(extra.sessionId, [Role.GESTOR, Role.RH_ADMIN])` → `candidatoService.buscarPorId(id)`.
**Where**: `lib/services/mcpServerManager.ts` (modificar)
**Depends on**: T8
**Reuses**: `solicitacaoService.buscarDetalhePorId`, `candidatoService.buscarPorId`, `requireMcpUser`
**Requirement**: MCP-12, MCP-13

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `tipo: "solicitacao"` sem identidade → `isError: true`
- [ ] `tipo: "solicitacao"` sem visibilidade (dono/gestor/RH_Admin) → `isError: true` com mensagem de `ErroAcessoNegado`
- [ ] `tipo: "solicitacao"` com `id` inexistente → `isError: true` com mensagem de `ErroNaoEncontrado`
- [ ] `tipo: "curriculo"` com papel `SOLICITANTE` → `isError: true`
- [ ] `tipo: "curriculo"` com `id` inexistente → `isError: true`
- [ ] Caminho feliz de ambos os `tipo` retorna o JSON de detalhe correspondente
- [ ] Gate check passa: `npm test -- lib/services/mcpServerManager.test.ts`
- [ ] Test count: 6+ novos testes passam (cumulativo)

**Tests**: unit
**Gate**: full (`npm test && npm run build` — última task do arquivo mais sensível do servidor MCP, roda o build completo antes de fechar a fase)

**Commit**: `feat(mcp): adiciona tool exibir_detalhes`

---

### T10: Ajustar `scripts/seed-apikey.ts` para aceitar `usuario_id` [P]

**What**: Script de seed passa a aceitar um e-mail/ID de usuário opcional e, se informado, gravar `usuario_id` na `ApiKey` criada.
**Where**: `scripts/seed-apikey.ts` (modificar)
**Depends on**: T4
**Reuses**: script existente, só estendido
**Requirement**: MCP-04 (suporte operacional)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Script aceita parâmetro opcional de usuário e grava `usuario_id` quando informado
- [ ] Sem o parâmetro, comportamento atual (chave sem vínculo) é preservado
- [ ] Gate check passa: `npm run build`

**Tests**: none (script de dev/seed, sem infraestrutura de teste no projeto para scripts)
**Gate**: build

---

### T11: Ajustar `app/api/dev/seed-mcp/route.ts` para aceitar `usuario_id` [P]

**What**: Endpoint de dev passa a aceitar um parâmetro de usuário (query string) e, se informado, gravar `usuario_id` na `ApiKey` gerada.
**Where**: `app/api/dev/seed-mcp/route.ts` (modificar)
**Depends on**: T4
**Reuses**: rota existente, só estendida
**Requirement**: MCP-04 (suporte operacional)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Endpoint aceita parâmetro opcional e grava `usuario_id` quando informado
- [ ] Sem o parâmetro, comportamento atual é preservado
- [ ] Gate check passa: `npm run build`

**Tests**: none (endpoint de dev, mesmo critério de T10)
**Gate**: build

---

## Parallel Execution Map

```
Phase 1 (Sequential, com 2 entradas independentes):
  T1 ──┐
       ├──→ T3 ──→ T4
  T2 ──┘

Phase 2 (Sequential — mesmo arquivo mcpServerManager.ts):
  T4 ──→ T5 ──→ T6 ──→ T7 ──→ T8 ──→ T9

Phase 3 (Parallel):
  T4 completo (via T9 no fim da Fase 2), então:
    ├── T10 [P]
    └── T11 [P]
```

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Adicionar `usuario_id` ao model `ApiKey` | 1 schema change + migration | ✅ Granular |
| T2: Criar `mcpSessionRegistry.ts` | 1 arquivo novo, 3 funções coesas | ✅ Granular |
| T3: Adicionar `requireMcpUser` | 1 função nova em 1 arquivo | ✅ Granular |
| T4: Handshake resolve identidade | 1 arquivo, 1 fluxo (handshake) | ✅ Granular |
| T5: Migrar `listar_pendentes` | 1 tool | ✅ Granular |
| T6: Tool `adicionar_curriculo` | 1 tool | ✅ Granular |
| T7: Tool `adicionar_solicitacao` | 1 tool | ✅ Granular |
| T8: Tool `aprovar_solicitacao` | 1 tool | ✅ Granular |
| T9: Tool `exibir_detalhes` | 1 tool (2 ramos do mesmo input, mesmo conceito) | ✅ Granular |
| T10: Ajustar seed script | 1 arquivo | ✅ Granular |
| T11: Ajustar endpoint de dev seed | 1 arquivo | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Entra direto na Fase 1, sem seta de entrada | ✅ Match |
| T2 | None | Entra direto na Fase 1, sem seta de entrada | ✅ Match |
| T3 | T1, T2 | `T1 → T3`, `T2 → T3` | ✅ Match |
| T4 | T1, T2, T3 | `T3 → T4` (T1/T2 já convergem em T3) | ✅ Match |
| T5 | T4 | `T4 → T5` | ✅ Match |
| T6 | T5 | `T5 → T6` | ✅ Match |
| T7 | T6 | `T6 → T7` | ✅ Match |
| T8 | T7 | `T7 → T8` | ✅ Match |
| T9 | T8 | `T8 → T9` | ✅ Match |
| T10 | T4 | `T4 → T10 [P]` (via conclusão da Fase 2) | ✅ Match |
| T11 | T4 | `T4 → T11 [P]` (via conclusão da Fase 2) | ✅ Match |

---

## Test Co-location Validation

Não existe `.specs/codebase/TESTING.md` neste projeto (brownfield sem esse doc específico). A matriz abaixo foi inferida da convenção já em uso no repositório: testes unitários colocados em `*.test.ts` ao lado do arquivo, usando `vitest` + `vi.mock` para Prisma/services (ex: `aprovacaoService.test.ts`, `app/api/cron/sla-check/route.test.ts`), rodados via `npm test` (`vitest run`); gate de build via `npm run build`; nenhuma infraestrutura de teste e2e/integration foi encontrada no projeto.

| Task | Código Criado/Modificado | Convenção Exige | Task Diz | Status |
| --- | --- | --- | --- | --- |
| T1 | Schema Prisma | Nenhum teste unitário (padrão do projeto: mudança de schema valida via `prisma validate`) | none | ✅ OK |
| T2 | `lib/services/mcpSessionRegistry.ts` (módulo de serviço) | unit | unit | ✅ OK |
| T3 | `lib/services/authService.ts` (função de serviço) | unit | unit | ✅ OK |
| T4 | `app/api/mcp/route.ts` (route handler) | unit (convenção confirmada por `route.test.ts` já existentes no projeto) | unit | ✅ OK |
| T5 | `lib/services/mcpServerManager.ts` (handler de tool) | unit | unit | ✅ OK |
| T6 | `lib/services/mcpServerManager.ts` (handler de tool) | unit | unit | ✅ OK |
| T7 | `lib/services/mcpServerManager.ts` (handler de tool) | unit | unit | ✅ OK |
| T8 | `lib/services/mcpServerManager.ts` (handler de tool) | unit | unit | ✅ OK |
| T9 | `lib/services/mcpServerManager.ts` (handler de tool) | unit | unit | ✅ OK |
| T10 | `scripts/seed-apikey.ts` (script de dev, sem convenção de teste no projeto) | none | none | ✅ OK |
| T11 | `app/api/dev/seed-mcp/route.ts` (endpoint de dev) | none (rota exclusivamente de dev/seed, fora do matcher de auth) | none | ✅ OK |

---

## Tips

- **Fase 2 é sequencial por design** — todas as tools novas vivem em `mcpServerManager.ts`; não force `[P]` só porque as tools são conceitualmente independentes.
- **`requireMcpUser` é o gate de tudo** — nenhuma task de tool (T5–T9) deve aceitar `usuario_id`/`papel` como parâmetro de input, mesmo que pareça mais simples para o teste.
- **Commit por task de tool** — cada tool nova (T4/T6/T7/T8/T9) tem seu próprio commit, granular e revertível isoladamente.
- **T10/T11 só depois de T4** — sem o handshake suportando `usuario_id`, os scripts de seed não têm o que popular.

---

## Antes de Executar: MCPs e Skills por Task

Nenhuma task desta feature precisa de MCP externo (todo trabalho é leitura/escrita de arquivos locais + Prisma). Skills sugeridas:

- **T1**: `supabase-postgres-best-practices` (schema/migration Postgres)
- **T2–T11**: nenhuma skill específica necessária — seguem convenções já estabelecidas no projeto (services, validations, testes vitest)

Confirmar com o usuário antes de iniciar a Execução: usar essas skills como estão, ou pular e seguir só pelas convenções do projeto?
