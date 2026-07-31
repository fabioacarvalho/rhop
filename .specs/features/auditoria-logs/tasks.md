# Auditoria e Logs Tasks

**Design**: `.specs/features/auditoria-logs/design.md`
**Status**: Draft

---

## Nota sobre estratégia de execução e teste

Repositório ainda greenfield: nenhum arquivo de código existe (`prisma/`, `lib/`, `app/` vazios no momento desta escrita). `.specs/codebase/TESTING.md` não existe e nenhum framework de teste automatizado foi escolhido ainda.

Seguindo o precedente já fixado em `autenticacao-usuarios/tasks.md` (mesma decisão, não refeita aqui para não divergir entre specs irmãs) e o `CLAUDE.md` (§"Como validar o trabalho"), o gate padrão de toda task é:

- **build**: `npm run build`
- **prisma**: `npx prisma validate` (tasks que tocam `schema.prisma`)
- **manual**: para lógica de autorização/resiliência/fluxo, `CLAUDE.md` exige descrever o cenário de teste manualmente no resumo da task — usado aqui como valor de `Tests`.

Se o usuário quiser Jest/Vitest/Playwright configurado antes do Execute, avisar antes de começar a implementar — não fabricado aqui.

### Dependências cross-feature (fundação compartilhada, Fase 1 do `docs/2026-07-30-ordem-execucao-specs.md`)

`auditoria-logs` está na Fase 1 (paralela a `autenticacao-usuarios` e `configuracao-fluxos`), mas duas dependências reais de implementação existem e não são stub-áveis do mesmo jeito que `autenticacao-usuarios/tasks.md` (T9) stubou `logService`:

| Esta feature precisa de... | Vem de | Por que não dá pra stubar |
| --- | --- | --- |
| `prisma/schema.prisma` existente + `lib/prisma.ts` (client singleton) | `autenticacao-usuarios` T1 (scaffold) + T2 (Prisma) | É o mesmo arquivo físico (`schema.prisma`) — não existe "stub de arquivo", alguém tem que criar o arquivo primeiro. |
| `model User` já declarado em `schema.prisma` | `autenticacao-usuarios` T3 | `Log.usuario` é uma relação Prisma (`@relation`) para `User` — Prisma rejeita (`prisma validate` falha) uma relação apontando para um model que não existe no schema. Diferente de uma função TS, não há como "stubar" uma relação de schema sem o model real. |
| `authService.requireUser(roles?)` | `autenticacao-usuarios` T9 | É o próprio controle de acesso exigido por AUD-05. Stubar autorização (ex.: sempre permitir) é risco de segurança — pior que esperar a dependência real, diferente do stub de `logService` (pior caso de não logar é só perda de rastreabilidade, não brecha de acesso). |

**Implicação prática**: T1 desta feature só pode iniciar depois de `autenticacao-usuarios` T2+T3 estarem prontos (schema.prisma + model User). T4/T6/T5 (rota e UI) só podem iniciar depois de `autenticacao-usuarios` T9 estar pronto. Se as duas features forem executadas por agentes/pessoas em paralelo, coordenar essa ordem antes de começar — não é uma sugestão, é um bloqueio real de compilação/validação.

---

## Execution Plan

Pipeline único e sequencial dentro da feature — cada task depende de dado/contrato criado pela anterior (schema → escrita → leitura → rota → UI). Não há `[P]` interno; o paralelismo real acontece entre features (Fase 1), não dentro desta.

### Fase A: Fundação de dados (Sequential)

```
T1 → T2 → T3
```

### Fase B: Superfície HTTP (Sequential)

```
T3 → T4
```

### Fase C: UI (Sequential)

```
T4 → T6 → T5
```

Cadeia completa: `T1 → T2 → T3 → T4 → T6 → T5`

---

## Task Breakdown

### T1: Modelo `Log` + enum `LogTipo`

