# Solicitações Context

**Gathered:** 2026-07-30
**Spec:** `.specs/features/solicitacoes/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Criação de `Solicitacao` (Nova Solicitação, formulário dinâmico) e listagem "Minhas Solicitações" do próprio solicitante.

---

## Implementation Decisions

### Tipos de campo em `campos_formulario` (Questão em Aberto #5)

- Decisão tomada em conjunto com `configuracao-fluxos`: os tipos de campo são **semânticos** (texto → input texto, número → input numérico, data → input data, etc.). O formulário dinâmico desta feature deve renderizar o input correspondente ao tipo semântico declarado, e validar de acordo (ver `configuracao-fluxos/context.md`).

### Status "atrasado" (relacionado à Questão em Aberto #1, origem do `prazo_sla`)

- O status "atrasado" definido por `sla-cobranca` é **aditivo**, não um valor de status que substitui "pendente" (ver `sla-cobranca/context.md`). Uma `Solicitacao` atrasada continua com `status`=PENDENTE e ganha uma marcação adicional de atraso. Isso não resolve sozinho a questão de "por etapa vs. por solicitação" do `prazo_sla` (permanece em aberto), mas define a forma como o atraso convive com o `status` principal.

### Agent's Discretion

- Origem exata do valor de `prazo_sla` (default global fixo vs. por `TipoFluxo`) permanece em aberto — a decidir no Design.

---

## Specific References

Nenhuma referência visual específica.

---

## Deferred Ideas

Estratégia anti-duplicação de submissão (Questão em Aberto #6) e detalhe da própria solicitação (Questão em Aberto #3) seguem em aberto — não fizeram parte desta rodada.
