# Autenticação e Usuários Specification

> Feature slug: `autenticacao-usuarios` · Requirement prefix: `AUTH`
> Fonte da verdade: `docs/2026-07-30-fluxorh-design.md` (Telas §5.1 Login; Modelo de dados §4 `User`; Papéis §3) e `CLAUDE.md` (Regras de negócio).

## Problem Statement

Os fluxos de aprovação de RH dependem de saber, com segurança, **quem** está agindo e **qual seu papel/equipe** — sem isso não há como filtrar visibilidade, autorizar aprovações ou registrar auditoria. Hoje não existe uma camada de identidade única que autentique o colaborador e resolva seu papel (`SOLICITANTE` | `GESTOR` | `RH_ADMIN`) e sua posição na hierarquia (`gestor_id`). Esta feature entrega o login e o modelo `User` que todas as demais features consomem como base de autorização.

## Goals

- [ ] Colaborador autentica com e-mail/senha via Supabase Auth e obtém uma sessão persistente.
- [ ] Toda rota da aplicação que exige autenticação bloqueia acesso não autenticado (0 vazamento de tela protegida).
- [ ] O papel (`role`) e o gestor (`gestor_id`) do usuário autenticado são sempre resolvíveis a partir da sessão, servindo de base de autorização para as demais features.
- [ ] O modelo `User` mantém a integridade da hierarquia (`gestor_id` referencia usuário existente ou é nulo apenas para o topo).

## Out of Scope

Explicitamente excluído. Documentado para evitar scope creep.

| Feature | Motivo |
| ------- | ------ |
| Tela de cadastro/signup de usuário (self-service) | Design doc não prevê; usuários são provisionados via seed/admin backend (ver Questões em Aberto). |
| Lógica de quem-vê-o-quê em listagens de `Solicitacao`/`Aprovacao`/Dashboard | Pertence a `solicitacoes`, `aprovacoes` e `dashboard-visao-geral`; aqui só se especifica a integridade e a resolução do dado `gestor_id`/`role`. |
| CRUD de usuários / edição de papel e gestor pela UI | Design doc não prevê tela de gestão de usuários no MVP. |
| Bloqueio de criação de solicitação por "colaborador sem gestor" | É um erro de runtime da feature `solicitacoes` (§8 do design doc); aqui só se define que `gestor_id` pode ser nulo apenas no topo. |
| Recuperação de senha / "esqueci minha senha" | Não mencionado no design doc (ver Questões em Aberto). |
| SSO, OAuth, multi-fator (MFA) | Design doc especifica "auth simples" e-mail/senha. |
| Multi-tenant / múltiplas empresas | Fora de escopo global do projeto (`CLAUDE.md`). |

---

## User Stories

### P1: Login por e-mail/senha ⭐ MVP

**User Story**: Como colaborador, quero entrar na plataforma com meu e-mail e senha, para acessar minhas telas de forma segura.

**Why P1**: Sem autenticação não há como identificar o usuário; toda outra feature depende de uma sessão válida.

**Acceptance Criteria**:

1. WHEN o usuário submete e-mail e senha válidos THEN o sistema SHALL autenticar via Supabase Auth, criar uma sessão e direcionar o usuário à primeira tela autenticada da aplicação.
2. WHEN o usuário submete e-mail ou senha inválidos THEN o sistema SHALL manter o usuário na tela de login e exibir uma mensagem de erro genérica, sem revelar se o e-mail existe.
3. WHEN o usuário submete o formulário com campos obrigatórios em branco THEN o sistema SHALL bloquear o envio e sinalizar os campos faltantes, sem chamar o Supabase Auth.
4. WHEN a chamada de autenticação ao Supabase falha por indisponibilidade/rede THEN o sistema SHALL exibir mensagem de erro recuperável e permitir nova tentativa, sem travar a tela.

**Independent Test**: Provisionar um usuário de teste; entrar com credenciais corretas e verificar acesso à aplicação; repetir com senha errada e verificar mensagem genérica e permanência na tela de login.

---

### P1: Modelo de usuário, papéis e resolução de identidade ⭐ MVP

**User Story**: Como sistema, preciso de um registro `User` com papel e gestor associados à sessão autenticada, para que qualquer feature possa autorizar ações com base em quem é o usuário.

**Why P1**: `role` e `gestor_id` são os dados que governam visibilidade e autorização de aprovação em todo o produto; precisam existir e ser resolvíveis desde o MVP.

**Acceptance Criteria**:

1. WHEN o modelo de dados é definido THEN o sistema SHALL persistir `User` com os campos `id`, `nome`, `email`, `role` e `gestor_id`, conforme §4 do design doc.
2. WHEN um `User` é criado ou atualizado THEN o sistema SHALL restringir `role` ao conjunto `{ SOLICITANTE, GESTOR, RH_ADMIN }`, rejeitando qualquer outro valor.
3. WHEN uma requisição autenticada chega ao backend THEN o sistema SHALL resolver, a partir da sessão do Supabase, o registro `User` correspondente (incluindo `role` e `gestor_id`) e disponibilizá-lo para a camada de serviço.
4. WHEN existe sessão válida no Supabase Auth mas não há `User` correspondente no banco THEN o sistema SHALL negar o acesso como não autorizado e registrar um `Log` tipo `ERRO`, em vez de assumir um papel padrão.
5. WHEN o `email` de um `User` é gravado THEN o sistema SHALL garantir unicidade de e-mail entre usuários.

