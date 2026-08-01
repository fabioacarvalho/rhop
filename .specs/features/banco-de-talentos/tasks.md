# Banco de Talentos — Tasks

**Design**: `.specs/features/banco-de-talentos/design.md`
**Status**: Draft

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
- [ ] **Primeiro passo**: confirmado (documentação oficial do Prisma para `prisma@^7.9.1` + `@prisma/adapter-pg`, ou teste direto no ambiente) como habilitar a extensão `vector` — via `previewFeatures = ["postgresqlExtensions"]` + `extensions = [vector]` no `datasource`, OU via migration SQL manual (`CREATE EXTENSION IF NOT EXISTS vector;`) antes do `Unsupported`. Este era o ponto sinalizado como incerto no `design.md` — não fabricar, verificar contra a doc oficial ou testar a migration real.
- [ ] `enum StatusEmbedding { pendente processado falhou }` definido
- [ ] `model Candidato` com todos os campos do `design.md`: `nome`, `email` (`@unique`), `telefone`, `curriculo_texto`, `curriculo_arquivo_url?`, `transcricao_texto`, `embedding Unsupported("vector(1536)")?`, `status_embedding StatusEmbedding @default(pendente)`, `solicitacao_id?`, `criado_por String @db.Uuid`, `criado_em`
- [ ] `@@index([status_embedding])`, `@@index([solicitacao_id])`, `@@map("candidatos")`
- [ ] `User` ganha `candidatos Candidato[]`; `Solicitacao` ganha `candidatos Candidato[]`
- [ ] Migration gerada e aplicada sem erro (`npx prisma migrate dev --name adiciona_candidato`)
- [ ] Query manual de teste (`INSERT`/`UPDATE` de um vetor de teste via `$executeRaw`, `SELECT ... <=>` via `$queryRaw`) confirma que a extensão está ativa e o tipo `vector` funciona neste ambiente
- [ ] Gate check passa: `npx prisma validate && npm run build`

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
- [ ] `candidatoInputSchema = z.object({ nome: z.string().min(1), email: z.string().email(), telefone: z.string().min(1), curriculo_texto: z.string().min(1), transcricao_texto: z.string().min(1), solicitacao_id: z.string().optional() })`
- [ ] Teste cobre: válido passa; cada campo obrigatório ausente/vazio falha; `email` mal formatado falha; `solicitacao_id` ausente é aceito (campo opcional)
- [ ] Gate check passa: `npm test` (arquivo `candidato.test.ts`)
- [ ] Gate check passa: `npx prisma validate && npm run build`
- [ ] Test count: ≥6 casos (sem deleção silenciosa)

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
- [ ] `talentoBuscaInputSchema = z.object({ texto: z.string().min(1), n: z.number().int().positive().default(20) })`
- [ ] Teste cobre: válido passa; `texto` vazio/ausente falha; `n` ausente aplica default 20; `n` zero/negativo/não-inteiro falha (o teto máximo NÃO é testado aqui — é responsabilidade do service, T8)
- [ ] Gate check passa: `npm test` (arquivo `talentoBusca.test.ts`)
- [ ] Gate check passa: `npx prisma validate && npm run build`
- [ ] Test count: ≥5 casos

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
- [ ] `gerarJustificativaRanking(input: { candidatoId: string; nome: string; curriculoTexto: string; transcricaoTexto: string; queryTexto: string }): Promise<string | null>` exportada
- [ ] Prompt inclui o texto da busca e o currículo/transcrição do candidato; resposta em português
- [ ] Falha (chave ausente, erro de API, conteúdo vazio) → `Log ERRO` (`entidade: "Candidato"`, `entidade_id: candidatoId`, `acao: FALHA_IA`) + retorna `null`, nunca lança
- [ ] Sucesso com conteúdo não-vazio → string trimada
- [ ] Gate check passa: `npm test` (arquivo `iaService.test.ts`, casos novos + existentes intactos)
- [ ] Gate check passa: `npx prisma validate && npm run build`
- [ ] Test count: ≥4 casos novos (sucesso, chave ausente, erro de API, conteúdo vazio) sem quebrar os testes existentes de `gerarResumoSolicitacao`

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
- [ ] Recebe `candidato: CandidatoRankeado` (nome, email, solicitacao_id, score 0-1, justificativa)
- [ ] Renderiza score como barra visual (largura proporcional a `score`) + percentual (`Math.round(score * 100)}%`)
- [ ] `justificativa === null` → exibe texto alternativo claro (ex: "Justificativa indisponível"), sem quebrar o card
- [ ] Sem erros de TypeScript
- [ ] Gate check passa: `npx prisma validate && npm run build`

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
- [ ] `gerar(texto: string): Promise<number[] | null>` — `client.embeddings.create({ model: "text-embedding-3-small", input: texto })`; falha (chave ausente, erro de API, timeout) → `Log ERRO` (`entidade: "Candidato"`, `acao: FALHA_IA`) + `null`, nunca lança
- [ ] `persistirEmbedding(candidatoId: string, vetor: number[]): Promise<void>` — `$executeRaw` grava o vetor formatado como literal `vector` e `status_embedding = 'processado'`
- [ ] `marcarFalha(candidatoId: string): Promise<void>` — `status_embedding = 'falhou'`
- [ ] Gate check passa: `npm test` (arquivo `embeddingService.test.ts`, Prisma/OpenAI mockados)
- [ ] Gate check passa: `npx prisma validate && npm run build`
- [ ] Test count: ≥6 casos (gerar sucesso/chave-ausente/erro-api, persistirEmbedding, marcarFalha, formatação do vetor)

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
- [ ] `ErroEmailDuplicado`, `ErroNaoEncontrado`, `ErroReprocessamentoNaoPermitido` exportados
- [ ] `cadastrar(input, usuarioId)`: e-mail já existente (`P2002`) → `ErroEmailDuplicado`, sem persistir; sucesso → cria com `status_embedding=pendente`, chama `embeddingService.gerar` com `curriculo_texto + "\n" + transcricao_texto`, sucesso → `persistirEmbedding`, falha → `marcarFalha`; grava `Log AUDITORIA` (`acao: CRIACAO`) em ambos os casos
- [ ] `listar()`: retorna todos os candidatos (`id, nome, email, status_embedding, criado_em`), sem filtro por `criado_por`, `orderBy criado_em desc`
- [ ] `reprocessarEmbedding(id, usuarioId)`: `id` inexistente → `ErroNaoEncontrado`; `status_embedding !== 'falhou'` → `ErroReprocessamentoNaoPermitido`; senão repete o fluxo de geração de embedding de `cadastrar`
- [ ] Falha de `logService.registrar` (mockada rejeitando) não impede `cadastrar` de retornar sucesso
- [ ] Gate check passa: `npm test` (arquivo `candidatoService.test.ts`)
- [ ] Gate check passa: `npx prisma validate && npm run build`
- [ ] Test count: ≥10 casos (cadastrar feliz/embedding-sucesso/embedding-falha/email-duplicado/log-falha, listar, reprocessar feliz/não-encontrado/status-invalido)

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
- [ ] `N_MAXIMO_PADRAO = 100`; teto lido de `process.env.TALENTO_BUSCA_N_MAXIMO`, fallback `100` se ausente/inválido
- [ ] `buscar(texto: string, n: number): Promise<ResultadoBusca>`: `n` fora de `1..teto` → lança `ErroNInvalido` (rota converte em 400)
- [ ] `embeddingService.gerar(texto)` falha (`null`) → lança `ErroBuscaIndisponivel` (rota converte em 422)
- [ ] `$queryRaw` filtra `status_embedding='processado'`, ordena por `embedding <=> vetor`, `LIMIT n`, calcula `score = 1 - distancia` (0-1)
- [ ] Nenhum candidato `processado` → retorna `{ candidatos: [], disponivel: false }`, sem lançar
- [ ] Para cada candidato do resultado, chama `gerarJustificativaRanking`; falha em um item não interrompe os demais (item fica com `justificativa: null`)
- [ ] Gate check passa: `npm test` (arquivo `talentoSearchService.test.ts`, Prisma/`iaService`/`embeddingService` mockados)
- [ ] Gate check passa: `npx prisma validate && npm run build`
- [ ] Test count: ≥8 casos (n inválido, n acima do teto, embedding-da-query-falha, nenhum-processado, ranking-feliz, justificativa-falha-isolada, teto-via-env, teto-fallback)

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
- [ ] `GET`: sem sessão → 401; papel SOLICITANTE → 403; GESTOR/RH_ADMIN → 200 com lista de `listar()`
- [ ] `POST`: sem sessão → 401; papel SOLICITANTE → 403; corpo inválido (Zod) → 400 com `detalhes`; `ErroEmailDuplicado` → 409; sucesso → 201 com o `Candidato` criado
- [ ] Nenhuma lógica de negócio na rota
- [ ] Gate check passa: `npx prisma validate && npm run build`

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
- [ ] Sem sessão → 401; papel SOLICITANTE → 403
- [ ] `id` inexistente → 404 (`ErroNaoEncontrado`)
- [ ] `status_embedding !== 'falhou'` → 409 (`ErroReprocessamentoNaoPermitido`)
- [ ] Sucesso → 200 com o `Candidato` atualizado
- [ ] Gate check passa: `npx prisma validate && npm run build`

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
- [ ] Sem sessão → 401; papel SOLICITANTE → 403
- [ ] Corpo inválido (Zod) → 400
- [ ] `ErroNInvalido` → 400 com mensagem citando o teto atual
- [ ] `ErroBuscaIndisponivel` → 422
- [ ] Sucesso → 200 com `ResultadoBusca` (`candidatos`, `disponivel`)
- [ ] Gate check passa: `npx prisma validate && npm run build`

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
- [ ] Recebe `candidatoId: string` como prop
- [ ] Ao clicar, desabilita o botão, chama a rota, mostra estado de carregamento
- [ ] Sucesso → feedback visual + atualiza a linha (ex: `router.refresh()`)
- [ ] Erro (409/500) → mensagem clara, botão reabilitado
- [ ] Gate check passa: `npx prisma validate && npm run build`

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
- [ ] 5 campos obrigatórios renderizados, `required` nativo (validação client é só UX)
- [ ] Submit desabilitado durante o `fetch`
- [ ] Erro 400 (Zod) exibe mensagem de validação; erro 409 exibe mensagem no campo e-mail especificamente ("Já existe candidato com este e-mail")
- [ ] Sucesso (201) → redireciona pra `/banco-de-talentos`
- [ ] Gate check passa: `npx prisma validate && npm run build`

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
- [ ] Campo de texto (obrigatório) + campo N (numérico, default 20)
- [ ] N inválido (não numérico, ≤0) bloqueia o submit com mensagem clara antes de chamar a API
- [ ] Erro 400/422 da API exibe mensagem retornada pelo backend
- [ ] `disponivel: false` → mensagem "nenhum candidato disponível para busca ainda"
- [ ] `disponivel: true` → renderiza um `CandidatoCard` por resultado, na ordem retornada
- [ ] Gate check passa: `npx prisma validate && npm run build`

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
- [ ] Sem sessão → `redirect('/login')`; papel SOLICITANTE → mensagem "Acesso restrito"
- [ ] Lista mostra nome, e-mail, badge de `status_embedding` (pendente/processado/falhou)
- [ ] `ReprocessarButton` aparece só na linha `falhou`
- [ ] Lista vazia → mensagem explícita, sem erro
- [ ] Links "Novo Candidato" (`/banco-de-talentos/novo`) e "Buscar Candidatos" (`/banco-de-talentos/busca`)
- [ ] Gate check passa: `npx prisma validate && npm run build`

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
- [ ] Sem sessão → `redirect('/login')`; papel SOLICITANTE → mensagem "Acesso restrito"
- [ ] Renderiza `NovoCandidatoForm`
- [ ] Gate check passa: `npx prisma validate && npm run build`

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
- [ ] Sem sessão → `redirect('/login')`; papel SOLICITANTE → mensagem "Acesso restrito"
- [ ] Renderiza `BuscaForm`
- [ ] Gate check passa: `npx prisma validate && npm run build`

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
