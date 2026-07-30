# Auditoria e Logs Specification

> Feature 9 — slug `auditoria-logs`, prefixo de Requirement ID `AUD`.
> Fonte da verdade: `docs/2026-07-30-fluxorh-design.md` (seções 4, 5.8, 8, 9) e `CLAUDE.md` (Regras de negócio invioláveis).

## Problem Statement

Nos processos manuais de RH atuais, decisões e falhas se perdem: ninguém sabe quem aprovou o quê, quando um status mudou, ou por que uma notificação/IA falhou silenciosamente. O FluxoRH precisa de um registro único e consultável — a entidade `Log` — que capture toda transição de negócio (AUDITORIA) e toda falha técnica (ERRO), garantindo a narrativa central do produto: **"nada se perde silenciosamente"**. Sem isso, o RH não consegue rastrear responsabilidade nem diagnosticar problemas.

## Goals

- [ ] Todo evento de auditoria e erro definido pelas features de origem é persistido de forma consistente num único modelo `Log`, sem eventos perdidos silenciosamente.
- [ ] RH_Admin consegue localizar qualquer evento por tipo, entidade, usuário e período em segundos, numa tela dedicada.
- [ ] A gravação de um log nunca derruba nem bloqueia o fluxo de negócio que o originou (resiliência do registro).

## Out of Scope

Explicitamente excluído. Documentado para evitar scope creep.

| Feature | Reason |
| ------- | ------ |
| Lógica de negócio que decide *quando* gravar cada log | Pertence a cada feature de origem (`solicitacoes`, `aprovacoes`, `configuracao-fluxos`, `notificacoes`, `painel-insights`). Esta feature especifica só o contrato de gravação e a consulta. |
| Contadores/dashboards operacionais (pendentes, atrasados, aprovados) | É `dashboard-visao-geral`. A tela de auditoria é para rastreabilidade, não para métricas de negócio. |
| Exportação de logs (CSV/PDF) | Não consta no design doc; candidato a próximos passos. |
| Retenção, expurgo ou rotação de logs | Não consta no design doc; MVP assume persistência simples. Ver Questões em Aberto. |
| Alertas/notificações disparados a partir de logs `ERRO` | Notificação de fluxo é `notificacoes`; alertar operador a partir de erro não está no escopo do MVP. |
| Edição ou exclusão de logs pela UI | Logs são imutáveis por natureza de auditoria. |
| Multi-empresa / segmentação de logs por tenant | Fora de escopo global do projeto (single-tenant). |

---

## User Stories

### P1: Registro centralizado de logs (contrato do `logService`) ⭐ MVP

**User Story**: Como cada service de negócio (solicitacoes, aprovacoes, configuracao-fluxos, notificacoes, painel-insights), quero um ponto único para persistir um log de AUDITORIA ou ERRO, para que todo evento relevante seja registrado com esquema consistente e sem acoplar cada feature à camada de dados de log.

**Why P1**: Sem o contrato de gravação, nenhuma outra feature consegue cumprir a regra inviolável do `CLAUDE.md` ("toda transição e decisão grava `AUDITORIA`; toda falha de IA/notificação grava `ERRO`"). É a fundação de que todas as features de origem dependem.

**Acceptance Criteria**:

1. WHEN um service chama o `logService` para registrar um evento THEN o sistema SHALL persistir um registro `Log` com os campos `tipo` (`AUDITORIA` | `ERRO`), `entidade`, `entidade_id`, `acao`, `usuario_id`, `detalhes` (JSON) e `criado_em`.
2. WHEN um evento é registrado sem informar `criado_em` THEN o sistema SHALL preencher `criado_em` automaticamente com o instante da gravação.
3. WHEN o evento é originado por um processo de sistema sem usuário autenticado (ex.: job de SLA, falha de IA em background) THEN o sistema SHALL aceitar `usuario_id` nulo/ausente e ainda assim gravar o log.
4. WHEN o `tipo` informado não for `AUDITORIA` nem `ERRO` THEN o sistema SHALL rejeitar a gravação como entrada inválida (contrato fechado a esses dois valores).
5. WHEN a gravação do log falha (ex.: banco indisponível) THEN o sistema SHALL conter a falha internamente e NÃO propagar exceção que interrompa o fluxo de negócio chamador.

**Independent Test**: Chamar `logService` a partir de um teste com um evento `AUDITORIA` e outro `ERRO`, e verificar que ambos os registros existem em `Log` com todos os campos corretos e `criado_em` preenchido; simular falha de banco e confirmar que o chamador não recebe exceção.

---

### P1: Consulta de auditoria filtrável — Tela 8 (RH_Admin) ⭐ MVP

**User Story**: Como RH_Admin, quero uma tabela de logs filtrável por tipo, entidade, usuário e período, para que eu possa rastrear o que aconteceu, quem fez, e investigar falhas técnicas quando algo dá errado.

