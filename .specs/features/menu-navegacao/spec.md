# Menu de Navegação (App Shell) Specification

> Feature slug: `menu-navegacao` · Requirement prefix: `NAV`
> Fonte da verdade: `docs/design-ux-ui/fluxorh-mockup.html` e `docs/design-ux-ui/fluxorh-ui-layout-specs.md` (seção 2 "Diagrama de Navegação", seção 3 "Matriz de Permissões", seção 4.2 "Shell da Aplicação") para layout de header/sidebar; `CLAUDE.md` para regras de visibilidade por papel; specs das features individuais (`solicitacoes`, `aprovacoes`, `dashboard-visao-geral`, `painel-insights`, `configuracao-fluxos`, `auditoria-logs`, `banco-de-talentos`, `notificacoes`) para o conjunto real de telas a integrar.

## Problem Statement

Hoje cada tela (`aprovacoes`, `auditoria-logs`, `configuracao-fluxos`) é renderizada isolada, sem sidebar, topbar ou navegação entre telas — cada `page.tsx` faz sua própria checagem de papel e devolve HTML solto. Não existe um shell comum, então o usuário não tem como descobrir/alcançar as demais telas do sistema, não vê sua identidade nem seu papel ativo, e não há um jeito de sair da aplicação. Esta feature entrega o **App Shell** (sidebar + topbar) que integra todas as telas já existentes e as que ainda serão construídas, respeitando a mesma restrição de visibilidade por papel que já protege cada rota no backend.

## Goals

