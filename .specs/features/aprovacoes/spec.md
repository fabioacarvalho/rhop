# Aprovações (APR) — Especificação de Feature

> Feature 4 do FluxoRH — **hero feature de IA** do projeto. Fonte da verdade: `docs/2026-07-30-fluxorh-design.md` (telas 4, 6.1–6.4; seções 4, 8, 11) e `CLAUDE.md` (regras invioláveis).
> Features vizinhas referenciadas (sem duplicar o detalhe delas): `autenticacao-usuarios` (User, `role`, `gestor_id`), `solicitacoes` (criação da `Solicitacao`, `etapa_atual`, detalhe completo), `configuracao-fluxos` (`TipoFluxo.etapas`), `notificacoes` (envio ao próximo aprovador), `sla-cobranca` (atraso/cobrança), `auditoria-logs` (contrato do `Log`).

## Problem Statement

Aprovadores (Gestor e RH) recebem solicitações de RH sem contexto pronto: precisam investigar cada pedido antes de decidir, o que atrasa o fluxo. Não há uma fila única do que está pendente **para aquele aprovador especificamente**, nem garantia de que só o responsável correto da etapa atual consiga decidir. Esta feature entrega a tela de Aprovações Pendentes com um **resumo gerado por IA** em destaque e a decisão (aprovar/rejeitar) autorizada e auditada no backend.

## Goals

- [ ] Aprovador vê sua fila de pendências e decide (aprovar/rejeitar com comentário opcional) em segundos, apoiado por um `resumo_ia` em destaque.
- [ ] Nenhuma decisão passa sem autorização de backend: só o aprovador da etapa atual (papel = `aprovador_role` da etapa e, se `GESTOR`, gestor do solicitante) consegue decidir — 100% das decisões bloqueadas quando o autor não é elegível.
- [ ] Ao entrar numa nova etapa, o sistema gera o `resumo_ia` via OpenAI (`gpt-4o-mini`, server-side) — e uma falha de IA **nunca** trava o fluxo (a solicitação avança sem resumo, com `Log` tipo `ERRO`).
- [ ] Toda decisão e toda transição de status geram `Log` tipo `AUDITORIA`; registra-se uma linha de `Aprovacao` por etapa percorrida.

## Out of Scope

Explicitamente excluído para prevenir scope creep.

| Feature | Motivo |
| --- | --- |
| Múltiplos aprovadores em paralelo na mesma etapa | Fora de escopo do MVP (design doc seção 10) — apenas aprovador sequencial, um por etapa. |
| Envio efetivo da notificação ao próximo aprovador | Pertence a `notificacoes`. Aqui só se emite o evento "avançou de etapa" como gatilho. |
| Criação da `Solicitacao` e renderização do formulário/detalhe completo | Pertence a `solicitacoes`. Aqui a `Solicitacao` já existe e está numa etapa. |
| Job periódico de SLA/atraso/cobrança | Pertence a `sla-cobranca`. A fila pode exibir `prazo_sla`, mas a lógica de atraso não é desta feature. |
| Schema e tela do `Log` | Pertence a `auditoria-logs`. Aqui apenas se **escreve** `Log` (AUDITORIA/ERRO) via `logService`. |
| CRUD de `TipoFluxo` e definição das etapas | Pertence a `configuracao-fluxos`. Aqui as `etapas` são apenas lidas para avançar o fluxo. |
| Reprocessamento manual do `resumo_ia` pelo aprovador | Não previsto no design doc — ver `## Questões em Aberto`. |

---

## User Stories

### P1: Ver e decidir na fila de Aprovações Pendentes ⭐ MVP

**User Story**: Como **Gestor ou RH_Admin**, quero ver minhas solicitações pendentes em cards com o resumo de IA em destaque e aprovar/rejeitar com um comentário opcional, para decidir rapidamente sem investigar cada pedido.

**Why P1**: É a tela-destaque do pitch (hero screen) e o ponto de entrada de todo o valor da feature. Sem ela não há como aprovar nada.

**Acceptance Criteria**:

