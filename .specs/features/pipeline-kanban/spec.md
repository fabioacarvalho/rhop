# Pipeline Kanban Specification

> Feature slug: `pipeline-kanban` · Requirement prefix: `PIPE`
> Fonte da verdade: `docs/design-ux-ui/fluxorh-mockup.html` e `docs/design-ux-ui/fluxorh-ui-layout-specs.md` (Screen 5 "Pipeline de Aprovações", `#screen-pipeline`) e `CLAUDE.md` (regras de visibilidade e auditoria invioláveis).
> Features vizinhas referenciadas (sem duplicar o detalhe delas): `solicitacoes` (entidade `Solicitacao`, `solicitacaoService`), `aprovacoes` (status `PENDENTE`/`APROVADA`/`REJEITADA`, autorização de decisão), `dashboard-visao-geral` (regra de visibilidade Gestor/RH_Admin já implementada em `dashboardService.visibilidadeSolicitacaoWhere`), `gestao-equipes` (`Equipe.gestor_id`), `auditoria-logs` (contrato de `Log`), `menu-navegacao` (sidebar/`navConfig.ts`).
>
> **Nota:** `menu-navegacao/spec.md` já previa esta lacuna e a excluiu explicitamente: *"Tela 'Pipeline de Aprovações' (Kanban) — presente no mockup (`#screen-pipeline`) mas sem spec/feature própria no backlog do produto [...] não entra no menu até existir uma feature dedicada."* Esta spec é essa feature dedicada.

## Problem Statement

O mockup original (Screen 5) já desenhou uma visão Kanban do pipeline de solicitações, mas ela nunca foi especificada nem construída — hoje Gestor e RH_Admin só enxergam a própria fila de pendências (`aprovacoes`) ou uma lista tabular (`dashboard-visao-geral`), sem uma visão de "board" que mostre de relance quantas solicitações estão em cada estágio do funil, da entrada até o desfecho. Além disso, hoje não existe nenhuma forma de **cancelar** uma solicitação já aberta — `solicitacoes/spec.md` exclui esse comportamento explicitamente ("Editar ou cancelar uma solicitação depois de criada... fora de escopo"). Sem cancelamento, uma das 4 colunas do Kanban pedido ("Cancelado") nunca teria dado real. Esta feature entrega as duas coisas juntas: o board Kanban de 4 colunas (customizável no futuro, fixo nesta versão) e a capacidade de cancelar uma solicitação, que alimenta a coluna "Cancelado".

## Goals

- [ ] Gestor e RH_Admin veem um board Kanban com 4 colunas padrão — **Pendente**, **Em aprovação**, **Aprovado**, **Cancelado** — cada uma exibindo as solicitações do escopo de visibilidade de cada papel (mesma regra já aplicada em `dashboard-visao-geral`).
- [ ] O mapeamento coluna → status é definido em um único ponto de configuração no código (não hardcoded espalhado pela UI), preparando o terreno para customização futura (renomear/reordenar/redefinir colunas) sem exigir uma tela de administração nesta versão.
- [ ] Solicitante dono de uma `Solicitacao` **ou** RH_Admin conseguem cancelá-la enquanto ela ainda está `PENDENTE`, e essa ação é auditada (`Log AUDITORIA`).
- [ ] Nenhuma regra já travada em `aprovacoes`/`solicitacoes`/`dashboard-visao-geral` (status `PENDENTE`/`APROVADA`/`REJEITADA`, autorização de decisão, contadores) sofre regressão com a introdução do novo status `CANCELADA`.

## Out of Scope

Explicitamente excluído. Documentado para evitar scope creep.

