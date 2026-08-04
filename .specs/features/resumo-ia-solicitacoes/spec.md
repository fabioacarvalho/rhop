# Resumo IA de Solicitações Specification

> Feature `resumo-ia-solicitacoes` (prefixo `RIA`) — resumo gerado por IA sobre a própria `Solicitacao`, exibido ao solicitante em "Minhas Solicitações", com alerta de conflito de datas entre membros da mesma `Equipe` para Férias e Day Off.
> Depende de: `solicitacoes` (SOL) — model `Solicitacao`, tela "Minhas Solicitações"; `configuracao-fluxos` (CONF) — model `TipoFluxo`.
> Fonte da verdade: `CLAUDE.md` (regra inviolável: IA nunca trava fluxo; toda falha de IA grava `Log` tipo `ERRO`) e `docs/prd/2026-07-30-fluxorh-design.md`.

## Problem Statement

Hoje "Minhas Solicitações" (feature `solicitacoes`) só mostra dados brutos (tipo, status, etapa, data) numa tabela. O solicitante não tem uma leitura rápida do que aquele item significa, e no caso de Férias/Day Off só descobre um conflito de agenda com um colega de equipe depois — quando o gestor já está avaliando ou já rejeitou. Esta feature adiciona, por `Solicitacao`, um resumo gerado por IA (contexto da solicitação + alerta de conflito de datas quando aplicável), gerado uma única vez na criação, persistido, e exibido ao expandir a linha na tabela — nunca recalculado nas leituras seguintes.

## Goals

- [ ] Cada `Solicitacao` ganha um resumo de IA gerado uma vez (na criação) e persistido, visível ao solicitante ao expandir a linha em "Minhas Solicitações", sem nova chamada à IA em leituras subsequentes.
- [ ] Para `Solicitacao` de `TipoFluxo` com categoria FERIAS ou DAYOFF, o resumo inclui alerta se outro membro da mesma `Equipe` tiver solicitação (`APROVADA` ou `PENDENTE`) da mesma categoria com sobreposição de datas.
- [ ] Falha da IA nunca bloqueia a criação da `Solicitacao` nem quebra a listagem — fallback gracioso ("resumo indisponível") + `Log` tipo `ERRO`.
- [ ] RH_Admin consegue marcar um `TipoFluxo` com uma categoria (PADRAO/FERIAS/DAYOFF) em `configuracao-fluxos`, habilitando a checagem de conflito para aquele tipo.

## Out of Scope

Explicitamente excluído. Documentado para prevenir scope creep.