1. WHEN um aprovador autenticado abre "Aprovações Pendentes" THEN o sistema SHALL listar apenas as `Solicitacao` em que ele é o aprovador da etapa atual, cada uma como um card exibindo o `resumo_ia` em destaque (APR-01).
2. WHEN o card é renderizado THEN o sistema SHALL oferecer um link para os detalhes completos da solicitação (detalhe é renderizado por `solicitacoes`) (APR-02).
3. WHEN o aprovador clica "Aprovar" THEN o sistema SHALL registrar a decisão com um comentário **opcional** e processar o avanço do fluxo (ver P1: Avanço/encerramento) (APR-03).
4. WHEN o aprovador clica "Rejeitar" THEN o sistema SHALL registrar a decisão com um comentário **opcional** e encerrar a solicitação (ver P1: Avanço/encerramento) (APR-04).
5. WHEN o usuário é `GESTOR` THEN a fila SHALL conter somente solicitações da equipe dele (solicitante com `gestor_id` apontando para ele) cuja `etapa_atual` exige `GESTOR`; WHEN o usuário é `RH_ADMIN` THEN a fila SHALL conter todas as solicitações cuja `etapa_atual` exige `RH_ADMIN` (APR-05).
6. WHEN o `resumo_ia` da etapa atual está ausente (IA falhou/pendente) THEN o card SHALL exibir um indicador de "resumo indisponível" e continuar oferecendo os dados brutos e as ações Aprovar/Rejeitar (APR-14).

**Independent Test**: Logar como Gestor com uma solicitação da equipe na etapa `GESTOR`; ver o card com resumo; aprovar com comentário; confirmar que a solicitação sai da fila. Logar como RH_Admin e ver a fila com todas as solicitações em etapa RH.

---

### P1: Autorização de decisão no backend ⭐ MVP

**User Story**: Como **empresa**, quero que somente o aprovador correto da etapa atual consiga aprovar/rejeitar, para que a segregação de responsabilidades não dependa de esconder botões no frontend.

**Why P1**: Regra inviolável do `CLAUDE.md` ("Autorização de aprovação") — a barreira precisa existir no backend desde o MVP.

**Acceptance Criteria**:

1. WHEN uma decisão (aprovar/rejeitar) é submetida THEN o backend SHALL verificar que a `role` do usuário autenticado é igual ao `aprovador_role` da `etapa_atual` da solicitação, rejeitando com erro de autorização caso contrário (APR-06).
2. WHEN a `etapa_atual` exige `GESTOR` THEN o backend SHALL exigir adicionalmente que o usuário seja o gestor do solicitante (`solicitante.gestor_id == usuario.id`), rejeitando caso contrário — mesmo que a `role` seja `GESTOR` (APR-07).
3. WHEN um usuário tenta decidir uma solicitação que não está na etapa dele, ou que já foi decidida/encerrada THEN o backend SHALL bloquear a decisão e não alterar o estado da solicitação (APR-08).
4. WHEN a verificação de autorização falha THEN o sistema SHALL bloquear no backend independentemente do que o frontend exibe (o esconder do botão é conveniência, não a barreira) (APR-06/APR-07).

**Independent Test**: Como Gestor de outra equipe, chamar a rota de decisão sobre uma solicitação de equipe alheia → bloqueado. Como Gestor correto de papel mas não gestor do solicitante → bloqueado. Como RH em etapa que exige Gestor → bloqueado.

---

### P1: Avanço sequencial de etapa e encerramento do fluxo ⭐ MVP

**User Story**: Como **aprovador**, quero que aprovar leve a solicitação para a próxima etapa (ou a finalize) e rejeitar a encerre, para que o fluxo caminhe de forma previsível e rastreável.

**Why P1**: Sem transição de estado a decisão não produz efeito — é o núcleo do fluxo de aprovação.

**Acceptance Criteria**:

1. WHEN uma decisão válida é registrada THEN o sistema SHALL gravar uma linha de `Aprovacao` (`solicitacao_id`, `etapa`, `aprovador_role`, `aprovador_id`, `decisao`, `resumo_ia` da etapa, `decidido_em`) — uma linha por etapa percorrida (APR-09).
2. WHEN o aprovador **aprova** e existe etapa seguinte THEN o sistema SHALL avançar `etapa_atual` para a próxima etapa da lista `TipoFluxo.etapas`, mantendo status "Pendente", e emitir o evento "avançou de etapa" (gatilho consumido por `notificacoes`) (APR-10).
3. WHEN o aprovador **aprova** e a etapa atual é a última THEN o sistema SHALL definir o status da solicitação como "Aprovado" e não criar nova etapa (APR-10).
4. WHEN o aprovador **rejeita** em qualquer etapa THEN o sistema SHALL definir o status como "Rejeitado" e encerrar o fluxo (não há avanço) (APR-11).
5. WHEN qualquer decisão é registrada ou o status transiciona THEN o sistema SHALL gravar `Log` tipo `AUDITORIA` via `logService` (contrato em `auditoria-logs`), contendo entidade/ação/usuário/decisão (APR-12).

**Independent Test**: Solicitação tipo Vaga com etapas `[GESTOR, RH_ADMIN]`: Gestor aprova → `etapa_atual` vira `RH_ADMIN`, status "Pendente", `Aprovacao` da etapa 1 gravada, `Log AUDITORIA` gravado. RH aprova → status "Aprovado". Em outra solicitação, Gestor rejeita → status "Rejeitado".

