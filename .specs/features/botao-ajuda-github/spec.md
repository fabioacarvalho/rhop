# Botão de Ajuda com Abertura de Issue no GitHub Specification

> Feature slug: `botao-ajuda-github` — Requirement ID prefix: `HELP`
> Fonte: `docs/prd/2026-07-31-prd-botao-ajuda-github.md`. Feature complementar, **fora do escopo original** do `docs/2026-07-30-fluxorh-design.md`.

> ⚠️ **Nota de escopo (herdada do PRD).** Esta feature não estava prevista no design doc original. Conforme `CLAUDE.md` ("não reinterprete ou expanda o escopo definido lá sem confirmar antes"), este spec documentou originalmente a V1 (redirect client-side). **Atualização:** o usuário pediu explicitamente a evolução para V2 (criação da issue direto via API do GitHub, sem interação com a página do GitHub) — ver Questão em Aberto 1, resolvida. Este documento agora descreve a **V2 como implementação atual**; a V1 fica registrada como histórico/superada.

## Problem Statement

Hoje, se um solicitante, gestor ou RH_Admin encontra um bug ou tem uma sugestão enquanto usa o FluxoRH, não há canal dentro do próprio produto para registrar isso. O relato acaba indo por WhatsApp, e-mail ou verbalmente para o time, sem contexto técnico (tela, papel, solicitação) e sem rastreabilidade.

## Goals

- [ ] Dar a qualquer usuário autenticado um jeito de reportar um problema ou sugestão sem sair do fluxo de trabalho.
- [ ] Transformar esse relato em uma issue no GitHub do projeto, já com contexto técnico mínimo (tela atual, tipo do problema, papel de quem relatou).
- [ ] Garantir que o corpo da issue nunca inclua dado sensível (nome completo, e-mail, dados de uma `Solicitacao`).
- [ ] Garantir que qualquer falha no fluxo de ajuda (ex.: pop-up bloqueado) nunca trave o restante do produto.

## Out of Scope

Explicitamente excluído desta versão (V2). Documentado para prevenir scope creep.

| Feature | Motivo |
| --- | --- |
| Redirect client-side (`window.open` para `.../issues/new`) | Era a V1 — **superada**. O usuário pediu explicitamente que a issue seja criada sem interação com a página do GitHub; o fluxo agora é 100% via API server-side. |
| Edição, comentário ou fechamento de issues de dentro do FluxoRH | Gerenciamento de issue é feito no GitHub, não no produto. |
| Sincronizar de volta o status da issue (ex.: "resolvido") para o FluxoRH | Exigiria integração bidirecional; não previsto. |
| Anexar prints/arquivos ao relato | Projeto não suporta upload de anexos em nenhum fluxo (design doc, seção 10). |
| Suporte a mais de um repositório de destino | Um único `GITHUB_REPO` fixo por ambiente. |
| Distinção de permissão para abrir relato | Todo usuário autenticado (`SOLICITANTE`, `GESTOR`, `RH_ADMIN`) pode reportar, sem checagem de papel. |
| Rate limiting sofisticado (por IP, captcha, etc.) | Limite simples de 5 relatos/usuário/dia via contagem no Postgres — suficiente para o hackathon (PRD, seção 9). |

---

## User Stories

### P1: Reportar problema ou sugestão pelo botão de ajuda flutuante ⭐ MVP

**User Story**: Como usuário autenticado (qualquer papel), quero clicar em um botão de ajuda visível em qualquer tela, preencher o relato e ter a issue já criada no GitHub automaticamente — sem precisar interagir com a página do GitHub — para relatar um problema sem sair do meu fluxo de trabalho.

**Why P1**: É a feature inteira — sem o botão, o modal e a criação automática da issue não há valor entregue.

**Acceptance Criteria**:

1. WHEN o usuário autenticado está em qualquer tela do FluxoRH THEN o sistema SHALL exibir um botão flutuante fixo ("?").
2. WHEN o usuário está na tela de login (não autenticado) THEN o sistema SHALL NOT exibir o botão de ajuda.
3. WHEN o usuário clica no botão "?" THEN o sistema SHALL abrir um modal com: seletor de tipo do relato (`Bug` / `Melhoria` / `Dúvida`), campo de título, campo de descrição, e a tela atual exibida em modo somente leitura (ex.: "Aprovações Pendentes").
4. WHEN o usuário preenche tipo, título e descrição e clica em "Abrir issue no GitHub" THEN o sistema SHALL enviar os dados para `POST /api/feedback`, que SHALL criar a issue via REST API do GitHub (`POST /repos/{repo}/issues`) usando um token de bot server-side — **sem** abrir nenhuma aba nem exigir que o usuário tenha conta no GitHub.
5. WHEN a issue é criada com sucesso THEN o sistema SHALL exibir, dentro do próprio modal, uma confirmação com o número da issue e um link opcional para visualizá-la (`target="_blank"`), e SHALL limpar os campos de título e descrição.
6. WHEN o usuário não preenche um título e tenta enviar THEN o sistema SHALL usar o título padrão `"(sem título)"` em vez de bloquear o envio.
7. WHEN o usuário clica em "Cancelar" ou clica fora do modal (antes de enviar) THEN o sistema SHALL fechar o modal sem enviar nada.

