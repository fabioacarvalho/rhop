# Notificações Specification

## Problem Statement

Hoje os responsáveis por aprovações de RH não são avisados automaticamente quando há algo pendente com eles, e o solicitante não sabe quando seu pedido foi aprovado ou rejeitado — a comunicação é manual e falha, gerando atrasos e retrabalho. Esta feature entrega o canal de notificação (in-app + e-mail) que avisa a pessoa certa, no momento certo, a cada evento relevante do fluxo. Ela é o mecanismo que sustenta a narrativa central do produto: "nada fica pendente silenciosamente".

## Goals

- [ ] A cada evento de fluxo (criação, avanço de etapa, aprovação final, rejeição, cobrança de SLA), o destinatário correto recebe uma notificação in-app com link para o item.
- [ ] O mesmo evento dispara um e-mail para o destinatário, com resiliência total: falha de e-mail nunca bloqueia o fluxo.
- [ ] Toda falha de envio de e-mail é registrada como `Log` tipo `ERRO`, garantindo rastreabilidade (via `auditoria-logs`).
- [ ] Cada usuário só vê as notificações endereçadas a si mesmo.

## Out of Scope

Explicitamente excluído. Documentado para evitar expansão de escopo.

| Feature | Motivo da exclusão |
| --- | --- |
| Notificação via Slack/Teams | Fora de escopo do MVP (design doc §10 e CLAUDE.md). Só in-app + e-mail. |
| Lógica que decide **quando** cada evento ocorre | Pertence a `solicitacoes`, `aprovacoes` e `sla-cobranca`. Esta feature só especifica o contrato da notificação, não o gatilho de negócio. |
| Geração do `resumo_ia` | Pertence a `aprovacoes`. Notificações apenas linkam para o item; não geram resumo. |
| Preferências de notificação por usuário (opt-out, escolher canais) | Não previsto no design doc. Todos os canais são sempre acionados. |
| Push / notificação mobile nativa | Não previsto no design doc. |
| Digest / agrupamento periódico de notificações | Não previsto no design doc. Cada evento gera uma notificação individual. |

---

## User Stories

### P1: Notificação in-app dos eventos de fluxo ⭐ MVP

**User Story**: Como aprovador (Gestor/RH) ou solicitante, quero receber uma notificação in-app quando algo relevante acontece com uma solicitação, para agir sem precisar ficar consultando o sistema.

**Why P1**: É o coração da feature e a razão de existir do produto. Sem a notificação in-app, o problema original (pendências invisíveis) permanece.

**Acceptance Criteria**:

1. WHEN o serviço de notificação recebe o evento "solicitação criada" com o aprovador da etapa 1 como destinatário THEN o sistema SHALL criar uma notificação in-app para esse aprovador, contendo referência à `Solicitacao` e um link para a tela de detalhe/aprovação.
2. WHEN o serviço recebe o evento "avanço de etapa" com o aprovador da próxima etapa como destinatário THEN o sistema SHALL criar uma notificação in-app para o aprovador da nova etapa atual.
3. WHEN o serviço recebe o evento "aprovação final" (última etapa aprovada) THEN o sistema SHALL criar uma notificação in-app para o solicitante informando que a solicitação foi aprovada.
4. WHEN o serviço recebe o evento "rejeição" em qualquer etapa THEN o sistema SHALL criar uma notificação in-app para o solicitante informando a rejeição.
5. WHEN qualquer notificação in-app é criada THEN o sistema SHALL registrá-la como não lida e com data/hora de criação.
6. WHEN um usuário consulta suas notificações THEN o sistema SHALL retornar somente as notificações endereçadas a ele, nunca as de outros usuários.

**Independent Test**: Disparar cada um dos quatro eventos via chamada ao serviço de notificação e verificar que a notificação in-app aparece para o destinatário correto (e para nenhum outro usuário).

---

### P1: E-mail dos eventos com resiliência a falha ⭐ MVP

**User Story**: Como destinatário de uma notificação, quero também recebê-la por e-mail, para ser avisado mesmo estando fora do sistema — sem que uma falha de e-mail comprometa o andamento da solicitação.

**Why P1**: E-mail é o segundo canal exigido pelo design doc. A regra de resiliência (falha de IA/e-mail nunca trava o fluxo) é inviolável no CLAUDE.md e precisa estar coberta desde o MVP.

**Acceptance Criteria**:

1. WHEN uma notificação é gerada para um dos eventos de fluxo (criação, avanço, aprovação final, rejeição) THEN o sistema SHALL enviar um e-mail ao destinatário com assunto, corpo descritivo do evento e link para o item.
2. WHEN o envio do e-mail falha (timeout, erro do provedor, rate limit, endereço inválido) THEN o sistema SHALL manter a notificação in-app já criada e permitir que o fluxo da solicitação prossiga normalmente.
3. WHEN o envio do e-mail falha THEN o sistema SHALL registrar um `Log` do tipo `ERRO` com a entidade, o evento e o detalhe do erro (contrato do `Log` definido em `auditoria-logs`).
4. WHEN o destinatário não possui e-mail cadastrado THEN o sistema SHALL pular o envio de e-mail, manter a notificação in-app e registrar um `Log` tipo `ERRO`, sem lançar exceção que interrompa o chamador.
5. WHEN o e-mail é enviado com sucesso THEN o sistema SHALL prosseguir sem gravar `Log` de erro.

**Independent Test**: Simular provedor de e-mail indisponível e disparar um evento — verificar que a notificação in-app foi criada, o fluxo da solicitação seguiu, e um `Log` tipo `ERRO` foi gravado. Repetir com provedor saudável e confirmar entrega sem log de erro.

---

### P2: Reenvio de cobrança de SLA

**User Story**: Como aprovador responsável por uma etapa atrasada, quero ser cobrado novamente quando o prazo estoura, para não deixar a solicitação parada por esquecimento.

**Why P2**: Importante para a proposta de valor (cobrança automática), mas depende do job de SLA (`sla-cobranca`) já existir. É uma reutilização do mesmo contrato de notificação com um tipo de evento diferente.

**Acceptance Criteria**:

1. WHEN o serviço de notificação recebe o evento "cobrança de SLA" com o aprovador responsável pela etapa atual como destinatário THEN o sistema SHALL criar uma notificação in-app de cobrança e enviar o e-mail correspondente.
2. WHEN a notificação de cobrança é gerada THEN o sistema SHALL indicar que se trata de uma cobrança/atraso (distinta da notificação original), referenciando a mesma `Solicitacao`.
3. WHEN o envio de e-mail da cobrança falha THEN o sistema SHALL aplicar a mesma regra de resiliência de P1 (in-app mantida, fluxo não bloqueado, `Log` tipo `ERRO`).

**Independent Test**: Disparar o evento de cobrança de SLA para uma solicitação atrasada e verificar que o aprovador responsável recebe nova notificação in-app + e-mail marcada como cobrança.

---

### P2: Central de notificações (leitura e não lidas)

**User Story**: Como usuário, quero ver minhas notificações num só lugar e marcar como lidas, para acompanhar o que já tratei e o que ainda está pendente.

**Why P2**: Melhora significativamente a usabilidade do canal in-app, mas o valor mínimo (receber a notificação) já é entregue em P1 sem ela.

**Acceptance Criteria**:

1. WHEN o usuário abre a área de notificações THEN o sistema SHALL listar suas notificações ordenadas da mais recente para a mais antiga, indicando quais estão não lidas.
2. WHEN o usuário possui notificações não lidas THEN o sistema SHALL exibir um contador (badge) com a quantidade de não lidas.
3. WHEN o usuário marca uma notificação como lida THEN o sistema SHALL atualizar seu estado para lida e refletir a redução no contador de não lidas.
4. WHEN o usuário não possui nenhuma notificação THEN o sistema SHALL exibir um estado vazio informativo, sem erro.

**Independent Test**: Gerar duas notificações para um usuário, abrir a central, confirmar badge = 2, marcar uma como lida e confirmar badge = 1.

---

### P3: Navegação direta a partir da notificação

**User Story**: Como destinatário, quero clicar na notificação e cair direto na tela do item correspondente, para não precisar procurar a solicitação manualmente.

**Why P3**: É um polimento de conveniência; a notificação já carrega a informação essencial mesmo sem o deep-link funcionando.

**Acceptance Criteria**:

1. WHEN um aprovador clica em uma notificação de evento de aprovação THEN o sistema SHALL levá-lo à tela relevante da solicitação (ex: Aprovações Pendentes / detalhe da `Solicitacao`).
2. WHEN um solicitante clica em uma notificação de aprovação final ou rejeição THEN o sistema SHALL levá-lo ao detalhe da própria solicitação em Minhas Solicitações.
3. WHEN o link de uma notificação por e-mail é acessado THEN o sistema SHALL direcionar (após autenticação) para a mesma tela do item.

---

## Edge Cases

