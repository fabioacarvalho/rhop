# Solicitações Specification

> Feature `solicitacoes` (prefixo `SOL`) — Telas "Minhas Solicitações" e "Nova Solicitação" e a entidade `Solicitacao`.
> Fonte da verdade: `docs/2026-07-30-fluxorh-design.md` (seções 4, 5.2, 5.3, 6, 8) e `CLAUDE.md` (regras invioláveis).

## Problem Statement

Colaboradores precisam abrir solicitações de RH (Vaga, Férias, Reembolso e outros tipos extensíveis) e acompanhar o andamento delas sem depender de e-mails soltos ou de perguntar a alguém. Hoje não há um ponto único onde o solicitante veja apenas as suas solicitações com status em tempo real, nem um formulário que se adapte ao tipo de fluxo escolhido. Esta feature cobre a criação de uma solicitação e a sua listagem para o próprio solicitante — o ponto de entrada de todo o fluxo de aprovação.

## Goals

- [ ] Solicitante consegue abrir uma nova solicitação escolhendo um `TipoFluxo` e preenchendo um formulário dinâmico gerado a partir de `campos_formulario`, em menos de 2 minutos.
- [ ] Toda solicitação criada nasce na etapa 1 com `status`, `etapa_atual`, `criado_em`, `prazo_sla` e `dados` corretamente preenchidos, e dispara os side-effects de resumo_ia e notificação de forma não bloqueante.
- [ ] Solicitante vê em uma única tela a lista das suas próprias solicitações (e somente as suas) com status visível.
- [ ] Colaborador sem gestor cadastrado recebe erro claro na criação, sem gerar uma solicitação "perdida" sem aprovador.

## Out of Scope

Explicitamente excluído. Documentado para prevenir scope creep.

| Feature | Reason |
| --- | --- |
| Aprovar/rejeitar e avançar etapa após decisão | Pertence à feature `aprovacoes` (APR); aqui só se cria e lista. |
| Geração do `resumo_ia` e criação/preenchimento da linha `Aprovacao` | Pertence à feature `aprovacoes` (APR); esta feature apenas dispara o evento de criação. |
| Envio efetivo da notificação (in-app/e-mail) ao aprovador | Pertence à feature `notificacoes` (NOTIF); aqui só se dispara o gatilho. |
| Marcar solicitação como "atrasada" e cobrança periódica | Pertence à feature `sla-cobranca` (SLA); aqui só se grava o `prazo_sla` inicial. |
| CRUD de `TipoFluxo` / definição de `campos_formulario` e `etapas` | Pertence à feature `configuracao-fluxos` (CONF); aqui apenas se consome. |
| Login, modelo `User`, hierarquia `gestor_id` | Pertence à feature `autenticacao-usuarios` (AUTH); aqui só se lê o usuário autenticado. |
| Modelo `Log` e tela de auditoria | Pertence à feature `auditoria-logs` (AUD); aqui só se grava eventos AUDITORIA/ERRO. |
| Upload de arquivo / anexos | Fora de escopo do MVP (design doc §10); usar campo de texto/link em `campos_formulario`. |
| Editar ou cancelar uma solicitação depois de criada | Não descrito no design doc; ver Questões em Aberto. |
| Dashboard agregado e filtros por equipe/empresa | Pertence à feature `dashboard-visao-geral` (DASH). |

---

## User Stories

### P1: Minhas Solicitações (listagem do próprio solicitante) ⭐ MVP

**User Story**: Como solicitante, quero ver a lista das solicitações que eu abri, com o status de cada uma, para acompanhar o andamento sem precisar perguntar a ninguém.

**Why P1**: É a tela de entrada do usuário no produto (design doc §5.2) e materializa a regra de visibilidade inviolável ("solicitante só vê as próprias"). Sem ela não há como demonstrar o ciclo ponta a ponta.

**Acceptance Criteria**:

