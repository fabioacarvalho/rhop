# Dashboard de Visão Geral Specification

## Problem Statement

Gestores e o RH não têm hoje uma visão consolidada e em tempo real do andamento das solicitações de RH: para saber o que está pendente, atrasado, aprovado ou rejeitado é preciso perguntar às pessoas ou abrir cada solicitação individualmente. Isso perpetua a falta de visibilidade que é a dor central do produto. Este dashboard entrega uma tela operacional única com contadores por status e uma lista filtrável, respeitando o que cada papel pode ver.

## Goals

- [ ] Exibir contadores agregados (pendentes, atrasados, aprovados, rejeitados) do escopo de solicitações que o usuário autenticado pode ver.
- [ ] Exibir uma lista de solicitações filtrável por tipo de fluxo, status e solicitante.
- [ ] Garantir, no backend, que Gestor veja apenas as próprias solicitações + as da equipe e que RH_Admin veja tudo da empresa — nenhuma solicitação fora do escopo do papel pode aparecer nos contadores ou na lista.
- [ ] Ser uma tela puramente operacional/de leitura: sem gerar insights de IA, sem gráficos de tendência e sem ações de aprovação.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| --- | --- |
| Geração de insights e gráficos de tendência com IA | Pertence à feature `painel-insights`; este dashboard é operacional (contadores/lista), não analítico. |
| Aprovar/rejeitar solicitações a partir do dashboard | Ação e autorização de aprovação pertencem à feature `aprovacoes`. |
| Definição da regra de quando uma solicitação vira "atrasado" | O status "atrasado" é produzido pelo job da feature `sla-cobranca`; aqui apenas consumimos o status já gravado. |
| Criar/abrir novas solicitações e a tela "Minhas Solicitações" | Pertencem à feature `solicitacoes`. |
| Configurar tipos de fluxo (opções de filtro por tipo derivam de `TipoFluxo`) | CRUD de `TipoFluxo` pertence à feature `configuracao-fluxos`. |
| Exportação (CSV/PDF) e relatórios | Não consta no design doc; fora do MVP. |
| Filtro por período/data de criação | O design doc só menciona período no Painel de Insights, não neste dashboard. Ver Questões em Aberto. |

---

## User Stories

### P1: Visualizar contadores por status ⭐ MVP

**User Story**: Como Gestor ou RH_Admin, quero ver contadores de solicitações pendentes, atrasadas, aprovadas e rejeitadas, para ter uma leitura instantânea do estado do meu escopo sem abrir cada solicitação.

**Why P1**: É o núcleo do valor do dashboard — visibilidade em tempo real do status agregado, que é o oposto da dor original de "ninguém sabe o que está pendente".

**Acceptance Criteria**:

1. WHEN um Gestor ou RH_Admin acessa o dashboard THEN o sistema SHALL exibir quatro contadores: pendentes, atrasados, aprovados e rejeitados.
2. WHEN os contadores são calculados THEN o sistema SHALL contabilizar somente as solicitações dentro do escopo de visibilidade do usuário autenticado (ver DASH-03).
3. WHEN o valor de "atrasados" é exibido THEN o sistema SHALL usar o status "atrasado" já gravado na `Solicitacao` pelo job de `sla-cobranca`, sem recalcular a regra de atraso.
4. WHEN não há nenhuma solicitação no escopo do usuário THEN o sistema SHALL exibir todos os contadores como zero, sem erro.

**Independent Test**: Autenticar como RH_Admin com solicitações em cada status na base e verificar que os quatro contadores refletem exatamente a contagem por status.

---

### P1: Visualizar a lista de solicitações ⭐ MVP

**User Story**: Como Gestor ou RH_Admin, quero ver uma lista das solicitações do meu escopo com suas informações essenciais, para acompanhar o andamento individual de cada uma.

**Why P1**: Complementa os contadores permitindo passar do número agregado para as solicitações concretas — sem a lista, o dashboard só responde "quantas" e não "quais".

**Acceptance Criteria**:

1. WHEN um Gestor ou RH_Admin acessa o dashboard THEN o sistema SHALL exibir uma lista de solicitações contendo, no mínimo, tipo de fluxo, solicitante, status e data de criação.
2. WHEN a lista é montada THEN o sistema SHALL incluir somente solicitações dentro do escopo de visibilidade do usuário autenticado (ver DASH-03).
3. WHEN a lista é exibida sem ordenação escolhida pelo usuário THEN o sistema SHALL ordenar as solicitações da mais recente para a mais antiga por data de criação.
4. WHEN não há solicitações no escopo do usuário THEN o sistema SHALL exibir um estado vazio explícito (ex: "Nenhuma solicitação encontrada"), sem erro.

