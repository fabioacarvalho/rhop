# Gestão de Equipes Specification

> Feature slug: `gestao-equipes` · Requirement prefix: `EQP`
> Fonte da verdade: `.specs/features/cadastro-usuarios/spec.md` (feature que esta especificação estende/revisa), `.specs/features/autenticacao-usuarios/spec.md` (modelo `User`, papéis), `CLAUDE.md` (regras de negócio invioláveis — a regra de visibilidade por `gestor_id` é revisada aqui, ver "Impacto em regras existentes").

## Problem Statement

Hoje `User.gestor_id` (auto-relação 1:1) é a única fonte de verdade de "quem é subordinado de quem": decide quem aprova a etapa `GESTOR` de uma `Solicitacao` e o que cada `GESTOR` vê nas telas de usuários/dashboard/insights. Isso trava dois problemas reais: (1) não existe um conceito de "time" nomeado — só um ponteiro pessoa→pessoa, então não há como ver/gerenciar "a Equipe Comercial" como unidade; (2) trocar o responsável por um grupo inteiro de pessoas exige editar o `gestor_id` de cada subordinado individualmente, um por um, em vez de uma única troca. Esta feature introduz `Equipe` como entidade nomeada — usuário pertence a uma equipe, equipe tem 1 gestor responsável — e essa relação passa a decidir aprovação e visibilidade no lugar do `gestor_id` direto.

## Goals

- [ ] `RH_Admin` cria, edita, lista e desativa/reativa `Equipe`s (nome + gestor responsável) numa tela dedicada, sem depender de script.
- [ ] Cadastro de `SOLICITANTE` exige vincular a uma `Equipe` ativa (via `RH_Admin`, qualquer equipe; via `GESTOR`, só entre as equipes que ele mesmo gerencia) — substitui o campo `gestor_id` obrigatório de hoje.
- [ ] A etapa `GESTOR` de uma `Solicitacao` só pode ser decidida pelo gestor responsável pela `Equipe` do solicitante — não mais por um `gestor_id` gravado direto no solicitante.
- [ ] Um `GESTOR` pode ser responsável por mais de uma `Equipe`; a visibilidade dele (listagem de usuários, dashboard, insights) agrega os membros de todas as equipes que ele gerencia.
- [ ] Dados já existentes (via `scripts/seed-users.ts`/uso real) são migrados para o novo modelo sem perda: todo `GESTOR` com subordinados hoje ganha 1 `Equipe` equivalente antes do campo antigo saber do schema.

## Out of Scope

Explicitamente excluído. Documentado para evitar scope creep.

| Feature | Motivo |
| ------- | ------ |
| `Equipe` coexistir com `gestor_id` como fallback | Decisão travada em `context.md` — `gestor_id`/auto-relação `"Hierarquia"` são removidos do schema, não mantidos como campo morto. |
| `Equipe` com mais de 1 gestor responsável (aprovadores em paralelo) | Fora de escopo global (`CLAUDE.md`: "Múltiplos aprovadores em paralelo na mesma etapa"). |
| `GESTOR` criar/editar/desativar suas próprias `Equipe`s | Tela `/equipes` é `RH_Admin`-only (decisão travada em `context.md`). |
| `GESTOR` mover um `SOLICITANTE` entre as equipes que ele mesmo gerencia | Não pedido explicitamente; só `RH_Admin` edita `equipe_id` de um usuário existente (mesma postura de `cadastro-usuarios`: Gestor só edita `nome` do subordinado). |
| Reatribuição em massa de membros ao desativar/trocar o gestor de uma `Equipe` com membros ativos | `RH_Admin` reatribui manualmente, um a um — mesma postura já deferida em `cadastro-usuarios`. |
| Subtimes / hierarquia de `Equipe` dentro de `Equipe` | Não pedido, fora de escopo. |
| Exclusão definitiva (hard delete) de `Equipe` | Quebraria integridade referencial de `User.equipe_id` histórico — substituído por desativação (`ativo`), mesmo padrão de `User`. |
| Motor de workflow visual, múltiplos aprovadores em paralelo, upload de arquivo, notificação via Slack/Teams, multi-tenant | Fora de escopo global do projeto (`CLAUDE.md`). |

