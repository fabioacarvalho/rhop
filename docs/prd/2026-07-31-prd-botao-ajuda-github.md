# PRD — Botão de Ajuda com Abertura de Issue no GitHub
### FluxoRH · Feature complementar (fora do escopo original do MVP)

**Status:** proposta, aguardando validação com o time antes de implementar.
**Relacionado a:** mockup de telas (`fluxorh-mockup.html`), botão "?" flutuante já prototipado.

> ⚠️ **Nota de escopo.** O design doc original (`docs/2026-07-30-fluxorh-design.md`) não previa uma feature de feedback/reporte de bugs. Isso não está na lista de "fora de escopo" do doc, mas também não estava dentro — é uma adição nova. Pelo `CLAUDE.md` do projeto ("não reinterprete ou expanda o escopo definido lá sem confirmar antes"), este PRD deve ser validado com o time antes de virar tarefa de implementação.

---

## 1. Problema

Hoje, se um solicitante, gestor ou RH_Admin encontra um bug ou tem uma sugestão enquanto usa o FluxoRH, não há canal dentro do próprio produto para registrar isso. O relato acaba indo por WhatsApp, e-mail ou verbalmente para o time — sem contexto técnico (qual tela, qual papel, qual solicitação), e sem rastreabilidade.

## 2. Objetivo

Dar à pessoa usuária um jeito de reportar um problema ou sugerir algo **sem sair do fluxo de trabalho**, e fazer esse relato virar uma **issue no GitHub do projeto** já com contexto técnico mínimo anexado (tela atual, tipo do problema, quem relatou).

### Fora do escopo desta feature
- Edição, comentário ou fechamento de issues de dentro do FluxoRH (via GitHub, não pelo produto).
- Sincronizar de volta o status da issue (ex: "resolvido") para dentro do FluxoRH.
- Anexar prints/arquivos ao relato (o projeto já não suporta upload de anexos em nenhum fluxo — ver seção 10 do design doc).
- Suporte a mais de um repositório de destino.

## 3. Quem usa

Qualquer usuário autenticado — `SOLICITANTE`, `GESTOR` ou `RH_ADMIN`. Não há distinção de permissão para abrir um relato: todo mundo pode reportar.

## 4. Duas formas de implementar (escolher uma)

Vale decidir isso explicitamente antes de codar, porque muda estimativa e o que entra no schema do banco.

| | **V1 — Redirect com link pré-preenchido** | **V2 — Criação via API do GitHub** |
|---|---|---|
| Como funciona | Botão monta uma URL de "nova issue" do GitHub com `title` e `body` já preenchidos via query string, e abre em nova aba (`window.open`) | Backend chama a REST API do GitHub (`POST /repos/{owner}/{repo}/issues`) usando um token de bot, e a issue é criada sem o usuário sair do FluxoRH |
| Pré-requisito do usuário | Precisa ter conta no GitHub com acesso de escrita ao repositório | Nenhum — qualquer pessoa logada no FluxoRH consegue |
| Precisa de token/env var no servidor? | Não | Sim (`GITHUB_TOKEN`, `GITHUB_REPO`) |
| Precisa de tabela nova no banco? | Não (opcional: log local) | Sim — para guardar o vínculo com a issue criada |
| Esforço | Baixo — é praticamente só frontend | Médio — nova rota, novo service, nova tabela, tratamento de erro |
| Risco | Se a pessoa não tem conta/acesso ao GitHub, o relato se perde | Token do bot precisa ser guardado com cuidado; chamada externa pode falhar |
| **Recomendação para este momento do hackathon** | ✅ Fazer agora | Guardar como "Fase 2", só se o time achar que vale o esforço |

**Este PRD detalha a V1 como escopo imediato**, e deixa a V2 documentada na seção 9 para não bloquear a decisão nem virar trabalho perdido caso o time opte por ela depois.

---

## 5. Requisitos funcionais (V1)

| ID | Requisito |
|---|---|
| RF1 | Um botão flutuante fixo ("?"), visível em todas as telas autenticadas do FluxoRH, abre um modal de relato. |
| RF2 | O modal tem: tipo do relato (`Bug` / `Melhoria` / `Dúvida`), título (obrigatório), descrição (obrigatória). |
| RF3 | O modal mostra, somente leitura, a tela em que o usuário estava ao abrir o relato (ex: "Aprovações Pendentes"). |
| RF4 | Ao confirmar, o sistema monta o título e o corpo da issue incluindo: tipo, tela, papel do usuário (`SOLICITANTE`/`GESTOR`/`RH_ADMIN`) e a descrição digitada — **sem** incluir e-mail, nome completo ou qualquer dado da solicitação em si. |
| RF5 | O sistema abre a página de nova issue do GitHub (`.../issues/new`) em uma nova aba, com os campos já preenchidos. |
| RF6 | O modal pode ser fechado sem enviar nada (botão "Cancelar" e clique fora do modal). |
| RF7 | Campos de título e descrição são limpos depois do envio. |

## 6. Requisitos não funcionais

- **Não pode travar o fluxo principal.** Igual à regra já existente para a IA no `CLAUDE.md` ("IA nunca pode travar o fluxo"), esse botão é auxiliar — qualquer problema nele (ex: pop-up bloqueado pelo navegador) não pode impedir o uso do resto do produto.
- **Sem dado sensível na issue.** Como a issue pode ficar visível para mais gente do que o RH interno (dependendo da visibilidade do repositório), o corpo gerado automaticamente não deve incluir nome completo, e-mail, valores de reembolso ou qualquer `dados` de uma `Solicitacao`. Adicionar um aviso curto no modal: "não inclua dados pessoais ou de solicitações específicas".
- **Acessível de qualquer tela**, inclusive depois de navegar para uma "página" criada dinamicamente pelo menu expansível.