**Independent Test**: Autenticado com qualquer papel, em qualquer tela, abrir o modal, preencher tipo/título/descrição e confirmar → sem sair do FluxoRH, o modal mostra "Issue #N criada" com link para a issue real no GitHub; testar cancelar e clique fora → modal fecha sem nenhuma chamada de rede.

---

### P2: Corpo da issue nunca contém dado sensível

**User Story**: Como responsável pela privacidade dos dados do FluxoRH, quero que o relato gerado automaticamente nunca inclua nome completo, e-mail ou dados de uma `Solicitacao`, para que a issue possa ficar visível a mais gente do que o RH interno sem vazar informação sensível.

**Why P2**: É uma regra de segurança explícita do PRD (seção 6) — não é o fluxo feliz, mas bloqueia o "pronto" se violada.

**Acceptance Criteria**:

1. WHEN o sistema monta o título e o corpo da issue THEN o corpo SHALL conter apenas: tipo do relato, nome da tela, papel do usuário e a descrição digitada — e SHALL NOT incluir e-mail, nome completo ou qualquer campo de `dados` de uma `Solicitacao`.
2. WHEN o modal é exibido THEN o sistema SHALL mostrar um aviso curto e visível: "não inclua dados pessoais ou de solicitações específicas".

**Independent Test**: Preencher o modal com uma descrição qualquer e confirmar → inspecionar a URL/corpo gerado e confirmar ausência de e-mail, nome completo ou qualquer dado de `Solicitacao`; conferir visualmente que o aviso aparece no modal.

---

### P2: Falha na criação da issue nunca trava o restante do produto

**User Story**: Como usuário do FluxoRH, quero que uma falha ao criar a issue (token inválido, GitHub fora do ar, limite diário atingido) nunca impeça o uso do resto do produto, para que essa feature auxiliar não vire um ponto de falha do fluxo principal.

**Why P2**: Mesma regra já aplicada à IA no `CLAUDE.md` ("IA nunca pode travar o fluxo"), estendida a esta feature auxiliar e ao novo `feedbackService`.

**Acceptance Criteria**:

1. WHEN a chamada à API do GitHub falha (token ausente/inválido, erro de rede, rate limit do GitHub) THEN o sistema SHALL exibir uma mensagem de erro amigável dentro do próprio modal, mantendo os campos preenchidos para nova tentativa, e o restante do FluxoRH SHALL continuar funcionando normalmente.
2. WHEN a chamada à API do GitHub falha THEN o sistema SHALL gravar um registro em `Feedback` com `status: ERRO` e um `Log` tipo `ERRO` (`acao: FALHA_CRIAR_ISSUE_GITHUB`), sem nunca lançar a exceção para a interface.
3. WHEN o usuário já enviou 5 relatos no dia corrente THEN o sistema SHALL bloquear novos envios com uma mensagem clara ("limite diário atingido"), sem chamar a API do GitHub.

**Independent Test**: Sem `GITHUB_TOKEN` configurado, confirmar o envio do relato → modal mostra erro amigável, formulário permanece preenchido, resto do FluxoRH continua funcional; verificado ao vivo (ver `tasks.md`) que a resposta HTTP é `502` e o modal não quebra.

---

## Edge Cases

- WHEN o usuário não preenche título THEN o sistema SHALL usar `"(sem título)"` como padrão, sem bloquear o envio (RF/AC já coberto na P1).
- WHEN a chamada ao GitHub falha THEN o sistema SHALL exibir erro amigável, sem quebrar o restante da tela e sem lançar exceção não tratada (P2).
- WHEN o usuário já atingiu 5 relatos no dia THEN o sistema SHALL bloquear o envio com mensagem clara, sem chamar a API do GitHub nem gastar quota do token.
- WHEN a rota atual não está mapeada no dicionário de nomes amigáveis (`navConfig.ts`) THEN o sistema SHALL exibir um nome de fallback razoável em vez de quebrar o modal.
- WHEN o usuário fecha o modal sem preencher nada THEN o sistema SHALL apenas fechar, sem nenhuma chamada de rede.
- WHEN `GITHUB_TOKEN`/`GITHUB_REPO` não estão configurados no servidor THEN `githubService` SHALL lançar `ErroGithubApi` imediatamente (sem tentar a chamada HTTP), e `feedbackService` SHALL capturar e tratar como falha normal (Log ERRO + mensagem amigável).