---

### P1: Geração do `resumo_ia` por IA com fallback resiliente ⭐ MVP

**User Story**: Como **aprovador**, quero receber junto da solicitação um resumo de IA que destaque contexto, urgência e dados-chave, para decidir em segundos — e como **empresa**, quero que uma falha de IA nunca trave o fluxo.

**Why P1**: É a **hero feature de IA** do pitch e depende de uma regra inviolável do `CLAUDE.md` ("IA nunca pode travar o fluxo").

**Acceptance Criteria**:

1. WHEN uma solicitação entra numa nova etapa (na criação — disparada por `solicitacoes` — ou ao avançar de etapa) THEN uma API route server-side SHALL montar um prompt com os `dados` da solicitação + contexto do `TipoFluxo`, chamar a OpenAI (`gpt-4o-mini`) e salvar o texto em `Aprovacao.resumo_ia` da etapa corrente (APR-13).
2. WHEN a chamada à OpenAI é feita THEN ela SHALL ocorrer **apenas** em código server-side (nunca no client) e a chave nunca SHALL ser exposta ao frontend (APR-13).
3. WHEN a chamada à OpenAI falha (timeout, erro, rate limit) THEN o sistema SHALL deixar a solicitação seguir seu curso normalmente **sem** `resumo_ia` (aprovador vê os dados brutos) e SHALL gravar um `Log` tipo `ERRO` via `logService` (contrato em `auditoria-logs`) (APR-14, APR-15).
4. WHEN a geração de IA está em andamento ou falhou THEN a criação/avanço da solicitação SHALL **não** ser bloqueada por ela (a geração é resiliente e desacoplada do sucesso da transição) (APR-14).

**Independent Test**: Com chave OpenAI válida, avançar uma etapa → `Aprovacao.resumo_ia` populado e visível no card. Simular falha da OpenAI (chave inválida/timeout) → solicitação ainda avança, card mostra "resumo indisponível", e um `Log ERRO` é gravado.

---

### P2: Histórico de decisões da solicitação

**User Story**: Como **aprovador ou RH_Admin**, quero ver as etapas já percorridas de uma solicitação (quem decidiu, decisão, comentário, resumo da época), para entender o caminho da aprovação.

**Why P2**: Reforça a rastreabilidade e a narrativa de "nada se perde", mas não é necessário para o fluxo mínimo aprovar→avançar funcionar.

**Acceptance Criteria**:

1. WHEN um usuário com visibilidade sobre a solicitação abre seu histórico THEN o sistema SHALL listar as `Aprovacao` percorridas em ordem de etapa, com `aprovador_role`, quem decidiu, `decisao`, `decidido_em` e o `resumo_ia` daquela etapa (APR-16).
2. WHEN o usuário não tem visibilidade sobre a solicitação (regra de visibilidade do `CLAUDE.md`) THEN o sistema SHALL negar o acesso ao histórico (APR-16).

**Independent Test**: Após uma solicitação percorrer Gestor→RH, abrir seu histórico como RH_Admin e ver duas linhas de `Aprovacao` com decisões e resumos.

---

### P3: Estado vazio e contexto da fila

**User Story**: Como **aprovador**, quero um estado vazio claro quando não há pendências, para não confundir "sem pendências" com "erro de carregamento".

**Why P3**: Polimento de UX; não altera regra de negócio.

**Acceptance Criteria**:

1. WHEN a fila de Aprovações Pendentes do usuário está vazia THEN o sistema SHALL exibir uma mensagem de estado vazio ("Nenhuma aprovação pendente") em vez de uma lista em branco (APR-17).

---

## Edge Cases

- WHEN dois cliques/decisões concorrentes chegam para a mesma etapa THEN o sistema SHALL aplicar apenas a primeira e rejeitar a segunda (idempotência via `etapa_atual`/`decisao` já registrada) — sem dupla transição (APR-08).
- WHEN a `etapa_atual` exige `GESTOR` mas o solicitante não tem `gestor_id` definido THEN não há aprovador elegível; o sistema SHALL tratar como não-autorizado para qualquer usuário e a situação SHALL ser prevenida na criação por `solicitacoes` (design doc seção 8) — esta feature não "adivinha" um aprovador (APR-07).
- WHEN o comentário opcional excede um tamanho máximo razoável THEN o backend SHALL validar (Zod) e rejeitar com erro de validação claro, sem gravar decisão (APR-03/APR-04).
- WHEN a solicitação já está "Aprovado" ou "Rejeitado" THEN qualquer nova decisão SHALL ser bloqueada (APR-08).
- WHEN a OpenAI retorna conteúdo vazio/inválido THEN o sistema SHALL tratar como ausência de `resumo_ia` (mesmo caminho de fallback) e gravar `Log ERRO` (APR-14/APR-15).
- WHEN o `resumo_ia` ainda não foi gerado no instante em que o aprovador abre a fila THEN o card SHALL permitir decidir mesmo assim (a decisão não depende do resumo) (APR-14).