| Feature | Reason |
| --- | --- |
| Editar `Solicitacao` e regenerar o resumo ao editar | Edição de `Solicitacao` não existe no sistema hoje (`solicitacaoService` só tem `criar`/`listarMinhas`/`buscarDetalhePorId`; confirmado no código). O resumo é gerado 1x na criação e nunca regenerado nesta feature. Ver `context.md`. |
| Botão de "regenerar resumo" manual | Não pedido; mesmo padrão já decidido para o resumo do aprovador em `aprovacoes/context.md` (#1). |
| Troca da tabela por layout em cards | A tabela atual de `solicitacoes` (`app/(dashboard)/solicitacoes/page.tsx`) é mantida; o resumo aparece ao expandir a linha. |
| Categorias de `TipoFluxo` além de PADRAO/FERIAS/DAYOFF | Fora de escopo — extensível depois se necessário, não é pedido agora. |
| Conflito de datas fora da mesma `Equipe` (equipes diferentes, empresa toda) | Regra de visibilidade do `CLAUDE.md` restringe a comparação aos membros da mesma `Equipe` do solicitante. |
| Bloquear a criação da `Solicitacao` quando há conflito de datas | O conflito é só um alerta informativo dentro do resumo; não impede submissão nem aprovação (decisão de aprovar/rejeitar continua com o gestor, feature `aprovacoes`). |
| Notificar o gestor separadamente sobre o conflito | Pertence a `notificacoes`; não pedido. O alerta vive só dentro do resumo de IA. |
| CRUD de `TipoFluxo` em si (nome, `campos_formulario`, `etapas`) | Pertence a `configuracao-fluxos`; esta feature apenas **estende** o model com o campo `categoria`. |

---

## User Stories

### P1: Resumo de IA por solicitação ⭐ MVP

**User Story**: Como solicitante, quero ver um resumo gerado por IA explicando minha solicitação ao expandir a linha em "Minhas Solicitações", para entender rapidamente o contexto sem reler todos os dados brutos.

**Why P1**: É o pedido central (item 1) e o vertical slice mínimo: geração → persistência → exibição.

**Acceptance Criteria**:

1. WHEN uma `Solicitacao` é criada com sucesso THEN o system SHALL disparar a geração de um resumo de IA e, se bem-sucedida, persistir o texto associado àquela `Solicitacao`, de forma não bloqueante em relação à resposta de criação ao usuário.
2. WHEN o solicitante expande uma linha em "Minhas Solicitações" THEN o system SHALL exibir o resumo de IA já salvo daquela `Solicitacao`, sem chamar a IA novamente.
3. WHEN o resumo de IA ainda não foi gerado (side-effect ainda em andamento) ou falhou THEN o system SHALL exibir um estado de fallback claro ("resumo indisponível"), nunca um erro ou tela quebrada.
4. WHEN a geração do resumo falha (timeout, erro de API, chave ausente, conteúdo vazio) THEN o system SHALL gravar um `Log` tipo `ERRO` e manter a `Solicitacao` intacta (regra inviolável `CLAUDE.md`).
5. WHEN qualquer leitura de resumo é feita THEN o system SHALL nunca expor o resumo de uma `Solicitacao` que não seja do próprio solicitante autenticado (mesma regra de visibilidade de SOL-01).

**Independent Test**: Criar uma `Solicitacao` de qualquer `TipoFluxo`, aguardar a geração assíncrona, expandir a linha em "Minhas Solicitações" e ver o resumo salvo; recarregar a página e confirmar que o mesmo texto aparece sem nova chamada à IA.

---

### P1: Alerta de conflito de datas para Férias/Day Off ⭐ MVP

**User Story**: Como solicitante que vai tirar Férias ou Day Off, quero que o resumo me avise se outro colega da minha equipe já tem férias/day off programado para o mesmo período, para eu poder ajustar antes de esperar a aprovação.

**Why P1**: É o item 1 do pedido original e o diferencial da feature; sem ele o resumo seria só um resumo genérico sem valor novo.

**Acceptance Criteria**:

1. WHEN o `TipoFluxo` da `Solicitacao` tem categoria FERIAS ou DAYOFF THEN o system SHALL, ao gerar o resumo, buscar outras `Solicitacao` da mesma categoria pertencentes a membros da mesma `Equipe` do solicitante (via `User.equipe_id`), com `status` `APROVADA` ou `PENDENTE`, e comparar as datas.
2. WHEN existe sobreposição de datas (mesmo dia para DAYOFF, ou interseção do intervalo `data_inicio`/`data_fim` para FERIAS) com outra `Solicitacao` dessa categoria de um colega de equipe THEN o system SHALL incluir no resumo de IA um alerta explícito de conflito, sem citar o nome do colega (ver Questões em Aberto — privacidade).
3. WHEN não há sobreposição THEN o system SHALL gerar o resumo normalmente, sem menção a conflito.
4. WHEN o solicitante não pertence a nenhuma `Equipe` (GESTOR/RH_ADMIN nunca têm `equipe_id`) THEN o system SHALL pular a checagem de conflito sem erro.
5. WHEN o `TipoFluxo` não é FERIAS nem DAYOFF THEN o system SHALL gerar apenas o resumo descritivo, sem rodar a checagem de conflito.

**Independent Test**: Dois solicitantes da mesma `Equipe` abrem `Solicitacao` de tipo Férias com datas sobrepostas; ao expandir a linha de qualquer um dos dois, o resumo deve mencionar o conflito; um terceiro solicitante da mesma equipe com datas não sobrepostas não deve ver o alerta.

---

### P1: Categoria do TipoFluxo (PADRAO/FERIAS/DAYOFF) ⭐ MVP

**User Story**: Como RH_Admin, quero marcar um `TipoFluxo` como Férias ou Day Off ao configurá-lo, para que o sistema saiba quando rodar a checagem de conflito de equipe.

**Why P1**: Pré-requisito técnico das duas histórias acima — sem a categoria o sistema não distingue Férias/Day Off de qualquer outro fluxo (ex: Reembolso, Vaga).

**Acceptance Criteria**:

1. WHEN um RH_Admin cria ou edita um `TipoFluxo` THEN o system SHALL permitir escolher uma categoria entre PADRAO (default), FERIAS e DAYOFF.
2. WHEN um `TipoFluxo` é salvo com categoria FERIAS THEN o system SHALL assumir a convenção de que `campos_formulario` contém os campos `data_inicio` e `data_fim` (tipo data) — convenção de chave a documentar em Design.
3. WHEN um `TipoFluxo` é salvo com categoria DAYOFF THEN o system SHALL assumir a convenção de que `campos_formulario` contém um campo `data` (tipo data, dia único).
4. WHEN um `TipoFluxo` de categoria FERIAS/DAYOFF não segue a convenção de chave esperada (campo ausente/renomeado) THEN o system SHALL pular a checagem de conflito para aquela `Solicitacao` (fallback gracioso) e não travar a geração do resumo.

**Independent Test**: RH_Admin cria um `TipoFluxo` "Férias" com categoria FERIAS e campos `data_inicio`/`data_fim`; confirma que fica disponível em Nova Solicitação; cria outro `TipoFluxo` "Reembolso" com categoria PADRAO e confirma que solicitações desse tipo nunca disparam checagem de conflito.

---

### P2: Persistência definitiva do resumo (sem recomputo)

**User Story**: Como solicitante, quero que o resumo da minha solicitação continue o mesmo ao longo do tempo, sem esperar recarregamento ou gastar uma nova chamada de IA a cada vez que eu abro a tela.

**Why P2**: Reforça o item 1.1 do pedido original; tecnicamente é uma consequência direta de P1 (resumo salvo em coluna), mas vale como história própria para deixar explícito que não há regeneração automática nem por tempo nem por releitura.

**Acceptance Criteria**:

1. WHEN o resumo de uma `Solicitacao` já foi gerado com sucesso THEN o system SHALL sempre reutilizar o texto salvo em qualquer leitura futura, independente de quanto tempo passou.
2. WHEN não existe mecanismo de edição de `Solicitacao` nesta feature THEN o system SHALL considerar o resumo salvo como definitivo para o ciclo de vida da `Solicitacao` (ver Out of Scope).

**Independent Test**: Gerar o resumo de uma `Solicitacao`, esperar alguns minutos, reabrir a tela múltiplas vezes e confirmar (via ausência de novo `Log`/nova chamada à OpenAI) que o texto exibido é sempre o mesmo, vindo do banco.

---

## Edge Cases

- WHEN duas `Solicitacao` de Férias se sobrepõem parcialmente (ex: A: 10–20, B: 15–25) THEN o system SHALL considerar conflito (interseção de intervalo, não exige igualdade exata de datas).
- WHEN a `Solicitacao` concorrente está `REJEITADA` THEN o system SHALL ignorá-la — não conta como "programada".
- WHEN falha a busca de colegas de equipe (erro de banco) durante a geração do resumo THEN o system SHALL gerar o resumo sem a checagem de conflito e gravar `Log` tipo `ERRO`, sem quebrar a criação da `Solicitacao`.
- WHEN o campo `data_inicio`/`data_fim`/`data` vem ausente ou malformado nos `dados`, apesar do `TipoFluxo` ser FERIAS/DAYOFF THEN o system SHALL pular a checagem de conflito graciosamente (sem erro visível ao usuário).
- WHEN o próprio solicitante tem duas `Solicitacao` de Férias/Day Off sobrepostas (consigo mesmo) THEN fora de escopo desta feature — a checagem é só entre membros diferentes da equipe.
- WHEN a requisição de leitura do resumo chega sem usuário autenticado THEN o system SHALL negar o acesso (delegado a `autenticacao-usuarios`), mesma regra de `solicitacoes`.

---

## Requirement Traceability

Cada requisito recebe um ID único para rastreio entre design, tasks e validação.

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| RIA-01 | P1: Resumo de IA (geração e persistência na criação) | Design | Pending |
| RIA-02 | P1: Resumo de IA (exibição usa resumo salvo, sem nova chamada) | Design | Pending |
| RIA-03 | P1: Resumo de IA (fallback "indisponível") | Design | Pending |
| RIA-04 | P1: Resumo de IA (falha grava Log ERRO, não trava criação) | Design | Pending |
| RIA-05 | P1: Resumo de IA (visibilidade restrita ao próprio solicitante) | Design | Pending |
| RIA-06 | P1: Alerta de conflito (busca colegas de equipe, mesma categoria, status APROVADA/PENDENTE) | Design | Pending |
| RIA-07 | P1: Alerta de conflito (menciona conflito quando há sobreposição) | Design | Pending |
| RIA-08 | P1: Alerta de conflito (sem menção quando não há sobreposição) | Design | Pending |
| RIA-09 | P1: Alerta de conflito (pula checagem se solicitante sem equipe) | Design | Pending |
| RIA-10 | P1: Alerta de conflito (só roda para categoria FERIAS/DAYOFF) | Design | Pending |
| RIA-11 | P1: Categoria de TipoFluxo (campo categoria PADRAO/FERIAS/DAYOFF) | Design | Pending |
| RIA-12 | P1: Categoria de TipoFluxo (convenção data_inicio/data_fim p/ FERIAS) | Design | Pending |
| RIA-13 | P1: Categoria de TipoFluxo (convenção data p/ DAYOFF) | Design | Pending |
| RIA-14 | P1: Categoria de TipoFluxo (fallback gracioso se convenção não seguida) | Design | Pending |
| RIA-15 | P2: Persistência definitiva (reutiliza resumo salvo sempre) | Design | Pending |
| RIA-16 | Edge: interseção parcial de datas conta como conflito | Design | Pending |
| RIA-17 | Edge: Solicitacao REJEITADA não conta como programada | Design | Pending |
| RIA-18 | Edge: falha ao buscar equipe não quebra criação | Design | Pending |
| RIA-19 | Edge: campo de data ausente/malformado pula checagem | Design | Pending |

**ID format:** `RIA-[NUMBER]`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 19 total, 0 mapeados a tasks, 19 não mapeados ⚠️ (esperado nesta fase Specify).

---

## Success Criteria

Como saberemos que a feature está bem-sucedida:

- [ ] 100% das `Solicitacao` criadas com sucesso têm um resumo de IA gerado (ou uma falha registrada em `Log`) sem bloquear a criação.
- [ ] Expandir a mesma linha múltiplas vezes nunca dispara nova chamada à OpenAI — o resumo vem sempre do banco.
- [ ] Dois solicitantes da mesma equipe com férias/day off sobrepostos veem o alerta de conflito nas suas respectivas solicitações; um terceiro sem sobreposição não vê.
- [ ] `TipoFluxo` de categoria PADRAO (ex: Reembolso, Vaga) nunca dispara checagem de conflito.
- [ ] Falha simulada da OpenAI não impede a criação da `Solicitacao` nem quebra a tela "Minhas Solicitações".

---

## Questões em Aberto

Zonas cinzentas relevantes para decisão do usuário, discutidas nesta sessão:

1. ✅ **RESOLVIDO** (ver `context.md`) — **Onde o resumo aparece**: expande na linha da tabela existente (não vira cards).
2. ✅ **RESOLVIDO** (ver `context.md`) — **Como identificar Férias/Day Off**: novo campo `categoria` em `TipoFluxo`, com convenção de chave de campo (`data_inicio`/`data_fim` para FERIAS, `data` para DAYOFF).
3. ✅ **RESOLVIDO** (ver `context.md`) — **Quais status contam como "programada"**: `APROVADA` + `PENDENTE`.
4. ✅ **RESOLVIDO** (ver `context.md`) — **Regra de "só refaz se editado"**: sem função de editar `Solicitacao` nesta feature; resumo é gerado 1x na criação e fica definitivo.
5. **Privacidade do alerta**: o resumo deve citar o nome do colega em conflito, ou só um alerta genérico ("outro membro da sua equipe")? Assumido nesta spec como **genérico, sem nome** (menor exposição de dados de terceiros) — a confirmar em Design se o usuário quiser o nome explícito.
6. **Onde persistir o resumo**: novo campo em `Solicitacao` (ex: `resumo_ia_solicitante`) vs. reaproveitar algo de `Aprovacao.resumo_ia` (que é por etapa/aprovador, não do solicitante). Não decidido aqui — fica para Design, pois é decisão de schema/camada de dados.