**What**: Adicionar `enum LogTipo { AUDITORIA ERRO }` e `model Log` ao `schema.prisma` (campos `id`, `tipo`, `entidade`, `entidade_id`, `acao`, `usuario_id`, `usuario` (relação opcional a `User`, `onDelete: SetNull`), `detalhes` (Json?), `criado_em`), com os 4 índices (`tipo`, `entidade`, `usuario_id`, `criado_em`), e gerar a migration.
**Where**: `prisma/schema.prisma` (append), `prisma/migrations/`
**Depends on**: None dentro da feature. **Cross-feature (bloqueante)**: `autenticacao-usuarios` T2 (schema.prisma + `lib/prisma.ts` existentes) e T3 (`model User` já declarado — necessário para a relação).
**Reuses**: `model User` (de `autenticacao-usuarios` T3).
**Requirement**: AUD-01, AUD-02

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `enum LogTipo { AUDITORIA ERRO }` definido
- [ ] `model Log` com todos os campos do design (nomenclatura em português, sem tradução), `@@map("logs")`
- [ ] `criado_em DateTime @default(now())` (AUD-02)
- [ ] Relação `usuario` → `User` com `onDelete: SetNull`, `usuario_id` opcional
- [ ] `entidade`/`entidade_id` como `String` livres, sem FK (polimórfico — decisão do design)
- [ ] 4 índices presentes (`tipo`, `entidade`, `usuario_id`, `criado_em`)
- [ ] Migration gerada e aplicada sem erro
- [ ] Gate check passa: `npx prisma validate`

**Tests**: none
**Gate**: prisma

**Commit**: `feat(logs): adiciona modelo Log e enum LogTipo`

---

### T2: `logService.registrar`

**What**: Implementar `registrar(evento)` em `lib/services/logService.ts` — rejeita (lança) se `tipo` fora de `AUDITORIA`/`ERRO`; persiste via `prisma.log.create`; qualquer falha de persistência é capturada internamente e nunca propagada ao chamador (sem retry de log da própria falha, evita recursão).
**Where**: `lib/services/logService.ts`
**Depends on**: T1
**Reuses**: `lib/prisma.ts` (de `autenticacao-usuarios` T2)
**Requirement**: AUD-01, AUD-03, AUD-04

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `registrar(evento)` lança erro síncrono quando `tipo` não é `AUDITORIA` nem `ERRO` (contrato fechado)
- [ ] `registrar(evento)` aceita `usuario_id` nulo/ausente sem erro (evento de sistema)
- [ ] Persistência bem-sucedida: registro em `Log` com todos os campos do evento + `criado_em` automático
- [ ] Falha de persistência (ex.: `DATABASE_URL` inválida temporariamente): `registrar` NÃO lança, chamador conclui normalmente
- [ ] Falha de persistência não tenta gravar um novo log `ERRO` para si mesma (sem recursão)
- [ ] Gate check passa: `npm run build`

**Tests**: manual
**Gate**: build

**Verify** (cenário manual — Independent Test do spec.md):
- Chamar `registrar` com evento `AUDITORIA` válido → registro existe em `Log` com todos os campos corretos.
- Chamar `registrar` com evento `ERRO` válido, `usuario_id` ausente → registro existe com `usuario_id` nulo.
- Chamar `registrar` com `tipo: 'INVALIDO'` → lança erro (não grava nada).
- Apontar `DATABASE_URL` para host inválido temporariamente e chamar `registrar` → função retorna normalmente, sem lançar, sem crashar o processo chamador.

**Commit**: `feat(logs): implementa logService.registrar com resiliencia a falha de persistencia`

---

### T3: `logService.listar`

**What**: Implementar `listar(filtros: LogFiltro)` em `lib/services/logService.ts` — combina `tipo`, `entidade`, `usuario_id`, `data_inicio`/`data_fim` com AND lógico via `where`, `include usuario` (nome/e-mail), `orderBy criado_em desc`, paginação (`page`/`pageSize`, default `page=1`, `pageSize=20`).
**Where**: `lib/services/logService.ts` (mesmo arquivo de T2)
**Depends on**: T2 (mesmo arquivo — sequencial para evitar conflito de edição concorrente; sem dependência funcional real de `registrar`)
**Reuses**: `lib/prisma.ts`
**Requirement**: AUD-06, AUD-07, AUD-08, AUD-09, AUD-11

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Filtro por `tipo` isolado retorna só aquele tipo
- [ ] Filtro por `entidade` isolado retorna só aquela entidade
- [ ] Filtro por `usuario_id` isolado retorna só logs daquele usuário
- [ ] Filtro por período (`data_inicio`/`data_fim`) retorna só logs com `criado_em` no intervalo
- [ ] Múltiplos filtros combinados = AND lógico (interseção, não união)
- [ ] Sem filtros = todos os logs, paginados
- [ ] `orderBy criado_em desc` sempre aplicado, inclusive entre páginas
- [ ] `include usuario: { nome, email }` presente no retorno; `usuario: null` quando `usuario_id` nulo
- [ ] Retorna `{ logs, total }` com `total` = contagem sem paginação
- [ ] Gate check passa: `npm run build`

