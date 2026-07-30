# Configuração de Fluxos Context

**Gathered:** 2026-07-30
**Spec:** `.specs/features/configuracao-fluxos/spec.md`
**Status:** Ready for design

---

## Feature Boundary

CRUD de `TipoFluxo` (RH_Admin): nome, `campos_formulario` (JSON), `etapas` (lista ordenada de papéis aprovadores).

---

## Implementation Decisions

### Contrato de `campos_formulario` (Questão em Aberto #1)

- Os tipos de campo são **semânticos**: cada campo declara um tipo que corresponde à natureza real do dado — campo de texto para texto, campo numérico para número, campo de data para data, etc.
- Não é um único tipo genérico (ex.: tudo como string); o schema de `campos_formulario` deve carregar o tipo semântico por campo, que a feature `solicitacoes` usa para renderizar o input correto e validar.

### Edição de `TipoFluxo` com solicitações em andamento (Questão em Aberto #2)

- **Bloquear a edição** de um `TipoFluxo` (nome, `campos_formulario` ou `etapas`) quando existir ao menos uma `Solicitacao` **pendente** (não decidida) vinculada àquele tipo.
- Sem solicitações pendentes vinculadas, a edição é livre.

### Agent's Discretion

- Mensagem de erro exata exibida ao RH_Admin ao tentar editar um tipo bloqueado fica a critério do Design.
- Lista exata de tipos semânticos suportados (texto, número, data, seleção, etc.) e seus atributos de validação (obrigatório, min/max, opções) — a definir no Design em conjunto com `solicitacoes`.

---

## Specific References

Nenhuma referência visual específica.

---

## Deferred Ideas

Exclusão/desativação de `TipoFluxo` (Questão em Aberto #5 do spec) segue em aberto — não fazia parte desta rodada de decisões.