| Feature | Motivo |
| --- | --- |
| Tela de administração para customizar/renomear/reordenar as colunas do Kanban | Pedido explícito do usuário é "algo que possa ser personalizável **depois**" — esta versão só garante que o mapeamento coluna→status não está hardcoded na UI; a tela de configuração em si fica para uma feature futura. |
| Granularidade de "Em aprovação" por etapa (ex.: distinguir etapa Gestor de etapa RH_Admin) | Decisão de `context.md`: a coluna "Em aprovação" nasce **vazia** nesta versão — toda `Solicitacao` com `status = PENDENTE` cai em "Pendente", independente da `etapa_atual`. Granularidade por etapa é candidata a versão futura. |
| Drag-and-drop entre colunas (mover uma solicitação manualmente) | Não pedido; o mockup não descreve essa interação. O board é somente leitura — a mudança de coluna decorre só de ações já existentes (`aprovacoes.decidir`) ou da nova ação de cancelamento desta feature. |
| Reabrir/reverter uma solicitação `CANCELADA` ou `REJEITADA` | Não pedido; ambas continuam terminais. |
| Cancelamento por `GESTOR` | Decisão de `context.md`: só o solicitante dono ou `RH_ADMIN` podem cancelar — `GESTOR` não está na lista, mesmo sendo aprovador de etapa. |
| Cancelar uma `Solicitacao` já `APROVADA`/`REJEITADA`/`CANCELADA` | Só é possível cancelar enquanto `status = PENDENTE` (ver `context.md` e Edge Cases). |
| Notificação (in-app/e-mail) do cancelamento ao aprovador/solicitante | Pertence a `notificacoes`, se e quando for pedido; esta feature só grava `Log AUDITORIA`. |
| Filtro "Empresa/Área" mostrado no mockup da Screen 5 | Não existe campo de empresa/área no modelo de dados (`CLAUDE.md`: sem multi-tenant). Só o filtro por `TipoFluxo` é implementado. |
| Acesso de `SOLICITANTE` ao board Kanban | Board é `GESTOR`/`RH_ADMIN`-only (ver `context.md`); `SOLICITANTE` continua usando "Minhas Solicitações" (`solicitacoes`). |

---

## User Stories

### P1: Board Kanban com 4 colunas padrão, escopado por papel ⭐ MVP

**User Story**: Como Gestor ou RH_Admin, quero ver um board Kanban com as solicitações agrupadas em Pendente / Em aprovação / Aprovado / Cancelado, para ter uma leitura visual e instantânea do estágio de cada solicitação do meu escopo, sem abrir uma lista tabular.

**Why P1**: É o núcleo literal do pedido — sem isso não existe "kanban" nenhum. Reaproveita a regra de visibilidade já provada em `dashboard-visao-geral`.

**Acceptance Criteria**:

1. WHEN um Gestor ou RH_Admin autenticado abre o Pipeline Kanban THEN o sistema SHALL exibir exatamente 4 colunas na ordem: Pendente, Em aprovação, Aprovado, Cancelado.
2. WHEN as colunas são montadas THEN o sistema SHALL mapear `status = PENDENTE` para a coluna "Pendente", `status = APROVADA` para "Aprovado", e `status` em `{REJEITADA, CANCELADA}` para "Cancelado" — a coluna "Em aprovação" SHALL permanecer vazia nesta versão (ver Out of Scope).
3. WHEN o usuário autenticado é `GESTOR` THEN o board SHALL conter apenas as solicitações dele mesmo mais as dos usuários membros das `Equipe`s que ele gere (mesma regra de `dashboard-visao-geral`/DASH-03).
4. WHEN o usuário autenticado é `RH_ADMIN` THEN o board SHALL conter todas as solicitações da empresa, sem filtro de escopo.
5. WHEN uma coluna não tem nenhuma solicitação no escopo do usuário THEN o sistema SHALL exibir um estado vazio explícito naquela coluna, nunca erro.
6. WHEN o usuário é `SOLICITANTE` THEN o sistema SHALL negar o acesso ao Pipeline Kanban (delegado a `authService.requireUser`).

