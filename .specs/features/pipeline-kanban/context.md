# Pipeline Kanban — Context (Discuss)

> Decisões do usuário sobre as zonas cinzentas identificadas durante o Specify, antes de avançar para o Design. Resolve as "Questões em Aberto" #1-3 de `spec.md`.

## 1. Status "Cancelado" vs "Rejeitado"

**Pergunta**: o schema atual (`StatusSolicitacao`) só tem `PENDENTE`/`APROVADA`/`REJEITADA` (produzido pela feature `aprovacoes`, já `Verified`). O pedido do usuário por uma coluna "Cancelado" não bate literalmente com nenhum desses três. O que "Cancelado" representa?

**Decisão**: **Novo status real**, distinto de rejeição por aprovador. `CANCELADA` é adicionado ao enum `StatusSolicitacao` e representa o solicitante desistindo da própria solicitação (ou RH_Admin cancelando em nome de alguém) — uma ação nova, não uma rejeição do fluxo de aprovação.

**Consequência**: reabre a exclusão de escopo travada em `solicitacoes/spec.md` ("Editar ou cancelar uma solicitação depois de criada... fora de escopo, não há menção no design doc"). Essa exclusão não é reescrita (mantida como registro histórico da decisão original) — este `context.md` documenta o desvio, seguindo a mesma convenção já usada em `integrar-login-google/design.md` (SPEC_DEVIATION registrado em vez de editar o spec de outra feature).

## 2. Coluna "Em aprovação" — granularidade por etapa

**Pergunta**: o schema só tem `status = PENDENTE` para qualquer etapa em curso (`etapa_atual = GESTOR` ou `RH_ADMIN` usam o mesmo status). Como o Kanban distingue "Pendente" (aguardando 1ª etapa) de "Em aprovação" (fluxo já avançou)?

**Decisão**: **Genérico fixo por index, sem derivar de `etapa_atual`.** Nesta versão, `status = PENDENTE` sempre cai na coluna "Pendente", independentemente de `etapa_atual`. A coluna "Em aprovação" fica reservada e permanece vazia — preparada para quando houver granularidade por etapa no futuro, mas sem lógica de agrupamento nova nesta versão.

**Consequência**: nenhuma mudança de schema é necessária para esta coluna; é puramente uma decisão de mapeamento na configuração de colunas do Kanban (ver `design.md`). O estado "sempre vazio" de "Em aprovação" é esperado, não é bug — documentado em `spec.md` (Out of Scope, PIPE-02).

## 3. Escopo da tela: dedicada vs componente reutilizável, e quem acessa

**Pergunta**: esta é a Screen 5 "Pipeline de Aprovações" do mockup (RH_Admin-only, nunca especificada como feature própria — `menu-navegacao/spec.md` já excluía essa tela até existir uma feature dedicada) ou um componente Kanban reutilizável em mais de uma tela?

**Decisão** (resposta livre do usuário, não uma das duas opções propostas): **Board Kanban dedicado a uma visão de RH_Admin e Gestor, com controle de visualização** — ou seja, não é um componente genérico reusado em "Minhas Solicitações"/"Aprovações Pendentes"; é uma tela própria (Screen 5 do mockup), mas **diferente do mockup original**, que a desenhava como RH_Admin-only: aqui `GESTOR` também acessa, escopado pela mesma regra de visibilidade já usada em `dashboard-visao-geral` (`GESTOR` vê próprio + equipe(s) geridas; `RH_ADMIN` vê tudo).

**Consequência**: isso é um desvio da Matriz de Permissões (RBAC) documentada em `docs/design-ux-ui/fluxorh-ui-layout-specs.md` seção 3, que listava `screen-pipeline` como `RH_ADMIN`-only (`✗` para `GESTOR`). Este `context.md` registra o desvio; o arquivo original do mockup/UI specs não é alterado (é documentação de referência, não código nem spec de feature). `menu-navegacao/spec.md` também precisará, em uma iteração futura própria dessa feature, adicionar o item "Pipeline" ao grupo "Visão geral" para `GESTOR` e `RH_ADMIN` — não editado agora porque pertence à feature `menu-navegacao`, ainda em fase Specify (traceability 100% `Pending`).

## 4. Regra de cancelamento — quem e até quando

**Pergunta**: quem pode cancelar uma solicitação, e até que ponto do fluxo isso é permitido?

**Decisão**: **Solicitante dono ou RH_Admin, em qualquer momento antes de `APROVADA`.** Interpretado como: enquanto `status = PENDENTE` (o único status não-terminal antes de `APROVADA` no modelo atual — `REJEITADA`/`CANCELADA` já são terminais e cancelar novamente não tem efeito). `GESTOR` explicitamente **não** pode cancelar, mesmo sendo o aprovador da etapa atual — é uma ação do dono da solicitação ou do RH, não do aprovador.

**Consequência**: `aprovacaoService.assertPodeDecidir` não precisa de nenhuma mudança — já bloqueia decisões quando `status !== PENDENTE`, cobrindo o caso "aprovador tenta decidir uma solicitação que acabou de ser cancelada" sem código novo (ver `spec.md`, Edge Cases).

## 5. Coluna "Cancelado" — o que ela exibe (follow-up)

**Pergunta**: com `CANCELADA` sendo um status novo e distinto de `REJEITADA`, a coluna "Cancelado" do Kanban de 4 colunas mostra o quê?

**Decisão**: **Agrupa os dois.** A coluna "Cancelado" exibe `REJEITADA` + `CANCELADA` juntas (ambos são desfechos negativos/encerrados do ponto de vista do board). O mapeamento coluna → lista de status é uma configuração centralizada no código (não precisa ser tela de admin agora, mas não fica hardcoded inline nos componentes), preparando a customização futura pedida pelo usuário ("algo que possa ser personalizável depois").

---

## Resumo das decisões para o Design

| Decisão | Resumo |
| --- | --- |
| Novo status `CANCELADA` | Distinto de `REJEITADA`; requer migration no `schema.prisma`. |
| "Em aprovação" sempre vazia nesta versão | Sem derivação por `etapa_atual`; `PENDENTE` sempre vai para "Pendente". |
| Board dedicado, GESTOR + RH_ADMIN (não RH_Admin-only) | Desvio da matriz RBAC do mockup original — registrado aqui, não editado na fonte. |
| Cancelamento: solicitante dono OU RH_ADMIN, só se `PENDENTE` | `GESTOR` fora; sem mudança em `aprovacaoService`. |
| Coluna "Cancelado" agrupa `REJEITADA` + `CANCELADA` | Mapeamento coluna→status centralizado em config, não hardcoded na UI. |