1. WHEN um usuário autenticado abre "Minhas Solicitações" THEN o system SHALL retornar apenas as solicitações cujo `solicitante_id` é igual ao id do usuário autenticado.
2. WHEN a lista é exibida THEN o system SHALL mostrar, para cada solicitação, ao menos o nome do `TipoFluxo`, o `status`, a `etapa_atual` e o `criado_em`.
3. WHEN a lista é exibida THEN o system SHALL apresentar um botão/ação "Nova Solicitação" que leva à tela de criação.
4. WHEN o usuário não possui nenhuma solicitação THEN o system SHALL exibir um estado vazio (sem erro) mantendo o acesso a "Nova Solicitação".
5. WHEN a requisição de listagem chega sem usuário autenticado THEN o system SHALL negar o acesso (delegado a `autenticacao-usuarios`), nunca retornar solicitações de outro usuário.

**Independent Test**: Autenticar como um solicitante que abriu 2 solicitações, abrir a tela e ver exatamente essas 2 (e nenhuma de outro usuário), com status visível e o botão "Nova Solicitação" presente.

---

### P1: Nova Solicitação (formulário dinâmico e criação) ⭐ MVP

**User Story**: Como solicitante, quero escolher um tipo de fluxo e preencher um formulário adaptado a ele para abrir uma solicitação que entre automaticamente no fluxo de aprovação.

**Why P1**: É a ação central da feature e o gatilho de todo o fluxo (design doc §5.3 e §6, passos 1–2). É um vertical slice completo: seleção de tipo → formulário dinâmico → persistência → side-effects.

**Acceptance Criteria**:

1. WHEN o usuário abre "Nova Solicitação" THEN o system SHALL listar os `TipoFluxo` disponíveis (providos por `configuracao-fluxos`) para escolha.
2. WHEN o usuário seleciona um `TipoFluxo` THEN o system SHALL renderizar um formulário dinâmico a partir de `campos_formulario` daquele tipo.
3. WHEN o usuário submete o formulário THEN o system SHALL validar os campos conforme definido em `campos_formulario` (obrigatoriedade/tipo) antes de aceitar a criação.
4. WHEN a validação falha THEN o system SHALL rejeitar a submissão com mensagem clara e NÃO criar nenhuma `Solicitacao`.
5. WHEN a validação passa THEN o system SHALL criar uma `Solicitacao` com `solicitante_id` = usuário autenticado, `tipo_fluxo_id` = tipo escolhido, `dados` = respostas do formulário (JSON), `status` inicial PENDENTE, `etapa_atual` = 1, `criado_em` = agora e `prazo_sla` definido.
6. WHEN a `Solicitacao` é criada com sucesso THEN o system SHALL gravar um `Log` tipo AUDITORIA registrando a transição de status (nova solicitação criada na etapa 1), delegado a `auditoria-logs`.
7. WHEN a `Solicitacao` é criada com sucesso THEN o system SHALL disparar, de forma não bloqueante, os side-effects de criação: pedido de geração de `resumo_ia` (feature `aprovacoes`) e notificação ao aprovador da etapa 1 (feature `notificacoes`).
8. WHEN a criação é concluída THEN o system SHALL redirecionar/retornar o solicitante para "Minhas Solicitações" com a nova solicitação visível.

**Independent Test**: Autenticar como solicitante com `gestor_id` válido, escolher um `TipoFluxo` cujo primeiro passo é GESTOR, preencher e submeter; verificar que a `Solicitacao` foi criada com `status`=PENDENTE, `etapa_atual`=1, `dados` correto e `prazo_sla` preenchido, e que aparece na lista.

---

### P2: Indicador visual de status na lista

**User Story**: Como solicitante, quero distinguir visualmente o status de cada solicitação (pendente, atrasado, aprovado, rejeitado) para identificar de relance o que já resolveu e o que ainda está em andamento.

**Why P2**: A informação de status já está presente na P1 como texto; o tratamento visual (badge/cor por estado) é um refinamento de usabilidade citado no design doc ("status visual", §5.2), mas não é pré-requisito funcional para o fluxo rodar.

**Acceptance Criteria**:

1. WHEN a lista exibe uma solicitação THEN o system SHALL apresentar um indicador visual distinto por `status` entre pendente, atrasado, aprovado e rejeitado.
2. WHEN o `status` de uma solicitação muda (por ações de outras features) THEN o system SHALL refletir o indicador correspondente ao estado atual na próxima exibição da lista.

