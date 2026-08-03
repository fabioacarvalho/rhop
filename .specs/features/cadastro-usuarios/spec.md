# Cadastro de Usuários Specification

> Feature slug: `cadastro-usuarios` · Requirement prefix: `USR`
> Fonte da verdade: `.specs/features/autenticacao-usuarios/spec.md` (modelo `User`, papéis, regras de hierarquia já travadas), `CLAUDE.md` (regras de negócio invioláveis) e `docs/design-ux-ui/fluxorh-ui-layout-specs.md` (design system — esta tela não existe no mockup original, reusa os tokens/padrões descritos ali).

## Problem Statement

Hoje o único jeito de colocar um colaborador no FluxoRH é rodar `scripts/seed-users.ts` manualmente — `autenticacao-usuarios` deixou isso explicitamente fora de escopo ("CRUD de usuários / edição de papel e gestor pela UI... Design doc não prevê tela de gestão de usuários no MVP"). Isso trava o uso real do produto: RH e Gestores não conseguem onboardar/desligar/corrigir hierarquia de colaboradores sem depender de alguém rodar um script. Esta feature entrega a tela de administração de usuários que fecha essa lacuna.

## Goals

- [ ] RH_Admin cadastra um novo usuário com qualquer `role` e `gestor_id` válido, direto da UI, sem depender de script.
- [ ] Gestor cadastra um novo `SOLICITANTE` na própria equipe, direto da UI, sem acesso a outros papéis ou gestores.
- [ ] Todo usuário cadastrado pela UI recebe senha temporária por e-mail e consegue autenticar sem intervenção manual de alguém com acesso ao banco/Supabase.
- [ ] RH_Admin e Gestor conseguem corrigir dados (`nome`, `role`, `gestor_id`, dentro dos limites do próprio papel) e desativar/reativar usuários que estão no seu escopo de gestão, sem apagar histórico associado (`Log`, `Solicitacao`, `Aprovacao`).

## Out of Scope

Explicitamente excluído. Documentado para evitar scope creep.

| Feature | Motivo |
| ------- | ------ |
| Tela de self-service signup | Já fora de escopo global (`autenticacao-usuarios`) — cadastro é sempre feito por RH_Admin/Gestor sobre outra pessoa, nunca auto-cadastro. |
| Edição de `email` | `email` é a chave de correlação com Supabase Auth (junto com `id`); editar exigiria sincronizar as duas contas — não pedido, não necessário para o MVP desta feature. |
| Exclusão definitiva (hard delete) de usuário | Quebraria integridade referencial de `Log.usuario_id`, `Solicitacao.solicitante_id`, `Aprovacao.aprovador_id`, `Feedback.usuario_id`, `Candidato.criado_por`. Substituído por desativação (soft, campo `ativo`). |
| "Esqueci minha senha" / redefinição de senha por admin após a criação | Já fora de escopo em `autenticacao-usuarios` (recuperação de senha); esta feature só cobre a senha temporária do momento da criação. |
| Reenvio de e-mail de senha temporária | Não pedido; se o e-mail falhar, fica registrado em `Log` tipo `ERRO`, mas não há botão de "reenviar" nesta versão. |
| GESTOR cadastrar/gerenciar outro `GESTOR` (sub-hierarquia) | Decisão travada em `context.md` — Gestor só cadastra/gerencia `SOLICITANTE` na própria equipe. |
| Reatribuição em massa de equipe ao desativar um gestor com subordinados ativos | `gestor_id` dos subordinados não é tocado automaticamente ao desativar quem eles apontam. |
| Motor de workflow visual, múltiplos aprovadores em paralelo, upload de arquivo, notificação via Slack/Teams, multi-tenant | Fora de escopo global do projeto (`CLAUDE.md`). |

---

## User Stories

### P1: RH_Admin cadastra usuário com qualquer papel ⭐ MVP

**User Story**: Como RH_Admin, quero cadastrar um novo usuário informando nome, e-mail, papel e gestor, para dar acesso ao sistema a um colaborador sem depender de rodar script.

**Why P1**: É o núcleo literal da feature — sem isso não existe "cadastro pelo RH" e o time continua dependente do seed manual.

