# Banco de Talentos — Tasks

**Design**: `.specs/features/banco-de-talentos/design.md`
**Status**: Rodada 1 concluída. Rodada 2 (esta revisão) pendente de execução — ver seção ao final do arquivo.

---

## 0. Escopo desta rodada de Tasks

Cobre apenas o que o `design.md` desenhou: as 3 histórias P1/MVP (Cadastrar, Listar, Buscar e Ranquear)
mais os pontos resolvidos em `context.md` (e-mail duplicado, botão Reprocessar, layout de busca,
validação de N) — requisitos **TAL-01 a TAL-19** e **TAL-26 a TAL-31**.

`TAL-20` a `TAL-25` (upload de PDF, vínculo a Vaga, detalhe + histórico) são P2/P3 e o `design.md`
explicitamente não os desenhou ("Fora deste ciclo") — nenhuma task aqui os implementa. Ficam para uma
rodada futura de Design + Tasks própria, quando o P1 estiver estável (mesmo critério do PRD §5).

## 0.1 Nota sobre TESTING.md

Não existe `.specs/codebase/TESTING.md`. Mesma inferência já usada em `solicitacoes/tasks.md`,
verificável no código atual (`autenticacao-usuarios`, `auditoria-logs`, `configuracao-fluxos`,
`solicitacoes` já implementadas):

| Camada | Tipo de teste | Evidência |
| --- | --- | --- |
| `lib/validations/*.ts` | unit (vitest, `*.test.ts` colocado) | `lib/validations/tipoFluxo.test.ts`, `solicitacao.test.ts` |
| `lib/services/*.ts` | unit (vitest, `*.test.ts` colocado, Prisma/OpenAI mockados) | `logService.test.ts`, `tipoFluxoService.test.ts`, `iaService.test.ts` |
| `prisma/schema.prisma` | none — validado via `npx prisma validate` | nenhum teste de schema em nenhuma feature anterior |
| `app/api/**/route.ts` | none — sem teste de rota em nenhuma feature anterior | 0 arquivos `*.test.ts` em `app/api/**` |
| `app/(dashboard)/**/*.tsx` | none — sem `@testing-library/*` instalado | 0 arquivos `*.test.tsx`, `package.json` sem lib de teste de componente |

**Gate Check Commands:**
- `quick` → `npm test` (vitest run, arquivo específico durante o desenvolvimento)
- `build` → `npx prisma validate && npm run build` — mandatório em toda task (`CLAUDE.md`)

**Parallelism:** parallel-safe entre arquivos diferentes; quebra só quando duas tasks tocam o mesmo arquivo.

---

## Execution Plan

### Phase 1: Foundation (Parallel)

```
T1 [P] ──┐
T2 [P] ──┤
T3 [P] ──┼──→ (Phase 2)
T4 [P] ──┤
T5 [P] ──┘
```

### Phase 2: Embedding (Sequential — depende do schema)

```
T1 ──→ T6
```

### Phase 3: Services (Sequential)

```
T1, T6      ──→ T7
T1, T6, T4  ──→ T8
```

### Phase 4: Routes (Parallel)

```
        ┌→ T9  [P] (precisa T2 + T7)
T7 ─────┼→ T10 [P] (precisa T7)
T8 ─────┴→ T11 [P] (precisa T3 + T8)
```

### Phase 5: UI leaf components (Parallel)

```
T10 ──→ T12 [P]
T9  ──→ T13 [P]
T11, T5 ──→ T14 [P]
```

### Phase 6: Pages (Parallel)

```
T7, T12 ──→ T15 [P]
T13     ──→ T16 [P]
T14     ──→ T17 [P]
```

---

## Task Breakdown

### T1: `model Candidato` + `enum StatusEmbedding` + migration (inclui extensão `pgvector`)

**What**: Adicionar `enum StatusEmbedding`, `model Candidato` (schema completo do `design.md`,
incluindo `embedding Unsupported("vector(1536)")?` e `@@unique` em `email`), relação inversa
`candidatos Candidato[]` em `User` e `Solicitacao`; habilitar a extensão `pgvector` no Postgres;
gerar e aplicar a migration.
**Where**: `prisma/schema.prisma`, `prisma/migrations/**`
**Depends on**: None
**Reuses**: `model User`, `model Solicitacao` (relação opcional), padrão de `@@map`/`@@index` já usado em `Solicitacao`
**Requirement**: TAL-01, TAL-27, TAL-28

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] **Primeiro passo**: confirmado (documentação oficial do Prisma para `prisma@^7.9.1` + `@prisma/adapter-pg`, ou teste direto no ambiente) como habilitar a extensão `vector` — via `previewFeatures = ["postgresqlExtensions"]` + `extensions = [vector]` no `datasource`, OU via migration SQL manual (`CREATE EXTENSION IF NOT EXISTS vector;`) antes do `Unsupported`. Este era o ponto sinalizado como incerto no `design.md` — não fabricar, verificar contra a doc oficial ou testar a migration real.
- [x] `enum StatusEmbedding { pendente processado falhou }` definido
- [x] `model Candidato` com todos os campos do `design.md`: `nome`, `email` (`@unique`), `telefone`, `curriculo_texto`, `curriculo_arquivo_url?`, `transcricao_texto`, `embedding Unsupported("vector(1536)")?`, `status_embedding StatusEmbedding @default(pendente)`, `solicitacao_id?`, `criado_por String @db.Uuid`, `criado_em`
- [x] `@@index([status_embedding])`, `@@index([solicitacao_id])`, `@@map("candidatos")`
- [x] `User` ganha `candidatos Candidato[]`; `Solicitacao` ganha `candidatos Candidato[]`
- [x] Migration gerada e aplicada sem erro (`npx prisma migrate dev --name adiciona_candidato`)
- [x] Query manual de teste (`INSERT`/`UPDATE` de um vetor de teste via `$executeRaw`, `SELECT ... <=>` via `$queryRaw`) confirma que a extensão está ativa e o tipo `vector` funciona neste ambiente
- [x] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(banco-de-talentos): adiciona model Candidato com embedding vetorial (pgvector)`

---

### T2: `candidatoInputSchema` (envelope Zod) [P]

**What**: Schema Zod do envelope de cadastro de candidato.
**Where**: `lib/validations/candidato.ts` (+ `lib/validations/candidato.test.ts`)
**Depends on**: None
**Reuses**: padrão de `lib/validations/tipoFluxo.ts` (schema + teste colocado)
**Requirement**: TAL-06

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `candidatoInputSchema = z.object({ nome: z.string().min(1), email: z.string().email(), telefone: z.string().min(1), curriculo_texto: z.string().min(1), transcricao_texto: z.string().min(1), solicitacao_id: z.string().optional() })`
- [x] Teste cobre: válido passa; cada campo obrigatório ausente/vazio falha; `email` mal formatado falha; `solicitacao_id` ausente é aceito (campo opcional)
- [x] Gate check passa: `npm test` (arquivo `candidato.test.ts`)
- [x] Gate check passa: `npx prisma validate && npm run build`
- [x] Test count: ≥6 casos (sem deleção silenciosa)

**Tests**: unit
**Gate**: quick + build

**Commit**: `feat(banco-de-talentos): adiciona schema zod do envelope de cadastro de candidato`

---

### T3: `talentoBuscaInputSchema` (envelope Zod) [P]

**What**: Schema Zod do envelope de busca (texto + N, com `default(20)`).
**Where**: `lib/validations/talentoBusca.ts` (+ `lib/validations/talentoBusca.test.ts`)
**Depends on**: None
**Reuses**: mesmo padrão de `lib/validations/tipoFluxo.ts`
**Requirement**: TAL-12, TAL-30 (envelope; teto máximo é validado no service, não aqui — ver `design.md`)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `talentoBuscaInputSchema = z.object({ texto: z.string().min(1), n: z.number().int().positive().default(20) })`
- [x] Teste cobre: válido passa; `texto` vazio/ausente falha; `n` ausente aplica default 20; `n` zero/negativo/não-inteiro falha (o teto máximo NÃO é testado aqui — é responsabilidade do service, T8)
- [x] Gate check passa: `npm test` (arquivo `talentoBusca.test.ts`)
- [x] Gate check passa: `npx prisma validate && npm run build`
- [x] Test count: ≥5 casos

**Tests**: unit
**Gate**: quick + build

**Commit**: `feat(banco-de-talentos): adiciona schema zod do envelope de busca`

---

### T4: `iaService.gerarJustificativaRanking` [P]

**What**: Nova função no `iaService` existente — gera justificativa textual de por que um candidato
ficou naquela posição do ranking, seguindo o mesmo padrão de resiliência de `gerarResumoSolicitacao`
(falha → `Log ERRO` + `null`, nunca lança).
**Where**: `lib/services/iaService.ts` (modifica), `lib/services/iaService.test.ts` (modifica)
**Depends on**: None
**Reuses**: estrutura de `gerarResumoSolicitacao` (mesmo arquivo) — client OpenAI, `registrar` de `logService`
**Requirement**: TAL-14

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `gerarJustificativaRanking(input: { candidatoId: string; nome: string; curriculoTexto: string; transcricaoTexto: string; queryTexto: string }): Promise<string | null>` exportada
- [x] Prompt inclui o texto da busca e o currículo/transcrição do candidato; resposta em português
- [x] Falha (chave ausente, erro de API, conteúdo vazio) → `Log ERRO` (`entidade: "Candidato"`, `entidade_id: candidatoId`, `acao: FALHA_IA`) + retorna `null`, nunca lança
- [x] Sucesso com conteúdo não-vazio → string trimada
- [x] Gate check passa: `npm test` (arquivo `iaService.test.ts`, casos novos + existentes intactos)
- [x] Gate check passa: `npx prisma validate && npm run build`
- [x] Test count: ≥4 casos novos (sucesso, chave ausente, erro de API, conteúdo vazio) sem quebrar os testes existentes de `gerarResumoSolicitacao`

**Tests**: unit
**Gate**: quick + build

**Commit**: `feat(banco-de-talentos): adiciona gerarJustificativaRanking ao iaService`

---

### T5: `CandidatoCard.tsx` [P]

**What**: Componente de apresentação puro (props → JSX) — card de candidato do ranking: nome,
e-mail, vaga vinculada (se houver), score de similaridade em barra visual + percentual, justificativa.
**Where**: `app/(dashboard)/banco-de-talentos/busca/_components/CandidatoCard.tsx`
**Depends on**: None (recebe `CandidatoRankeado` como prop, não busca dados)
**Reuses**: mesmo estilo inline (`style={{...}}`) do resto do projeto, sem lib de componentes
**Requirement**: TAL-15, TAL-31

**Tools**:
- MCP: NONE
- Skill: `frontend-design`

**Done when**:
- [x] Recebe `candidato: CandidatoRankeado` (nome, email, solicitacao_id, score 0-1, justificativa)
- [x] Renderiza score como barra visual (largura proporcional a `score`) + percentual (`Math.round(score * 100)}%`)
- [x] `justificativa === null` → exibe texto alternativo claro (ex: "Justificativa indisponível"), sem quebrar o card
- [x] Sem erros de TypeScript
- [x] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(banco-de-talentos): adiciona componente CandidatoCard`

