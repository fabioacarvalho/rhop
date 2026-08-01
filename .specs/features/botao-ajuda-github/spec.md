# Botão de Ajuda com Abertura de Issue no GitHub Specification

> Feature slug: `botao-ajuda-github` — Requirement ID prefix: `HELP`
> Fonte: `docs/prd/2026-07-31-prd-botao-ajuda-github.md`. Feature complementar, **fora do escopo original** do `docs/2026-07-30-fluxorh-design.md`.

> ⚠️ **Nota de escopo (herdada do PRD).** Esta feature não estava prevista no design doc original. Conforme `CLAUDE.md` ("não reinterprete ou expanda o escopo definido lá sem confirmar antes"), este spec documenta o que a feature deveria fazer, mas a decisão de implementar (e a escolha V1 vs. V2) deve ser confirmada com o time antes de virar tasks/execução.

## Problem Statement

Hoje, se um solicitante, gestor ou RH_Admin encontra um bug ou tem uma sugestão enquanto usa o FluxoRH, não há canal dentro do próprio produto para registrar isso. O relato acaba indo por WhatsApp, e-mail ou verbalmente para o time, sem contexto técnico (tela, papel, solicitação) e sem rastreabilidade.

## Goals

- [ ] Dar a qualquer usuário autenticado um jeito de reportar um problema ou sugestão sem sair do fluxo de trabalho.
- [ ] Transformar esse relato em uma issue no GitHub do projeto, já com contexto técnico mínimo (tela atual, tipo do problema, papel de quem relatou).
- [ ] Garantir que o corpo da issue nunca inclua dado sensível (nome completo, e-mail, dados de uma `Solicitacao`).
- [ ] Garantir que qualquer falha no fluxo de ajuda (ex.: pop-up bloqueado) nunca trave o restante do produto.

## Out of Scope

Explicitamente excluído desta versão (V1). Documentado para prevenir scope creep.

| Feature | Motivo |
| --- | --- |
| Criação da issue via API do GitHub (`POST /repos/.../issues`) com token de bot | É a V2 do PRD (seção 9) — nova tabela `Feedback`, nova rota, novo service, token de bot. Guardada como decisão futura, não faz parte deste spec/tasks. |
| Edição, comentário ou fechamento de issues de dentro do FluxoRH | Gerenciamento de issue é feito no GitHub, não no produto. |
| Sincronizar de volta o status da issue (ex.: "resolvido") para o FluxoRH | Exigiria integração bidirecional; não previsto. |
| Anexar prints/arquivos ao relato | Projeto não suporta upload de anexos em nenhum fluxo (design doc, seção 10). |
| Suporte a mais de um repositório de destino | Um único `NEXT_PUBLIC_GITHUB_REPO` fixo por ambiente. |
| Distinção de permissão para abrir relato | Todo usuário autenticado (`SOLICITANTE`, `GESTOR`, `RH_ADMIN`) pode reportar, sem checagem de papel. |
| Chamada a rotas do FluxoRH ou ao Prisma | V1 é 100% client-side; não gera `Log`, não persiste nada no banco. |

---

## User Stories

### P1: Reportar problema ou sugestão pelo botão de ajuda flutuante ⭐ MVP

**User Story**: Como usuário autenticado (qualquer papel), quero clicar em um botão de ajuda visível em qualquer tela e abrir uma issue no GitHub já preenchida com contexto técnico, para relatar um problema sem sair do meu fluxo de trabalho.

**Why P1**: É a feature inteira — sem o botão, o modal e a abertura da issue não há valor entregue.

**Acceptance Criteria**:

