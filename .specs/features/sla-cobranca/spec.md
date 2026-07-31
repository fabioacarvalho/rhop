# SLA e Cobrança de Aprovações Atrasadas Specification

## Problem Statement

Aprovações de RH atrasam porque ninguém é avisado de que uma etapa passou do prazo aceitável e nenhum processo cobra o aprovador responsável. Sem um mecanismo automático que detecte o estouro de prazo, marque a solicitação como atrasada e reenvie a cobrança, os atrasos permanecem invisíveis até alguém perguntar manualmente — exatamente a dor que o produto se propõe a eliminar. Esta feature adiciona o job periódico que fecha essa lacuna.

## Goals

- [ ] Toda solicitação cuja etapa atual excede o `prazo_sla` sem decisão é marcada como atrasada em até um ciclo do job após a expiração.
- [ ] O aprovador responsável por uma etapa atrasada tem uma cobrança disparada (delegada a `notificacoes`).
- [ ] A marcação de atraso é idempotente: uma solicitação já atrasada não sofre nova transição de status nem novo `Log` de transição.
- [ ] Toda marcação de atraso grava `Log` tipo `AUDITORIA`; toda falha ao disparar a cobrança grava `Log` tipo `ERRO`, sem interromper o job.
- [ ] O job nunca trava o fluxo de aprovação: uma solicitação atrasada continua podendo ser decidida normalmente.

## Out of Scope

Explicitamente excluído. Documentado para evitar expansão de escopo.

| Feature | Motivo |
| --- | --- |
| Definição e armazenamento do campo `prazo_sla` em `Solicitacao` | Pertence à feature `solicitacoes` |
| Envio efetivo da notificação de cobrança (in-app, e-mail, templates, deduplicação de entrega) | Pertence à feature `notificacoes`; aqui só se define o gatilho/contrato |
| Autorização de quem pode aprovar/rejeitar a etapa | Pertence à feature `aprovacoes` |
| Exibição do contador/status "atrasado" e da lista filtrável | Pertence à feature `dashboard-visao-geral` |
| Definição do modelo `Log` (campos, persistência) | Pertence à feature `auditoria-logs` |
| Avanço de etapa e mudança de status após decisão de uma solicitação atrasada | Pertence à feature `aprovacoes` |
| Resumo de IA / qualquer dependência de IA | SLA não usa IA — cobrança é puramente determinística |
| Deduplicação e frequência exata do reenvio de cobrança em execuções sucessivas | Zona cinzenta não descrita no design doc — ver Questões em Aberto |

---

## User Stories

### P1: Detecção e marcação de solicitações atrasadas ⭐ MVP

**User Story**: Como sistema (job periódico acionado por cron), quero identificar solicitações cuja etapa de aprovação atual ultrapassou o `prazo_sla` sem decisão e marcá-las como atrasadas, para que o atraso fique visível e rastreável sem intervenção humana.

**Why P1**: É o núcleo da feature. Sem detecção e marcação não há cobrança nem visibilidade de atraso — o problema original permanece.

**Acceptance Criteria**:

1. WHEN o cron (node-cron ou Vercel Cron) aciona o endpoint de verificação de SLA THEN system SHALL executar uma rotina de "check" que percorre as solicitações com aprovação ainda pendente.
2. WHEN a etapa atual de uma solicitação pendente ultrapassou o prazo definido por `prazo_sla` sem decisão registrada THEN system SHALL marcar essa solicitação como atrasada de forma que os dashboards a contabilizem como "atrasada".
3. WHEN uma solicitação é marcada como atrasada THEN system SHALL gravar um `Log` tipo `AUDITORIA` registrando a transição (entidade `Solicitacao`, ação de marcação de atraso, `usuario_id` do sistema/job).
4. WHEN uma solicitação já está marcada como atrasada e continua pendente em uma execução posterior THEN system SHALL não repetir a transição de status nem gravar novo `Log` de transição de atraso (marcação idempotente).
5. WHEN uma solicitação já foi decidida (aprovada/rejeitada) ou não tem prazo estourado THEN system SHALL ignorá-la sem alterar seu status.