**Independent Test**: Ter solicitações em estados diferentes e confirmar que cada uma exibe o indicador visual correto para o seu status.

---

### P3: Estado vazio orientativo para primeiro uso

**User Story**: Como colaborador que ainda não abriu nenhuma solicitação, quero uma mensagem orientativa na lista vazia para entender que devo começar por "Nova Solicitação".

**Why P3**: Puramente de onboarding/UX; o acesso à criação já existe na P1. Nice to have.

**Acceptance Criteria**:

1. WHEN a lista está vazia THEN o system SHALL exibir uma mensagem explicativa e um call-to-action claro para "Nova Solicitação".

---

## Edge Cases

- WHEN a etapa 1 do `TipoFluxo` exige aprovador GESTOR e o solicitante não possui `gestor_id` cadastrado THEN o system SHALL falhar a criação com erro claro e NÃO persistir nenhuma `Solicitacao` (design doc §8 — evitar solicitação "perdida" sem aprovador).
- WHEN não existe nenhum `TipoFluxo` disponível THEN o system SHALL exibir um estado vazio na tela de Nova Solicitação e impedir a criação, sem erro não tratado.
- WHEN o `campos_formulario` do `TipoFluxo` está vazio ou malformado THEN o system SHALL tratar graciosamente (mensagem clara) em vez de quebrar a renderização.
- WHEN a submissão vem com campos obrigatórios ausentes ou tipos inválidos THEN o system SHALL rejeitar com mensagem de validação e não criar a `Solicitacao`.
- WHEN o disparo de um side-effect (resumo_ia ou notificação) falha THEN o system SHALL manter a `Solicitacao` criada e permitir que a falha seja registrada como `Log` tipo ERRO pela feature responsável (regra inviolável: IA/notificação nunca travam o fluxo).
- WHEN o usuário submete a mesma criação duas vezes em sequência rápida (duplo clique) THEN o system SHALL evitar criar solicitações duplicadas para a mesma submissão. *(Ver Questões em Aberto sobre a estratégia.)*
- WHEN a requisição de criação chega sem usuário autenticado THEN o system SHALL negar a operação (delegado a `autenticacao-usuarios`).

---

## Requirement Traceability

Cada requisito recebe um ID único para rastreio entre design, tasks e validação.

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| SOL-01 | P1: Minhas Solicitações | Design | Pending |
| SOL-02 | P1: Minhas Solicitações | Design | Pending |
| SOL-03 | P1: Minhas Solicitações | Design | Pending |
| SOL-04 | P1: Minhas Solicitações (auth guard) | Design | Pending |
| SOL-05 | P1: Nova Solicitação | Design | Pending |
| SOL-06 | P1: Nova Solicitação | Design | Pending |
| SOL-07 | P1: Nova Solicitação | Design | Pending |
| SOL-08 | P1: Nova Solicitação | Design | Pending |
| SOL-09 | P1: Nova Solicitação | Design | Pending |
| SOL-10 | P1: Nova Solicitação (Log AUDITORIA) | Design | Pending |
| SOL-11 | P1: Nova Solicitação (side-effects) | Design | Pending |
| SOL-12 | Edge: solicitante sem gestor | Design | Pending |
| SOL-13 | Edge: side-effect não bloqueante | Design | Pending |
| SOL-14 | P2: Indicador visual de status | Design | Pending |
| SOL-15 | P3: Estado vazio orientativo | Design | Pending |

**Mapa ID → critério:**