- WHEN o evento chega sem destinatário resolvido (destinatário nulo/indefinido) THEN o sistema SHALL não criar notificação, registrar um `Log` tipo `ERRO` e retornar sem lançar exceção que interrompa o chamador.
- WHEN o provedor de e-mail responde com rate limit ou timeout THEN o sistema SHALL tratar como falha de e-mail (regra de resiliência P1), sem retry que bloqueie o fluxo.
- WHEN o mesmo evento de SLA é disparado repetidamente para a mesma solicitação ainda atrasada THEN o sistema SHALL gerar a notificação de cobrança conforme o contrato — a política de deduplicação/throttle, se houver, é responsabilidade de `sla-cobranca` (ver Questões em Aberto).
- WHEN um usuário tenta acessar/marcar como lida uma notificação que não é dele THEN o sistema SHALL negar a operação (visibilidade restrita ao destinatário).
- WHEN a criação da notificação in-app falha (erro de banco) THEN o sistema SHALL registrar `Log` tipo `ERRO` e não impedir o avanço da `Solicitacao`.
- WHEN não há nenhuma notificação para o usuário THEN o sistema SHALL retornar lista vazia e badge zero, sem erro.

---

## Requirement Traceability

Cada requisito recebe um ID único para rastreamento em design, tasks e validação.

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| NOTIF-01 | P1: In-app dos eventos de fluxo | Design | Pending |
| NOTIF-02 | P1: In-app dos eventos de fluxo | Design | Pending |
| NOTIF-03 | P1: In-app dos eventos de fluxo | Design | Pending |
| NOTIF-04 | P1: In-app dos eventos de fluxo | Design | Pending |
| NOTIF-05 | P1: In-app dos eventos de fluxo (estado não lida + timestamp) | Design | Pending |
| NOTIF-06 | P1: In-app dos eventos de fluxo (visibilidade por destinatário) | Design | Pending |
| NOTIF-07 | P1: E-mail dos eventos | Design | Pending |
| NOTIF-08 | P1: E-mail — resiliência (in-app mantida, fluxo não bloqueado) | Design | Pending |
| NOTIF-09 | P1: E-mail — falha registrada como `Log` ERRO | Design | Pending |
| NOTIF-10 | P1: E-mail — destinatário sem e-mail cadastrado | Design | Pending |
| NOTIF-11 | P2: Reenvio de cobrança de SLA | - | Pending |
| NOTIF-12 | P2: Central de notificações — lista + badge não lidas | - | Pending |
| NOTIF-13 | P2: Central de notificações — marcar como lida | - | Pending |
| NOTIF-14 | P2: Central de notificações — estado vazio | - | Pending |
| NOTIF-15 | P3: Navegação direta (deep-link) da notificação | - | Pending |

**ID format:** `[CATEGORY]-[NUMBER]` (ex: `NOTIF-01`)

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 15 total, 0 mapped to tasks, 15 unmapped ⚠️ (mapeamento ocorre na fase de Tasks)

---

## Success Criteria

Como saberemos que a feature está pronta:

- [ ] Cada um dos 5 eventos (criação, avanço, aprovação final, rejeição, cobrança de SLA) gera notificação in-app para o destinatário correto e para nenhum outro usuário.
- [ ] Com o provedor de e-mail indisponível, o fluxo da solicitação avança normalmente, a notificação in-app é entregue, e um `Log` tipo `ERRO` é gravado — zero solicitações travadas por falha de e-mail.
- [ ] Um usuário consegue abrir a central de notificações, ver o contador de não lidas correto e marcar como lida em menos de 2 cliques.
- [ ] Nenhuma query de notificação retorna itens de outro usuário (verificado em teste de visibilidade).

---

## Questões em Aberto

1. ✅ **RESOLVIDO** (ver `context.md`) — **Entidade de persistência da notificação in-app**: aprovado criar entidade nova `Notificacao`.
2. ✅ **RESOLVIDO** (ver `context.md`) — **Deduplicação/throttle da cobrança de SLA**: no máximo 1x por dia.
3. **Conteúdo do e-mail/notificação de aprovação inclui o `resumo_ia`?** O design doc (§6) diz que o aprovador recebe a solicitação "junto com" o resumo de IA. Confirmar se o corpo da notificação deve embutir o `resumo_ia` (quando disponível, degradando graciosamente quando ausente) ou apenas linkar para a tela onde o resumo aparece. Há acoplamento com `aprovacoes`.
4. **Provedor de e-mail do MVP.** O design doc cita Resend "ou Nodemailer + SMTP". Definir qual será usado para o MVP, já que impacta configuração e tratamento de erro.
