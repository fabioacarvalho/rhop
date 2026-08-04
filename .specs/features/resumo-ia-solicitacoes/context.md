# Resumo IA de Solicitações — Context (decisões de zonas cinzentas)

**Spec**: `.specs/features/resumo-ia-solicitacoes/spec.md`
**Status**: Resolved for Design

---

## Investigação prévia (antes de perguntar ao usuário)

- Não existe seed/fixture real de `TipoFluxo` "Férias"/"Day Off" no projeto — `TipoFluxo.campos_formulario` é JSON livre, sem convenção de chave hoje.
- "Minhas Solicitações" (`app/(dashboard)/solicitacoes/page.tsx:101-157`) é uma **tabela**, não cards.
- Não existe edição de `Solicitacao` em nenhuma camada (`solicitacaoService` só tem `criar`/`listarMinhas`/`buscarDetalhePorId`; confirmado também como fora de escopo em `.specs/features/solicitacoes/spec.md:31`).
- Não existe hoje nenhuma query que compare datas entre membros da mesma `Equipe`.
- `resumo_ia` hoje só existe em `Aprovacao` (visão do aprovador); design doc não menciona resumo para o solicitante nem conflito de férias entre equipe.

## Questões do spec.md (resolvidas)

| # | Questão | Decisão |
| --- | --- | --- |
| 1 | Onde o resumo aparece, já que a tela é tabela e não cards? | **Expande na tabela** — mantém a tabela atual de `solicitacoes`, resumo aparece ao expandir a linha (reaproveitável também na tela de detalhe `[id]/page.tsx` se fizer sentido no Design). |
| 2 | Como o sistema sabe que um `TipoFluxo` é "Férias" ou "Day Off", já que hoje isso não existe? | **Novo campo `categoria`** em `TipoFluxo` (enum: PADRAO/FERIAS/DAYOFF), definido pelo RH_Admin ao criar/editar o tipo em `configuracao-fluxos`. A checagem de conflito se baseia nesse flag, não no nome do `TipoFluxo`. Convenção de chave de campo assumida: FERIAS → `data_inicio`/`data_fim`; DAYOFF → `data`. |
| 3 | Quais `Solicitacao` concorrentes contam como "programada" para efeito de conflito? | **APROVADA + PENDENTE** — inclui um aviso preventivo mesmo antes da aprovação final do colega, não só férias já confirmadas. |
| 4 | Como resolver a regra "só refaz o resumo se editado", já que não existe edição de `Solicitacao`? | **Cachear na criação, sem edição.** Resumo é gerado 1x na criação e persistido; nenhuma função de editar `Solicitacao` é criada nesta feature. A regra original do usuário (1.1) fica satisfeita porque, sem edição possível, "nunca regenerar" é automaticamente verdade — não é uma lacuna, é a decisão. |

## Decisões adicionais (assumidas nesta sessão, a confirmar/ajustar no Design)

| Tema | Decisão |
| --- | --- |
| Nome do colega em conflito | Alerta genérico, sem citar nome (privacidade) — não perguntado explicitamente ao usuário; sinalizado no spec como assumption a revisar. |
| Local de persistência do resumo | Não decidido — Design escolhe entre novo campo em `Solicitacao` ou outro mecanismo; não é decisão de produto, é de schema. |
| Categorias além de PADRAO/FERIAS/DAYOFF | Fora de escopo — não pedido. |