---

### T6: `embeddingService.ts`

**What**: `gerar` (chama OpenAI embeddings, nunca lança), `persistirEmbedding` (`$executeRaw` UPDATE
com cast `::vector`), `marcarFalha` (`status_embedding = 'falhou'`).
**Where**: `lib/services/embeddingService.ts` (+ `lib/services/embeddingService.test.ts`)
**Depends on**: T1 (schema/migration com `Candidato`/`StatusEmbedding`)
**Reuses**: padrão de `iaService.gerarResumoSolicitacao` (resiliência), `lib/prisma.ts`
**Requirement**: TAL-03, TAL-04, TAL-05

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `gerar(texto: string): Promise<number[] | null>` — `client.embeddings.create({ model: "text-embedding-3-small", input: texto })`; falha (chave ausente, erro de API, timeout) → `Log ERRO` (`entidade: "Candidato"`, `acao: FALHA_IA`) + `null`, nunca lança
- [x] `persistirEmbedding(candidatoId: string, vetor: number[]): Promise<void>` — `$executeRaw` grava o vetor formatado como literal `vector` e `status_embedding = 'processado'`
- [x] `marcarFalha(candidatoId: string): Promise<void>` — `status_embedding = 'falhou'`
- [x] Gate check passa: `npm test` (arquivo `embeddingService.test.ts`, Prisma/OpenAI mockados)
- [x] Gate check passa: `npx prisma validate && npm run build`
- [x] Test count: ≥6 casos (gerar sucesso/chave-ausente/erro-api, persistirEmbedding, marcarFalha, formatação do vetor)

**Tests**: unit
**Gate**: quick + build

**Commit**: `feat(banco-de-talentos): implementa embeddingService`

---

### T7: `candidatoService.ts` (cadastrar / listar / reprocessarEmbedding)

**What**: `cadastrar` (cria com `status_embedding=pendente`, e-mail duplicado → `ErroEmailDuplicado`,
gera embedding síncrono, grava `Log AUDITORIA`), `listar` (todos, sem filtro por criador),
`reprocessarEmbedding` (só permitido quando `status_embedding = 'falhou'`).
**Where**: `lib/services/candidatoService.ts` (+ `lib/services/candidatoService.test.ts`)
**Depends on**: T1 (schema), T6 (`embeddingService`)
**Reuses**: padrão de erro `P2002` → domínio (`tipoFluxoService.ts`), `logService.registrar`
**Requirement**: TAL-01, TAL-04, TAL-05, TAL-07, TAL-08, TAL-09, TAL-28, TAL-29

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `ErroEmailDuplicado`, `ErroNaoEncontrado`, `ErroReprocessamentoNaoPermitido` exportados
- [x] `cadastrar(input, usuarioId)`: e-mail já existente (`P2002`) → `ErroEmailDuplicado`, sem persistir; sucesso → cria com `status_embedding=pendente`, chama `embeddingService.gerar` com `curriculo_texto + "\n" + transcricao_texto`, sucesso → `persistirEmbedding`, falha → `marcarFalha`; grava `Log AUDITORIA` (`acao: CRIACAO`) em ambos os casos
- [x] `listar()`: retorna todos os candidatos (`id, nome, email, status_embedding, criado_em`), sem filtro por `criado_por`, `orderBy criado_em desc`
- [x] `reprocessarEmbedding(id, usuarioId)`: `id` inexistente → `ErroNaoEncontrado`; `status_embedding !== 'falhou'` → `ErroReprocessamentoNaoPermitido`; senão repete o fluxo de geração de embedding de `cadastrar`
- [x] Falha de `logService.registrar` (mockada rejeitando) não impede `cadastrar` de retornar sucesso
- [x] Gate check passa: `npm test` (arquivo `candidatoService.test.ts`)
- [x] Gate check passa: `npx prisma validate && npm run build`
- [x] Test count: ≥10 casos (cadastrar feliz/embedding-sucesso/embedding-falha/email-duplicado/log-falha, listar, reprocessar feliz/não-encontrado/status-invalido)