**Independent Test**: Autenticar como Gestor da Equipe A com solicitações em `PENDENTE`/`APROVADA`/`REJEITADA` e confirmar que só aparecem as da própria equipe, nas colunas certas; autenticar como RH_Admin e ver todas; autenticar como Solicitante e confirmar bloqueio de acesso.

---

### P1: Cancelamento de solicitação pelo solicitante dono ou RH_Admin ⭐ MVP

**User Story**: Como solicitante, quero poder cancelar uma solicitação que abri por engano ou que não preciso mais, e como RH_Admin, quero poder cancelar em nome de alguém quando necessário, para que a solicitação pare de ocupar a fila de aprovação sem exigir uma rejeição formal do aprovador.

**Why P1**: Sem esta ação, a coluna "Cancelado" do Kanban nunca teria nenhum dado real — é pré-requisito funcional da User Story anterior.

**Acceptance Criteria**:

1. WHEN o solicitante dono de uma `Solicitacao` com `status = PENDENTE` aciona "Cancelar" THEN o sistema SHALL alterar o `status` para `CANCELADA` e encerrar o fluxo (sem novo avanço de etapa).
2. WHEN um `RH_ADMIN` aciona "Cancelar" em qualquer `Solicitacao` com `status = PENDENTE` (de qualquer solicitante) THEN o sistema SHALL aplicar o mesmo efeito do item anterior.
3. WHEN o cancelamento é aplicado com sucesso THEN o sistema SHALL gravar um `Log` tipo `AUDITORIA` (entidade `Solicitacao`, ação `CANCELAMENTO`, `usuario_id` de quem cancelou).
4. WHEN um usuário que não é o solicitante dono nem `RH_ADMIN` (incluindo `GESTOR`, mesmo sendo o aprovador da etapa atual) tenta cancelar THEN o sistema SHALL negar a operação no backend.
5. WHEN a `Solicitacao` já está `APROVADA`, `REJEITADA` ou `CANCELADA` THEN o sistema SHALL bloquear qualquer tentativa de cancelamento, sem alterar o estado.

**Independent Test**: Como solicitante dono de uma solicitação `PENDENTE`, cancelar e confirmar `status = CANCELADA` + `Log AUDITORIA`; como outro solicitante, tentar cancelar a mesma solicitação e ser bloqueado; como RH_Admin, cancelar uma solicitação de outro solicitante e confirmar sucesso; tentar cancelar uma já `APROVADA` e ser bloqueado.

---

### P1: Autorização de cancelamento aplicada no backend ⭐ MVP

**User Story**: Como empresa, quero que a regra de "quem pode cancelar" nunca dependa de esconder um botão no frontend, para que a segregação de responsabilidades seja garantida na origem.

**Why P1**: Regra inviolável do `CLAUDE.md` — toda autorização de mudança de estado de `Solicitacao` precisa ser garantida no backend, no mesmo padrão já aplicado em `aprovacoes.decidir`.

**Acceptance Criteria**:

1. WHEN uma requisição de cancelamento chega sem usuário autenticado THEN o sistema SHALL negar com `401`.
2. WHEN uma requisição de cancelamento chega de um usuário autenticado que não é o solicitante dono nem `RH_ADMIN` THEN o sistema SHALL negar com `403`, independentemente do que o frontend exibir.
3. WHEN a `Solicitacao` referenciada não existe THEN o sistema SHALL responder `404`.
4. WHEN a `Solicitacao` existe mas não está `PENDENTE` THEN o sistema SHALL responder `409`, sem alterar o estado.

**Independent Test**: Chamar a rota de cancelamento diretamente (sem passar pela UI) como um solicitante de outra solicitação → bloqueado com `403`; como Gestor da equipe → bloqueado com `403`; sobre `id` inexistente → `404`; sobre solicitação já `APROVADA` → `409`.

---

### P2: Filtro por Tipo de Fluxo no board