---

## Impacto em regras existentes (não é feature nova isolada — revisa `cadastro-usuarios`)

- **`CLAUDE.md` — Visibilidade**: a frase "gestor vê... usuários com `gestor_id` apontando para ele" precisa ser atualizada para "gestor vê... usuários cuja `Equipe` tem `gestor_id` igual ao dele" como parte da execução (task de documentação).
- **`aprovacaoService.assertPodeDecidir`**: hoje compara `solicitacao.solicitante.gestor_id === usuario.id`; passa a comparar `solicitacao.solicitante.equipe.gestor_id === usuario.id`.
- **`userService.listar`/`assertEscopoGestao`/`buscarPorId`**: hoje filtram por `gestor_id: ator.id`; passam a filtrar por `equipe_id: { in: equipesGeridasPor(ator.id) } }`.
- **`dashboardService`/`insightsService`**: mesmas duas ocorrências de `gestor_id: usuario.id` migram para o filtro por `equipe_id in equipesGeridasPor(...)`.
- Requisitos `USR-02`, `USR-03`, `USR-07`, `USR-08`, `USR-13`, `USR-14`, `USR-20` de `cadastro-usuarios/spec.md` são **superados** pelos requisitos `EQP-*` abaixo — `cadastro-usuarios/spec.md` não é reescrito nesta sessão, mas seu comportamento real muda conforme esta spec.

---

## User Stories

### P1: `RH_Admin` cria e gerencia `Equipe`s ⭐ MVP

**User Story**: Como RH_Admin, quero criar, renomear, trocar o gestor responsável e desativar/reativar uma `Equipe`, para organizar os colaboradores em times nomeados e poder trocar quem é responsável por um time inteiro numa única edição.

**Why P1**: É o núcleo literal do pedido — sem isso não existe "área de configuração de equipes", e a etapa seguinte (cadastro de usuário exigindo equipe) não tem o que referenciar.

**Acceptance Criteria**:

1. WHEN um `RH_ADMIN` submete `nome` e `gestor_id` referenciando um `User` com `role = GESTOR` e `ativo = true` THEN o sistema SHALL criar a `Equipe`.
2. WHEN o `nome` submetido já pertence a uma `Equipe` existente THEN o sistema SHALL rejeitar a criação/edição com mensagem clara.
3. WHEN `gestor_id` submetido não existe, não tem `role = GESTOR`, ou tem `ativo = false` THEN o sistema SHALL rejeitar a criação/edição com mensagem clara.
4. WHEN um `RH_ADMIN` acessa a listagem de `Equipe`s THEN o sistema SHALL exibir nome, nome do gestor responsável, quantidade de membros ativos e status (`ativo`/`inativo`) de cada uma.
5. WHEN um `RH_ADMIN` edita `nome` e/ou `gestor_id` de uma `Equipe` existente THEN o sistema SHALL aplicar as mesmas validações de EQP-1 a EQP-3 antes de salvar.
6. WHEN um usuário autenticado com papel diferente de `RH_ADMIN` tenta criar, editar, listar ou desativar/reativar uma `Equipe` THEN o sistema SHALL negar o acesso no backend, independente do que a UI esconde.

**Independent Test**: Como `RH_Admin`, criar uma `Equipe` com um `GESTOR` existente como responsável, confirmar que aparece na listagem, renomear e confirmar a mudança refletida.

---

### P1: Desativação/reativação de `Equipe` respeita membros ativos ⭐ MVP

**User Story**: Como RH_Admin, quero que o sistema me impeça de desativar uma `Equipe` que ainda tem membros ativos, para nunca deixar um `SOLICITANTE` numa equipe sem aprovador elegível por engano.