**Independent Test**: Autenticar como usuários de papéis distintos e verificar que o backend resolve o `role`/`gestor_id` corretos; forçar uma sessão sem `User` correspondente e verificar negação de acesso + `Log` de erro.

---

### P1: Sessão e proteção de rotas ⭐ MVP

**User Story**: Como colaborador autenticado, quero que minha sessão persista e que telas protegidas fiquem inacessíveis sem login, para não perder acesso a cada navegação nem expor dados a não autenticados.

**Why P1**: A garantia de que nenhuma tela protegida é servida sem sessão é a base de segurança sobre a qual as regras de visibilidade das outras features se apoiam.

**Acceptance Criteria**:

1. WHEN um usuário não autenticado tenta acessar qualquer rota/tela protegida THEN o sistema SHALL redirecioná-lo para a tela de Login, sem renderizar o conteúdo protegido.
2. WHEN um usuário autenticado recarrega a página ou reabre a aplicação com sessão ainda válida THEN o sistema SHALL restaurar a sessão sem exigir novo login.
3. WHEN a sessão do usuário expira ou é invalidada THEN o sistema SHALL tratar as requisições subsequentes como não autenticadas e redirecioná-lo para o Login.
4. WHEN uma API route protegida recebe requisição sem sessão válida THEN o sistema SHALL responder com status de não autenticado (401) e não executar nenhuma lógica de negócio.

**Independent Test**: Sem login, acessar uma URL protegida diretamente e verificar redirect para Login; logar, recarregar a página e verificar continuidade da sessão; invalidar a sessão e verificar redirect.

---

### P2: Logout

**User Story**: Como colaborador autenticado, quero sair da plataforma, para encerrar minha sessão com segurança em dispositivos compartilhados.

**Why P2**: Necessário para uso real e segurança, mas não bloqueia a demonstração ponta a ponta do fluxo de aprovação no MVP.

**Acceptance Criteria**:

1. WHEN o usuário aciona "Sair" THEN o sistema SHALL encerrar a sessão no Supabase Auth e redirecioná-lo para a tela de Login.
2. WHEN a sessão foi encerrada THEN o sistema SHALL tratar qualquer tentativa de acesso a rota protegida como não autenticada.

**Independent Test**: Logar, acionar "Sair", verificar redirect para Login e que voltar a uma rota protegida exige novo login.

---

### P2: Integridade da hierarquia de gestores (`gestor_id`)

**User Story**: Como sistema, preciso garantir que `gestor_id` seja sempre coerente, para que a definição de "equipe" usada por visibilidade e aprovação em outras features seja confiável.

**Why P2**: A qualidade do dado `gestor_id` sustenta as regras de outras features; a integridade precisa ser garantida no provisionamento, mas não é pré-condição para o primeiro login funcionar.

**Acceptance Criteria**:

1. WHEN um `User` é provisionado com `gestor_id` preenchido THEN o sistema SHALL exigir que o valor referencie um `User` existente.
2. WHEN um `User` é o topo da hierarquia THEN o sistema SHALL permitir `gestor_id` nulo.
3. WHEN um `User` é provisionado THEN o sistema SHALL rejeitar `gestor_id` igual ao próprio `id` (auto-referência).
4. WHEN o `gestor_id` de um usuário é consultado por outra feature THEN o sistema SHALL expô-lo como o identificador da equipe do gestor apontado (dado apenas, sem lógica de visibilidade — consumido por `solicitacoes`, `aprovacoes`, `dashboard-visao-geral`).

**Independent Test**: Tentar provisionar usuário com `gestor_id` inexistente e com auto-referência → rejeitado; provisionar topo com `gestor_id` nulo → aceito.

---

### P3: Exibição da identidade do usuário logado

**User Story**: Como colaborador autenticado, quero ver meu nome e papel na interface, para confirmar com qual conta estou operando.

**Why P3**: Melhora a experiência e a confiança, mas não é necessário para o funcionamento dos fluxos.

**Acceptance Criteria**:

1. WHEN o usuário está autenticado THEN o sistema SHALL exibir o `nome` do usuário logado na área persistente da interface (ex.: cabeçalho).
2. WHEN o usuário está autenticado THEN o sistema SHALL indicar o `role` do usuário de forma legível.

---

## Edge Cases

- WHEN o e-mail informado não corresponde a nenhum usuário THEN o sistema SHALL responder com a mesma mensagem genérica de credenciais inválidas (sem enumeração de contas).
- WHEN há sessão Supabase válida mas o `User` correspondente foi removido/não existe THEN o sistema SHALL negar acesso e registrar `Log` tipo `ERRO`.
- WHEN o token/sessão expira durante o uso THEN o sistema SHALL redirecionar para Login na próxima interação protegida, sem estado inconsistente.
- WHEN o Supabase Auth está indisponível THEN o sistema SHALL exibir erro recuperável no login, sem quebrar a aplicação.
- WHEN se tenta provisionar um `User` com `role` fora do conjunto permitido THEN o sistema SHALL rejeitar a operação.
- WHEN se tenta provisionar um `User` com `gestor_id` apontando para usuário inexistente ou para si mesmo THEN o sistema SHALL rejeitar a operação.
- WHEN dois usuários tentam usar o mesmo `email` THEN o sistema SHALL rejeitar por violação de unicidade.