**Tests**: manual
**Gate**: build

**Verify** (cenário manual — Independent Test do spec.md):
- Popular logs de tipos/entidades/usuários/datas diferentes.
- Filtrar por `tipo: 'ERRO'` isolado → só `ERRO` retornado.
- Filtrar por `entidade` + `usuario_id` combinados → interseção correta.
- Filtrar por período com `data_inicio`/`data_fim` → só registros dentro do intervalo.
- Sem filtro, popular > `pageSize` registros → `page=2` retorna o próximo bloco, ordenação preservada entre páginas.

**Commit**: `feat(logs): implementa logService.listar com filtros combinados e paginacao`

---

### T4: `GET /api/logs`

**What**: Implementar `app/api/logs/route.ts` — `authService.requireUser(['RH_ADMIN'])` → valida query params via Zod (`tipo` opcional, `entidade` opcional, `usuario_id` opcional, `data_inicio`/`data_fim` opcionais com `refine` garantindo `data_inicio <= data_fim`, `page`/`pageSize` opcionais) → `logService.listar(filtros)` → `200 JSON`.
**Where**: `app/api/logs/route.ts`
**Depends on**: T3. **Cross-feature (bloqueante)**: `autenticacao-usuarios` T9 (`authService.requireUser`).
**Reuses**: `authService.requireUser` (de `autenticacao-usuarios` T9), `logService.listar` (T3)
**Requirement**: AUD-05, AUD-06, AUD-07, AUD-08, AUD-09, AUD-11

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Sem sessão ou papel diferente de `RH_ADMIN` → 401/403, `logService.listar` nunca é chamado
- [ ] Query com `data_inicio > data_fim` → 400, `listar` nunca é chamado
- [ ] Query válida → 200 com `{ logs, total }`
- [ ] Todos os filtros da spec aceitos e repassados corretamente ao service
- [ ] Gate check passa: `npm run build`

**Tests**: manual
**Gate**: build

**Verify** (cenário manual — Independent Test do spec.md):
- Autenticar como `GESTOR` ou `SOLICITANTE`, chamar `GET /api/logs` → bloqueado (401/403), confirma AUD-05.
- Autenticar como `RH_ADMIN`, chamar sem filtros → 200 com lista paginada.
- Chamar com `data_inicio` posterior a `data_fim` → 400, sem consulta ao banco.
- Chamar com combinação de filtros válidos → resultado coerente com T3.

**Commit**: `feat(logs): implementa rota GET /api/logs com autorizacao RH_ADMIN`

---

### T6: UI da tela de Auditoria/Logs (filtros + tabela + paginação)

**What**: Implementar `_components/LogFiltros.tsx` (client, campos tipo/entidade/usuário/período, bloqueia submit se `data_inicio > data_fim`), `_components/LogTabela.tsx` (client, tabela ordenada, linha expansível com `detalhes` formatado, estado vazio explícito), `_components/LogPaginacao.tsx` (client, paginação simples) — os três compartilham estado de filtro/página e disparam `fetch` em `GET /api/logs` a cada mudança.
**Where**: `app/(dashboard)/auditoria-logs/_components/LogFiltros.tsx`, `.../_components/LogTabela.tsx`, `.../_components/LogPaginacao.tsx`
**Depends on**: T4
**Reuses**: `GET /api/logs` (T4)
**Requirement**: AUD-06, AUD-07, AUD-08, AUD-09, AUD-10, AUD-11