---

## Requirement Traceability

Cada requisito recebe um ID único para rastreio entre design, tasks e validação.

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| APR-01 | P1: Fila de Aprovações Pendentes | Design | Pending |
| APR-02 | P1: Fila de Aprovações Pendentes | Design | Pending |
| APR-03 | P1: Fila de Aprovações Pendentes | Design | Pending |
| APR-04 | P1: Fila de Aprovações Pendentes | Design | Pending |
| APR-05 | P1: Fila de Aprovações Pendentes (visibilidade) | Design | Pending |
| APR-06 | P1: Autorização de decisão (backend) | Design | Pending |
| APR-07 | P1: Autorização de decisão (backend, gestor do solicitante) | Design | Pending |
| APR-08 | P1: Autorização de decisão (etapa/idempotência) | Design | Pending |
| APR-09 | P1: Avanço/encerramento (registro de `Aprovacao`) | Design | Pending |
| APR-10 | P1: Avanço/encerramento (aprovar → avança/finaliza) | Design | Pending |
| APR-11 | P1: Avanço/encerramento (rejeitar → encerra) | Design | Pending |
| APR-12 | P1: Avanço/encerramento (`Log AUDITORIA`) → `auditoria-logs` | Design | Pending |
| APR-13 | P1: Geração de `resumo_ia` (OpenAI server-side) | Design | Pending |
| APR-14 | P1: Fallback resiliente de IA | Design | Pending |
| APR-15 | P1: `Log ERRO` na falha de IA → `auditoria-logs` | Design | Pending |
| APR-16 | P2: Histórico de decisões da solicitação | - | Pending |
| APR-17 | P3: Estado vazio da fila | - | Pending |

**ID format:** `APR-[NUMBER]`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 17 total, 0 mapeados para tasks, 17 não-mapeados ⚠️ (mapeamento ocorre na fase Tasks)

---

## Success Criteria

Como sabemos que a feature teve sucesso:

- [ ] Um aprovador consegue abrir a fila, ler o `resumo_ia` e decidir (aprovar/rejeitar com comentário opcional) em menos de 1 minuto por solicitação.
- [ ] 100% das tentativas de decisão por usuário não-elegível (papel errado, etapa errada, gestor errado, solicitação já encerrada) são bloqueadas no backend.
- [ ] Aprovar avança sequencialmente até a última etapa e então marca "Aprovado"; rejeitar marca "Rejeitado" — com uma linha de `Aprovacao` por etapa percorrida.
- [ ] Toda decisão e transição de status gera `Log AUDITORIA`; toda falha de IA gera `Log ERRO` (verificável na tela de `auditoria-logs`).
- [ ] Com a OpenAI indisponível, nenhuma solicitação fica travada: 0 falhas de fluxo atribuíveis à IA; o card mostra dados brutos + "resumo indisponível".
- [ ] `npm run build` e `npx prisma validate` passam; o cenário de autorização é descrito manualmente no resumo da tarefa (ex.: "Gestor de outra equipe tentou aprovar → bloqueado").

---

## Questões em Aberto

Zonas cinzentas relevantes para decisão do usuário (não assumidas nesta spec):

1. **Reprocessar `resumo_ia` manualmente:** o design doc só prevê geração automática ao entrar na etapa. Quando a IA falha e o card mostra "resumo indisponível", deve existir um botão para o aprovador tentar gerar o resumo de novo? (Fora de escopo por ora — candidato a P3 se desejado.)
2. **Comentário obrigatório na rejeição:** o design doc diz "comentário opcional" para ambas as ações. Faz sentido tornar o comentário **obrigatório** ao rejeitar (para justificar a recusa ao solicitante)? Mantido como opcional conforme a spec atual.
3. **Rótulo de status "atrasado" na fila:** a solicitação atrasada é marcada por `sla-cobranca`. A fila de Aprovações Pendentes deve exibir visualmente o indicador de atraso/`prazo_sla`, ou isso fica só no Dashboard (`dashboard-visao-geral`)? (Exibição, não a lógica de atraso.)
4. **Momento exato da 1ª geração de `resumo_ia`:** na criação (etapa 1) a geração é disparada pelo fluxo de `solicitacoes` chamando esta feature, ou por esta feature reagindo ao evento de criação? Depende de contrato a alinhar com `solicitacoes`.