**User Story**: Como Gestor ou RH_Admin, quero filtrar o Kanban por Tipo de Fluxo (Vaga, Férias, Reembolso etc.), para focar em um tipo específico de solicitação sem precisar varrer todas as colunas.

**Why P2**: Refinamento citado no mockup ("Filtros: Tipo de Fluxo, Empresa/Área") — o board já é útil e demonstrável sem filtro, mas fica mais prático com ele.

**Acceptance Criteria**:

1. WHEN o usuário seleciona um `TipoFluxo` no filtro THEN o sistema SHALL exibir, em cada coluna, apenas as solicitações daquele tipo.
2. WHEN nenhum `TipoFluxo` é selecionado (padrão) THEN o sistema SHALL exibir todos os tipos.
3. WHEN o filtro é aplicado THEN o sistema SHALL continuar respeitando a visibilidade por papel (PIPE-03/PIPE-04) — filtro nunca amplia o escopo.

**Independent Test**: Como RH_Admin, filtrar por "Reembolso" e confirmar que só solicitações de Reembolso aparecem nas 4 colunas, mantendo a contagem total inalterada ao remover o filtro.

---

### P2: Indicador visual de atraso no card do board

**User Story**: Como Gestor ou RH_Admin, quero identificar visualmente quais solicitações pendentes estão atrasadas dentro do próprio Kanban, para priorizar sem precisar abrir o Dashboard separadamente.

**Why P2**: Reaproveita o sinal `atrasada_em` já produzido por `sla-cobranca` e já consumido por `dashboard-visao-geral`; é um refinamento visual, não um pré-requisito do board funcionar.

**Acceptance Criteria**:

1. WHEN uma `Solicitacao` na coluna "Pendente" tem `atrasada_em` preenchido THEN o card SHALL exibir um indicador visual distinto de atraso.
2. WHEN `atrasada_em` é nulo THEN o card SHALL ser exibido no estilo padrão (sem indicador de atraso).

**Independent Test**: Ter uma solicitação pendente com `atrasada_em` preenchido (produzido por `sla-cobranca`) e confirmar que o card correspondente exibe o indicador de atraso; as demais pendentes não exibem.

---

### P3: Ação "Cancelar" acessível em Minhas Solicitações

**User Story**: Como solicitante, quero encontrar o botão "Cancelar" na minha própria tela de "Minhas Solicitações" (não só no Kanban, que eu nem acesso), para efetivamente conseguir usar a ação sem depender de uma rota chamada manualmente.

**Why P3**: Sem isso, a capacidade de auto-cancelamento (PIPE-05/06) fica funcionalmente inacessível para `SOLICITANTE` — ele não tem acesso ao board Kanban (PIPE-01, item 6). Priorizado como P3 porque o núcleo do pedido desta sessão é o Kanban em si; a ação de cancelar já existe e é testável via API assim que P1 estiver pronta.

**Acceptance Criteria**:

1. WHEN o solicitante visualiza uma solicitação própria com `status = PENDENTE` em "Minhas Solicitações" THEN o sistema SHALL oferecer uma ação "Cancelar" para aquele item.
2. WHEN o solicitante aciona "Cancelar" e confirma THEN o sistema SHALL chamar a mesma rota de cancelamento (PIPE-05) e refletir o novo status na lista.
3. WHEN a solicitação não está `PENDENTE` THEN o sistema SHALL não exibir a ação "Cancelar" para aquele item (esconder no frontend é conveniência; a barreira real é o backend, PIPE-08).

**Independent Test**: Como solicitante, abrir "Minhas Solicitações", cancelar uma pendente pelo botão e ver o status mudar para "Cancelada" na própria lista; confirmar que solicitações já aprovadas/rejeitadas não exibem o botão.

---

### P3: Estado vazio do board completo

**User Story**: Como Gestor ou RH_Admin sem nenhuma solicitação no escopo, quero ver o board com as 4 colunas vazias e uma mensagem clara, para não confundir "sem dados" com "erro de carregamento".