## 7. Fluxo (V1)

```
Usuário clica no botão "?"
   → Modal abre, com a tela atual pré-preenchida
   → Usuário escolhe tipo, escreve título e descrição
   → Usuário clica em "Abrir issue no GitHub"
       → Front monta a URL: /issues/new?title=...&body=...
       → window.open(url, "_blank")
       → Modal fecha, campos são limpos
   → Usuário completa a criação da issue na própria aba do GitHub
```

Não há chamada a nenhuma rota do FluxoRH nem ao Prisma nessa versão — é uma feature 100% client-side.

## 8. Implementação técnica (V1)

Seguindo a arquitetura do projeto (`app/`, `components/`), sem necessidade de nova rota de API nem de service:

- `components/HelpButton.tsx` — botão flutuante + estado de abrir/fechar modal.
- `components/HelpModal.tsx` — formulário (tipo, título, descrição), monta a URL e chama `window.open`.
- Detecção da tela atual: usar `usePathname()` do Next.js e mapear a rota para um nome amigável (`/aprovacoes` → "Aprovações Pendentes"), num dicionário simples parecido com o `screenTitles` do mockup.
- Papel do usuário: já disponível via sessão do Supabase Auth (mesmo dado usado para checar permissão nas outras telas).
- Repositório de destino: uma constante `NEXT_PUBLIC_GITHUB_REPO` (ex: `"sua-org/rhop"`) — pode ficar em variável de ambiente pública, já que só monta uma URL, sem token envolvido.

Nenhuma alteração no `schema.prisma` é necessária para a V1.

### Variáveis de ambiente novas
```bash
NEXT_PUBLIC_GITHUB_REPO=   # ex: sua-org/rhop
```

## 9. V2 — Criação via API (referência para decisão futura)

Se o time decidir que vale a pena não depender do usuário ter conta no GitHub:

- Nova tabela `Feedback`: `id`, `usuario_id`, `tipo`, `titulo`, `descricao`, `tela_contexto`, `github_issue_url`, `github_issue_numero`, `status` (`ENVIADO` \| `ERRO`), `criado_em`.
- `app/api/feedback/route.ts` — valida entrada (Zod), confirma autenticação, delega para o service. Sem lógica de negócio na rota, seguindo o padrão do projeto.
- `lib/services/feedbackService.ts` — monta o payload, chama `githubService`, grava o registro em `Feedback`. Se a chamada ao GitHub falhar, grava um `Log` tipo `ERRO` (mesmo padrão já usado para falha de IA e de e-mail) e retorna uma mensagem amigável — **nunca** trava a interação do usuário.
- `lib/services/githubService.ts` — encapsula a chamada `POST https://api.github.com/repos/{owner}/{repo}/issues`, usando um token de bot.
- Variáveis de ambiente novas: `GITHUB_TOKEN` (PAT ou GitHub App com escopo restrito a `issues: write` nesse repositório específico — nunca um token com acesso amplo), `GITHUB_REPO`.
- Rate limiting simples (ex: máximo de 5 relatos por usuário por dia) para evitar spam acidental ou malicioso.

## 10. Critérios de aceite (V1)

- **Dado** que o usuário está em qualquer tela autenticada, **quando** clica no botão "?", **então** o modal abre com a tela atual já identificada no campo somente leitura.
- **Dado** que o usuário preencheu tipo, título e descrição, **quando** clica em "Abrir issue no GitHub", **então** uma nova aba abre na página de nova issue do repositório configurado, com título e corpo já preenchidos.
- **Dado** que o usuário não preencheu um título, **quando** tenta enviar, **então** o sistema usa um título padrão (`"(sem título)"`) em vez de bloquear o envio — não é um formulário crítico, não deve frustrar quem só quer relatar rápido.
- **Dado** que o navegador bloqueia pop-ups, **quando** a nova aba não abre, **então** o restante do FluxoRH continua funcionando normalmente (o botão de ajuda nunca deve gerar um erro que afete outra parte da tela).

## 11. Como validar (checklist antes de considerar pronto)

- [ ] Botão aparece em todas as telas autenticadas, some na tela de login.
- [ ] Testado com os três papéis (`SOLICITANTE`, `GESTOR`, `RH_ADMIN`) — o botão e o modal se comportam igual para todos.
- [ ] Testado a partir de uma "página" custom criada via menu lateral expansível — o contexto de tela ainda aparece corretamente.
- [ ] Conferido manualmente que o corpo da issue gerada não inclui nenhum dado de uma `Solicitacao` real.
- [ ] `npm run build` sem erros (checklist padrão do `CLAUDE.md`).

## 12. Riscos

| Risco | Mitigação |
|---|---|
| Usuário sem conta no GitHub não consegue concluir o relato | Aceitável para V1 dado o público (equipe interna/técnica do hackathon); reavaliar para V2 se o público real incluir RH/gestores sem GitHub |
| Vazamento de dado sensível dentro do corpo da issue | Corpo gerado programaticamente, sem campos de dados da solicitação; aviso textual no modal |
| Pop-up bloqueado pelo navegador | Mensagem de fallback no modal ("se não abriu, copie o link: ...") — pequeno ajuste de UX, não bloqueia a V1 |