> **Nota de escopo**: o design (`design.md`) lista os três componentes separadamente mas não nomeia onde vive o estado compartilhado de filtro/página nem quem dispara o `fetch`. Tratados como UMA task (não 3 `[P]`) porque são fortemente acoplados por esse estado compartilhado — mudar filtro reseta página, mudar página refaz o fetch com o filtro atual; dividir em tasks paralelas criaria risco de integração (dois arquivos escrevendo a mesma lógica de estado de formas incompatíveis). Não inventar um 4º componente além dos listados no design; a coordenação de estado fica no componente que a task considerar mais natural durante a implementação (ex.: elevar estado para o componente pai mais próximo já previsto). Se a distribuição concreta divergir do design, sinalizar como `SPEC_DEVIATION` no resumo da task.

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Filtro por tipo/entidade/usuário/período disparam nova busca (AUD-06, AUD-07, AUD-08)
- [ ] Submit bloqueado no client (sem chamar a API) quando `data_inicio > data_fim`, com mensagem
- [ ] Tabela ordenada por `criado_em` desc, colunas `criado_em`, `tipo`, `entidade`, `entidade_id`, `acao`, usuário (nome via join, "Sistema" se `usuario_id` nulo) — AUD-09
- [ ] Linha expansível mostra `detalhes` formatado (JSON legível, truncamento/scroll para payload grande) sem nova chamada de rede — AUD-10
- [ ] `detalhes` nulo/vazio exibe o registro normalmente, sem erro — AUD-10
- [ ] Estado vazio explícito quando filtros não retornam nada
- [ ] Paginação mantém ordenação entre páginas — AUD-11
- [ ] Gate check passa: `npm run build`

**Tests**: manual
**Gate**: build

**Verify** (cenário manual — Independent Test do spec.md):
- Popular logs de tipos/entidades diferentes; aplicar cada filtro isoladamente e combinado; confirmar resultado exibido bate com o esperado.
- Abrir um log `ERRO` com `detalhes` populado → JSON legível ao expandir.
- Abrir um log com `detalhes` nulo → exibição normal, sem erro.
- Informar período com `data_inicio > data_fim` → bloqueado no client, sem request de rede.
- Popular volume acima do tamanho de página → navegar entre páginas preservando ordenação.
- Filtros sem resultado → estado vazio, não erro.

**Commit**: `feat(logs): implementa filtros, tabela e paginacao da tela de auditoria`

---

### T5: `page.tsx` — gate de acesso e composição da tela

**What**: Implementar `app/(dashboard)/auditoria-logs/page.tsx` (Server Component) — `authService.requireUser(['RH_ADMIN'])`; papéis diferentes recebem 403/redirect; renderiza `LogFiltros` + `LogTabela` + `LogPaginacao`.
**Where**: `app/(dashboard)/auditoria-logs/page.tsx`
**Depends on**: T6. **Cross-feature (bloqueante)**: `autenticacao-usuarios` T9 (`authService.requireUser`).
**Reuses**: `authService.requireUser` (de `autenticacao-usuarios` T9), componentes de T6
**Requirement**: AUD-05

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `RH_ADMIN` acessa a rota → tela renderiza normalmente
- [ ] `SOLICITANTE`/`GESTOR` acessa a rota → bloqueado no backend (403/redirect), não apenas escondido no frontend
- [ ] Gate check passa: `npm run build`

**Tests**: manual
**Gate**: build

**Verify** (cenário manual — Independent Test do spec.md):
- Autenticar como `RH_ADMIN`, acessar `/auditoria-logs` → tela renderiza com filtros/tabela/paginação.
- Autenticar como `GESTOR` ou `SOLICITANTE`, acessar `/auditoria-logs` diretamente pela URL → bloqueado no backend, confirma AUD-05 (não é só botão escondido).

**Commit**: `feat(logs): implementa pagina de auditoria com gate RH_ADMIN`

---

## Parallel Execution Map

```
T1 → T2 → T3 → T4 → T6 → T5
```

