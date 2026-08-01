# Painel de Insights Context

**Gathered:** 2026-07-30
**Spec:** `.specs/features/painel-insights/spec.md`
**Status:** Design + Tasks completos — ver `design.md` e `tasks.md`. Pronto para execução (T1–T7).

---

## Feature Boundary

Filtro por tipo de fluxo e período + gráfico quantitativo (Recharts) + resumo em linguagem natural gerado por IA a partir dos números agregados.

---

## Implementation Decisions

### Papel de acesso ao painel (Questão em Aberto #1)

- **Gestor também tem acesso**, além de RH_Admin. A agregação para o Gestor é **restrita à própria equipe** (mesma regra de visibilidade usada nas demais features: solicitações próprias + de usuários cujo `gestor_id` aponta para ele). RH_Admin continua vendo a agregação global da empresa.
- Isso torna a story P2 "Escopo de visibilidade por papel na agregação" (INSIGHT-09) **obrigatória para o MVP**, não mais condicional.

### Agent's Discretion

- Dimensão de agregação sobre `dados` (Questão em Aberto #2) e definição exata de "período" (Questão em Aberto #3) permanecem a critério do Design.

---

## Specific References

Nenhuma referência visual específica.

---

## Deferred Ideas

Cache do resumo de IA (Questão em Aberto #4) e formato do gráfico por tipo (Questão em Aberto #5) seguem em aberto — não fizeram parte desta rodada.