**Independent Test**: Criar uma solicitação pendente com `prazo_sla` já expirado, acionar o endpoint de check manualmente, e verificar que o status vira "atrasada" e um `Log` `AUDITORIA` foi gravado; acionar novamente e confirmar que nada muda.

---

### P1: Disparo de cobrança ao aprovador responsável ⭐ MVP

**User Story**: Como sistema, quero disparar um evento de cobrança ao aprovador responsável pela etapa atrasada, para que ele seja lembrado da pendência e o processo volte a andar.

**Why P1**: A cobrança é a metade "ação" da feature; detectar o atraso sem cobrar não resolve o problema descrito no design doc.

**Acceptance Criteria**:

1. WHEN uma solicitação é detectada como atrasada THEN system SHALL disparar um evento de cobrança para a feature `notificacoes`, passando o contrato mínimo: `solicitacao_id`, identificação do aprovador responsável pela etapa atual, `etapa` atual e o tipo de evento (cobrança de SLA).
2. WHEN o evento de cobrança é disparado THEN system SHALL delegar o envio efetivo (in-app + e-mail) integralmente à feature `notificacoes`, sem implementar aqui a entrega.
3. WHEN não é possível determinar o aprovador responsável da etapa atual THEN system SHALL não disparar cobrança para essa solicitação, gravar `Log` tipo `ERRO` e prosseguir com as demais.

**Independent Test**: Com uma solicitação atrasada e aprovador definido, acionar o check e verificar (via stub/spy do serviço de notificação) que o evento de cobrança foi chamado uma vez com `solicitacao_id`, aprovador, etapa e tipo corretos.

---

### P2: Resiliência do job de SLA

**User Story**: Como operador do sistema, quero que uma falha ao processar uma solicitação não interrompa o job inteiro nem trave o fluxo de aprovação, para que as demais solicitações atrasadas ainda sejam tratadas.

**Why P2**: Não é o caminho feliz do MVP, mas um job periódico frágil que aborta na primeira exceção deixa solicitações sem cobrança silenciosamente — contrariando a narrativa de "nada se perde silenciosamente". Também materializa a regra de negócio "toda falha de notificação grava `Log` `ERRO`".

**Acceptance Criteria**:

1. WHEN o disparo do evento de cobrança lança exceção (ex: serviço de notificação indisponível) THEN system SHALL capturar o erro, gravar `Log` tipo `ERRO` e continuar processando as próximas solicitações.
2. WHEN o processamento de uma solicitação específica falha por qualquer motivo THEN system SHALL isolar a falha àquela solicitação e não abortar a varredura das restantes.
3. WHEN o job encontra uma falha THEN system SHALL nunca impedir que a solicitação continue podendo ser aprovada/rejeitada normalmente.

**Independent Test**: Forçar o serviço de notificação a lançar exceção em uma de várias solicitações atrasadas e verificar que um `Log` `ERRO` é gravado, que as demais são processadas e marcadas normalmente, e que o endpoint retorna sucesso.

---

### P2: Proteção do endpoint de verificação

**User Story**: Como responsável pela segurança, quero que o endpoint de check só possa ser acionado pelo cron autorizado, para que terceiros não consigam disparar marcações e cobranças arbitrárias.

**Why P2**: O endpoint executa efeitos colaterais (muda status, dispara e-mails). Se ficar público e anônimo, vira vetor de spam de cobrança. Não é o núcleo funcional, mas é necessário antes de ir para produção.

**Acceptance Criteria**:

1. WHEN o endpoint de check é chamado sem o segredo/token de cron esperado THEN system SHALL rejeitar a requisição (não autorizado) sem executar a rotina.
2. WHEN o endpoint é chamado com o segredo/token de cron válido THEN system SHALL executar a rotina normalmente.

**Independent Test**: Chamar o endpoint sem cabeçalho de autorização e confirmar rejeição sem efeitos colaterais; chamar com o token correto e confirmar execução.

---

### P3: Observabilidade da execução do job

**User Story**: Como operador, quero que cada execução do job registre um resumo (quantas solicitações foram verificadas, quantas marcadas como atrasadas, quantas cobranças disparadas), para acompanhar se o SLA está funcionando.

**Why P3**: Melhora diagnóstico e demonstração, mas o MVP funciona sem isso.

**Acceptance Criteria**:

1. WHEN o job conclui uma execução THEN system SHALL registrar um resumo com a contagem de solicitações verificadas, marcadas como atrasadas e cobranças disparadas.

---

## Edge Cases

- WHEN não existe nenhuma solicitação com etapa vencida THEN system SHALL concluir a execução com sucesso sem alterar nada e sem gravar logs de transição.
- WHEN o `prazo_sla` de uma solicitação não está definido (nulo) THEN system SHALL ignorar essa solicitação, pois não é possível calcular o vencimento (ver Questões em Aberto sobre prazo default).
- WHEN o job roda novamente sobre uma solicitação já marcada como atrasada e ainda pendente THEN system SHALL evitar nova transição de status e novo `Log` `AUDITORIA` de transição; a política de reenvio da cobrança nessa situação está em aberto (ver Questões em Aberto).
- WHEN uma solicitação é decidida (aprovada/rejeitada) entre a leitura e o processamento na mesma execução THEN system SHALL não marcá-la como atrasada nem disparar cobrança.
- WHEN o disparo de cobrança falha para uma solicitação THEN system SHALL gravar `Log` `ERRO` e prosseguir, sem reverter a marcação de atraso já aplicada.
- WHEN a rotina processa muitas solicitações THEN system SHALL tratar cada uma de forma independente para que a falha de uma não afete as demais.

---

## Requirement Traceability

Cada requisito recebe um ID único para rastreamento entre design, tasks e validação.

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| SLA-01 | P1: Detecção e marcação de atrasadas (endpoint/cron de check) | Tasks | In Tasks |
| SLA-02 | P1: Detecção e marcação de atrasadas (identificação de etapa vencida e pendente) | Tasks | In Tasks |
| SLA-03 | P1: Detecção e marcação de atrasadas (marcar atrasada + `Log` `AUDITORIA`, idempotente) | Tasks | In Tasks |
| SLA-04 | P1: Disparo de cobrança ao aprovador responsável (contrato do evento) | Tasks | In Tasks |
| SLA-05 | P2: Resiliência do job (falha isolada + `Log` `ERRO`, não trava fluxo) | Tasks | In Tasks |
| SLA-06 | P2: Proteção do endpoint de verificação (segredo/token de cron) | Tasks | In Tasks |
| SLA-07 | P3: Observabilidade da execução do job | Tasks | In Tasks |

**ID format:** `[CATEGORY]-[NUMBER]` (ex: `SLA-01`)

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 7 total, 7 mapeados para tasks ✅ (ver `tasks.md`)

---

## Success Criteria

Como saberemos que a feature está bem-sucedida:

- [ ] Uma solicitação pendente com `prazo_sla` expirado é marcada como atrasada na primeira execução do job após o vencimento.
- [ ] Cada solicitação atrasada com aprovador válido gera exatamente um disparo de cobrança na detecção inicial.
- [ ] Executar o job repetidamente sobre a mesma solicitação atrasada não gera transições de status duplicadas nem `Log`s de transição duplicados.
- [ ] Toda marcação de atraso tem um `Log` `AUDITORIA` correspondente; toda falha de disparo de cobrança tem um `Log` `ERRO` correspondente.
- [ ] Uma falha ao processar uma solicitação não impede o processamento das demais nem a aprovação posterior daquela solicitação.
- [ ] O endpoint de check rejeita chamadas sem o segredo de cron.

---

## Questões em Aberto

1. ✅ **RESOLVIDO** (ver `context.md`) — **Frequência/deduplicação do reenvio de cobrança**: no máximo 1x por dia por solicitação atrasada.
2. ✅ **RESOLVIDO** (ver `context.md`) — **Modelagem de "atrasada"**: indicador/flag adicional; NÃO substitui o status "pendente".
3. ✅ **RESOLVIDO** (ver `design.md`) — **Semântica do `prazo_sla`**: deadline absoluto da **etapa atual**; `aprovacoes` reinicia `prazo_sla` e limpa flags de atraso no avanço (contrato cross-feature; implementação hoje ausente em `decidir`).
4. ✅ **RESOLVIDO** (ver `design.md`) — **`prazo_sla` nulo**: schema exige `DateTime`; job ignora defensivamente se ausente; sem default no job.