**Why P1**: É a única superfície de consulta do log de auditoria/erro descrita no design doc (Tela 8). Sem ela, os registros existem mas ninguém consegue usá-los — a promessa de rastreabilidade não se cumpre.

**Acceptance Criteria**:

1. WHEN um usuário com papel `RH_ADMIN` acessa a tela de Auditoria/Logs THEN o sistema SHALL exibir uma tabela de registros `Log` ordenada por `criado_em` decrescente (mais recente primeiro), mostrando ao menos `criado_em`, `tipo`, `entidade`, `entidade_id`, `acao` e o usuário responsável.
2. WHEN um usuário com papel diferente de `RH_ADMIN` (SOLICITANTE ou GESTOR) tenta acessar a tela ou a API de consulta de logs THEN o sistema SHALL bloquear o acesso no backend (resposta de não autorizado), não apenas escondendo a tela no frontend.
3. WHEN o RH_Admin filtra por `tipo` (`AUDITORIA` ou `ERRO`) THEN o sistema SHALL retornar apenas os logs daquele tipo.
4. WHEN o RH_Admin filtra por `entidade` (ex.: `Solicitacao`, `TipoFluxo`, `Aprovacao`) THEN o sistema SHALL retornar apenas os logs daquela entidade.
5. WHEN o RH_Admin filtra por usuário THEN o sistema SHALL retornar apenas os logs cujo `usuario_id` corresponde ao usuário selecionado.
6. WHEN o RH_Admin filtra por período (data inicial e/ou final) THEN o sistema SHALL retornar apenas os logs cujo `criado_em` está dentro do intervalo informado.
7. WHEN mais de um filtro é aplicado simultaneamente THEN o sistema SHALL combiná-los de forma cumulativa (E lógico).

**Independent Test**: Autenticar como RH_Admin, popular alguns logs de tipos e entidades diferentes, aplicar cada filtro isoladamente e combinado, e verificar o conjunto retornado; autenticar como GESTOR e confirmar que a chamada à API de logs é bloqueada.

---

### P2: Detalhe de um evento de log

**User Story**: Como RH_Admin, quero abrir um registro de log e ver o conteúdo completo do campo `detalhes` (JSON), para que eu possa entender o contexto exato de uma decisão ou a causa raiz de uma falha.

**Why P2**: A tabela dá a visão geral; a investigação real (ex.: por que a chamada de IA falhou, qual payload gerou o erro) exige inspecionar `detalhes`. Importante, mas o MVP demonstra valor já com a lista filtrável.

**Acceptance Criteria**:

1. WHEN o RH_Admin abre o detalhe de um registro de log THEN o sistema SHALL exibir o conteúdo de `detalhes` (JSON) de forma legível, junto de todos os campos do registro.
2. WHEN o campo `detalhes` está vazio ou nulo THEN o sistema SHALL exibir o registro normalmente indicando ausência de detalhes adicionais, sem erro.

**Independent Test**: Abrir um log `ERRO` com `detalhes` populado e confirmar que o JSON é exibido de forma legível; abrir um log com `detalhes` nulo e confirmar exibição sem erro.

---

### P3: Paginação e ordenação da tabela de logs

**User Story**: Como RH_Admin, quero paginar e ordenar a lista de logs, para que a tela permaneça utilizável mesmo quando o volume de registros crescer.

**Why P3**: O volume de logs cresce continuamente, mas para a demo do hackathon a ordenação padrão por data já é suficiente; paginação é robustez incremental.

**Acceptance Criteria**:

1. WHEN o número de logs correspondentes aos filtros excede o tamanho de uma página THEN o sistema SHALL paginar os resultados, mantendo a ordenação por `criado_em` decrescente entre páginas.

**Independent Test**: Popular volume de logs acima do tamanho de página e verificar navegação entre páginas preservando a ordem.

---

## Edge Cases

- WHEN a gravação de um log falha (banco indisponível, timeout) THEN o sistema SHALL manter a operação de negócio principal (criar/avançar `Solicitacao`, aprovar, notificar) concluída normalmente, sem propagar a falha do log ao usuário.
- WHEN o registro de um log de `ERRO` ele próprio falha ao gravar THEN o sistema SHALL evitar recursão infinita (não tentar registrar um novo `ERRO` para a falha de gravar o `ERRO`).
- WHEN os filtros não correspondem a nenhum registro THEN o sistema SHALL exibir a tabela vazia com um estado claro ("nenhum log encontrado"), não um erro.
- WHEN o período informado tem data inicial posterior à final THEN o sistema SHALL tratar como entrada inválida e sinalizar ao usuário, sem executar a consulta.
- WHEN `detalhes` contém um JSON grande ou profundamente aninhado THEN o sistema SHALL exibi-lo de forma legível (sem quebrar o layout), truncando/expandindo conforme necessário.
- WHEN um evento de sistema sem usuário gera um log THEN o sistema SHALL exibir o responsável como "Sistema" (ou equivalente) na tela, dado `usuario_id` nulo.
- WHEN um `usuario_id` referenciado num log corresponde a um usuário posteriormente removido THEN o sistema SHALL ainda exibir o log (o registro de auditoria não depende da existência atual do usuário).