- **SOL-01** — Listagem retorna apenas solicitações do `solicitante_id` autenticado (P1-Minhas #1).
- **SOL-02** — Cada item exibe TipoFluxo, status, etapa_atual, criado_em (P1-Minhas #2).
- **SOL-03** — Tela oferece ação "Nova Solicitação" (P1-Minhas #3).
- **SOL-04** — Requisição sem usuário autenticado nega acesso (P1-Minhas #5).
- **SOL-05** — Seleção de TipoFluxo renderiza formulário dinâmico de `campos_formulario` (P1-Nova #1, #2).
- **SOL-06** — Validação de campos conforme `campos_formulario` antes de criar (P1-Nova #3, #4).
- **SOL-07** — Criação persiste Solicitacao com status=PENDENTE, etapa_atual=1, dados, criado_em (P1-Nova #5).
- **SOL-08** — Definição de `prazo_sla` na criação (P1-Nova #5).
- **SOL-09** — Redirecionamento/retorno para a lista com a nova solicitação visível (P1-Nova #8).
- **SOL-10** — Log AUDITORIA na transição de status de criação (P1-Nova #6).
- **SOL-11** — Disparo não bloqueante dos side-effects resumo_ia + notificação (P1-Nova #7).
- **SOL-12** — Erro claro e nenhuma persistência quando solicitante sem gestor e etapa 1 = GESTOR (Edge).
- **SOL-13** — Falha de side-effect não impede a criação (Edge; regra inviolável).
- **SOL-14** — Indicador visual distinto por status (P2 #1, #2).
- **SOL-15** — Estado vazio com CTA (P3 #1 e P1-Minhas #4).

**ID format:** `SOL-[NUMBER]`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 15 total, 0 mapeados a tasks, 15 não mapeados ⚠️ (esperado nesta fase Specify).

---

## Success Criteria

Como saberemos que a feature está bem-sucedida:

- [ ] Um solicitante autenticado abre uma nova solicitação de qualquer `TipoFluxo` existente em < 2 minutos, e ela aparece imediatamente em "Minhas Solicitações".
- [ ] Nenhuma consulta de listagem retorna solicitações de outro usuário (regra de visibilidade verificada em teste manual: logar como usuário A e não ver nada de B).
- [ ] 100% das solicitações criadas nascem com `status`=PENDENTE, `etapa_atual`=1, `criado_em` e `prazo_sla` preenchidos e `dados` fiel ao formulário.
- [ ] Toda criação bem-sucedida gera exatamente um `Log` AUDITORIA.
- [ ] Colaborador sem gestor, ao tentar criar solicitação cuja etapa 1 é GESTOR, recebe erro claro e nenhuma `Solicitacao` é persistida.
- [ ] Falha simulada no disparo de resumo_ia/notificação não impede a criação da solicitação.

---

## Questões em Aberto

Zonas cinzentas relevantes para decisão do usuário antes de avançar para Design:

1. **Origem do `prazo_sla`.** O design doc cita "ex: 48h" (§6) mas não define a fonte do valor. É um default global fixo, configurado por `TipoFluxo`, ou por etapa? Isso afeta como `solicitacoes` calcula `prazo_sla` na criação e a fronteira com `configuracao-fluxos`/`sla-cobranca`.
2. **Criação da linha `Aprovacao` da etapa 1.** O `resumo_ia` mora em `Aprovacao` (§4) e é gerado já na criação (§6, passo 2). Quem cria/persiste a linha `Aprovacao` da etapa 1: esta feature (no ato da criação) ou a feature `aprovacoes` (ao receber o evento)? Esta spec assume que `solicitacoes` apenas dispara o evento e `aprovacoes` cuida da `Aprovacao`/`resumo_ia`.
3. **Detalhe da própria solicitação.** O design doc só cita "detalhes completos" na tela de Aprovações (§5.4). Existe uma rota/tela de detalhe da solicitação para o próprio solicitante, ou a lista já basta no MVP? (Não especificado aqui para não inventar escopo.)
4. **Editar/cancelar após criada.** O solicitante pode editar ou cancelar uma solicitação depois de aberta? Não há menção no design doc; tratado como fora de escopo nesta spec.
5. ✅ **RESOLVIDO** (ver `context.md`) — **Tipos de campo suportados em `campos_formulario`**: tipos semânticos (texto → texto, número → número, data → data, etc.), alinhado com `configuracao-fluxos`.
6. **Estratégia anti-duplicação.** Qual mecanismo evita solicitações duplicadas por duplo submit (desabilitar botão no client, chave de idempotência, verificação server-side)? A ser decidido no Design.