**Why P1**: Sem essa trava, desativar uma `Equipe` distraidamente quebra silenciosamente o fluxo de aprovação de todo mundo que ainda está nela.

**Acceptance Criteria**:

1. WHEN um `RH_ADMIN` tenta desativar uma `Equipe` que tem pelo menos 1 `User` `ativo = true` com `equipe_id` apontando pra ela THEN o sistema SHALL rejeitar com mensagem clara citando a quantidade de membros ativos, sem desativar nada.
2. WHEN uma `Equipe` não tem nenhum `User` `ativo = true` associado THEN o sistema SHALL permitir a desativação (`ativo = false`).
3. WHEN um `RH_ADMIN` reativa uma `Equipe` com `ativo = false` THEN o sistema SHALL permitir sempre, sem checagem de membros.

**Independent Test**: Criar uma `Equipe` com 1 `SOLICITANTE` ativo associado, tentar desativar e confirmar bloqueio; desativar o `SOLICITANTE` (ou trocar sua equipe) e confirmar que a desativação da `Equipe` passa a ser permitida.

---

### P1: Cadastro de `SOLICITANTE` exige vínculo com `Equipe` ⭐ MVP

**User Story**: Como RH_Admin ou Gestor, quero informar a `Equipe` de um `SOLICITANTE` no cadastro (em vez de um gestor individual), para que a aprovação dele já saia roteada corretamente pro responsável certo daquele time.

**Why P1**: É a ponte entre "Equipe existe" e "Equipe decide aprovação" — sem isso, `Equipe` fica só uma tela de configuração sem efeito prático em nenhum outro fluxo.

**Acceptance Criteria**:

1. WHEN um `RH_ADMIN` cadastra um `SOLICITANTE` informando `equipe_id` de uma `Equipe` `ativo = true` THEN o sistema SHALL gravar o vínculo, aceitando qualquer `Equipe` ativa existente.
2. WHEN um `GESTOR` cadastra um `SOLICITANTE` informando `equipe_id` THEN o sistema SHALL aceitar somente uma `Equipe` cujo `gestor_id` seja o próprio `GESTOR` autenticado, rejeitando (403) qualquer `equipe_id` de uma equipe que ele não gerencia — mesmo que a requisição seja manipulada diretamente.
3. WHEN `equipe_id` submetido não existe ou referencia uma `Equipe` `ativo = false` THEN o sistema SHALL rejeitar o cadastro com mensagem clara.
4. WHEN um `RH_ADMIN` cadastra um `User` com `role = GESTOR` ou `role = RH_ADMIN` e envia `equipe_id` (qualquer valor) THEN o sistema SHALL rejeitar — esses papéis não pertencem ao modelo de equipes como membros.
5. WHEN `role = SOLICITANTE` e `equipe_id` está ausente/nulo THEN o sistema SHALL rejeitar o cadastro (`equipe_id` é obrigatório para `SOLICITANTE`).

**Independent Test**: Como `RH_Admin`, cadastrar um `SOLICITANTE` numa `Equipe` existente e confirmar o vínculo salvo; como `GESTOR` responsável por 2 equipes, cadastrar 2 `SOLICITANTE`s em cada uma das próprias equipes e confirmar que uma tentativa de usar a `equipe_id` de outro gestor é bloqueada.

---

### P1: Aprovação da etapa `GESTOR` roteia pela `Equipe` do solicitante ⭐ MVP

**User Story**: Como Gestor responsável por uma Equipe, quero ver e decidir só as solicitações dos membros das equipes que eu gerencio, para que a troca de responsável de uma equipe inteira não exija tocar em cada solicitante individualmente.

**Why P1**: É o efeito funcional principal da feature — sem isso, `Equipe` não muda nada no comportamento real de aprovação, só organiza dados.

**Acceptance Criteria**:

1. WHEN a etapa atual de uma `Solicitacao` é `GESTOR` THEN o sistema SHALL considerar como único aprovador elegível o `User` que é `gestor_id` da `Equipe` do `solicitante` daquela solicitação.
2. WHEN um `User` diferente do gestor responsável pela `Equipe` do solicitante tenta decidir a etapa `GESTOR` THEN o sistema SHALL negar com erro de autorização (403), mesmo comportamento de hoje só que a checagem passa pela `Equipe`.
3. WHEN o `solicitante` de uma `Solicitacao` não tem `equipe_id` (dado legado incompleto ou inconsistência) THEN o sistema SHALL negar a decisão com a mesma mensagem de "sem aprovador elegível" já usada hoje para "solicitante sem gestor_id".
4. WHEN a `Equipe` do solicitante existe mas seu `gestor_id` responsável está `ativo = false` THEN o sistema SHALL negar a decisão para qualquer usuário (nenhum aprovador elegível até `RH_Admin` trocar o responsável da `Equipe`).

**Independent Test**: Criar uma `Equipe` com Gestor A como responsável, um `SOLICITANTE` nela, abrir uma `Solicitacao`; confirmar que só o Gestor A consegue decidir a etapa `GESTOR` e que trocar o responsável da `Equipe` pra Gestor B (via `/equipes`) faz a próxima solicitação daquele mesmo `SOLICITANTE` aparecer pra Gestor B, não mais pra A.

---

### P1: Visibilidade de um `GESTOR` agrega todas as equipes que ele gerencia ⭐ MVP

**User Story**: Como Gestor responsável por mais de uma Equipe, quero ver na listagem de usuários, no dashboard e no painel de insights os dados de todas as equipes que gerencio, não só de uma.

**Why P1**: Consequência direta de "1 Gestor pode gerenciar N Equipes" (decisão travada) — sem isso, um Gestor com 2 equipes ficaria sem visibilidade de metade do próprio time.

**Acceptance Criteria**:

1. WHEN um `GESTOR` acessa a listagem de usuários (`/usuarios`) THEN o sistema SHALL listar todos os `SOLICITANTE`s cujo `equipe_id` pertence a alguma `Equipe` com `gestor_id` igual ao dele — nunca a base inteira, nunca só 1 equipe se ele gerenciar mais de 1.
2. WHEN um `GESTOR` acessa o dashboard ou o painel de insights THEN o sistema SHALL considerar `Solicitacao`s cujo `solicitante.equipe_id` pertence a alguma `Equipe` gerenciada por ele, agregando todas.
3. WHEN um `RH_ADMIN` acessa qualquer uma das telas acima THEN o sistema SHALL continuar vendo a base inteira, sem mudança de comportamento.

**Independent Test**: Um `GESTOR` responsável por 2 `Equipe`s com `SOLICITANTE`s distintos em cada uma; confirmar que a listagem de usuários e o dashboard mostram os `SOLICITANTE`s de ambas.

---

### P1: Migração de dados legados (`gestor_id` → `Equipe`) ⭐ MVP

**User Story**: Como responsável técnico pelo projeto, quero que os dados já cadastrados (via seed/uso real) sejam convertidos para o modelo de `Equipe` sem perda, para que a troca do modelo não quebre login/aprovação de ninguém já existente no banco.

**Why P1**: Sem isso, ativar esta feature em cima de dados reais quebra a aprovação de toda solicitação pendente de gestor já em andamento — não é opcional, é pré-requisito de deploy seguro.

**Acceptance Criteria**:

1. WHEN a migração roda THEN o sistema SHALL criar 1 `Equipe` para cada `User` `role = GESTOR` que hoje é `gestor_id` de pelo menos 1 outro `User`, com esse `GESTOR` como `gestor_id` responsável.
2. WHEN a migração roda THEN o sistema SHALL preencher `equipe_id` de cada `User` migrado com o `id` da `Equipe` criada para o `gestor_id` que ele tinha antes.
3. WHEN um `User` `role = GESTOR` não é `gestor_id` de ninguém antes da migração THEN o sistema SHALL NÃO criar uma `Equipe` vazia para ele automaticamente.
4. WHEN a migração termina com sucesso THEN o sistema SHALL remover `User.gestor_id` (e a auto-relação `"Hierarquia"`) do schema, sem deixar código de produção lendo um campo que não existe mais.

**Independent Test**: Rodar a migração contra uma cópia dos dados de seed atuais; confirmar que cada `SOLICITANTE` migrado consegue ter sua etapa `GESTOR` decidida pelo mesmo `GESTOR` que já era responsável por ele antes da migração.

---

### P2: Detalhe de membros de uma `Equipe`

**User Story**: Como RH_Admin, quero ver quem são os membros de uma `Equipe` direto na tela de gestão, para decidir se posso desativá-la ou pra quem realocar antes de trocar o responsável.

**Why P2**: Melhora a UX de decisão (EQP-06/07 já bloqueiam o caso perigoso mesmo sem essa tela), mas o MVP funciona sem listar membros em detalhe — a contagem (EQP-04) já é suficiente pra operar.

**Acceptance Criteria**:

1. WHEN um `RH_ADMIN` expande/abre o detalhe de uma `Equipe` THEN o sistema SHALL listar nome, e-mail e status de cada `User` com `equipe_id` apontando pra ela.

**Independent Test**: Abrir o detalhe de uma `Equipe` com 3 membros e confirmar que os 3 aparecem com dados corretos.

---

## Edge Cases