---

## Requirement Traceability

Cada requisito recebe um ID único para rastreio entre design, tasks e validação.

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| HELP-01 | P1: Botão visível em toda tela autenticada, oculto no login | Tasks (T4, T5) | Verified |
| HELP-02 | P1: Modal com tipo, título, descrição | Tasks (T3) | Verified |
| HELP-03 | P1: Modal mostra tela atual (somente leitura) | Tasks (T3) | Verified |
| HELP-04 | P1: Monta title/body com tipo, tela, papel e descrição | Tasks (T1, T7) | Verified |
| HELP-05 | P1 (V2): `POST /api/feedback` cria a issue via API do GitHub server-side, sem `window.open` | Tasks (T7, T8, T9, T10) | Verified |
| HELP-06 | P1: Título vazio usa padrão `"(sem título)"` | Tasks (T1) | Verified |
| HELP-07 | P1: Cancelar/clique fora fecha sem enviar | Tasks (T3, T11) | Verified |
| HELP-08 | P2: Corpo da issue sem dado sensível | Tasks (T1) | Verified |
| HELP-09 | P2: Aviso de "não incluir dados pessoais" no modal | Tasks (T2, T3) | Verified |
| HELP-10 | P2 (V2): Falha na API do GitHub não trava o produto; erro amigável + Log ERRO + Feedback status ERRO | Tasks (T9, T11) | Verified (ao vivo, sem `GITHUB_TOKEN` real configurado — ver `tasks.md` § Verificação Final V2) |
| HELP-11 | P2 (V2): Limite de 5 relatos/usuário/dia bloqueia novo envio sem chamar a API | Tasks (T9) | Verified (unitário — não exercitado ao vivo, exigiria 5 envios reais) |
| HELP-12 | P2 (V2): Registro persistido em `Feedback` (ENVIADO ou ERRO) para toda tentativa de envio | Tasks (T6, T9) | Verified |

**ID format:** `HELP-NN`.

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 12 total, 12 mapeados a tasks, 0 não mapeados. V1 (client-side redirect) superada por V2 (criação via API) a pedido explícito do usuário — ver `.specs/features/botao-ajuda-github/tasks.md` § Verificação Final V2.

---

## Success Criteria

Como saberemos que a feature está bem-sucedida:

- [x] Botão aparece em todas as telas autenticadas e some no login (verificado ao vivo com Playwright, ver `tasks.md`).
- [ ] Testado com os três papéis (`SOLICITANTE`, `GESTOR`, `RH_ADMIN`) — QA manual real cobriu `GESTOR` (V1) e `RH_ADMIN` (V2); `SOLICITANTE` não foi exercitado ao vivo.
- [ ] Issue criada de fato no GitHub via API com título/corpo corretos, sem dado sensível — **não verificado ao vivo** ainda: exige um `GITHUB_TOKEN` real (fine-grained, `Issues: write` em `fabioacarvalho/rhop`) que o agente não pode gerar; o caminho de erro (sem token) foi verificado ao vivo e se comporta corretamente (502, mensagem amigável, modal não quebra).
- [x] Falha na API do GitHub não gera erro visível fora do modal; restante do FluxoRH continua funcional (verificado ao vivo sem token configurado).
- [x] `npm run build` sem erros.

---

## Questões em Aberto

1. ✅ **RESOLVIDO** — **V1 vs V2**: usuário pediu explicitamente a V2 ("issue já é criada automaticamente no GitHub", sem interação com a página do GitHub). V1 implementada primeiro, depois substituída por V2 na mesma sessão.
2. ✅ **RESOLVIDO** — **Valor do repositório**: `fabioacarvalho/rhop` (confirmado via `git remote -v`). Passou de `NEXT_PUBLIC_GITHUB_REPO` (V1, público) para `GITHUB_REPO` (V2, server-only).
3. **`GITHUB_TOKEN` real ainda não configurado.** O código está pronto e o caminho de erro foi verificado ao vivo, mas ninguém gerou ainda o Personal Access Token fine-grained (escopo `Issues: write` restrito a `fabioacarvalho/rhop`) para testar a criação real de uma issue. Ação: gerar o token em github.com/settings/tokens e colocar em `GITHUB_TOKEN` no `.env` local (nunca commitar).