**Independent Test**: Autenticar como Gestor e confirmar que a lista mostra as solicitações próprias e as da equipe com as colunas essenciais, ordenadas da mais recente para a mais antiga.

---

### P1: Aplicar visibilidade por papel no backend ⭐ MVP

**User Story**: Como empresa, quero que contadores e lista sejam sempre filtrados pelo papel do usuário no backend, para que ninguém veja solicitações fora do seu escopo de permissão.

**Why P1**: Regra de negócio inviolável do CLAUDE.md — a visibilidade não pode depender de esconder elementos no frontend; precisa ser garantida na origem dos dados.

**Acceptance Criteria**:

1. WHEN um Gestor consulta contadores ou lista THEN o sistema SHALL retornar apenas as solicitações do próprio Gestor mais as dos usuários cujo `gestor_id` aponta para ele.
2. WHEN um RH_Admin consulta contadores ou lista THEN o sistema SHALL retornar todas as solicitações da empresa.
3. WHEN qualquer query de contadores ou de lista é executada THEN o sistema SHALL aplicar o filtro de visibilidade por papel na própria consulta ao banco, e não apenas na renderização do frontend.
4. WHEN um Gestor sem nenhum subordinado (equipe vazia) acessa o dashboard THEN o sistema SHALL exibir apenas as próprias solicitações do Gestor.
5. WHEN um usuário não autenticado tenta acessar o dashboard THEN o sistema SHALL negar o acesso.

**Independent Test**: Como Gestor da Equipe A, confirmar que solicitações da Equipe B (cujos solicitantes têm outro `gestor_id`) não aparecem nem nos contadores nem na lista.

---

### P2: Filtrar a lista por tipo, status e solicitante

**User Story**: Como Gestor ou RH_Admin, quero filtrar a lista por tipo de fluxo, status e solicitante, para focar rapidamente no subconjunto de solicitações que me interessa.

**Why P2**: Refina a tela e é explicitamente citado no design doc ("lista filtrável por tipo, status e solicitante"), mas o dashboard já é demonstrável e útil com contadores + lista base antes dos filtros.

**Acceptance Criteria**:

1. WHEN o usuário seleciona um tipo de fluxo no filtro THEN o sistema SHALL exibir na lista apenas solicitações daquele `TipoFluxo`.
2. WHEN o usuário seleciona um status no filtro THEN o sistema SHALL exibir na lista apenas solicitações naquele status (pendente, atrasado, aprovado ou rejeitado).
3. WHEN o usuário seleciona um solicitante no filtro THEN o sistema SHALL exibir na lista apenas solicitações daquele solicitante.
4. WHEN o usuário combina múltiplos filtros THEN o sistema SHALL aplicá-los de forma cumulativa (interseção / AND).
5. WHEN qualquer filtro é aplicado THEN o sistema SHALL ainda respeitar o escopo de visibilidade por papel (ver DASH-03) — filtrar por um solicitante fora do escopo do usuário SHALL retornar lista vazia, nunca solicitações não autorizadas.
6. WHEN uma combinação de filtros não produz resultados THEN o sistema SHALL exibir o estado vazio, sem erro.

**Independent Test**: Como RH_Admin, aplicar tipo="Reembolso" + status="pendente" e confirmar que a lista mostra somente reembolsos pendentes; como Gestor, filtrar por um solicitante de outra equipe e confirmar lista vazia.

---

### P3: Navegar da lista para o detalhe da solicitação

**User Story**: Como Gestor ou RH_Admin, quero clicar em uma solicitação da lista para abrir seus detalhes, para investigar sem sair do fluxo de acompanhamento.

**Why P3**: Melhora a navegação, mas o dashboard cumpre seu objetivo de visibilidade sem esse atalho; a tela de detalhe é provida por outras features (`solicitacoes`/`aprovacoes`).

**Acceptance Criteria**:

1. WHEN o usuário seleciona uma solicitação na lista THEN o sistema SHALL navegar para a visualização de detalhe da solicitação correspondente.

---

### P3: Usar o contador como atalho de filtro

**User Story**: Como Gestor ou RH_Admin, quero clicar em um contador (ex: "atrasados") para filtrar a lista por aquele status, para ir direto ao subconjunto que o número representa.

**Why P3**: Conveniência de UX que reaproveita o filtro por status (DASH-05); não é essencial para o valor da tela.

**Acceptance Criteria**:

1. WHEN o usuário seleciona um contador de status THEN o sistema SHALL aplicar à lista o filtro de status correspondente.

---

## Edge Cases

