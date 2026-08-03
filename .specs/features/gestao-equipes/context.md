# Gestão de Equipes Context

**Gathered:** 2026-08-03
**Spec:** `.specs/features/gestao-equipes/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Hoje a hierarquia de aprovação/visibilidade é 100% baseada em `User.gestor_id` (auto-relação): cada colaborador aponta direto para o `id` do próprio gestor, e esse mesmo campo decide quem aprova a etapa `GESTOR` de uma `Solicitacao` (`aprovacaoService.assertPodeDecidir`) e o que cada `GESTOR` vê em `userService.listar`, `dashboardService`, `insightsService`. Essa feature introduz uma entidade `Equipe` nomeada (ex.: "Equipe Comercial") como camada intermediária: usuário pertence a uma `Equipe`, `Equipe` tem um gestor responsável — e passa a ser essa relação, não mais `gestor_id` direto no usuário, que decide aprovação e visibilidade. Fecha a lacuna de `cadastro-usuarios`, que só resolvia "quem reporta pra quem 1:1", sem noção de time nomeado nem forma de trocar o responsável por um time inteiro numa única edição.

---

## Implementation Decisions

Decisões abaixo foram confirmadas explicitamente via `/discuss` (todas as opções recomendadas foram aceitas):

### 1. Equipe substitui `gestor_id`, não coexiste com ele

- `Equipe.gestor_id` passa a ser a única fonte de verdade de "quem aprova a etapa `GESTOR`" e "o que um `GESTOR` vê". `User.gestor_id`, `User.gestor`/`User.equipe` (auto-relação `"Hierarquia"`) são **removidos** do schema — não ficam como campo morto nem como fallback.
- Consequência: `aprovacaoService.assertPodeDecidir`, `userService.listar`/`assertEscopoGestao`, `dashboardService`, `insightsService` — todo lugar que hoje lê `gestor_id` — precisa ser migrado para ler `equipe_id`/`Equipe.gestor_id`. Ver `spec.md` (histórias P1) e `design.md` (blast radius completo).
- `CLAUDE.md` define a regra de visibilidade hoje em termos de `gestor_id` ("gestor vê... usuários com `gestor_id` apontando para ele") — essa frase precisa ser atualizada para refletir `Equipe` como parte da execução desta feature (task de documentação, não código).

### 2. Cardinalidade: 1 Equipe = 1 Gestor; 1 Gestor pode gerenciar N Equipes

- Cada `Equipe` tem exatamente 1 `gestor_id` (mantém a regra já travada em `CLAUDE.md` de "sem múltiplos aprovadores em paralelo na mesma etapa" — cada `Equipe` só pode ter 1 aprovador elegível para a etapa `GESTOR`).
- Um mesmo `User` com `role = GESTOR` pode ser o responsável por mais de uma `Equipe` simultaneamente (não há limite de 1).
- Consequência prática: telas que hoje assumem "1 gestor = 1 conjunto de subordinados" (`userService.listar`, título "Minha equipe") passam a agregar por **todas** as equipes que aquele `GESTOR` gerencia.

### 3. `RH_ADMIN` fica fora do modelo de equipes

- `RH_ADMIN` não pertence a nenhuma `Equipe` (sem `equipe_id`) e não é elegível como `gestor_id` de uma `Equipe` — aprova a etapa `RH_ADMIN` de qualquer solicitação, independente de equipe, exatamente como hoje.
- Mesma postura do modelo atual (`RH_ADMIN` é o único papel que pode ter `gestor_id` nulo) — só que agora "fora do modelo de equipes" em vez de "gestor_id nulo".

### 4. Área de configuração: tela dedicada "Equipes" (RH_Admin)

- Nova tela `/equipes` (grupo "Administração" do `navConfig.ts`, visível só a `RH_ADMIN` — mesmo padrão de `Configuração de Fluxos`/`Auditoria & Logs`) para CRUD de `Equipe`: criar (nome + gestor responsável), editar (renomear e/ou trocar gestor responsável), listar (nome, gestor responsável, quantidade de membros), desativar/reativar.
- **Resolução do pedido original** ("no cadastro do usuário, se for gestor, qual equipe ele é gestor"): como 1 `GESTOR` pode gerenciar N `Equipe`s, esse dado não cabe bem como 1 campo no formulário de usuário — a atribuição "quem é o gestor responsável por esta equipe" vive na tela `/equipes` (campo `gestor_id` do formulário de `Equipe`), não no formulário de usuário. O formulário de usuário (`cadastro-usuarios`) só ganha o campo "equipe" para quem é `SOLICITANTE`. Isso não contradiz o pedido — apenas resolve a mecânica de "qual tela edita o quê" da forma que fecha com a cardinalidade N:1 escolhida.
- Ordem de operação natural: 1) `RH_ADMIN` cadastra o `User` com `role = GESTOR` (sem equipe) → 2) `RH_ADMIN` cria/edita uma `Equipe` apontando esse `GESTOR` como responsável → 3) `RH_ADMIN` ou o próprio `GESTOR` cadastra `SOLICITANTE`s escolhendo essa `Equipe`. Não há ciclo: nunca é preciso que a `Equipe` já exista para criar o `GESTOR`, nem que o `GESTOR` já exista para criar a `Equipe` vazia — mas **atribuir** um gestor responsável exige que o `User` `GESTOR` já exista.

---

## Escopo de CRUD de `Equipe`

- **Criação + edição** (nome, gestor responsável) **+ desativação/reativação** (toggle `ativo`, mesmo padrão de `User.ativo`) — sem exclusão definitiva (hard delete), mesma justificativa de integridade referencial já usada em `cadastro-usuarios` (`User.equipe_id` de membros históricos, `Log`).
- Desativar uma `Equipe` com membros **ativos** associados (`User.equipe_id` apontando pra ela, `User.ativo = true`) é bloqueado — `RH_ADMIN` precisa realocar os membros pra outra equipe antes. Mesmo padrão de bloqueio-por-dependência já usado em `tipoFluxoService.editar` (`ErroEdicaoBloqueada`) e em `userService.editar` (`ErroEdicaoBloqueadaUsuario`).
- Trocar o `gestor_id` responsável por uma `Equipe` exige que o novo valor seja um `User` com `role = GESTOR` e `ativo = true` — mesma validação de "papel elegível" já usada em `userService.listarElegiveisComoGestor`.
- Nome de `Equipe` é único (mesmo padrão de `TipoFluxo.nome`).

## Escopo de cadastro/edição de `User` (revisão de `cadastro-usuarios`)

- `SOLICITANTE`: `equipe_id` passa a ser **obrigatório** no cadastro (substitui `gestor_id` obrigatório) — deve referenciar uma `Equipe` `ativo = true`. Editável depois só por `RH_ADMIN` (Gestor continua só editando `nome` do próprio subordinado, sem poder mover ele de equipe — evita "roubo" de membro entre equipes de gestores diferentes).
- `GESTOR` cadastrando `SOLICITANTE`: escolhe a `Equipe` entre as que **ele próprio** gerencia (`Equipe.gestor_id = próprio id`) — nunca uma equipe de outro gestor. Se o `GESTOR` gerencia só 1 equipe, pré-seleciona; se gerencia N, exige escolha explícita entre as N.
- `GESTOR`/`RH_ADMIN`: sem campo de equipe no próprio cadastro (não pertencem ao modelo como membros — ver decisão 2 e 3).
- Listagem de usuários (`userService.listar`) por `GESTOR` passa a agregar `SOLICITANTE`s de **todas** as equipes que ele gerencia, não só 1.

## Migração de dados existentes

- Dados já existem em produção real (Supabase) via `scripts/seed-users.ts` e uso — a migração desta feature não é só de schema, é de **dados**: cada `User` `GESTOR` com subordinados hoje (`gestor_id` apontando pra ele) precisa ganhar 1 `Equipe` correspondente antes do campo `gestor_id` sair do schema, e cada subordinado precisa ganhar o `equipe_id` dessa nova `Equipe`.
- Estratégia de nomeação da `Equipe` migrada: "Equipe de {nome do gestor}" (placeholder gerado automaticamente) — `RH_ADMIN` renomeia depois pela tela `/equipes` se quiser um nome melhor. Documentado como decisão do agente (não perguntado explicitamente).
- Task de migração roda **antes** da task que remove `gestor_id` do schema, na mesma feature — ver `design.md`/`tasks.md` para a ordem exata.

## Agent's Discretion

- Nome do relacionamento Prisma (`"EquipeGestor"`/`"EquipeMembros"`) e formato do `id` de `Equipe` (`cuid()`, mesmo padrão de `TipoFluxo`/`Solicitacao`, não `uuid` — `Equipe` não corresponde a nada no Supabase Auth).
- Nome de exibição da tela para `GESTOR` em `/usuarios` — hoje é "Minha equipe" (singular); com N equipes possíveis, ajustar para algo neutro tipo "Minha equipe" mantendo o singular como rótulo de tela (não "Minhas equipes") já que a lista continua sendo 1 lista de pessoas, independente de quantas `Equipe`s alimentam ela — critério do Design.
- Placeholder de nome de `Equipe` migrada de dados legados ("Equipe de {nome}") — critério do Design, ajustável depois via UI.
- Se a migração de dados encontrar um `GESTOR` sem nenhum subordinado hoje: não cria `Equipe` vazia automaticamente — só cria `Equipe` para gestores que já têm ao menos 1 subordinado via `gestor_id` no momento da migração (evita lixo de equipes vazias no dia 1).

---

## Specific References

Nenhuma referência visual específica no mockup (`docs/design-ux-ui/fluxorh-mockup.html`) — esta tela não existe no mockup original, assim como `/usuarios`. Reusar a mesma estrutura de listagem+form de `configuracao-fluxos` (Screen 7) e os tokens de badge (`.stamp-badge`) já usados em `cadastro-usuarios` para o status Ativo/Inativo de `Equipe`.

---

## Deferred Ideas

- Reatribuição em massa de membros ao desativar/trocar o gestor de uma `Equipe` com membros ativos — fora de escopo (mesma postura já deferida em `cadastro-usuarios` para desativação de gestor). `RH_ADMIN` reatribui manualmente.
- `GESTOR` poder criar/editar suas próprias `Equipe`s (hoje é RH_Admin-only) — não pedido; ficou de fora.
- Subtimes/hierarquia de equipes (`Equipe` dentro de `Equipe`) — não pedido, fora de escopo.
- Permitir `GESTOR` mover um `SOLICITANTE` entre as equipes que ele mesmo gerencia (hoje só `RH_ADMIN` edita `equipe_id`) — não pedido explicitamente; ficou de fora do MVP, pode ser P2/P3 futuro se necessário.