**Why P3**: Polimento de UX; não altera regra de negócio.

**Acceptance Criteria**:

1. WHEN o escopo de visibilidade do usuário não contém nenhuma solicitação THEN o sistema SHALL exibir as 4 colunas com estado vazio, sem erro.

---

## Edge Cases

- WHEN duas requisições de cancelamento concorrentes chegam para a mesma `Solicitacao` THEN o sistema SHALL aplicar apenas a primeira (a segunda encontra `status != PENDENTE` e é bloqueada com `409` — mesma estratégia de idempotência já usada em `aprovacaoService.decidir`).
- WHEN uma `Solicitacao` é cancelada enquanto um aprovador está com a tela de decisão aberta na mesma etapa THEN a próxima tentativa de aprovar/rejeitar SHALL ser bloqueada pelo `assertPodeDecidir` já existente em `aprovacaoService` (`status !== PENDENTE` → `ErroDecisaoInvalida`), sem necessidade de mudança nesse serviço.
- WHEN o `TipoFluxo` informado no filtro não existe THEN o sistema SHALL rejeitar a entrada com validação (Zod) e não executar a consulta.
- WHEN o volume de solicitações em uma coluna é muito alto THEN o sistema SHALL listar de forma controlada (ver Questões em Aberto sobre limite/paginação por coluna).
- WHEN uma `Solicitacao` tem `status = REJEITADA` (rejeitada por aprovador) THEN ela SHALL aparecer na mesma coluna "Cancelado" que as `CANCELADA` (decisão de `context.md` — a coluna agrupa os dois desfechos negativos), sem distinção visual adicional nesta versão.

---

## Requirement Traceability

Cada requisito recebe um ID único para rastreamento em design, tasks e validação.

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| PIPE-01 | P1: Board com 4 colunas (ordem fixa) | T11, T12, T13 | In Tasks |
| PIPE-02 | P1: Board (mapeamento coluna→status, "Em aprovação" vazia) | T2, T6, T13 | In Tasks |
| PIPE-03 | P1: Board (visibilidade GESTOR) | T3, T6 | In Tasks |
| PIPE-04 | P1: Board (visibilidade RH_ADMIN) | T3, T6 | In Tasks |
| PIPE-05 | P1: Cancelamento pelo solicitante dono | T1, T5 | In Tasks |
| PIPE-06 | P1: Cancelamento pelo RH_ADMIN | T1, T5 | In Tasks |
| PIPE-07 | P1: Log AUDITORIA do cancelamento | T5 | In Tasks |
| PIPE-08 | P1: Bloqueio de cancelamento por papel não elegível | T5, T7 | In Tasks |
| PIPE-09 | P1: Bloqueio de cancelamento fora de PENDENTE | T1, T5, T7 | In Tasks |
| PIPE-10 | P1: Autorização backend (401/403/404/409) | T7 | In Tasks |
| PIPE-11 | P2: Filtro por Tipo de Fluxo | T4, T6, T8, T13 | In Tasks |
| PIPE-12 | P2: Indicador visual de atraso no card | T11, T13 | In Tasks |
| PIPE-13 | P3: Ação "Cancelar" em Minhas Solicitações | T14, T15, T16 | In Tasks |
| PIPE-14 | P3: Estado vazio do board | T6, T9, T13 | In Tasks |
| PIPE-15 | Bloqueio de acesso ao board para SOLICITANTE | T8, T12 | In Tasks |

**Mapa ID → critério:**