- WHEN o escopo de visibilidade do usuário não contém nenhuma solicitação THEN o sistema SHALL exibir contadores em zero e lista vazia, sem erro.
- WHEN o usuário filtra por um solicitante que existe mas está fora do seu escopo de visibilidade THEN o sistema SHALL retornar lista vazia e nunca vazar solicitações não autorizadas.
- WHEN uma solicitação está marcada como "atrasado" THEN o sistema SHALL exibi-la de forma consistente entre o contador e a lista (mesmo status como fonte única — ver Questões em Aberto sobre exclusividade entre "pendente" e "atrasado").
- WHEN um Gestor tem equipe, mas nenhum subordinado abriu solicitações THEN o sistema SHALL exibir apenas as solicitações do próprio Gestor.
- WHEN um valor inválido é enviado em um filtro (ex: tipo de fluxo inexistente ou status desconhecido) THEN o sistema SHALL rejeitar a entrada com validação (Zod) e não executar a consulta.
- WHEN existem muitas solicitações no escopo (volume alto) THEN o sistema SHALL retornar a lista de forma controlada (ver Questões em Aberto sobre paginação).

---

## Requirement Traceability

Each requirement gets a unique ID for tracking across design, tasks, and validation.

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| DASH-01 | P1: Visualizar contadores por status | Tasks (T1, T3, T4, T7) | In Tasks |
| DASH-02 | P1: Visualizar a lista de solicitações | Tasks (T3, T5, T6, T9, T10) | In Tasks |
| DASH-03 | P1: Aplicar visibilidade por papel no backend | Tasks (T3, T4, T5, T11) | In Tasks |
| DASH-04 | P2: Filtrar por tipo de fluxo | Tasks (T2, T3, T5, T8) | In Tasks |
| DASH-05 | P2: Filtrar por status | Tasks (T2, T3, T5, T8) | In Tasks |
| DASH-06 | P2: Filtrar por solicitante | Tasks (T3, T5, T8) | In Tasks |
| DASH-07 | P2: Filtros combináveis (AND) respeitando visibilidade | Tasks (T3, T5) | In Tasks |
| DASH-08 | P1/P2: Estado vazio (contadores zero / lista vazia) | Tasks (T3, T9) | In Tasks |
| DASH-09 | P3: Navegar da lista para o detalhe da solicitação | Tasks (T9) | In Tasks |
| DASH-10 | P3: Contador como atalho de filtro de status | Tasks (T7) | In Tasks |

**ID format:** `[CATEGORY]-[NUMBER]` (ex: `DASH-01`)

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 10 total, 10 mapeados para tasks, 0 não mapeados ✅

---

## Success Criteria

How we know the feature is successful:

- [ ] Um Gestor abre o dashboard e vê, em uma tela, contadores corretos e a lista das solicitações da sua equipe + próprias.
- [ ] Um RH_Admin vê contadores e lista cobrindo todas as solicitações da empresa.
- [ ] Nenhuma solicitação fora do escopo do papel aparece em contadores ou lista, comprovado por teste com dois Gestores de equipes distintas.
- [ ] Filtrar por tipo, status e solicitante (isolados e combinados) reduz a lista corretamente e nunca contorna a visibilidade por papel.
- [ ] Escopos e filtros sem resultado exibem estado vazio sem erro.

---

## Questões em Aberto

1. **SOLICITANTE tem acesso a este dashboard?** O design doc descreve a Tela 5 como "Gestor vê a equipe; RH vê tudo" e a tabela de papéis diz que o SOLICITANTE só vê as próprias solicitações (atendido pela tela "Minhas Solicitações", feature `solicitacoes`). O texto não afirma explicitamente se o SOLICITANTE comum abre este dashboard. Premissa desta spec: **NÃO** — o SOLICITANTE usa "Minhas Solicitações". Confirmar antes do Design.
2. **Os contadores acompanham os filtros aplicados ou sempre refletem o escopo total de visibilidade?** Ex: ao filtrar a lista por tipo="Vaga", os quatro contadores passam a contar só "Vaga" ou continuam mostrando o total do escopo do usuário? O design doc não especifica. Premissa desta spec: contadores refletem o **escopo de visibilidade completo** (independentes dos filtros da lista); DASH-10 (clicar contador filtra a lista) atua na direção oposta. Confirmar.
3. ✅ **RESOLVIDO** (ver `context.md`) — **"Pendente" e "atrasado" nos contadores**: NÃO são mutuamente exclusivos; "atrasado" é um sinal aditivo sobre "pendente" — uma solicitação atrasada conta nos dois contadores.
4. **A lista precisa de paginação/limite?** O design doc não define volume esperado nem paginação para esta tela. Se o volume por escopo puder ser grande (especialmente para RH_Admin), definir paginação/limite no Design.
5. **Há filtro por período/data neste dashboard?** O design doc só menciona filtro de período no Painel de Insights (Tela 6), não na Tela 5. Premissa desta spec: **não há** filtro de período aqui (apenas tipo, status e solicitante). Confirmar.