---

## Requirement Traceability

Cada requisito recebe um ID único para rastreamento em design, tasks e validação.

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| AUTH-01 | P1: Login por e-mail/senha | Tasks | In Tasks |
| AUTH-02 | P1: Login por e-mail/senha (credenciais inválidas / mensagem genérica) | Tasks | In Tasks |
| AUTH-03 | P1: Login por e-mail/senha (validação de formulário e erro de Supabase) | Tasks | In Tasks |
| AUTH-04 | P1: Modelo de usuário, papéis e resolução de identidade (campos do `User`) | Tasks | In Tasks |
| AUTH-05 | P1: Modelo de usuário, papéis e resolução de identidade (`role` restrito ao enum) | Tasks | In Tasks |
| AUTH-06 | P1: Modelo de usuário, papéis e resolução de identidade (resolução da identidade a partir da sessão) | Tasks | In Tasks |
| AUTH-07 | P1: Modelo de usuário, papéis e resolução de identidade (sessão sem `User` → nega + `Log` ERRO) | Tasks | In Tasks |
| AUTH-08 | P1: Modelo de usuário, papéis e resolução de identidade (unicidade de e-mail) | Tasks | In Tasks |
| AUTH-09 | P1: Sessão e proteção de rotas (redirect de não autenticado) | Tasks | In Tasks |
| AUTH-10 | P1: Sessão e proteção de rotas (persistência de sessão) | Tasks | In Tasks |
| AUTH-11 | P1: Sessão e proteção de rotas (expiração → redirect) | Tasks | In Tasks |
| AUTH-12 | P1: Sessão e proteção de rotas (API route protegida → 401) | Tasks | In Tasks |
| AUTH-13 | P2: Logout (encerrar sessão e redirect) | Tasks | In Tasks |
| AUTH-14 | P2: Logout (bloqueio pós-logout) | Tasks | In Tasks |
| AUTH-15 | P2: Integridade `gestor_id` (referência a `User` existente) | Tasks | In Tasks |
| AUTH-16 | P2: Integridade `gestor_id` (topo com `gestor_id` nulo) | Tasks | In Tasks |
| AUTH-17 | P2: Integridade `gestor_id` (sem auto-referência) | Tasks | In Tasks |
| AUTH-18 | P2: Integridade `gestor_id` (expor `gestor_id` como equipe — consumido por outras features) | Tasks | In Tasks |
| AUTH-19 | P3: Exibição da identidade (nome do usuário logado) | Tasks | In Tasks |
| AUTH-20 | P3: Exibição da identidade (papel legível) | Tasks | In Tasks |

**ID format:** `[CATEGORY]-[NUMBER]` (ex.: `AUTH-01`)

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 20 total, 20 mapeados para tasks, 0 não mapeados ✅ (ver `tasks.md`)

---

## Success Criteria

Como saberemos que a feature está bem-sucedida:

- [ ] Usuário com credenciais válidas autentica e chega à aplicação; credenciais inválidas mantêm-no no Login com mensagem genérica.
- [ ] Nenhuma rota/tela protegida é servida a usuário não autenticado (redirect para Login em 100% dos acessos diretos).
- [ ] O backend resolve `role` e `gestor_id` do usuário autenticado em toda requisição protegida — base disponível para autorização de `solicitacoes`, `aprovacoes`, `dashboard-visao-geral`, `configuracao-fluxos`, `painel-insights` e `auditoria-logs`.
- [ ] Todo `User` provisionado tem `role` dentro do enum e `gestor_id` válido (referencia usuário existente) ou nulo (topo da hierarquia).
- [ ] Sessão persiste entre recargas de página; expiração e logout levam de volta ao Login sem estado inconsistente.

---

## Questões em Aberto

1. ✅ **RESOLVIDO** (ver `context.md`) — **Provisionamento de usuários:** cadastro usa o e-mail corporativo do funcionário como identificador de setup via seed/admin backend.
2. ✅ **RESOLVIDO** (ver `context.md`) — **Vínculo Supabase Auth ↔ `User` (Prisma):** mesmo `id` entre as duas contas; e-mail usado como facilitador de correlação/acesso.
3. ✅ **RESOLVIDO** (ver `context.md`) — **Recuperação de senha:** fora de escopo do MVP.
4. ✅ **RESOLVIDO** (ver `context.md`) — **Topo da hierarquia:** só `RH_ADMIN` pode ter `gestor_id` nulo; `GESTOR`/`SOLICITANTE` sempre exigem `gestor_id`.
5. ✅ **RESOLVIDO** (ver `context.md`) — **Primeira tela pós-login:** landing única em `/`, sem roteamento condicional por papel.
