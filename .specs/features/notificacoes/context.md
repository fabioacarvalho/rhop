# Notificações Context

**Gathered:** 2026-07-30
**Spec:** `.specs/features/notificacoes/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Canal de notificação (in-app + e-mail) disparado pelos eventos de fluxo (criação, avanço de etapa, aprovação final, rejeição, cobrança de SLA).

---

## Implementation Decisions

### Entidade de persistência da notificação in-app (Questão em Aberto #1)

- **Aprovado criar uma nova entidade `Notificacao`** no schema (não existia no modelo de dados original do design doc). Campos mínimos: destinatário (`usuario_id`), tipo/evento, referência à `Solicitacao`, mensagem, lida/não lida, `criado_em`, link.

### Deduplicação/throttle da cobrança de SLA (Questão em Aberto #2)

- Alinhado com `sla-cobranca/context.md`: a notificação de cobrança é enviada **no máximo 1x por dia** por solicitação atrasada.

### Agent's Discretion

- Schema exato de `Notificacao` (nomes de coluna, índices) fica a critério do Design.

---

## Specific References

Nenhuma referência visual específica.

---

## Deferred Ideas

Se o corpo da notificação deve embutir o `resumo_ia` (Questão em Aberto #3) segue em aberto — não fez parte desta rodada.