- [ ] Toda tela autenticada é renderizada dentro de um shell único (sidebar + topbar), sem duplicar layout por tela.
- [ ] A sidebar lista apenas os itens de navegação permitidos para o papel do usuário autenticado (`SOLICITANTE`, `GESTOR`, `RH_ADMIN`), refletindo no menu a mesma regra que o backend já aplica em `requireUser`.
- [ ] O usuário identifica, a qualquer momento, em qual tela está, quem é (nome/papel) e consegue sair da aplicação — sem sair do shell.
- [ ] Nenhum item de menu aponta para uma tela sem funcionalidade real por trás (menu reflete o conjunto de features spec'adas/implementadas, não o mockup literal).

## Out of Scope

Explicitamente excluído. Documentado para prevenir scope creep.

| Feature | Reason |
| --- | --- |
| Seletor "Visualizar como" (troca manual de papel Solicitante/Gestor/RH_Admin na sidebar) | É um artefato de teste do mockup para simular papéis sem múltiplos logins. Em produção o papel vem da sessão autenticada (`autenticacao-usuarios`/`requireUser`) — não existe troca manual de papel. |
| Grupo "Páginas" / "+ Adicionar página" (criação dinâmica de páginas em branco) | Scaffolding de demonstração do mockup (`#screen-customX`); não corresponde a nenhuma feature spec'ada do produto. |
| Tela "Pipeline de Aprovações" (Kanban) | Presente no mockup (`#screen-pipeline`) mas sem spec/feature própria no backlog do produto — não há dado ou service por trás. Não entra no menu até existir uma feature dedicada. |
| Botão de Ajuda flutuante (FAB "?") e modal de report de issue | Já possui spec própria (`botao-ajuda-github`), marcada como "decisão de implementar pendente de confirmação". Fora deste menu; se confirmada, se integra como componente flutuante independente do shell. |
| Lógica de negócio de cada tela (dados, filtros, tabelas, formulários) | Pertence a cada feature individual (`solicitacoes`, `aprovacoes`, `dashboard-visao-geral`, etc.); esta feature só entrega o container de navegação e o link para a rota. |
| Definição/mudança das regras de quem pode aprovar o quê | Já definida em `autenticacao-usuarios`, `aprovacoes` e `CLAUDE.md`; o menu só espelha a visibilidade, não a redefine. |
| Motor de workflow visual (canvas), múltiplos aprovadores em paralelo, upload de arquivo, notificação via Slack/Teams, multi-tenant | Fora de escopo global do projeto (`CLAUDE.md`). |

---

## User Stories

### P1: Shell com sidebar de navegação filtrada por papel ⭐ MVP

**User Story**: Como colaborador autenticado (qualquer papel), quero ver uma sidebar com os grupos e itens de navegação das telas que meu papel pode acessar, para me mover entre as funcionalidades do sistema sem digitar URLs.

**Why P1**: Sem isso não existe "menu" — é o núcleo literal da feature. Sem ele o usuário não descobre `dashboard-visao-geral`, `painel-insights`, `banco-de-talentos` etc., mesmo que já existam.

**Acceptance Criteria**:

1. WHEN o usuário autenticado carrega qualquer tela protegida THEN o sistema SHALL renderizar a sidebar com marca ("OP Conecta") e os grupos de navegação aplicáveis.
2. WHEN o papel do usuário autenticado é `SOLICITANTE` THEN o sistema SHALL exibir apenas: Minhas Solicitações, Nova Solicitação (grupo "Meu trabalho") — nenhum outro grupo/item.
3. WHEN o papel do usuário autenticado é `GESTOR` THEN o sistema SHALL exibir: Minhas Solicitações, Nova Solicitação, Aprovações Pendentes (grupo "Meu trabalho"); Dashboard, Painel de Insights (grupo "Visão geral"); Banco de Talentos.
4. WHEN o papel do usuário autenticado é `RH_ADMIN` THEN o sistema SHALL exibir todos os itens do `GESTOR` mais Configuração de Fluxos e Auditoria & Logs (grupo "Administração").
5. WHEN um grupo de navegação não tem nenhum item visível para o papel atual THEN o sistema SHALL ocultar o grupo inteiro (não exibir cabeçalho de grupo vazio).
6. WHEN o usuário clica em um item de menu THEN o sistema SHALL navegar para a rota da tela correspondente sem recarregar o shell (sidebar/topbar permanecem montados).
7. WHEN a tela atual corresponde a um item do menu THEN o sistema SHALL destacar visualmente esse item como ativo.

**Independent Test**: Autenticar como `SOLICITANTE`, `GESTOR` e `RH_ADMIN` (um de cada vez) e conferir que a lista de itens visíveis bate exatamente com a matriz de permissões desta spec para cada papel.

---

### P1: Topbar com identidade do usuário e saída da sessão ⭐ MVP

**User Story**: Como colaborador autenticado, quero ver meu nome, meu papel e um jeito de sair, sempre visível no topo da tela, para saber com qual conta estou operando e conseguir encerrar a sessão a qualquer momento.

**Why P1**: Completa o requisito P3 de `autenticacao-usuarios` ("Exibição da identidade do usuário logado") e entrega o único ponto de saída da aplicação — sem ele, não há como sair pela UI.

**Acceptance Criteria**:

1. WHEN o usuário autenticado carrega qualquer tela protegida THEN o sistema SHALL exibir na topbar o nome e o papel do usuário (dado resolvido do `User` autenticado, nunca de estado local editável).
2. WHEN o usuário aciona "Sair" (na sidebar, conforme layout do mockup) THEN o sistema SHALL encerrar a sessão (Supabase Auth) e redirecionar para a tela de Login, reaproveitando o contrato já definido em `autenticacao-usuarios` (AUTH-13/AUTH-14).
3. WHEN a tela ativa muda THEN o sistema SHALL atualizar o título exibido na topbar (eyebrow + título) para refletir a tela atual.
4. WHEN o nome do usuário é muito longo para o espaço da topbar THEN o sistema SHALL truncar visualmente sem quebrar o layout.

**Independent Test**: Logar com um usuário de cada papel e confirmar nome/papel corretos na topbar; acionar "Sair" e confirmar encerramento de sessão + redirect para Login + bloqueio de rota protegida ao tentar voltar.

---

### P1: Ponto de entrada de notificações na topbar ⭐ MVP

**User Story**: Como colaborador autenticado, quero acessar minhas notificações a partir de qualquer tela, para não perder avisos de aprovação/rejeição/cobrança de SLA.

**Why P1**: `notificacoes` já entrega `NotificacaoBadge` e `NotificacoesPopover`, mas sem um shell/topbar comum eles não têm onde morrer — sem este item, a feature de notificações fica órfã de UI global.

**Acceptance Criteria**:

1. WHEN o usuário autenticado carrega qualquer tela protegida THEN o sistema SHALL exibir o gatilho de notificações (badge + popover já implementados por `notificacoes`) na topbar, visível em todas as telas.
2. WHEN não há notificações não lidas THEN o sistema SHALL exibir o gatilho sem contagem (estado zero), sem erro.

**Independent Test**: Gerar uma notificação para o usuário logado, verificar contagem no badge a partir de qualquer tela do shell, abrir o popover e confirmar que o item aparece.

---

### P2: Destaque de item ativo e grupos colapsáveis

**User Story**: Como colaborador autenticado, quero recolher/expandir grupos de navegação e ver claramente onde estou, para navegar mais rápido em uma sidebar com múltiplos grupos.

**Why P2**: Melhora usabilidade, mas a navegação funciona (ainda que menos ergonômica) sem colapso de grupo.

**Acceptance Criteria**:

1. WHEN o usuário clica no cabeçalho de um grupo THEN o sistema SHALL alternar (expandir/recolher) a visibilidade dos itens daquele grupo.
2. WHEN a página é recarregada THEN o sistema SHALL exibir todos os grupos aplicáveis expandidos por padrão (sem persistência de preferência de colapso nesta versão).

---

### P2: Integração do Banco de Talentos ao menu

**User Story**: Como `GESTOR` ou `RH_ADMIN`, quero acessar o Banco de Talentos a partir do menu principal, para não depender de digitar a URL da tela.

**Why P2**: `banco-de-talentos` é a única feature spec'ada sem representação alguma no mockup original — precisa de um item novo de navegação para deixar de ser um "módulo escondido".

**Acceptance Criteria**:

1. WHEN o papel do usuário autenticado é `GESTOR` ou `RH_ADMIN` THEN o sistema SHALL exibir um item "Banco de Talentos" no menu, navegando para a rota da feature.
2. WHEN o papel do usuário autenticado é `SOLICITANTE` THEN o sistema SHALL não exibir esse item (consistente com o bloqueio já aplicado no backend de `banco-de-talentos`).

---

### P3: Navegação responsiva

**User Story**: Como colaborador autenticado usando uma tela estreita, quero acessar o menu sem perder espaço útil de conteúdo, para usar o sistema fora do desktop.

**Why P3**: Nem o mockup original nem o design doc detalham comportamento mobile da sidebar — não é crítico para o MVP interno.

**Acceptance Criteria**:

1. WHEN a largura da tela é menor que o breakpoint definido em design THEN o sistema SHALL recolher a sidebar para um estado compacto/oculto, acessível por um gatilho explícito.

---

## Edge Cases

- WHEN o papel resolvido do usuário não pertence ao enum `{SOLICITANTE, GESTOR, RH_ADMIN}` THEN o sistema SHALL não exibir nenhum item de menu além do necessário para sair (mesma postura conservadora de `autenticacao-usuarios`: nunca assumir papel default).
- WHEN o usuário navega diretamente por URL para uma tela que seu papel não deveria ver (link não aparece no menu) THEN o sistema SHALL continuar bloqueando no backend/página (`requireUser`), independente do menu — o menu esconder o link é UX, não é o controle de autorização.
- WHEN a sessão expira enquanto o usuário está em qualquer tela do shell THEN o sistema SHALL redirecionar para Login na próxima navegação/ação protegida, sem deixar sidebar/topbar "vivos" com dado de sessão inválida.
- WHEN uma feature referenciada no menu (ex.: `painel-insights`, `dashboard-visao-geral`) ainda não tem rota implementada THEN o sistema SHALL não incluir esse item no menu até a rota existir (nunca linkar para 404).
- WHEN o usuário está em uma tela sem nenhum item de menu correspondente (ex.: tela de detalhe aninhada) THEN o sistema SHALL manter o grupo pai expandido/destacado, sem destacar item nenhum como falso-ativo.

---

## Requirement Traceability

Cada requisito recebe um ID único para rastreamento em design, tasks e validação.

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| NAV-01 | P1: Shell com sidebar (marca + grupos) | Pending | Pending |
| NAV-02 | P1: Shell com sidebar (itens visíveis para SOLICITANTE) | Pending | Pending |
| NAV-03 | P1: Shell com sidebar (itens visíveis para GESTOR) | Pending | Pending |
| NAV-04 | P1: Shell com sidebar (itens visíveis para RH_ADMIN) | Pending | Pending |
| NAV-05 | P1: Shell com sidebar (ocultar grupo vazio) | Pending | Pending |
| NAV-06 | P1: Shell com sidebar (navegação sem reload do shell) | Pending | Pending |
| NAV-07 | P1: Shell com sidebar (destaque de item ativo) | Pending | Pending |
| NAV-08 | P1: Topbar (nome + papel do usuário) | Pending | Pending |
| NAV-09 | P1: Topbar (ação Sair -> encerra sessão + redirect) | Pending | Pending |
| NAV-10 | P1: Topbar (título dinâmico por tela) | Pending | Pending |
| NAV-11 | P1: Topbar (truncamento de nome longo) | Pending | Pending |
| NAV-12 | P1: Notificações na topbar (gatilho visível em toda tela) | Pending | Pending |
| NAV-13 | P1: Notificações na topbar (estado zero sem erro) | Pending | Pending |
| NAV-14 | P2: Grupos colapsáveis (alternar expandir/recolher) | Pending | Pending |
| NAV-15 | P2: Grupos colapsáveis (expandido por padrão ao recarregar) | Pending | Pending |
| NAV-16 | P2: Banco de Talentos no menu (visível para GESTOR/RH_ADMIN) | Pending | Pending |
| NAV-17 | P2: Banco de Talentos no menu (oculto para SOLICITANTE) | Pending | Pending |
| NAV-18 | P3: Navegação responsiva (sidebar compacta abaixo do breakpoint) | Pending | Pending |

**ID format:** `NAV-[NUMBER]`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 18 total, 0 mapeados para tasks, 18 não mapeados ⚠️ (mapeamento ocorre em `tasks.md`)

---

## Success Criteria

Como saberemos que a feature está bem-sucedida:

- [ ] Todas as telas hoje implementadas (`aprovacoes`, `auditoria-logs`, `configuracao-fluxos`) passam a renderizar dentro do mesmo shell, sem regressão nas checagens de papel já existentes em cada `page.tsx`.
- [ ] Um usuário de cada papel (`SOLICITANTE`, `GESTOR`, `RH_ADMIN`) vê exatamente os itens de menu previstos na matriz desta spec — nem a mais, nem a menos.
- [ ] "Sair" encerra a sessão de fato (nova tentativa de acessar rota protegida exige login).
- [ ] Nenhum item do menu aponta para uma rota inexistente (0 links quebrados/404 a partir da navegação).
- [ ] O gatilho de notificações já existente (`notificacoes`) aparece consistente em todas as telas do shell.

---

## Questões em Aberto

1. **Rotas canônicas das telas ainda não implementadas** (Minhas Solicitações, Nova Solicitação, Dashboard, Painel de Insights, Banco de Talentos): hoje só existem `/aprovacoes`, `/auditoria-logs`, `/configuracao-fluxos`. Este spec assume que a rota de cada item seguirá a mesma convenção plana já em uso (`app/(dashboard)/<slug>`); a definição exata do `<slug>` de cada uma fica para `design.md`.
2. **Implementação de fato do logout**: não há hoje nenhum código de `signOut`/rota de logout no projeto. O contrato de comportamento já está definido em `autenticacao-usuarios` (AUTH-13/AUTH-14); esta feature assume a responsabilidade de implementar o gatilho de UI e, se necessário, o mecanismo de `signOut` em si (a menos que já exista quando a execução começar).
3. **Placement do item "Banco de Talentos"**: grupo próprio ou dentro de um grupo existente — decisão visual fica para `design.md`, guiada por `/frontend-design` e `/ui-ux-pro-max`.