- WHEN o `nome` de uma `Equipe` submetido é vazio/só espaços THEN o sistema SHALL rejeitar antes de tocar o banco.
- WHEN `gestor_id` de uma `Equipe` é trocado para outro `GESTOR` que já é responsável por outra(s) `Equipe`(s) THEN o sistema SHALL permitir (1 Gestor pode gerenciar N Equipes — decisão travada), sem limite de quantidade.
- WHEN um `RH_ADMIN` edita o `role` de um `User` que é `gestor_id` responsável de 1+ `Equipe` `ativo = true` para um papel diferente de `GESTOR` THEN o sistema SHALL bloquear a edição (mesmo princípio de `ErroEdicaoBloqueadaUsuario` já usado em `cadastro-usuarios`, agora contando `Equipe`s geridas em vez de subordinados diretos).
- WHEN um `RH_ADMIN` edita o `role` de um `SOLICITANTE` com `equipe_id` preenchido para `GESTOR`/`RH_ADMIN` THEN o sistema SHALL limpar `equipe_id` automaticamente (papel novo não pertence ao modelo de equipes como membro).
- WHEN um `GESTOR` tenta cadastrar/editar um `SOLICITANTE` usando `equipe_id` de uma `Equipe` que ele não gerencia THEN o sistema SHALL negar com 403 em todos os casos, mesmo que a UI não exponha esse caminho.
- WHEN o gestor responsável de uma `Equipe` é desativado (`User.ativo = false`) enquanto ainda é `gestor_id` dela THEN o sistema SHALL deixar a `Equipe` sem aprovador elegível até `RH_Admin` trocar o responsável — não desfaz nem realoca automaticamente (mesma postura de "sem reatribuição em massa" já deferida em `cadastro-usuarios`).
- WHEN a migração de dados encontra um `User` com `gestor_id` apontando para outro `User` que não é `role = GESTOR` (inconsistência de dados legados) THEN o sistema SHALL registrar `Log` tipo `ERRO` e pular esse registro sem interromper a migração dos demais — tratado manualmente por `RH_Admin` depois.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| EQP-01 | P1: RH_Admin cria Equipe | Design | Pending |
| EQP-02 | P1: RH_Admin cria/edita Equipe (nome duplicado) | Design | Pending |
| EQP-03 | P1: RH_Admin cria/edita Equipe (gestor_id inválido) | Design | Pending |
| EQP-04 | P1: RH_Admin lista Equipes | Design | Pending |
| EQP-05 | P1: RH_Admin edita Equipe | Design | Pending |
| EQP-06 | P1: RH_Admin acesso restrito ao CRUD de Equipe | Design | Pending |
| EQP-07 | P1: Desativação bloqueada com membros ativos | Design | Pending |
| EQP-08 | P1: Desativação permitida sem membros ativos | Design | Pending |
| EQP-09 | P1: Reativação sempre permitida | Design | Pending |
| EQP-10 | P1: RH_Admin cadastra SOLICITANTE com equipe_id (qualquer equipe ativa) | Design | Pending |
| EQP-11 | P1: GESTOR cadastra SOLICITANTE só nas próprias equipes | Design | Pending |
| EQP-12 | P1: equipe_id inexistente/inativa rejeitado | Design | Pending |
| EQP-13 | P1: GESTOR/RH_ADMIN não aceitam equipe_id no próprio cadastro | Design | Pending |
| EQP-14 | P1: equipe_id obrigatório para SOLICITANTE | Design | Pending |
| EQP-15 | P1: aprovador elegível da etapa GESTOR = gestor_id da Equipe do solicitante | Design | Pending |
| EQP-16 | P1: decisão por quem não é o gestor responsável → 403 | Design | Pending |
| EQP-17 | P1: solicitante sem equipe_id → sem aprovador elegível | Design | Pending |
| EQP-18 | P1: gestor responsável inativo → sem aprovador elegível | Design | Pending |
| EQP-19 | P1: listagem de usuários do GESTOR agrega todas as equipes geridas | Design | Pending |
| EQP-20 | P1: dashboard/insights do GESTOR agregam todas as equipes geridas | Design | Pending |
| EQP-21 | P1: RH_Admin sem mudança de comportamento (base inteira) | Design | Pending |
| EQP-22 | P1: migração cria 1 Equipe por GESTOR com subordinados existentes | Design | Pending |
| EQP-23 | P1: migração preenche equipe_id dos subordinados migrados | Design | Pending |
| EQP-24 | P1: GESTOR sem subordinados não recebe Equipe automática | Design | Pending |
| EQP-25 | P1: gestor_id/Hierarquia removidos do schema após migração | Design | Pending |
| EQP-26 | P2: detalhe de membros de uma Equipe | Design | Pending |

**ID format:** `EQP-[NUMBER]`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 26 total, 0 mapeados para tasks ainda ⚠️ (mapeamento acontece em `tasks.md`, fase Tasks)

---

## Success Criteria

Como saberemos que a feature está bem-sucedida:

- [ ] `RH_Admin` cria/edita/desativa `Equipe`s pela UI, sem script manual, e a troca de responsável de uma equipe inteira é 1 única edição (não N edições de usuário).
- [ ] Todo `SOLICITANTE` cadastrado depois desta feature tem `equipe_id` preenchido, e sua etapa `GESTOR` é decidida corretamente pelo gestor responsável daquela equipe.
- [ ] Um `GESTOR` responsável por 2+ `Equipe`s vê e decide as solicitações de todos os membros de todas elas, sem lacuna.
- [ ] Nenhuma tentativa de `GESTOR` cadastrar/decidir fora das próprias equipes é aceita pelo backend, mesmo manipulando a requisição diretamente.
- [ ] Dados existentes antes da migração continuam com a mesma pessoa aprovando a mesma etapa depois da migração (nenhum aprovador "perdido").
- [ ] Nenhum código de produção lê `User.gestor_id` depois que a migração e a remoção do campo forem concluídas.

---

## Questões em Aberto

Nenhuma — as 4 decisões de modelagem (papel da Equipe, cardinalidade, RH_Admin fora do modelo, tela dedicada) foram resolvidas via `/discuss` e registradas em `context.md` antes de escrever este spec.