**Tests**: unit
**Gate**: quick + build

**Commit**: `feat(banco-de-talentos): implementa candidatoService (cadastrar, listar, reprocessar)`

---

### T8: `talentoSearchService.ts`

**What**: `buscar` — valida `n` contra `TALENTO_BUSCA_N_MAXIMO` (fallback 100), gera embedding da
query, `$queryRaw` de similaridade (`ORDER BY embedding <=> ... WHERE status_embedding='processado'`),
chama `iaService.gerarJustificativaRanking` por item (falha isolada não interrompe o loop).
**Where**: `lib/services/talentoSearchService.ts` (+ `lib/services/talentoSearchService.test.ts`)
**Depends on**: T1 (schema), T6 (`embeddingService.gerar`), T4 (`iaService.gerarJustificativaRanking`)
**Reuses**: loop tolerante a falha isolada de `aprovacaoService.listarPendentes`
**Requirement**: TAL-12, TAL-13, TAL-14, TAL-16, TAL-17, TAL-19, TAL-26, TAL-30

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `N_MAXIMO_PADRAO = 100`; teto lido de `process.env.TALENTO_BUSCA_N_MAXIMO`, fallback `100` se ausente/inválido
- [x] `buscar(texto: string, n: number): Promise<ResultadoBusca>`: `n` fora de `1..teto` → lança `ErroNInvalido` (rota converte em 400)
- [x] `embeddingService.gerar(texto)` falha (`null`) → lança `ErroBuscaIndisponivel` (rota converte em 422)
- [x] `$queryRaw` filtra `status_embedding='processado'`, ordena por `embedding <=> vetor`, `LIMIT n`, calcula `score = 1 - distancia` (0-1)
- [x] Nenhum candidato `processado` → retorna `{ candidatos: [], disponivel: false }`, sem lançar
- [x] Para cada candidato do resultado, chama `gerarJustificativaRanking`; falha em um item não interrompe os demais (item fica com `justificativa: null`)
- [x] Gate check passa: `npm test` (arquivo `talentoSearchService.test.ts`, Prisma/`iaService`/`embeddingService` mockados)
- [x] Gate check passa: `npx prisma validate && npm run build`
- [x] Test count: ≥8 casos (n inválido, n acima do teto, embedding-da-query-falha, nenhum-processado, ranking-feliz, justificativa-falha-isolada, teto-via-env, teto-fallback)

**Tests**: unit
**Gate**: quick + build

**Commit**: `feat(banco-de-talentos): implementa talentoSearchService`

---

### T9: `app/api/candidatos/route.ts` (GET lista + POST cadastro) [P]

**What**: `GET` → `requireUser([GESTOR, RH_ADMIN])` → `candidatoService.listar()`. `POST` →
`requireUser([...])` → Zod (`candidatoInputSchema`) → `candidatoService.cadastrar`.
**Where**: `app/api/candidatos/route.ts`
**Depends on**: T2 (`candidatoInputSchema`), T7 (`candidatoService`)
**Reuses**: padrão de `app/api/tipos-fluxo/route.ts` (try/catch mapeando erro → status)
**Requirement**: TAL-01, TAL-02, TAL-06, TAL-07, TAL-08, TAL-10, TAL-28

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `GET`: sem sessão → 401; papel SOLICITANTE → 403; GESTOR/RH_ADMIN → 200 com lista de `listar()`
- [x] `POST`: sem sessão → 401; papel SOLICITANTE → 403; corpo inválido (Zod) → 400 com `detalhes`; `ErroEmailDuplicado` → 409; sucesso → 201 com o `Candidato` criado
- [x] Nenhuma lógica de negócio na rota
- [x] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(banco-de-talentos): adiciona rota GET/POST /api/candidatos`

---

### T10: `app/api/candidatos/[id]/reprocessar/route.ts` [P]

**What**: `POST` → `requireUser([GESTOR, RH_ADMIN])` → `candidatoService.reprocessarEmbedding(id, usuario.id)`.
**Where**: `app/api/candidatos/[id]/reprocessar/route.ts`
**Depends on**: T7 (`candidatoService`)
**Reuses**: mesmo padrão de rota
**Requirement**: TAL-10, TAL-29

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Sem sessão → 401; papel SOLICITANTE → 403
- [x] `id` inexistente → 404 (`ErroNaoEncontrado`)
- [x] `status_embedding !== 'falhou'` → 409 (`ErroReprocessamentoNaoPermitido`)
- [x] Sucesso → 200 com o `Candidato` atualizado
- [x] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(banco-de-talentos): adiciona rota POST /api/candidatos/[id]/reprocessar`

---

### T11: `app/api/candidatos/busca/route.ts` [P]

**What**: `POST` → `requireUser([GESTOR, RH_ADMIN])` → Zod (`talentoBuscaInputSchema`) →
`talentoSearchService.buscar`.
**Where**: `app/api/candidatos/busca/route.ts`
**Depends on**: T3 (`talentoBuscaInputSchema`), T8 (`talentoSearchService`)
**Reuses**: mesmo padrão de rota
**Requirement**: TAL-12 a TAL-19, TAL-26, TAL-30

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Sem sessão → 401; papel SOLICITANTE → 403
- [x] Corpo inválido (Zod) → 400
- [x] `ErroNInvalido` → 400 com mensagem citando o teto atual
- [x] `ErroBuscaIndisponivel` → 422
- [x] Sucesso → 200 com `ResultadoBusca` (`candidatos`, `disponivel`)
- [x] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(banco-de-talentos): adiciona rota POST /api/candidatos/busca`

---

### T12: `ReprocessarButton.tsx` [P]

**What**: Client Component pequeno — botão que chama `POST /api/candidatos/[id]/reprocessar`,
com estado de loading e feedback de sucesso/erro.
**Where**: `app/(dashboard)/banco-de-talentos/_components/ReprocessarButton.tsx`
**Depends on**: T10 (rota `POST /api/candidatos/[id]/reprocessar`)
**Reuses**: mesmo estilo inline do projeto
**Requirement**: TAL-29

**Tools**:
- MCP: NONE
- Skill: `frontend-design`

**Done when**:
- [x] Recebe `candidatoId: string` como prop
- [x] Ao clicar, desabilita o botão, chama a rota, mostra estado de carregamento
- [x] Sucesso → feedback visual + atualiza a linha (ex: `router.refresh()`)
- [x] Erro (409/500) → mensagem clara, botão reabilitado
- [x] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(banco-de-talentos): adiciona componente ReprocessarButton`

---

### T13: `NovoCandidatoForm.tsx` [P]

**What**: Client Component — formulário com os 5 campos obrigatórios (nome, e-mail, telefone,
currículo colado, transcrição colada); submete `POST /api/candidatos`; exibe erro 409 (e-mail
duplicado) inline no campo e-mail; sucesso → redireciona pra listagem.
**Where**: `app/(dashboard)/banco-de-talentos/novo/_components/NovoCandidatoForm.tsx`
**Depends on**: T9 (rota `POST /api/candidatos`)
**Reuses**: mesmo estilo inline do projeto
**Requirement**: TAL-06, TAL-28

**Tools**:
- MCP: NONE
- Skill: `frontend-design`