**Acceptance Criteria**:

1. WHEN um usuário autenticado com papel `RH_ADMIN` submete o formulário com `nome`, `email`, `role` (qualquer valor do enum) e `gestor_id` (quando aplicável) THEN o sistema SHALL criar o usuário no Supabase Auth e o `User` correspondente no Prisma, com o mesmo `id` das duas contas.
2. WHEN `role` submetido é `RH_ADMIN` THEN o sistema SHALL aceitar `gestor_id` nulo (topo da hierarquia), mantendo a regra já travada em `userService`.
3. WHEN `role` submetido é `GESTOR` ou `SOLICITANTE` THEN o sistema SHALL exigir um `gestor_id` que referencie um `User` existente, rejeitando nulo, auto-referência ou `id` inexistente (mesmas validações já existentes em `userService.provisionar`).
4. WHEN o `email` submetido já pertence a um `User` existente THEN o sistema SHALL rejeitar a criação com mensagem clara, sem criar conta duplicada no Supabase Auth nem no Prisma.
5. WHEN campos obrigatórios (`nome`, `email`, `role`) estão ausentes ou o `email` não tem formato válido THEN o sistema SHALL rejeitar a submissão com mensagem clara, sem chamar o Supabase Auth.
6. WHEN um usuário autenticado com papel diferente de `RH_ADMIN` ou `GESTOR` tenta cadastrar usuário THEN o sistema SHALL negar o acesso no backend (independente do que a UI esconde).

**Independent Test**: Autenticar como `RH_ADMIN`, cadastrar um `GESTOR` com `gestor_id` apontando para o `RH_ADMIN` autenticado, confirmar que aparece na listagem e que o login com a senha temporária recebida funciona.

---

### P1: Gestor cadastra `SOLICITANTE` na própria equipe ⭐ MVP

**User Story**: Como Gestor, quero cadastrar um novo `SOLICITANTE` na minha equipe informando apenas nome e e-mail, para dar acesso ao sistema a um membro do meu time sem depender do RH.

**Why P1**: É o segundo poder explícito do pedido ("cadastro pelo RH **ou gestor**") — sem isso, Gestor continua dependente do RH_Admin para qualquer onboarding do próprio time.

**Acceptance Criteria**:

1. WHEN um usuário autenticado com papel `GESTOR` submete o formulário com `nome` e `email` THEN o sistema SHALL criar o `User` com `role = SOLICITANTE` e `gestor_id` igual ao `id` do próprio Gestor autenticado, ignorando/rejeitando qualquer `role`/`gestor_id` diferente que a requisição tente enviar.
2. WHEN um Gestor tenta submeter `role` diferente de `SOLICITANTE` (ex.: manipulando a requisição diretamente) THEN o sistema SHALL rejeitar a criação com erro de autorização (403), sem criar nada.
3. WHEN o `email` submetido já pertence a um `User` existente THEN o sistema SHALL rejeitar a criação com a mesma mensagem clara da história de RH_Admin.

**Independent Test**: Autenticar como Gestor, cadastrar um `SOLICITANTE`, confirmar `gestor_id` gravado é o do Gestor autenticado e que o novo usuário aparece na listagem "minha equipe" do próprio Gestor.

---

### P1: Novo usuário recebe senha temporária por e-mail ⭐ MVP

**User Story**: Como colaborador recém-cadastrado, quero receber minha senha de acesso por e-mail, para conseguir logar no FluxoRH sem falar com ninguém do time técnico.

**Why P1**: Sem isso, o cadastro cria uma conta que ninguém sabe como acessar — a feature fica incompleta mesmo com o `User` persistido.

**Acceptance Criteria**:

1. WHEN um `User` é criado com sucesso (por RH_Admin ou Gestor) THEN o sistema SHALL gerar uma senha temporária aleatória, usá-la para criar a conta no Supabase Auth, e enviar um e-mail ao novo usuário com a senha temporária e instrução de acesso.
2. WHEN a criação no Supabase Auth é bem-sucedida mas o `provisionar` do `User` no Prisma falha (ex.: `email` duplicado detectado apenas no Prisma) THEN o sistema SHALL desfazer a conta criada no Supabase Auth (compensação), sem deixar conta órfã sem `User` correspondente.
3. WHEN o envio do e-mail com a senha temporária falha (Resend indisponível ou erro) THEN o sistema SHALL manter o usuário criado (Auth + Prisma), gravar `Log` tipo `ERRO`, e informar na resposta da API que o e-mail não foi confirmado como enviado — a falha de e-mail NUNCA desfaz a criação do usuário.

**Independent Test**: Cadastrar um usuário de teste com e-mail real acessível, confirmar recebimento do e-mail com senha temporária, e logar com sucesso usando essa senha.

---

### P1: Listagem de usuários por escopo de papel ⭐ MVP

**User Story**: Como RH_Admin ou Gestor, quero ver a lista de usuários que estão no meu escopo de gestão, para saber quem já está cadastrado antes de criar um novo ou de editar/desativar alguém.

**Why P1**: É pré-requisito de UX para editar/desativar (P2) e para o Gestor confirmar quem já é seu subordinado antes de cadastrar duplicado.

**Acceptance Criteria**:

1. WHEN um `RH_ADMIN` acessa a tela de usuários THEN o sistema SHALL listar todos os `User` cadastrados, com `nome`, `email`, `role`, nome do gestor (quando houver) e status (`ativo`/`inativo`).
2. WHEN um `GESTOR` acessa a tela de usuários THEN o sistema SHALL listar apenas os `User` com `role = SOLICITANTE` e `gestor_id` igual ao próprio `id` — nunca a base inteira.
3. WHEN um `SOLICITANTE` tenta acessar a tela de usuários THEN o sistema SHALL negar o acesso no backend.

**Independent Test**: Cadastrar 2 `SOLICITANTE` sob Gestores diferentes; autenticar como um dos Gestores e confirmar que só o próprio subordinado aparece; autenticar como `RH_ADMIN` e confirmar que ambos aparecem.

---

### P2: Edição de usuário (nome, papel, gestor)

**User Story**: Como RH_Admin ou Gestor, quero corrigir nome, papel ou gestor de um usuário já cadastrado dentro do meu escopo, para arrumar erro de cadastro ou refletir mudança de time sem recriar a conta.

**Why P2**: Corrige o dado sem precisar de um caminho de "excluir e recriar", que perderia histórico — importante para manutenção real, mas o produto funciona no MVP sem isso (P1 já entrega o cadastro).

**Acceptance Criteria**:

1. WHEN um `RH_ADMIN` edita `nome`, `role` e/ou `gestor_id` de qualquer `User` (exceto si mesmo) THEN o sistema SHALL validar as mesmas regras de hierarquia do cadastro (role ∈ enum, `gestor_id` nulo só se `RH_ADMIN`, sem auto-referência, `gestor_id` deve existir) antes de salvar.
2. WHEN um `GESTOR` tenta editar um `User` que não é seu subordinado direto (`gestor_id !== GESTOR.id` ou `role !== SOLICITANTE`) THEN o sistema SHALL negar com erro de autorização (403), sem alterar nada.
3. WHEN um `GESTOR` edita seu subordinado direto THEN o sistema SHALL permitir apenas a alteração de `nome` — tentativa de alterar `role`/`gestor_id` do subordinado SHALL ser rejeitada (403), mantendo o subordinado como `SOLICITANTE` do próprio Gestor.
4. WHEN alguém tenta editar o próprio usuário (RH_Admin ou Gestor editando a si mesmo) THEN o sistema SHALL negar a edição, para nunca permitir autorrebaixamento ou perda do próprio acesso por essa tela.
5. WHEN a edição tenta mudar o `role` de um usuário que ainda é `gestor_id` de outros usuários ativos para um papel diferente de `GESTOR`/`RH_ADMIN` THEN o sistema SHALL rejeitar a edição com mensagem clara, sem deixar subordinados apontando para um `gestor_id` sem capacidade de gerir equipe.