1. WHEN o usuário autenticado está em qualquer tela do FluxoRH (incluindo páginas dinâmicas criadas via menu lateral expansível) THEN o sistema SHALL exibir um botão flutuante fixo ("?").
2. WHEN o usuário está na tela de login (não autenticado) THEN o sistema SHALL NOT exibir o botão de ajuda.
3. WHEN o usuário clica no botão "?" THEN o sistema SHALL abrir um modal com: seletor de tipo do relato (`Bug` / `Melhoria` / `Dúvida`), campo de título, campo de descrição, e a tela atual exibida em modo somente leitura (ex.: "Aprovações Pendentes").
4. WHEN o usuário preenche tipo, título e descrição e clica em "Abrir issue no GitHub" THEN o sistema SHALL montar a URL `.../issues/new` com `title` e `body` preenchidos via query string, incluindo tipo, tela atual, papel do usuário (`SOLICITANTE`/`GESTOR`/`RH_ADMIN`) e a descrição digitada.
5. WHEN a URL é montada THEN o sistema SHALL abrir essa URL em nova aba (`window.open`) e, em seguida, SHALL fechar o modal e limpar os campos de título e descrição.
6. WHEN o usuário não preenche um título e tenta enviar THEN o sistema SHALL usar o título padrão `"(sem título)"` em vez de bloquear o envio.
7. WHEN o usuário clica em "Cancelar" ou clica fora do modal THEN o sistema SHALL fechar o modal sem enviar nada e sem chamar `window.open`.

**Independent Test**: Autenticado com qualquer papel, em qualquer tela (inclusive uma página dinâmica do menu expansível), abrir o modal, preencher tipo/título/descrição e confirmar → nova aba abre no GitHub com título e corpo corretos; testar cancelar e clique fora → modal fecha sem nenhuma aba nova.

---

### P2: Corpo da issue nunca contém dado sensível

**User Story**: Como responsável pela privacidade dos dados do FluxoRH, quero que o relato gerado automaticamente nunca inclua nome completo, e-mail ou dados de uma `Solicitacao`, para que a issue possa ficar visível a mais gente do que o RH interno sem vazar informação sensível.

**Why P2**: É uma regra de segurança explícita do PRD (seção 6) — não é o fluxo feliz, mas bloqueia o "pronto" se violada.

**Acceptance Criteria**:

1. WHEN o sistema monta o título e o corpo da issue THEN o corpo SHALL conter apenas: tipo do relato, nome da tela, papel do usuário e a descrição digitada — e SHALL NOT incluir e-mail, nome completo ou qualquer campo de `dados` de uma `Solicitacao`.
2. WHEN o modal é exibido THEN o sistema SHALL mostrar um aviso curto e visível: "não inclua dados pessoais ou de solicitações específicas".

**Independent Test**: Preencher o modal com uma descrição qualquer e confirmar → inspecionar a URL/corpo gerado e confirmar ausência de e-mail, nome completo ou qualquer dado de `Solicitacao`; conferir visualmente que o aviso aparece no modal.

---

### P2: Falha no fluxo de ajuda nunca trava o restante do produto

**User Story**: Como usuário do FluxoRH, quero que um problema no botão de ajuda (ex.: pop-up bloqueado pelo navegador) nunca impeça o uso do resto do produto, para que essa feature auxiliar não vire um ponto de falha do fluxo principal.

**Why P2**: Mesma regra já aplicada à IA no `CLAUDE.md` ("IA nunca pode travar o fluxo"), estendida a esta feature auxiliar.

**Acceptance Criteria**:

1. WHEN o navegador bloqueia o pop-up e a nova aba não abre THEN o restante do FluxoRH SHALL continuar funcionando normalmente, sem erro que afete outra parte da tela.
2. WHEN a nova aba não abre THEN o sistema SHALL exibir uma mensagem de fallback no modal (ex.: "se não abriu, copie o link: ...").

**Independent Test**: Bloquear pop-ups no navegador, confirmar o envio do relato → nenhuma aba abre, mensagem de fallback com o link aparece no modal, e o restante do FluxoRH (navegação, outras telas) continua funcional.

---

## Edge Cases