**Done when**:
- [x] 5 campos obrigatórios renderizados, `required` nativo (validação client é só UX)
- [x] Submit desabilitado durante o `fetch`
- [x] Erro 400 (Zod) exibe mensagem de validação; erro 409 exibe mensagem no campo e-mail especificamente ("Já existe candidato com este e-mail")
- [x] Sucesso (201) → redireciona pra `/banco-de-talentos`
- [x] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(banco-de-talentos): implementa formulario de cadastro de candidato`

---

### T14: `BuscaForm.tsx` [P]

**What**: Client Component — campo de texto livre (perfil desejado) + campo N (padrão 20); submete
`POST /api/candidatos/busca`; renderiza resultados com `CandidatoCard`; trata `disponivel: false`
com mensagem clara; N inválido bloqueia antes de submeter (espelha a regra do service).
**Where**: `app/(dashboard)/banco-de-talentos/busca/_components/BuscaForm.tsx`
**Depends on**: T11 (rota `POST /api/candidatos/busca`), T5 (`CandidatoCard`)
**Reuses**: `CandidatoCard`
**Requirement**: TAL-15, TAL-16, TAL-26, TAL-30, TAL-31

**Tools**:
- MCP: NONE
- Skill: `frontend-design`

**Done when**:
- [x] Campo de texto (obrigatório) + campo N (numérico, default 20)
- [x] N inválido (não numérico, ≤0) bloqueia o submit com mensagem clara antes de chamar a API
- [x] Erro 400/422 da API exibe mensagem retornada pelo backend
- [x] `disponivel: false` → mensagem "nenhum candidato disponível para busca ainda"
- [x] `disponivel: true` → renderiza um `CandidatoCard` por resultado, na ordem retornada
- [x] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(banco-de-talentos): implementa formulario de busca e ranking`

---

### T15: `app/(dashboard)/banco-de-talentos/page.tsx` (Listar Candidatos) [P]

**What**: Server Component: gate `requireUser([GESTOR, RH_ADMIN])`; chama `candidatoService.listar()`
DIRETO; lista com nome, e-mail, badge de `status_embedding`; `ReprocessarButton` só na linha `falhou`;
links "Novo Candidato" e "Buscar Candidatos"; estado vazio.
**Where**: `app/(dashboard)/banco-de-talentos/page.tsx`
**Depends on**: T7 (`candidatoService`), T12 (`ReprocessarButton`)
**Reuses**: padrão de gate de `app/(dashboard)/configuracao-fluxos/page.tsx`
**Requirement**: TAL-08, TAL-09, TAL-10, TAL-11, TAL-29

**Tools**:
- MCP: NONE
- Skill: `frontend-design`

**Done when**:
- [x] Sem sessão → `redirect('/login')`; papel SOLICITANTE → mensagem "Acesso restrito"
- [x] Lista mostra nome, e-mail, badge de `status_embedding` (pendente/processado/falhou)
- [x] `ReprocessarButton` aparece só na linha `falhou`
- [x] Lista vazia → mensagem explícita, sem erro
- [x] Links "Novo Candidato" (`/banco-de-talentos/novo`) e "Buscar Candidatos" (`/banco-de-talentos/busca`)
- [x] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(banco-de-talentos): implementa pagina Listar Candidatos`

---

### T16: `app/(dashboard)/banco-de-talentos/novo/page.tsx` [P]

**What**: Server Component: gate `requireUser([GESTOR, RH_ADMIN])`; renderiza `<NovoCandidatoForm />`.
**Where**: `app/(dashboard)/banco-de-talentos/novo/page.tsx`
**Depends on**: T13 (`NovoCandidatoForm`)
**Reuses**: mesmo padrão de gate
**Requirement**: TAL-02

**Tools**:
- MCP: NONE
- Skill: `frontend-design`

**Done when**:
- [x] Sem sessão → `redirect('/login')`; papel SOLICITANTE → mensagem "Acesso restrito"
- [x] Renderiza `NovoCandidatoForm`
- [x] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(banco-de-talentos): implementa pagina Novo Candidato`

---

### T17: `app/(dashboard)/banco-de-talentos/busca/page.tsx` [P]

**What**: Server Component: gate `requireUser([GESTOR, RH_ADMIN])`; renderiza `<BuscaForm />`.
**Where**: `app/(dashboard)/banco-de-talentos/busca/page.tsx`
**Depends on**: T14 (`BuscaForm`)
**Reuses**: mesmo padrão de gate
**Requirement**: TAL-18

**Tools**:
- MCP: NONE
- Skill: `frontend-design`

**Done when**:
- [x] Sem sessão → `redirect('/login')`; papel SOLICITANTE → mensagem "Acesso restrito"
- [x] Renderiza `BuscaForm`
- [x] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(banco-de-talentos): implementa pagina Buscar Candidatos`

---

## Parallel Execution Map

```
Phase 1 (Parallel, sem dependencias):
  T1 [P] · T2 [P] · T3 [P] · T4 [P] · T5 [P]

Phase 2 (Sequential):
  T1 completo ──→ T6

Phase 3 (Sequential):
  T1, T6      ──→ T7
  T1, T6, T4  ──→ T8

Phase 4 (Parallel, todas dependem de T7/T8):
  T2, T7  ──→ T9  [P]
  T7      ──→ T10 [P]
  T3, T8  ──→ T11 [P]

Phase 5 (Parallel):
  T10      ──→ T12 [P]
  T9       ──→ T13 [P]
  T11, T5  ──→ T14 [P]

Phase 6 (Parallel):
  T7, T12 ──→ T15 [P]
  T13     ──→ T16 [P]
  T14     ──→ T17 [P]