**Independent Test**: Como RH_Admin, editar o `nome` de um `SOLICITANTE`; tentar mudar o `role` de um `GESTOR` com equipe ativa para `SOLICITANTE` e confirmar bloqueio; como Gestor, tentar editar um `User` fora da própria equipe e confirmar 403.

---

### P2: Desativação e reativação de usuário

**User Story**: Como RH_Admin ou Gestor, quero desativar o acesso de um usuário que saiu da empresa/equipe (e reativar se necessário), para bloquear login sem apagar o histórico dele no sistema.

**Why P2**: Necessário para desligamento real de colaboradores, mas o MVP de onboarding (P1) funciona sem isso.

**Acceptance Criteria**:

1. WHEN um `RH_ADMIN` desativa qualquer `User` (exceto si mesmo) THEN o sistema SHALL marcar `ativo = false`, sem apagar o registro nem suas relações (`Log`, `Solicitacao`, `Aprovacao`, etc.).
2. WHEN um `GESTOR` desativa um subordinado direto (`gestor_id === GESTOR.id` e `role === SOLICITANTE`) THEN o sistema SHALL aplicar a mesma regra da história acima; tentar desativar alguém fora do próprio escopo SHALL ser negado (403).
3. WHEN um usuário com `ativo = false` tenta autenticar (mesmo com sessão Supabase válida) THEN o sistema SHALL tratar como não autenticado (mesmo contrato de `authService.getSessionUser` retornando `null` para "sessão sem `User`"), registrando `Log` tipo `ERRO`.
4. WHEN um `RH_ADMIN` ou `GESTOR` (dentro do próprio escopo) reativa um `User` com `ativo = false` THEN o sistema SHALL marcar `ativo = true`, permitindo login novamente.
5. WHEN alguém tenta desativar a si mesmo THEN o sistema SHALL negar a operação, para nunca permitir autoexclusão de acesso por essa tela.

**Independent Test**: Desativar um `SOLICITANTE` de teste, confirmar que o login dele passa a ser bloqueado; reativar e confirmar que o login volta a funcionar.

---

## Edge Cases

- WHEN o `email` submetido no cadastro é inválido (formato) THEN o sistema SHALL rejeitar antes de chamar o Supabase Auth.
- WHEN a criação no Supabase Auth falha por indisponibilidade/rede THEN o sistema SHALL responder com erro recuperável, sem criar `User` no Prisma (nada parcialmente criado do lado do Prisma).
- WHEN a criação do `User` no Prisma falha após a conta já existir no Supabase Auth (ex.: violação de unicidade de `email` detectada só no Prisma) THEN o sistema SHALL desfazer (deletar) a conta recém-criada no Supabase Auth antes de retornar o erro.
- WHEN o envio de e-mail de senha temporária falha THEN o sistema SHALL registrar `Log` tipo `ERRO` e sinalizar isso na resposta da API, mas NUNCA desfazer a criação do usuário.
- WHEN um `GESTOR` tenta cadastrar/editar/desativar um usuário fora do próprio time (qualquer `role` diferente de `SOLICITANTE` sob ele) THEN o sistema SHALL negar com 403 em todos os casos, mesmo que a UI não exponha esse caminho.
- WHEN alguém tenta editar/desativar o próprio usuário autenticado THEN o sistema SHALL negar, independente do papel.
- WHEN a edição de `role` de um usuário deixaria subordinados existentes "órfãos" de um gestor capaz de gerir equipe (usuário ainda é `gestor_id` de alguém e o novo `role` não é `GESTOR`/`RH_ADMIN`) THEN o sistema SHALL bloquear a edição.
- WHEN um `User` desativado (`ativo = false`) já tem sessão Supabase ativa no navegador THEN o sistema SHALL bloquear o acesso na próxima requisição protegida (mesmo padrão de "sessão sem `User`" de `autenticacao-usuarios`), não apenas no próximo login.

---

## Requirement Traceability

