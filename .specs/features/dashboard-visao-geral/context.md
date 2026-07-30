# Dashboard de Visão Geral Context

**Gathered:** 2026-07-30
**Spec:** `.specs/features/dashboard-visao-geral/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Contadores agregados + lista filtrável de `Solicitacao`, respeitando visibilidade por papel (Gestor = equipe, RH_Admin = tudo).

---

## Implementation Decisions

### "Pendente" e "atrasado" nos contadores (Questão em Aberto #3)

- **Não são mutuamente exclusivos.** "Atrasado" é uma marcação adicional sobre uma solicitação que continua `status`=PENDENTE (ver `sla-cobranca/context.md`). Uma solicitação atrasada deve contar tanto no contador de "pendentes" quanto no de "atrasados" (não é um bucket exclusivo que subtrai da contagem de pendentes).

### Agent's Discretion

- Layout exato dos contadores (cards separados vs. combinados) fica a critério do Design.

---

## Specific References

Nenhuma referência visual específica.

---

## Deferred Ideas

Paginação (Questão em Aberto #4) e filtro por período (Questão em Aberto #5) seguem em aberto — não fizeram parte desta rodada.