- WHEN o usuário não preenche título THEN o sistema SHALL usar `"(sem título)"` como padrão, sem bloquear o envio (RF/AC já coberto na P1).
- WHEN o navegador bloqueia o pop-up THEN o sistema SHALL exibir fallback com link copiável, sem quebrar o restante da tela (P2).
- WHEN o usuário navega para uma "página" dinâmica criada via menu lateral expansível THEN o botão de ajuda SHALL continuar visível e o campo de tela atual SHALL identificar corretamente essa página (não cair num nome genérico/errado).
- WHEN a rota atual não está mapeada no dicionário de nomes amigáveis THEN o sistema SHALL exibir um nome de fallback razoável (ex.: o próprio path) em vez de quebrar o modal.
- WHEN o usuário fecha o modal sem preencher nada THEN o sistema SHALL apenas fechar, sem gerar nenhuma URL nem abrir aba.

---

## Requirement Traceability

Cada requisito recebe um ID único para rastreio entre design, tasks e validação.

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| HELP-01 | P1: Botão visível em toda tela autenticada, oculto no login | Tasks (T4, T5) | Verified |
| HELP-02 | P1: Modal com tipo, título, descrição | Tasks (T3) | Verified |
| HELP-03 | P1: Modal mostra tela atual (somente leitura), inclusive páginas dinâmicas do menu | Tasks (T3) | Verified |
| HELP-04 | P1: Monta URL `issues/new` com tipo, tela, papel e descrição | Tasks (T1, T3) | Verified |
| HELP-05 | P1: Abre em nova aba, fecha modal e limpa campos | Tasks (T3) | Verified |
| HELP-06 | P1: Título vazio usa padrão `"(sem título)"` | Tasks (T1) | Verified |
| HELP-07 | P1: Cancelar/clique fora fecha sem enviar | Tasks (T3) | Verified |
| HELP-08 | P2: Corpo da issue sem dado sensível | Tasks (T1) | Verified |
| HELP-09 | P2: Aviso de "não incluir dados pessoais" no modal | Tasks (T2, T3) | Verified |
| HELP-10 | P2: Falha (pop-up bloqueado) não trava o produto; fallback com link | Tasks (T2, T3) | Verified (código revisado; caminho de fallback não exercitado ao vivo — Chromium headless não bloqueou o popup no teste manual, ver `tasks.md` § Verificação Final) |

**ID format:** `HELP-NN`.

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 10 total, 10 mapeados a tasks, 0 não mapeados. Implementado e verificado — ver `.specs/features/botao-ajuda-github/tasks.md` § Verificação Final.

---

## Success Criteria

Como saberemos que a feature está bem-sucedida:

- [x] Botão aparece em todas as telas autenticadas e some no login (verificado ao vivo com Playwright, ver `tasks.md`).
- [ ] Testado com os três papéis (`SOLICITANTE`, `GESTOR`, `RH_ADMIN`) — QA manual real cobriu apenas `GESTOR`; `SOLICITANTE`/`RH_ADMIN` não foram exercitados ao vivo (comportamento do componente não branch por papel, mas falta a confirmação visual).
- [x] Issue aberta no GitHub tem título e corpo corretos, sem nenhum dado sensível ou de `Solicitacao` real (URL real capturada em `tasks.md`).
- [ ] Pop-up bloqueado não gera erro visível fora do modal; restante do FluxoRH continua funcional — código revisado, caminho de fallback não exercitado ao vivo (ver `tasks.md`).
- [x] `npm run build` sem erros.

---

## Questões em Aberto

1. **Confirmação de escopo com o time.** Este PRD é uma adição fora do design doc original. Antes de avançar para Design/Tasks, confirmar com o time se V1 (redirect client-side) é aceitável para o hackathon ou se V2 (API do GitHub) já deveria entrar.
2. **Valor de `NEXT_PUBLIC_GITHUB_REPO`.** Precisa do nome real do repositório de destino (ex.: `sua-org/rhop`) antes da implementação.
3. **Nome amigável de páginas dinâmicas do menu.** O PRD cita um dicionário simples (`screenTitles`) para rotas fixas; falta definir como esse dicionário resolve nomes de páginas criadas dinamicamente via menu lateral expansível (RF3 / HELP-03).