Nenhuma task `[P]` dentro desta feature — pipeline sequencial genuíno (cada task consome contrato/código da anterior, ou compartilha arquivo). Paralelismo real: esta feature inteira roda em paralelo a `autenticacao-usuarios` e `configuracao-fluxos` (Fase 1 do `docs/2026-07-30-ordem-execucao-specs.md`), respeitando os bloqueios cross-feature descritos acima (T1 espera AUTH T2+T3; T4/T5 esperam AUTH T9).

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Modelo Log + enum | 1 schema (2 declarações coesas: enum + model que o usa) | ✅ Granular |
| T2: logService.registrar | 1 função | ✅ Granular |
| T3: logService.listar | 1 função | ✅ Granular |
| T4: GET /api/logs | 1 endpoint | ✅ Granular |
| T6: UI (Filtros+Tabela+Paginação) | 3 arquivos, mas 1 concern coeso (estado compartilhado de filtro/página) — ver Nota de escopo em T6 | ✅ Granular (2-3 coisas relacionadas, cohesive) |
| T5: page.tsx | 1 arquivo | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None (+ cross-feature AUTH T2,T3) | Início da cadeia, sem seta de entrada | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | T3 (+ cross-feature AUTH T9) | T3 → T4 | ✅ Match |
| T6 | T4 | T4 → T6 | ✅ Match |
| T5 | T6 (+ cross-feature AUTH T9) | T6 → T5 | ✅ Match |

Nenhuma task marcada `[P]` — não se aplica a regra de "task paralela não pode depender de outra da mesma fase".

---

## Test Co-location Validation

Sem `TESTING.md` (greenfield, sem framework escolhido) — aplicando a mesma convenção fixada em `autenticacao-usuarios/tasks.md`: "manual" (cenário descrito em `Verify`, conforme `CLAUDE.md`) substitui unit/e2e/integration para toda lógica de autorização/resiliência/fluxo; tasks de schema puro usam `none`, gate por `prisma validate`.

| Task | Código Criado/Modificado | Convenção Exige | Task Diz | Status |
| --- | --- | --- | --- | --- |
| T1: Modelo Log | schema (sem lógica própria) | none | none | ✅ OK |
| T2: logService.registrar | lógica de resiliência/contrato (AUD-03, AUD-04) | manual | manual | ✅ OK |
| T3: logService.listar | lógica de combinação de filtros/paginação | manual | manual | ✅ OK |
| T4: GET /api/logs | lógica de autorização + validação de query | manual | manual | ✅ OK |
| T6: UI (Filtros+Tabela+Paginação) | lógica de fluxo (filtro→fetch→render, expandir detalhe) | manual | manual | ✅ OK |
| T5: page.tsx | lógica de gate de acesso (AUD-05) | manual | manual | ✅ OK |

---

## Requirement Traceability (atualização)

| Requirement ID | Task(s) |
| --- | --- |
| AUD-01 | T1 (schema), T2 (persistência) |
| AUD-02 | T1 (`criado_em @default(now())`) |
| AUD-03 | T2 |
| AUD-04 | T2 |
| AUD-05 | T4 (rota), T5 (página) |
| AUD-06 | T3, T4, T6 |
| AUD-07 | T3, T4, T6 |
| AUD-08 | T3, T4, T6 |
| AUD-09 | T3, T6 |
| AUD-10 | T6 |
| AUD-11 | T3, T4, T6 |

Coverage: 11/11 requisitos mapeados para pelo menos 1 task.

---

## Riscos / Pontos a verificar na fase de Execute

- **Bloqueio real de T1** em `autenticacao-usuarios` T2+T3 (schema.prisma + model User) — coordenar ordem antes de iniciar Execute em paralelo às duas features (ver seção "Dependências cross-feature" acima).
- **Bloqueio real de T4/T5** em `autenticacao-usuarios` T9 (`authService.requireUser`) — sem stub aceitável por ser controle de acesso (AUD-05), diferente do stub que `autenticacao-usuarios` T9 já previu para `logService`.
- **T6** tem uma lacuna de design (onde vive o estado compartilhado de filtro/página) — não resolvida aqui para não inventar componente fora do que `design.md` lista; resolver durante a implementação e sinalizar `SPEC_DEVIATION` se a distribuição final divergir da lista de componentes do design.
- Reconciliar nomes (`registrarLog`→`registrar`, `getUsuarioAutenticado`/`requireRole`→`authService.*`) no `design.md` de `configuracao-fluxos` quando essa feature for revisitada — herdado do `design.md` desta feature (seção 0), não resolvido aqui por não invadir escopo de outra feature.
- Confirmar com o usuário as 5 decisões da tabela "Tech Decisions" do `design.md` marcadas como resolução de "Questão em Aberto" — nenhuma teve `/discuss` dedicado.