Cada requisito recebe um ID único para rastreamento em design, tasks e validação.

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| USR-01 | P1: RH_Admin cadastra usuário com qualquer papel (criação Auth + Prisma) | Tasks | In Tasks |
| USR-02 | P1: RH_Admin cadastra usuário (`RH_ADMIN` aceita `gestor_id` nulo) | Tasks | In Tasks |
| USR-03 | P1: RH_Admin cadastra usuário (`GESTOR`/`SOLICITANTE` exigem `gestor_id` válido) | Tasks | In Tasks |
| USR-04 | P1: RH_Admin cadastra usuário (`email` duplicado rejeitado) | Tasks | In Tasks |
| USR-05 | P1: RH_Admin cadastra usuário (validação de campos obrigatórios/formato) | Tasks | In Tasks |
| USR-06 | P1: RH_Admin cadastra usuário (bloqueio de papel não autorizado) | Tasks | In Tasks |
| USR-07 | P1: Gestor cadastra `SOLICITANTE` (role/gestor_id fixos no backend) | Tasks | In Tasks |
| USR-08 | P1: Gestor cadastra `SOLICITANTE` (rejeita tentativa de outro role) | Tasks | In Tasks |
| USR-09 | P1: Gestor cadastra `SOLICITANTE` (`email` duplicado rejeitado) | Tasks | In Tasks |
| USR-10 | P1: Senha temporária por e-mail (geração + criação Auth + envio) | Tasks | In Tasks |
| USR-11 | P1: Senha temporária por e-mail (compensação se `provisionar` falhar) | Tasks | In Tasks |
| USR-12 | P1: Senha temporária por e-mail (falha de envio não desfaz criação) | Tasks | In Tasks |
| USR-13 | P1: Listagem (RH_ADMIN vê todos) | Tasks | In Tasks |
| USR-14 | P1: Listagem (GESTOR vê só a própria equipe) | Tasks | In Tasks |
| USR-15 | P1: Listagem (SOLICITANTE bloqueado) | Tasks | In Tasks |
| USR-16 | P2: Edição (RH_ADMIN edita qualquer um, valida hierarquia) | Tasks | In Tasks |
| USR-17 | P2: Edição (GESTOR fora do escopo → 403) | Tasks | In Tasks |
| USR-18 | P2: Edição (GESTOR só edita `nome` do subordinado) | Tasks | In Tasks |
| USR-19 | P2: Edição (bloqueio de autoedição) | Tasks | In Tasks |
| USR-20 | P2: Edição (bloqueio por equipe dependente) | Tasks | In Tasks |
| USR-21 | P2: Desativação (RH_ADMIN) | Tasks | In Tasks |
| USR-22 | P2: Desativação (GESTOR dentro do escopo) | Tasks | In Tasks |
| USR-23 | P2: Desativação (login bloqueado para `ativo = false`) | Tasks | In Tasks |
| USR-24 | P2: Reativação | Tasks | In Tasks |
| USR-25 | P2: Desativação (bloqueio de autodesativação) | Tasks | In Tasks |

**ID format:** `USR-[NUMBER]`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 25 total, 25 mapeados para tasks, 0 não mapeados ✅ (ver `tasks.md`)

---

## Success Criteria

Como saberemos que a feature está bem-sucedida:

- [ ] RH_Admin cadastra um usuário de qualquer papel pela UI e ele consegue logar com a senha recebida por e-mail, sem nenhum script manual.
- [ ] Gestor cadastra um `SOLICITANTE` na própria equipe pela UI, e esse usuário aparece corretamente vinculado (`gestor_id`) sem intervenção do RH.
- [ ] Nenhuma tentativa de Gestor cadastrar/editar/desativar usuário fora do próprio escopo (`SOLICITANTE` sob ele) é aceita pelo backend, mesmo manipulando a requisição diretamente.
- [ ] Falha de envio de e-mail nunca impede a criação do usuário; falha de criação no Prisma nunca deixa conta órfã no Supabase Auth.
- [ ] Usuário desativado tem login bloqueado imediatamente (mesma sessão ou nova), e reativação desfaz o bloqueio.
- [ ] Ninguém consegue editar ou desativar a própria conta por esta tela.

---

## Questões em Aberto

Nenhuma — todas as decisões de escopo foram resolvidas via `/discuss` e registradas em `context.md` antes de escrever este spec.