---

## Requirement Traceability

Cada requisito recebe um ID único para rastreamento em design, tasks e validação.

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| AUD-01 | P1: Registro centralizado (`logService`) | Design | Pending |
| AUD-02 | P1: Registro centralizado (`logService`) | Design | Pending |
| AUD-03 | P1: Registro centralizado (`logService`) | Design | Pending |
| AUD-04 | P1: Registro centralizado (`logService`) | Design | Pending |
| AUD-05 | P1: Consulta de auditoria (Tela 8) | Design | Pending |
| AUD-06 | P1: Consulta de auditoria (Tela 8) | Design | Pending |
| AUD-07 | P1: Consulta de auditoria (Tela 8) | Design | Pending |
| AUD-08 | P1: Consulta de auditoria (Tela 8) | Design | Pending |
| AUD-09 | P1: Consulta de auditoria (Tela 8) | Design | Pending |
| AUD-10 | P2: Detalhe de um evento de log | - | Pending |
| AUD-11 | P3: Paginação e ordenação | - | Pending |

**Detalhamento dos IDs:**

- **AUD-01** — Modelo `Log` com esquema completo (`id`, `tipo`, `entidade`, `entidade_id`, `acao`, `usuario_id`, `detalhes` JSON, `criado_em`) e ponto único de gravação via `logService`, aceitando os tipos `AUDITORIA` e `ERRO`.
- **AUD-02** — `criado_em` preenchido automaticamente na gravação.
- **AUD-03** — Falha ao gravar log é contida e não interrompe o fluxo de negócio chamador (resiliência).
- **AUD-04** — `usuario_id` opcional para eventos de sistema; `tipo` restrito a `AUDITORIA`/`ERRO`.
- **AUD-05** — Acesso à tela e à API de logs restrito a `RH_ADMIN`, bloqueado no backend.
- **AUD-06** — Filtro por `tipo`.
- **AUD-07** — Filtro por `entidade` e por usuário.
- **AUD-08** — Filtro por período (`criado_em` entre datas).
- **AUD-09** — Listagem ordenada por `criado_em` desc exibindo campos-chave.
- **AUD-10** — Detalhe de um log exibe `detalhes` (JSON) completo e legível.
- **AUD-11** — Paginação preservando ordenação.

**ID format:** `AUD-[NUMBER]`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 11 total, 0 mapeados para tasks, 11 pendentes de design ⚠️

---

## Success Criteria

Como sabemos que a feature teve sucesso:

- [ ] **Nada se perde silenciosamente**: todo evento definido pelas features de origem (transição de status de `Solicitacao`, decisão de aprovação/rejeição, edição de `TipoFluxo`, falha de IA, falha de notificação/e-mail) tem um registro correspondente em `Log`.
- [ ] Somente RH_Admin acessa a tela de Auditoria/Logs; SOLICITANTE e GESTOR são bloqueados no backend.
- [ ] RH_Admin localiza um evento específico combinando os filtros de tipo, entidade, usuário e período.
- [ ] Nenhuma falha de gravação de log interrompe uma criação ou avanço de `Solicitacao`, aprovação ou notificação.
- [ ] Todo registro `Log` tem `tipo`, `entidade`, `entidade_id`, `acao` e `criado_em` preenchidos (registro completo e consistente).

---

## Questões em Aberto

Zonas cinzentas relevantes para o usuário decidir antes/durante o Design (não assumidas nesta spec):

1. **Retenção/volume de logs**: o design doc não define política de retenção nem expurgo. Assumi persistência simples e paginação como P3. Confirmar se o MVP precisa de qualquer política de retenção ou se cresce indefinidamente.
2. **Padronização do shape de `detalhes`**: o campo é JSON livre por design (flexível por evento). Confirmar se esta feature deve especificar um shape mínimo comum (ex.: `{ mensagem, contexto, erro }`) para uniformizar, ou se cada feature de origem define seu próprio conteúdo sem contrato.
3. **Exibição do usuário na tela**: mostrar nome/e-mail do usuário (join com `User`) em vez do `usuario_id` cru é mais útil, e foi assumido nos critérios. Confirmar se é aceitável esse join na tela de logs.
4. **Filtro por `entidade_id` específico**: o design doc cita filtro por "entidade" (o tipo), não por `entidade_id`. Não incluí busca por um registro específico (ex.: todos os logs de uma `Solicitacao` X). Confirmar se essa navegação é desejável no MVP.
5. **Filtro por `acao`**: o design doc lista apenas tipo, entidade, usuário e período como filtros. Mantive estritamente esses quatro. Confirmar se filtrar por `acao` também é desejado.
