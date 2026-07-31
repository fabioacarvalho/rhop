# Solicitações — Tasks

**Design**: `.specs/features/solicitacoes/design.md`
**Status**: Draft

---

## 0. Nota sobre TESTING.md

Não existe `.specs/codebase/TESTING.md`. O projeto já tem 3 features implementadas
(`autenticacao-usuarios`, `auditoria-logs`, `configuracao-fluxos`) com um padrão de teste
consistente e verificável no código — por isso a matriz abaixo foi **inferida da convenção
real do repositório**, não inventada, e não bloqueei a criação das tasks numa pergunta cuja
resposta já está no código:

| Camada | Tipo de teste | Evidência |
| --- | --- | --- |
| `lib/validations/*.ts` | unit (vitest, `*.test.ts` colocado) | `lib/validations/tipoFluxo.test.ts` |
| `lib/services/*.ts` | unit (vitest, `*.test.ts` colocado, Prisma/services mockados) | `logService.test.ts`, `tipoFluxoService.test.ts`, `authService.test.ts`, `userService.test.ts` |
| `prisma/schema.prisma` | none — validado via `npx prisma validate` | nenhum teste de schema em nenhuma feature anterior |
| `app/api/**/route.ts` | none — sem teste de rota em nenhuma feature anterior | 0 arquivos `*.test.ts` em `app/api/**` |
| `app/(dashboard)/**/*.tsx` (páginas e componentes) | none — sem `@testing-library/*` instalado (só `vitest` puro) | 0 arquivos `*.test.tsx`, `package.json` sem lib de teste de componente |

**Gate Check Commands:**

- `quick` → `npm test` (vitest run; task pode restringir ao arquivo específico durante o desenvolvimento)
- `build` → `npx prisma validate && npm run build` — **mandatório em toda task**, por regra explícita do `CLAUDE.md` ("Como validar o trabalho"), independente de a camada ter teste unitário ou não.

Ou seja: tasks em `lib/validations`/`lib/services` rodam **quick + build**; tasks em schema/rotas/UI rodam **só build**.

**Parallelism:** todas as camadas acima são parallel-safe entre arquivos diferentes (mocks isolados,
sem estado compartilhado). O que quebra paralelismo é duas tasks tocando o **mesmo arquivo** — não
o tipo de teste.

---

## Execution Plan

### Phase 1: Foundation (Parallel)

Nenhuma depende de código novo desta feature — todas usam apenas o que já existe
(`tipoFluxo.ts`, `Role`, Prisma atual).

```
T1 [P] ──┐
T2 [P] ──┤
T3 [P] ──┼──→ (Phase 2)
T4 [P] ──┘
```

### Phase 2: Service Layer (Sequential)

```
T1, T3 ──→ T5
```

### Phase 3: Routes + Read-side UI (Parallel)

Todas dependem só de T5 (e T6 também de T2); nenhuma toca o mesmo arquivo que outra.

```
        ┌→ T6 [P] (precisa T2 + T5)
T5 ─────┼→ T7 [P]
        ├→ T8 [P]
        └→ T11 [P]
```

### Phase 4: Fluxo "Nova Solicitação" (Sequential)

```
T4, T6 ──→ T9 ──→ T10
```

---

## Task Breakdown

### T1: Estender `model Solicitacao` + migration

