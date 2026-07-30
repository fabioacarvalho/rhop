# SLA e Cobrança Context

**Gathered:** 2026-07-30
**Spec:** `.specs/features/sla-cobranca/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Job periódico que detecta solicitações com etapa vencida, marca atraso e dispara evento de cobrança ao aprovador responsável.

---

## Implementation Decisions

### Modelagem de "atrasada" (Questão em Aberto #2)

- **Status adicional**, não status próprio que substitui "pendente". Uma `Solicitacao` atrasada mantém `status`=PENDENTE e recebe uma marcação/flag adicional de atraso (ex.: campo booleano ou timestamp de quando foi marcada). Isso significa que `aprovacoes` continua reconhecendo a etapa como aprovável normalmente mesmo quando atrasada.

### Frequência de reenvio de cobrança (Questão em Aberto #1)

- Cobrança reenviada **no máximo 1x por dia** por solicitação atrasada, independentemente de quantas vezes o cron rodar no mesmo dia. Se o cron rodar de hora em hora, apenas a primeira execução do dia (ou a que completa 24h desde a última cobrança) dispara novo evento de cobrança para uma mesma solicitação já marcada como atrasada.

### Agent's Discretion

- Mecanismo exato de controle do throttle de 1x/dia (campo de "última cobrança em" na `Solicitacao`, tabela auxiliar, ou cálculo a partir do `Log` mais recente) fica a critério do Design.
- Semântica exata do `prazo_sla` (por etapa vs. por solicitação, Questão em Aberto #3) permanece em aberto.

---

## Specific References

Nenhuma referência visual específica.

---

## Deferred Ideas

None — discussão ficou dentro do escopo da feature.