```

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Schema + migration + pgvector | 1 arquivo de schema + 1 migration | ✅ Granular |
| T2: candidatoInputSchema | 1 schema Zod | ✅ Granular |
| T3: talentoBuscaInputSchema | 1 schema Zod | ✅ Granular |
| T4: gerarJustificativaRanking | 1 função (mesmo arquivo do iaService existente) | ✅ Granular |
| T5: CandidatoCard | 1 componente | ✅ Granular |
| T6: embeddingService | 3 funções coesivas no mesmo arquivo novo | ✅ Granular (coesivo) |
| T7: candidatoService | 3 funções coesivas no mesmo arquivo novo | ✅ Granular (coesivo, mesmo padrão de `tipoFluxoService.ts`) |
| T8: talentoSearchService | 1 função pública (+ helpers privados) | ✅ Granular |
| T9: route.ts (GET+POST) | 1 arquivo de rota | ✅ Granular |
| T10: [id]/reprocessar/route.ts | 1 arquivo de rota | ✅ Granular |
| T11: busca/route.ts | 1 arquivo de rota | ✅ Granular |
| T12: ReprocessarButton | 1 componente | ✅ Granular |
| T13: NovoCandidatoForm | 1 componente | ✅ Granular |
| T14: BuscaForm | 1 componente | ✅ Granular |
| T15: page.tsx (listagem) | 1 página | ✅ Granular |
| T16: novo/page.tsx | 1 página | ✅ Granular |
| T17: busca/page.tsx | 1 página | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Phase 1, sem seta de entrada | ✅ Match |
| T2 | None | Phase 1, sem seta de entrada | ✅ Match |
| T3 | None | Phase 1, sem seta de entrada | ✅ Match |
| T4 | None | Phase 1, sem seta de entrada | ✅ Match |
| T5 | None | Phase 1, sem seta de entrada | ✅ Match |
| T6 | T1 | `T1 ──→ T6` | ✅ Match |
| T7 | T1, T6 | `T1, T6 ──→ T7` | ✅ Match |
| T8 | T1, T6, T4 | `T1, T6, T4 ──→ T8` | ✅ Match |
| T9 | T2, T7 | `T2, T7 ──→ T9` | ✅ Match |
| T10 | T7 | `T7 ──→ T10` | ✅ Match |
| T11 | T3, T8 | `T3, T8 ──→ T11` | ✅ Match |
| T12 | T10 | `T10 ──→ T12` | ✅ Match |
| T13 | T9 | `T9 ──→ T13` | ✅ Match |
| T14 | T11, T5 | `T11, T5 ──→ T14` | ✅ Match |
| T15 | T7, T12 | `T7, T12 ──→ T15` | ✅ Match |
| T16 | T13 | `T13 ──→ T16` | ✅ Match |
| T17 | T14 | `T14 ──→ T17` | ✅ Match |

Nenhuma task `[P]` de uma fase depende de outra task da mesma fase.

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | `prisma/schema.prisma` | none | none | ✅ OK |
| T2 | `lib/validations/candidato.ts` | unit | unit | ✅ OK |
| T3 | `lib/validations/talentoBusca.ts` | unit | unit | ✅ OK |
| T4 | `lib/services/iaService.ts` | unit | unit | ✅ OK |
| T5 | `.../CandidatoCard.tsx` | none | none | ✅ OK |
| T6 | `lib/services/embeddingService.ts` | unit | unit | ✅ OK |
| T7 | `lib/services/candidatoService.ts` | unit | unit | ✅ OK |
| T8 | `lib/services/talentoSearchService.ts` | unit | unit | ✅ OK |
| T9 | `app/api/candidatos/route.ts` | none | none | ✅ OK |
| T10 | `app/api/candidatos/[id]/reprocessar/route.ts` | none | none | ✅ OK |
| T11 | `app/api/candidatos/busca/route.ts` | none | none | ✅ OK |
| T12 | `.../ReprocessarButton.tsx` | none | none | ✅ OK |
| T13 | `.../NovoCandidatoForm.tsx` | none | none | ✅ OK |
| T14 | `.../BuscaForm.tsx` | none | none | ✅ OK |
| T15 | `app/(dashboard)/banco-de-talentos/page.tsx` | none | none | ✅ OK |
| T16 | `.../novo/page.tsx` | none | none | ✅ OK |
| T17 | `.../busca/page.tsx` | none | none | ✅ OK |

Todos ✅ — nenhuma restruturação necessária.

---

## Riscos / Notas herdadas do `design.md`

- **T1 é bloqueante para quase tudo** (T6, T7, T8 e toda a cadeia depois) — o ponto sinalizado como
  incerto no `design.md` (sintaxe de habilitação do `pgvector` nesta versão do Prisma) deve ser
  resolvido logo no início da execução, não adiado.
- TAL-20 a TAL-25 (upload de PDF, vínculo a Vaga, detalhe + histórico) permanecem formalmente fora
  desta rodada — nenhuma task aqui cobre; ficam para Design + Tasks futuros, quando o P1 estiver
  estável.
- `solicitacao_id` já existe no schema (T1) mesmo sem UI para vinculá-lo ainda (isso é P2/TAL-23) —
  decisão deliberada do `design.md` pra evitar migration aditiva depois.
- Latência do cadastro síncrono (embedding gerado dentro da própria request de `POST /api/candidatos`)
  é uma limitação conhecida, não um bug — ver `design.md`, seção de Riscos.

---
---

## Rodada 2 — Parecer Técnico, Tags e Upload Multi-formato

**Design**: `.specs/features/banco-de-talentos/design.md`, seção "Rodada 2"
**Status**: Concluído — R1 a R13 implementados e commitados; `npx prisma validate && npm run build` e `npx vitest run` verdes; UAT manual concluído via dev server real (`playwright-skill`) contra o Supabase real do projeto. **Um bloqueio de infraestrutura foi encontrado e não corrigido nesta rodada** — ver "UAT manual (achados reais)" ao final desta seção.

## 0. Escopo desta rodada

Cobre `TAL-32` a `TAL-47`: rename `transcricao_texto` → `parecer_tecnico`, entidade `Tag` + vínculo
many-to-many com `Candidato`, tela de gestão de Tags (RH_ADMIN-only), e upload de currículo em
PDF/Word/Markdown (supersede `TAL-20/21/22`). Importação de planilhas continua fora de escopo —
nenhuma task aqui a implementa.

**Gate check commands**: os mesmos da rodada 1 (`npm test`, `npx prisma validate && npm run build`).

---

## Execution Plan (rodada 2)

```
Phase 1 (Parallel, sem dependencias):
  R1 [P] · R2 [P] · R3 [P]

Phase 2 (Sequential — depende do schema):
  R1 ──→ R4
  R1 ──→ R5

Phase 3 (Sequential):
  R4        ──→ R6
  R1, R5    ──→ R7

Phase 4 (Parallel):
  R2, R6  ──→ R8  [P]
  R7      ──→ R9  [P]
  R7      ──→ R10 [P]

Phase 5 (Parallel — UI):
  R8       ──→ R11 [P]
  R9, R10  ──→ R12 [P]
  R7       ──→ R13 [P] (existentes, alteradas)