- **PIPE-01** — 4 colunas, ordem Pendente/Em aprovação/Aprovado/Cancelado (P1-Board #1).
- **PIPE-02** — Mapeamento status→coluna, "Em aprovação" vazia nesta versão (P1-Board #2, Edge Case REJEITADA+CANCELADA juntas).
- **PIPE-03** — Escopo GESTOR = próprio + equipe(s) geridas (P1-Board #3).
- **PIPE-04** — Escopo RH_ADMIN = tudo (P1-Board #4).
- **PIPE-05** — Solicitante dono cancela PENDENTE (P1-Cancelamento #1).
- **PIPE-06** — RH_ADMIN cancela PENDENTE de qualquer um (P1-Cancelamento #2).
- **PIPE-07** — Log AUDITORIA do cancelamento (P1-Cancelamento #3).
- **PIPE-08** — Bloqueio para não-elegível, incluindo GESTOR (P1-Cancelamento #4, P1-Autorização #2).
- **PIPE-09** — Bloqueio fora de PENDENTE (P1-Cancelamento #5, P1-Autorização #4).
- **PIPE-10** — Contrato de erro 401/403/404/409 (P1-Autorização #1-4).
- **PIPE-11** — Filtro por TipoFluxo (P2-Filtro #1-3).
- **PIPE-12** — Indicador de atraso no card (P2-Atraso #1-2).
- **PIPE-13** — Ação "Cancelar" em Minhas Solicitações (P3 #1-3).
- **PIPE-14** — Estado vazio do board (P3-Vazio #1).
- **PIPE-15** — Bloqueio de acesso ao board para SOLICITANTE (P1-Board #6).

**ID format:** `PIPE-[NUMBER]`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 15 total, 15 mapeados para tasks (T1-T16), 0 não mapeados ✅ (ver `tasks.md`).

---

## Success Criteria

Como saberemos que a feature está bem-sucedida:

- [ ] Um RH_Admin abre o Pipeline Kanban e vê as 4 colunas com a totalidade das solicitações da empresa corretamente distribuídas (Pendente/Aprovado/Cancelado povoadas; "Em aprovação" vazia).
- [ ] Um Gestor abre o mesmo board e vê só as solicitações da própria equipe + próprias — nenhuma de outra equipe aparece, comprovado com dois Gestores de equipes distintas.
- [ ] Um solicitante consegue cancelar sua própria solicitação pendente a partir de "Minhas Solicitações", e ela aparece na coluna "Cancelado" do board na próxima visita de um Gestor/RH_Admin.
- [ ] Um RH_Admin consegue cancelar uma solicitação de outro solicitante.
- [ ] 100% das tentativas de cancelamento por usuário não elegível (outro solicitante, Gestor, solicitação já decidida) são bloqueadas no backend.
- [ ] `npm run build` e `npx prisma validate` passam; `npx prisma migrate dev` aplica a nova migration do status `CANCELADA` sem quebrar dados existentes.

---

## Questões em Aberto

Zonas cinzentas já parcialmente resolvidas em `context.md` (ver seção correspondente); as remaining abaixo ficam para `design.md`:

1. ✅ **RESOLVIDO** (ver `context.md`) — Coluna "Cancelado" agrupa `REJEITADA` + `CANCELADA`; mapeamento coluna→status fica em um único ponto de configuração no código, sem tela de admin nesta versão.
2. ✅ **RESOLVIDO** (ver `context.md`) — Cancelamento: solicitante dono ou RH_Admin, só enquanto `PENDENTE`.
3. ✅ **RESOLVIDO** (ver `context.md`) — Board é tela dedicada (não componente genérico reusado em outras telas), visível a GESTOR e RH_ADMIN com escopo de visibilidade diferenciado (não RH_Admin-only como o mockup original sugeria).
4. **Limite/paginação por coluna.** O design doc não define volume esperado. Se uma coluna puder crescer muito (ex.: "Aprovado" ao longo de meses), definir limite/paginação/scroll por coluna no Design — mesmo padrão do mockup (`+N outras concluídas`).
5. **Rota e posição no menu.** Este spec assume a rota seguirá a convenção plana já em uso (`app/(dashboard)/<slug>`) e que o item de menu será adicionado a `lib/navigation/navConfig.ts` (grupo "Visão geral", ao lado de Dashboard/Insights) — confirmar em `design.md`.