**What**: Adicionar `solicitante_id`, `dados`, `etapa_atual`, `prazo_sla` ao `model Solicitacao`,
os índices `solicitante_id`/`etapa_atual`, e a relação inversa `solicitacoes Solicitacao[]` em
`model User`; gerar e aplicar a migration.
**Where**: `prisma/schema.prisma`, `prisma/migrations/**` (nova pasta gerada por `prisma migrate dev`)
**Depends on**: None
**Reuses**: `model TipoFluxo`, `enum Role` (`autenticacao-usuarios`), `model User`
**Requirement**: SOL-08 (schema para `prazo_sla`)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `Solicitacao` tem `solicitante_id String @db.Uuid`, `solicitante User @relation(...)`, `dados Json`, `etapa_atual Role`, `prazo_sla DateTime`
- [ ] `@@index([solicitante_id])` e `@@index([etapa_atual])` adicionados (mantendo os já existentes)
- [ ] `User` ganha `solicitacoes Solicitacao[]`
- [ ] Migration gerada (`npx prisma migrate dev --name extende_solicitacao`) e aplicada sem erro
- [ ] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(solicitacoes): estende model Solicitacao com campos de criacao`

---

### T2: `solicitacaoInputSchema` (envelope Zod) [P]

**What**: Schema Zod do envelope da requisição de criação (`tipo_fluxo_id` + `dados` genérico) —
não valida os campos dinâmicos (isso é T3, no service).
**Where**: `lib/validations/solicitacao.ts` (+ `lib/validations/solicitacao.test.ts`)
**Depends on**: None
**Reuses**: padrão de `lib/validations/tipoFluxo.ts` (schema Zod + teste colocado)
**Requirement**: SOL-06 (validação de envelope antes do service)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `solicitacaoInputSchema = z.object({ tipo_fluxo_id: z.string().min(1), dados: z.record(z.string(), z.unknown()) })`
- [ ] Teste cobre: válido passa; `tipo_fluxo_id` vazio/ausente falha; `dados` que não é objeto falha
- [ ] Gate check passa: `npm test` (arquivo `solicitacao.test.ts`)
- [ ] Gate check passa: `npx prisma validate && npm run build`
- [ ] Test count: ≥3 casos (sem deleção silenciosa)

**Tests**: unit
**Gate**: quick + build

**Commit**: `feat(solicitacoes): adiciona schema zod do envelope de criacao`

---

### T3: `validarDados` (`solicitacaoDados.ts`) [P]

**What**: Função que valida `dados` contra `campos_formulario` de um `TipoFluxo`, campo a campo
(obrigatoriedade + tipo semântico), ignorando silenciosamente chaves extras.
**Where**: `lib/validations/solicitacaoDados.ts` (+ `lib/validations/solicitacaoDados.test.ts`)
**Depends on**: None
**Reuses**: `CampoFormularioDefinicao`/`TipoCampo` de `lib/validations/tipoFluxo.ts` (não redefine o tipo)
**Requirement**: SOL-06

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `validarDados(dados, campos): { valido: true } | { valido: false; erros: Array<{ chave, mensagem }> }`
- [ ] Campo `obrigatorio` ausente/vazio → erro
- [ ] Tipo `numero`: valor não numérico OU fora de `min`/`max` → erro
- [ ] Tipo `data`: valor não parseável como data → erro
- [ ] Tipo `selecao`: valor fora de `opcoes` → erro
- [ ] Tipo `texto`: fora de `min`/`max` (tamanho da string) → erro
- [ ] Chave em `dados` sem correspondência em `campos_formulario` → ignorada, sem erro
- [ ] Gate check passa: `npm test` (arquivo `solicitacaoDados.test.ts`)
- [ ] Gate check passa: `npx prisma validate && npm run build`
- [ ] Test count: ≥8 casos (um por regra acima, incluindo o caminho feliz)

**Tests**: unit
**Gate**: quick + build

**Commit**: `feat(solicitacoes): adiciona validacao de dados dinamicos contra campos_formulario`

---

### T4: `CampoDinamico.tsx` [P]

**What**: Client Component que renderiza o input correto por `tipo` semântico de campo
(`texto`→text, `numero`→number, `data`→date, `selecao`→select com `opcoes`), aplicando
`obrigatorio`/`min`/`max` como atributos HTML nativos (validação client é só UX).
**Where**: `app/(dashboard)/solicitacoes/nova/_components/CampoDinamico.tsx`
**Depends on**: None
**Reuses**: `CampoFormularioDefinicao`/`TipoCampo` de `lib/validations/tipoFluxo.ts`; padrão visual de
`CampoFormularioEditor.tsx` (`configuracao-fluxos`)
**Requirement**: SOL-05

**Tools**:
- MCP: NONE
- Skill: `frontend-design` (definido pelo usuário para tasks de UI)

**Done when**:
- [ ] Um input por `tipo` (texto/numero/data/selecao), controlado (`value`/`onChange` sobem pro form pai)
- [ ] `obrigatorio` vira `required`; `min`/`max` viram atributos nativos quando `tipo` é `texto`/`numero`
- [ ] `selecao` renderiza `<select>` com `opcoes`
- [ ] Sem erros de TypeScript
- [ ] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none (sem `@testing-library/*` no projeto — convenção existente)
**Gate**: build

**Commit**: `feat(solicitacoes): adiciona componente de campo dinamico`

---

### T5: `solicitacaoService.ts` (criar / listarMinhas / buscarDetalhePorId)

**What**: Service completo — `SLA_HORAS` constante, `criar` (busca `TipoFluxo`, valida `dados`,
define `etapa_atual`/`prazo_sla`, persiste, grava `Log AUDITORIA`), `listarMinhas` (filtra por
`solicitante_id`), `buscarDetalhePorId` (404 se não existe, 403/`ErroAcessoNegado` se não é o dono).
**Where**: `lib/services/solicitacaoService.ts` (+ `lib/services/solicitacaoService.test.ts`)
**Depends on**: T1 (campos novos do Prisma), T3 (`validarDados`)
**Reuses**: `tipoFluxoService.buscarPorId`, `logService.registrar`, padrão de erro/mensagem de
`tipoFluxoService.ts` (`ErroNaoEncontrado`, try/catch de `Prisma.PrismaClientKnownRequestError`)
**Requirement**: SOL-01, SOL-06 a SOL-13

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `ErroTipoFluxoNaoEncontrado`, `ErroNaoEncontrado`, `ErroAcessoNegado` exportados
- [ ] `criar`: `tipo_fluxo_id` inexistente → `ErroTipoFluxoNaoEncontrado`; `dados` inválido (via
      `validarDados`) → não persiste, retorna erros por campo; sucesso → `status=PENDENTE`,
      `etapa_atual=etapas[0]`, `prazo_sla=now+48h`, grava `Log AUDITORIA`
- [ ] `listarMinhas(solicitanteId)`: `where solicitante_id`, `orderBy criado_em desc`, inclui `tipoFluxo.nome`
- [ ] `buscarDetalhePorId(id, solicitanteId)`: inexistente → `ErroNaoEncontrado`; de outro dono →
      `ErroAcessoNegado`; do próprio dono → retorna detalhe completo
- [ ] Falha de `logService.registrar` (mockada rejeitando) não impede `criar` de retornar sucesso
- [ ] Gate check passa: `npm test` (arquivo `solicitacaoService.test.ts`)
- [ ] Gate check passa: `npx prisma validate && npm run build`
- [ ] Test count: ≥10 casos (criar feliz/tipo-inexistente/dados-inválidos/log-falha, listarMinhas,
      buscarDetalhePorId feliz/não-encontrado/acesso-negado)

**Tests**: unit
**Gate**: quick + build

**Commit**: `feat(solicitacoes): implementa solicitacaoService (criar, listar, detalhe)`

---

### T6: `app/api/solicitacoes/route.ts` (GET lista + POST cria) [P]

**What**: `GET` → `requireUser()` (sem restrição de papel) → `listarMinhas(usuario.id)`. `POST` →
`requireUser()` → valida com `solicitacaoInputSchema` → `criar(dados, usuario.id)`.
**Where**: `app/api/solicitacoes/route.ts`
**Depends on**: T2 (`solicitacaoInputSchema`), T5 (`solicitacaoService`)
**Reuses**: `authService.requireUser`, padrão de rota de `app/api/tipos-fluxo/route.ts`
(try/catch mapeando erro → status)
**Requirement**: SOL-01, SOL-04, SOL-06 a SOL-08

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `GET`: sem sessão → 401; autenticado → 200 com lista de `listarMinhas`
- [ ] `POST`: sem sessão → 401; corpo inválido (Zod) → 400 com `detalhes`; `ErroTipoFluxoNaoEncontrado` → 404;
      sucesso → 201 com a `Solicitacao` criada
- [ ] Nenhuma lógica de negócio na rota (delega tudo pro service, conforme `CLAUDE.md`)
- [ ] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none (sem teste de rota em nenhuma feature anterior — convenção existente)
**Gate**: build

**Commit**: `feat(solicitacoes): adiciona rota GET/POST /api/solicitacoes`

---

### T7: `app/api/solicitacoes/[id]/route.ts` (GET detalhe) [P]

**What**: `GET` → `requireUser()` → `buscarDetalhePorId(id, usuario.id)`.
**Where**: `app/api/solicitacoes/[id]/route.ts`
**Depends on**: T5 (`solicitacaoService`)
**Reuses**: `authService.requireUser`, padrão de `app/api/tipos-fluxo/[id]/route.ts`
**Requirement**: SOL-10 a SOL-12

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Sem sessão → 401
- [ ] `id` inexistente → 404
- [ ] `id` de outro solicitante → 403
- [ ] `id` do próprio solicitante → 200 com detalhe
- [ ] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(solicitacoes): adiciona rota GET /api/solicitacoes/[id]`

---

### T8: `app/(dashboard)/solicitacoes/page.tsx` (Minhas Solicitações) [P]

**What**: Server Component: `requireUser()` (sem restrição de papel); chama
`solicitacaoService.listarMinhas` DIRETO (sem round-trip); lista com tipo/status/data; estado
vazio; botão "Nova Solicitação".
**Where**: `app/(dashboard)/solicitacoes/page.tsx`
**Depends on**: T5 (`solicitacaoService`)
**Reuses**: padrão de `app/(dashboard)/configuracao-fluxos/page.tsx` (gate de acesso + chamada
direta ao service em Server Component)
**Requirement**: SOL-01 a SOL-03, SOL-14, SOL-15

**Tools**:
- MCP: NONE
- Skill: `frontend-design`

**Done when**:
- [ ] Sem sessão → `redirect('/login')`
- [ ] Lista mostra tipo (`tipoFluxo.nome`), `status`, `criado_em`, indicador visual por status (SOL-14)
- [ ] Lista vazia → mensagem explícita (SOL-15)
- [ ] Botão/link "Nova Solicitação" → `/solicitacoes/nova`
- [ ] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(solicitacoes): implementa pagina Minhas Solicitacoes`

---

### T9: `NovaSolicitacaoForm.tsx`

**What**: Client Component: seletor de `TipoFluxo`; ao selecionar, `fetch('/api/tipos-fluxo/{id}')`
(rota já existente) pra pegar `campos_formulario`; renderiza um `<CampoDinamico>` por campo;
submete `POST /api/solicitacoes`; desabilita botão de submit durante o `fetch` (anti-duplicação
mínima, conforme design); sucesso → redireciona pra `/solicitacoes`.
**Where**: `app/(dashboard)/solicitacoes/nova/_components/NovaSolicitacaoForm.tsx`
**Depends on**: T4 (`CampoDinamico`), T6 (rota `POST /api/solicitacoes`)
**Reuses**: `GET /api/tipos-fluxo/[id]` (já existente), `CampoDinamico`
**Requirement**: SOL-05, SOL-06, SOL-09

**Tools**:
- MCP: NONE
- Skill: `frontend-design`

**Done when**:
- [ ] Seletor lista `tiposDisponiveis` (prop vinda da página)
- [ ] Selecionar tipo busca `campos_formulario` via `fetch` e renderiza um `CampoDinamico` por campo
- [ ] Submit desabilitado durante o `fetch` do POST
- [ ] Erro 400 do backend exibe mensagem por campo (usa `detalhes` da resposta)
- [ ] Sucesso (201) → redireciona pra `/solicitacoes`
- [ ] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(solicitacoes): implementa formulario de nova solicitacao`

---

### T10: `app/(dashboard)/solicitacoes/nova/page.tsx`

**What**: Server Component: `requireUser()`; chama `tipoFluxoService.listar()` DIRETO; renderiza
`<NovaSolicitacaoForm tiposDisponiveis={...} />`.
**Where**: `app/(dashboard)/solicitacoes/nova/page.tsx`
**Depends on**: T9 (`NovaSolicitacaoForm`)
**Reuses**: `tipoFluxoService.listar()` (já existente), padrão de Server Component de
`configuracao-fluxos/page.tsx`
**Requirement**: SOL-03, SOL-04, SOL-05

**Tools**:
- MCP: NONE
- Skill: `frontend-design`

**Done when**:
- [ ] Sem sessão → `redirect('/login')`
- [ ] `tiposDisponiveis` vem de `tipoFluxoService.listar()`, passado como prop
- [ ] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(solicitacoes): implementa pagina Nova Solicitacao`

---

### T11: `app/(dashboard)/solicitacoes/[id]/page.tsx` (detalhe, P2) [P]

**What**: Server Component: `requireUser()`; `solicitacaoService.buscarDetalhePorId(id, usuario.id)`
DIRETO; `ErroAcessoNegado`/`ErroNaoEncontrado` → mensagem/`notFound()`; exibe `dados` rotulados
conforme `campos_formulario` do `TipoFluxo`.
**Where**: `app/(dashboard)/solicitacoes/[id]/page.tsx`
**Depends on**: T5 (`solicitacaoService`)
**Reuses**: `tipoFluxoService.buscarPorId` (pra rotular `dados` pelos `campos_formulario`),
`next/navigation` `notFound()`
**Requirement**: SOL-10 a SOL-12 (P2 — não bloqueia o restante da feature)

**Tools**:
- MCP: NONE
- Skill: `frontend-design`

**Done when**:
- [ ] Sem sessão → `redirect('/login')`
- [ ] `id` inexistente → `notFound()`
- [ ] `id` de outro solicitante (`ErroAcessoNegado`) → mensagem "Você não tem acesso a esta solicitação"
- [ ] `id` do próprio solicitante → exibe `dados` rotulados por `campos_formulario` (busca `TipoFluxo` via `tipoFluxoService.buscarPorId`)
- [ ] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(solicitacoes): implementa pagina de detalhe da solicitacao (P2)`

---

## Parallel Execution Map

```
Phase 1 (Parallel, sem dependencias):
  T1 [P] · T2 [P] · T3 [P] · T4 [P]

Phase 2 (Sequential):
  T1, T3 completos ──→ T5

Phase 3 (Parallel, todas dependem so de T5):
  T5 completo, entao:
    ├── T6  [P]  (tambem precisa T2)
    ├── T7  [P]
    ├── T8  [P]
    └── T11 [P]

Phase 4 (Sequential):
  T4, T6 completos ──→ T9 ──→ T10
```

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Estender model + migration | 1 arquivo de schema + 1 migration | ✅ Granular |
| T2: solicitacaoInputSchema | 1 schema Zod | ✅ Granular |
| T3: validarDados | 1 função | ✅ Granular |
| T4: CampoDinamico | 1 componente | ✅ Granular |
| T5: solicitacaoService | 3 funções cohesivas no mesmo arquivo (mesmo padrão de `tipoFluxoService.ts`) | ✅ Granular (cohesivo, mesmo arquivo) |
| T6: route.ts (GET+POST) | 1 arquivo de rota | ✅ Granular |
| T7: [id]/route.ts | 1 arquivo de rota | ✅ Granular |
| T8: page.tsx (listagem) | 1 página | ✅ Granular |
| T9: NovaSolicitacaoForm | 1 componente | ✅ Granular |
| T10: nova/page.tsx | 1 página | ✅ Granular |
| T11: [id]/page.tsx | 1 página | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Phase 1, sem seta de entrada | ✅ Match |
| T2 | None | Phase 1, sem seta de entrada | ✅ Match |
| T3 | None | Phase 1, sem seta de entrada | ✅ Match |
| T4 | None | Phase 1, sem seta de entrada | ✅ Match |
| T5 | T1, T3 | `T1, T3 ──→ T5` | ✅ Match |
| T6 | T2, T5 | `T5 ──→ T6` + T2 anotado ("tambem precisa T2") | ✅ Match |
| T7 | T5 | `T5 ──→ T7` | ✅ Match |
| T8 | T5 | `T5 ──→ T8` | ✅ Match |
| T11 | T5 | `T5 ──→ T11` | ✅ Match |
| T9 | T4, T6 | `T4, T6 ──→ T9` | ✅ Match |
| T10 | T9 | `T9 ──→ T10` | ✅ Match |

Nenhum task em fase `[P]` depende de outro task na mesma fase — T6/T7/T8/T11 dependem todos só de
T5 (fase anterior), nunca entre si.

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | `prisma/schema.prisma` | none | none | ✅ OK |
| T2 | `lib/validations/solicitacao.ts` | unit | unit | ✅ OK |
| T3 | `lib/validations/solicitacaoDados.ts` | unit | unit | ✅ OK |
| T4 | `app/(dashboard)/.../CampoDinamico.tsx` | none | none | ✅ OK |
| T5 | `lib/services/solicitacaoService.ts` | unit | unit | ✅ OK |
| T6 | `app/api/solicitacoes/route.ts` | none | none | ✅ OK |
| T7 | `app/api/solicitacoes/[id]/route.ts` | none | none | ✅ OK |
| T8 | `app/(dashboard)/solicitacoes/page.tsx` | none | none | ✅ OK |
| T9 | `.../NovaSolicitacaoForm.tsx` | none | none | ✅ OK |
| T10 | `app/(dashboard)/solicitacoes/nova/page.tsx` | none | none | ✅ OK |
| T11 | `app/(dashboard)/solicitacoes/[id]/page.tsx` | none | none | ✅ OK |

Todos ✅ — nenhuma restruturação necessária.

---

## Riscos / Notas herdadas do design.md

- SOL-11 (side-effects de criação) permanece formalmente fora de escopo — nenhuma task aqui cobre.
- SOL-12 (edge: `TipoFluxo` sem etapas) é garantido por CONF-04 (`configuracao-fluxos`), não
  reimplementado em nenhuma task.
- T11 é P2 — pode ser adiada sem bloquear as demais (todas as outras não dependem dela).