```

---

## Task Breakdown (Rodada 2)

### R1: Migration — rename `transcricao_texto` → `parecer_tecnico` + `model Tag` + relação many-to-many [P]

**What**: Editar `prisma/schema.prisma`: renomear o campo `transcricao_texto` para `parecer_tecnico`
em `Candidato`; adicionar `model Tag` (`nome` único, `funcao`, `ativo`, timestamps); adicionar
`tags Tag[]` em `Candidato` (relação implícita many-to-many). Gerar migration e **conferir que o
Prisma emitiu `RENAME COLUMN`, não `DROP`+`ADD`** — se emitir drop+add, editar a migration SQL manualmente
antes de aplicar (risco de perda de dado, ver `design.md` Riscos rodada 2).

**Where**: `prisma/schema.prisma`, `prisma/migrations/**`
**Depends on**: None
**Reuses**: padrão `@@unique`/`@@map` já usado em `TipoFluxo.nome`
**Requirement**: TAL-32, TAL-33, TAL-39

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `Candidato.parecer_tecnico` existe, `Candidato.transcricao_texto` não existe mais
- [x] Migration aplicada preserva os dados de `parecer_tecnico` dos candidatos já cadastrados na rodada 1 (verificado manualmente: `SELECT parecer_tecnico FROM candidatos LIMIT 1` retorna o texto que antes era `transcricao_texto`, não `NULL`)
- [x] `model Tag { id, nome (@unique), funcao, ativo (@default(true)), criado_em, atualizado_em, candidatos Candidato[] }` definido, `@@map("tags")`
- [x] `Candidato` ganha `tags Tag[]` (implicit many-to-many, sem tabela de junção explícita no schema)
- [x] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(banco-de-talentos): renomeia transcricao_texto para parecer_tecnico e adiciona model Tag`

---

### R2: `tagInputSchema` (envelope Zod) [P]

**What**: Schema Zod do envelope de criação/edição de Tag.
**Where**: `lib/validations/tag.ts` (+ `lib/validations/tag.test.ts`)
**Depends on**: None
**Reuses**: padrão de `lib/validations/tipoFluxo.ts`
**Requirement**: TAL-38

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `tagInputSchema = z.object({ nome: z.string().min(1), funcao: z.string().min(1) })`
- [x] Teste cobre: válido passa; `nome` ausente/vazio falha; `funcao` ausente/vazio falha
- [x] Gate check passa: `npm test` (`tag.test.ts`)
- [x] Gate check passa: `npx prisma validate && npm run build`
- [x] Test count: ≥4 casos

**Tests**: unit
**Gate**: quick + build

**Commit**: `feat(banco-de-talentos): adiciona schema zod do envelope de tag`

---

### R3: Atualiza `candidatoInputSchema` (rename + `tag_ids`) [P]

**What**: Renomear `transcricao_texto` para `parecer_tecnico` no schema Zod existente; adicionar
`tag_ids: z.array(z.string()).optional()`.
**Where**: `lib/validations/candidato.ts` (modifica), `lib/validations/candidato.test.ts` (modifica)
**Depends on**: None
**Reuses**: schema já existente, só campo renomeado + campo novo opcional
**Requirement**: TAL-32, TAL-33

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `parecer_tecnico: z.string().min(1)` no lugar de `transcricao_texto`
- [x] `tag_ids: z.array(z.string()).optional()` adicionado
- [x] Testes existentes atualizados pro novo nome de campo; novo caso cobre `tag_ids` ausente (aceito) e `tag_ids` com array vazio (aceito)
- [x] Gate check passa: `npm test` (`candidato.test.ts`)
- [x] Gate check passa: `npx prisma validate && npm run build`

**Tests**: unit
**Gate**: quick + build

**Commit**: `feat(banco-de-talentos): renomeia campo transcricao_texto para parecer_tecnico e adiciona tag_ids no envelope de cadastro`

---

### R4: `tagService.ts`

**What**: `listar` (com filtro opcional `somenteAtivas`), `criar`, `editar`, `alternarAtivo` — nome
normalizado (trim + comparação case-insensitive) antes de gravar; `P2002` traduzido em `ErroTagDuplicada`.
**Where**: `lib/services/tagService.ts` (+ `lib/services/tagService.test.ts`)
**Depends on**: R1 (`model Tag`)
**Reuses**: padrão de erro `P2002` → domínio de `tipoFluxoService.ts`
**Requirement**: TAL-37, TAL-38, TAL-39, TAL-40, TAL-41

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `ErroTagDuplicada`, `ErroNaoEncontrado` exportados
- [x] `listar(somenteAtivas?: boolean)`: sem argumento retorna todas; `true` filtra `ativo: true`
- [x] `criar(dados)`: normaliza `nome` (trim), nome duplicado (case-insensitive) → `ErroTagDuplicada` antes do `create`; sucesso → `ativo: true` por padrão
- [x] `editar(id, dados)`: `id` inexistente → `ErroNaoEncontrado`; nome duplicado (de outra Tag) → `ErroTagDuplicada`
- [x] `alternarAtivo(id, ativo)`: `update` do campo `ativo`, `id` inexistente → `ErroNaoEncontrado`
- [x] Gate check passa: `npm test` (`tagService.test.ts`)
- [x] Gate check passa: `npx prisma validate && npm run build`
- [x] Test count: ≥10 casos (listar-todas, listar-ativas, criar-feliz, criar-duplicado-mesmo-case, criar-duplicado-outro-case, editar-feliz, editar-nao-encontrado, editar-duplicado, alternarAtivo-feliz, alternarAtivo-nao-encontrado)

**Tests**: unit
**Gate**: quick + build

**Commit**: `feat(banco-de-talentos): implementa tagService`

---

### R5: `arquivoCurriculoService.ts`

**What**: `extrairTexto` (roteia PDF/`.docx`/`.md` pra `pdf-parse`/`mammoth`/leitura UTF-8; formato não
suportado ou falha de parsing retorna `{ erro }`, nunca lança), `armazenarArquivo` (`Supabase Storage`,
bucket `curriculos`). Instalar `pdf-parse` e `mammoth` como dependência (`npm install pdf-parse mammoth`).
**Where**: `lib/services/arquivoCurriculoService.ts` (+ `lib/services/arquivoCurriculoService.test.ts`),
`package.json`
**Depends on**: R1 (schema — não é dependência técnica direta, mas mantém a ordem da fase 2 do plano)
**Reuses**: `createAdminClient()` (`lib/supabase/admin.ts`)
**Requirement**: TAL-43, TAL-45, TAL-46, TAL-47

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] **Primeiro passo**: `pdf-parse` e `mammoth` instalados e funcionando em runtime Node de uma API route (teste manual/smoke antes de escrever a lógica completa) — ponto sinalizado como incerto no `design.md`
- [x] `extrairTexto({ buffer, nomeOriginal, tipoMime })`: `.pdf` → `pdf-parse`; `.docx` → `mammoth.extractRawText`; `.md`/`.markdown` → `buffer.toString("utf-8")`; extensão/mime não reconhecido → `{ erro: "Formato nao suportado" }` sem tentar parsear (TAL-46); falha de parsing (arquivo corrompido/escaneado) → `{ erro }` (TAL-45), nunca lança
- [x] Arquivo maior que `5MB` (constante `TALENTO_CURRICULO_TAMANHO_MAXIMO_MB`) → `{ erro }` antes de tentar extrair
- [x] `armazenarArquivo(candidatoIdOuTemp, { buffer, nomeOriginal })`: upload pro bucket `curriculos`, retorna URL (TAL-47)
- [x] Gate check passa: `npm test` (`arquivoCurriculoService.test.ts`, Supabase Storage mockado)
- [x] Gate check passa: `npx prisma validate && npm run build`
- [x] Test count: ≥8 casos (pdf-sucesso, docx-sucesso, md-sucesso, formato-nao-suportado, pdf-corrompido-falha, arquivo-grande-demais, armazenarArquivo-sucesso, armazenarArquivo-falha-propaga)

**Tests**: unit
**Gate**: quick + build

**Commit**: `feat(banco-de-talentos): implementa arquivoCurriculoService (extracao PDF/Word/Markdown + storage)`

---

### R6: `app/api/candidatos/extrair-curriculo/route.ts`

**What**: `POST` (multipart) → `requireUser([GESTOR, RH_ADMIN])` → `arquivoCurriculoService.extrairTexto`
→ sucesso também chama `armazenarArquivo` → retorna `{ texto, arquivo_url }`.
**Where**: `app/api/candidatos/extrair-curriculo/route.ts`
**Depends on**: R5 (`arquivoCurriculoService`)
**Reuses**: padrão de rota de `app/api/tipos-fluxo/route.ts`
**Requirement**: TAL-43, TAL-45, TAL-46, TAL-47

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Sem sessão → 401; papel SOLICITANTE → 403
- [x] Formato não suportado → 422 com mensagem clara
- [x] Falha de extração → 422 com mensagem clara
- [x] Sucesso → 200 `{ texto, arquivo_url }`
- [x] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(banco-de-talentos): adiciona rota POST /api/candidatos/extrair-curriculo`

---

### R7: Atualiza `candidatoService.ts` e `talentoSearchService.ts` (rename + tags)

**What**: `candidatoService.cadastrar`/`reprocessarEmbedding` passam a usar `parecer_tecnico` no lugar
de `transcricao_texto` em todas as referências; `cadastrar` aceita `tag_ids?: string[]` e conecta via
`tags: { connect: ... } }`; `listar()` inclui `tags: { select: { id, nome } }`.
`talentoSearchService.buscar` anexa `tags` de cada candidato do resultado antes de retornar.
**Where**: `lib/services/candidatoService.ts`, `lib/services/candidatoService.test.ts`,
`lib/services/talentoSearchService.ts`, `lib/services/talentoSearchService.test.ts` (todos modificam)
**Depends on**: R1 (schema), R4 (não é dependência técnica, mas Tags precisam existir pra conectar)
**Reuses**: estrutura já existente dos dois services
**Requirement**: TAL-32, TAL-33, TAL-34, TAL-35

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Toda referência a `transcricao_texto` em `candidatoService.ts` substituída por `parecer_tecnico`
- [x] `cadastrar(dados, usuarioId)`: `tag_ids` presente → `tags: { connect: tag_ids.map(id => ({ id })) }` no `create`; ausente/vazio → nenhum vínculo
- [x] `listar()`: `select` inclui `tags: { select: { id: true, nome: true } }`
- [x] `talentoSearchService.buscar`: cada `CandidatoRankeado` do retorno inclui `tags: { id, nome }[]`
- [x] Testes existentes atualizados pro novo nome de campo; casos novos cobrem tag_ids presente/ausente no cadastro e tags no retorno de listar/buscar
- [x] Gate check passa: `npm test` (ambos os arquivos de teste)
- [x] Gate check passa: `npx prisma validate && npm run build`

**Tests**: unit
**Gate**: quick + build

**Commit**: `feat(banco-de-talentos): candidatoService e talentoSearchService passam a usar parecer_tecnico e incluir tags`

---

### R8: `app/api/tags/route.ts` + `app/api/tags/[id]/route.ts` [P]

**What**: `GET /api/tags` (GESTOR/RH_ADMIN, filtro `?ativo=true`) → `tagService.listar`. `POST /api/tags`
(RH_ADMIN-only) → Zod → `tagService.criar`. `PATCH /api/tags/[id]` (RH_ADMIN-only) → `tagService.editar`/
`alternarAtivo` conforme os campos do corpo.
**Where**: `app/api/tags/route.ts`, `app/api/tags/[id]/route.ts`
**Depends on**: R2 (`tagInputSchema`), R4 (`tagService`)
**Reuses**: padrão de rota de `app/api/tipos-fluxo/route.ts`
**Requirement**: TAL-36, TAL-37, TAL-38, TAL-39, TAL-40, TAL-41, TAL-42

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `GET`: GESTOR e RH_ADMIN autorizados; SOLICITANTE → 403; `?ativo=true` filtra só ativas
- [x] `POST`: GESTOR → 403 (RH_ADMIN-only); corpo inválido → 400; nome duplicado → 409; sucesso → 201
- [x] `PATCH`: GESTOR → 403; `id` inexistente → 404; sucesso → 200 com a Tag atualizada
- [x] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(banco-de-talentos): adiciona rotas de gestao de tags (GET/POST/PATCH)`

---

### R9: `app/api/candidatos/route.ts` (atualiza para `parecer_tecnico` + `tag_ids`) [P]

**What**: `POST` passa a repassar `parecer_tecnico` e `tag_ids` do corpo (já validados por R3) pro
`candidatoService.cadastrar`.
**Where**: `app/api/candidatos/route.ts`
**Depends on**: R3 (`candidatoInputSchema` atualizado), R7 (`candidatoService` atualizado)
**Reuses**: rota já existente, ajuste pontual
**Requirement**: TAL-32, TAL-33

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `POST` aceita `parecer_tecnico` no corpo (novo nome), corpo com `transcricao_texto` (nome antigo) → 400 (Zod rejeita campo desconhecido/obrigatório ausente)
- [x] `POST` aceita `tag_ids` opcional e repassa pro service
- [x] Comportamento existente (401/403/409/201) inalterado
- [x] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(banco-de-talentos): atualiza rota de cadastro de candidato para parecer_tecnico e tag_ids`

---

### R10: `TagForm.tsx` + `TagList.tsx` [P]

**What**: Client Components — `TagList` renderiza tabela (nome, função, badge ativo, botão
ativar/desativar); `TagForm` formulário de criar/editar (nome, função), exibe erro 409 (nome duplicado)
inline.
**Where**: `app/(dashboard)/banco-de-talentos/tags/_components/TagForm.tsx`,
`app/(dashboard)/banco-de-talentos/tags/_components/TagList.tsx`
**Depends on**: R8 (rotas `/api/tags/**`)
**Reuses**: mesmo estilo inline do projeto (`configuracao-fluxos`)
**Requirement**: TAL-37, TAL-38, TAL-39, TAL-40, TAL-41

**Tools**:
- MCP: NONE
- Skill: `frontend-design`

**Done when**:
- [x] `TagList` mostra nome/função/status ativo de cada Tag, botão "Ativar"/"Desativar" por linha
- [x] `TagForm` cria (campos vazios) ou edita (pré-preenchido) — nome duplicado exibe erro inline no campo nome
- [x] Sucesso → atualiza a lista (`router.refresh()`)
- [x] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(banco-de-talentos): adiciona componentes TagForm e TagList`

---

### R11: `app/(dashboard)/banco-de-talentos/tags/page.tsx` [P]

**What**: Server Component: gate `requireUser([RH_ADMIN])` (mensagem "Acesso restrito" pra GESTOR,
`redirect('/login')` sem sessão); chama `tagService.listar()` DIRETO; renderiza `TagList` + `TagForm`
de criação.
**Where**: `app/(dashboard)/banco-de-talentos/tags/page.tsx`
**Depends on**: R4 (`tagService`), R10 (`TagForm`/`TagList`)
**Reuses**: mesmo padrão de gate de `configuracao-fluxos/page.tsx`
**Requirement**: TAL-37, TAL-42

**Tools**:
- MCP: NONE
- Skill: `frontend-design`

**Done when**:
- [x] Sem sessão → `redirect('/login')`; papel GESTOR ou SOLICITANTE → mensagem "Acesso restrito"
- [x] RH_ADMIN vê lista completa (ativas e inativas) + form de criação
- [x] Link a partir de `app/(dashboard)/banco-de-talentos/page.tsx` ("Gerenciar Tags")
- [x] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(banco-de-talentos): implementa pagina Gestao de Tags`

---

### R12: Atualiza `NovoCandidatoForm.tsx` (rename + upload + multi-select de tags) [P]

**What**: Renomeia label/estado do campo de transcrição para "Parecer técnico"; adiciona bloco de
upload (`<input type="file" accept=".pdf,.docx,.md">`) que chama `POST /api/candidatos/extrair-curriculo`
e preenche o `textarea` de currículo com o texto retornado (editável); adiciona multi-select de Tags
(busca `GET /api/tags?ativo=true` ao montar, checkboxes), envia `tag_ids` no submit final.
**Where**: `app/(dashboard)/banco-de-talentos/novo/_components/NovoCandidatoForm.tsx`
**Depends on**: R6 (rota de extração), R9 (rota de cadastro atualizada), R8 (`GET /api/tags`)
**Reuses**: mesmo componente já existente, alterado
**Requirement**: TAL-32, TAL-33, TAL-43, TAL-44

**Tools**:
- MCP: NONE
- Skill: `frontend-design`

**Done when**:
- [x] Campo "Transcrição da entrevista" renomeado para "Parecer técnico" (label + `id` + estado)
- [x] Upload de arquivo: ao selecionar, chama a rota de extração; sucesso preenche o `textarea` de currículo (usuário pode editar depois); erro 422 exibe mensagem clara sem bloquear o preenchimento manual
- [x] `textarea` de currículo continua editável/preenchível manualmente mesmo sem upload (TAL-44)
- [x] Multi-select de Tags carrega só Tags ativas, permite selecionar 0..N, envia `tag_ids` no `POST /api/candidatos`
- [x] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(banco-de-talentos): formulario de cadastro ganha parecer tecnico, upload de curriculo e selecao de tags`

---

### R13: Atualiza listagem e `CandidatoCard.tsx` (badges de tags) [P]

**What**: `page.tsx` (listagem) e `CandidatoCard.tsx` (busca) passam a renderizar as Tags vinculadas
de cada candidato como badges.
**Where**: `app/(dashboard)/banco-de-talentos/page.tsx`,
`app/(dashboard)/banco-de-talentos/busca/_components/CandidatoCard.tsx`
**Depends on**: R7 (`candidatoService.listar`/`talentoSearchService.buscar` incluindo `tags`)
**Reuses**: componentes já existentes, alterados
**Requirement**: TAL-34, TAL-35

**Tools**:
- MCP: NONE
- Skill: `frontend-design`

**Done when**:
- [x] Listagem mostra badges de Tags por linha (vazio → nenhuma badge, sem erro)
- [x] `CandidatoCard` mostra badges de Tags no resultado de busca
- [x] Gate check passa: `npx prisma validate && npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(banco-de-talentos): exibe tags como badges na listagem e no ranking de busca`

---

## Task Granularity Check (rodada 2)

| Task | Scope | Status |
| --- | --- | --- |
| R1: schema (rename + Tag) | 1 arquivo de schema + 1 migration | ✅ Granular |
| R2: tagInputSchema | 1 schema Zod | ✅ Granular |
| R3: candidatoInputSchema (rename + tag_ids) | 1 schema Zod, ajuste pontual | ✅ Granular |
| R4: tagService | 4 funções coesivas, 1 arquivo novo | ✅ Granular (coesivo) |
| R5: arquivoCurriculoService | 2 funções coesivas, 1 arquivo novo | ✅ Granular (coesivo) |
| R6: extrair-curriculo/route.ts | 1 arquivo de rota | ✅ Granular |
| R7: candidatoService + talentoSearchService (rename + tags) | 2 arquivos, mudança coesa (mesma revisão de dado) | ✅ Granular (coesivo) |
| R8: tags/route.ts + tags/[id]/route.ts | 2 arquivos de rota | ✅ Granular |
| R9: candidatos/route.ts (ajuste) | 1 arquivo de rota, ajuste pontual | ✅ Granular |
| R10: TagForm + TagList | 2 componentes | ✅ Granular |
| R11: tags/page.tsx | 1 página | ✅ Granular |
| R12: NovoCandidatoForm (rename + upload + tags) | 1 componente, 3 mudanças relacionadas | ✅ Granular (coesivo) |
| R13: listagem + CandidatoCard (badges) | 2 arquivos, mesma mudança (badges) | ✅ Granular (coesivo) |

---

## Riscos / Notas herdadas do `design.md` (rodada 2)

- **R1 é bloqueante pra quase tudo** (mesmo papel que T1 teve na rodada 1) — confirmar `RENAME COLUMN`
  antes de aplicar a migration é o primeiro passo técnico, não adiável.
- **R5 depende de instalar `pdf-parse` e `mammoth`**, nenhum dos dois presente no `package.json` atual —
  validar compatibilidade com o runtime Node das API routes do Next 16 como primeiro passo da task.
- Importação de planilhas continua fora de escopo — nenhuma task aqui a implementa; nomes de campo
  (`Candidato`, `Tag`) mantidos planos/simples de propósito pra reduzir remapeamento futuro.

### Notas da execução real (pós-implementação)

- **`pdf-parse` instalado é a v2 (`PDFParse` class-based), não a v1 clássica** que o `design.md`
  assumia (`pdf(buffer) -> Promise<{text}>`). API real usa `new PDFParse({ data: buffer })` +
  `.getText()` + `.destroy()`. `@types/pdf-parse` (pacote de tipos da v1) foi removido — a v2 já
  vem com tipos próprios. Corrigido durante R5, documentado aqui pra não repetir a suposição errada.
- **Gap fechado fora do escopo original de R3/R7**: nem `candidatoInputSchema` nem
  `candidatoService.cadastrar` previam `curriculo_arquivo_url` — TAL-47 exige salvar essa URL no
  `Candidato`, mas a task original não cobria isso. Corrigido em commit `fix(banco-de-talentos):
  persiste curriculo_arquivo_url no cadastro de candidato`, antes de R12.
- **Migration real**: `prisma migrate dev` tentou forçar `prisma migrate reset` (drift causado por
  extensões que o Supabase já injeta: `pg_stat_statements`, `pgcrypto`, `supabase_vault`,
  `uuid-ossp`) — **não executado** (destruiria dados reais). Fluxo usado: `prisma migrate diff`
  pra gerar o SQL, correção manual de `DROP+ADD` pra `RENAME COLUMN`, aplicação via `prisma db
  execute`, e `prisma migrate resolve --applied` pra manter o histórico consistente. Dado do único
  `Candidato` já cadastrado confirmado preservado após a migration.
- **Commit `a119a29`** ficou com mensagem de "refactor" (rename de parâmetro interno) mas por
  acidente de staging também inclui os arquivos de R5 (`arquivoCurriculoService` + deps
  `pdf-parse`/`mammoth` no `package.json`). Conteúdo correto, só a mensagem não descreve tudo —
  cosmético, não corrigido (não fazer amend sem pedido explícito).
- **Falha pré-existente e não relacionada**: `lib/navigation/navConfig.test.ts` falha (espera 10
  itens de nav, recebe 11) por causa de outra feature (`pipeline-kanban`) sendo desenvolvida em
  paralelo no mesmo diretório de trabalho, por outra sessão. Não é responsabilidade desta rodada.
### UAT manual (achados reais — via dev server + `playwright-skill`, projeto Supabase real)

Rodado contra `npm run dev` + Supabase real do projeto (não mockado), usuários de teste
`rh.admin@01tec.com.br`/`gestor@01tec.com.br` (`scripts/seed-users.ts`).

**Confirmado funcionando (evidência: screenshots + logs do dev server)**:
- TAL-42: GESTOR bloqueado com "Acesso restrito" em `/banco-de-talentos/tags`; RH_ADMIN acessa normalmente.
- TAL-38/39: criar Tag funciona (`POST /api/tags` 201); nome duplicado bloqueia (`409`, confirmado num teste anterior de regressão).
- TAL-40/41: ativar/desativar Tag funciona de ponta a ponta (`PATCH /api/tags/[id]` alterna `ativo` corretamente, confirmado lendo a tabela `tags` direto no banco após os cliques).
- TAL-32/33/34: cadastro de candidato com `parecer_tecnico` (texto colado) + Tag selecionada funciona; candidato aparece na listagem com `status_embedding = processado` (embedding real da OpenAI rodou) e a badge da Tag aparece na linha.
- TAL-35: badge da Tag aparece no card de ranking em `/banco-de-talentos/busca`, junto com justificativa de IA real e score.
- TAL-44: cadastro via texto colado (sem upload de arquivo) continua funcionando normalmente — coexistência confirmada.

**Achado — bloqueio de infraestrutura, não corrigido nesta rodada**:
- `POST /api/candidatos/extrair-curriculo` retorna `500` para qualquer upload (`.pdf`/`.docx`/`.md`)
  porque o bucket `curriculos` **não existe no projeto Supabase real** (`StorageApiError: Bucket not
  found`, ver log do dev server). A extração de texto em si (`arquivoCurriculoService.extrairTexto`)
  roda antes do erro e provavelmente funcionaria — o erro acontece na chamada seguinte,
  `armazenarArquivo`, sem try/catch na rota (comportamento intencional, ver `design.md` Error
  Handling Strategy: falha de Storage é infraestrutura, não regra de negócio, propaga como 500).
  **TAL-43, TAL-45, TAL-46, TAL-47 ficam formalmente não verificados em ambiente real** até o bucket
  `curriculos` ser criado no projeto Supabase — decisão de criar o bucket (nome, público/privado,
  políticas de acesso) não foi tomada unilateralmente aqui, precisa de confirmação do usuário.
- Dados de teste (`Candidato UAT ...`, `TagUAT ...`, `Debug Toggle ...`) ficaram gravados no banco
  real do projeto durante o UAT — não removidos automaticamente (exclusão de `Candidato`/`Tag` está
  fora de escopo do produto, ver `spec.md`); avisado ao usuário para limpeza manual se desejado.
