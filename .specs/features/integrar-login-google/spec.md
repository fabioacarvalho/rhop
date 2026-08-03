# Integrar Login Google Specification

> Feature slug: `integrar-login-google` · Requirement prefix: `GAUTH`
> Fonte da verdade: `.specs/features/autenticacao-usuarios/spec.md` (modelo `User`, papéis, sessão via Supabase Auth já travados), `CLAUDE.md` (regras de negócio invioláveis) e `.specs/features/cadastro-usuarios/spec.md` (fluxo de provisionamento manual já existente, que esta feature complementa sem substituir).
>
> **Nota:** `autenticacao-usuarios/spec.md` linha 28 excluía explicitamente "SSO, OAuth, multi-fator (MFA)" do MVP ("Design doc especifica 'auth simples' e-mail/senha"). Esta feature reabre esse ponto especificamente para login Google restrito a `@01tec.com.br` — as demais exclusões daquela linha (multi-fator, outros provedores SSO) continuam de fora.

## Problem Statement

Hoje o único jeito de entrar no FluxoRH é e-mail/senha, com conta provisionada manualmente por RH_Admin/Gestor (`userService.cadastrar`) e senha temporária enviada por e-mail. Para colaboradores da 01tec que já usam Google Workspace no dia a dia, isso é uma fricção extra (mais uma senha pra lembrar) e um ponto de suporte (senha perdida/expirada). Esta feature adiciona "Entrar com Google" como método alternativo, restrito ao domínio corporativo `@01tec.com.br`, sem remover ou substituir o login por senha existente.

## Goals

- [ ] Colaborador com conta Google `@01tec.com.br` consegue autenticar no FluxoRH pelo botão "Entrar com Google", sem precisar de senha.
- [ ] Conta Google fora do domínio `@01tec.com.br` nunca consegue obter sessão no FluxoRH, mesmo que o usuário tente.
- [ ] Login por e-mail/senha continua funcionando sem nenhuma regressão.
- [ ] Colaborador que já tem `User` cadastrado (via `userService.cadastrar`) e loga com Google pela primeira vez tem sua conta vinculada ao registro existente, nunca duplicada.
- [ ] Colaborador `@01tec.com.br` sem `User` prévio ganha acesso automático como `SOLICITANTE` no primeiro login Google, sem intervenção manual.

## Out of Scope

Explicitamente excluído. Documentado para evitar scope creep.

| Feature | Motivo |
| ------- | ------ |
| Remover/substituir login por e-mail/senha | Decisão travada em `context.md` — os dois métodos convivem. |
| Outros provedores OAuth (Microsoft/Azure AD, etc.) | Não pedido; só Google está no escopo desta feature. |
| Multi-fator (MFA) | Continua fora de escopo, conforme `autenticacao-usuarios`. |
| Definir/inferir `gestor_id` automaticamente para usuário auto-provisionado via Google | Não discutido; `gestor_id` fica nulo e a correção é manual, via a feature `cadastro-usuarios` (edição de usuário). |
| GESTOR ou RH_Admin conseguir auto-provisionar-se com papel diferente de `SOLICITANTE` via Google | Auto-provisionamento via Google sempre cria `SOLICITANTE`; qualquer papel maior exige cadastro manual prévio (`cadastro-usuarios`), que depois é vinculado no primeiro login Google. |
| Tela/fluxo de "recuperação de senha" | Já fora de escopo em `autenticacao-usuarios`; não é afetado por esta feature. |
| Revogar/desvincular uma conta Google já vinculada a um `User` | Não pedido; se necessário, é operação de suporte manual (fora do MVP). |

---

## User Stories

### P1: Login Google restrito ao domínio `@01tec.com.br` ⭐ MVP

**User Story**: Como colaborador da 01tec, quero entrar no FluxoRH com minha conta Google corporativa, para acessar o sistema sem precisar lembrar de outra senha.

**Why P1**: É o núcleo literal do pedido — sem isso não existe "login com Google" nenhum.

**Acceptance Criteria**:

1. WHEN o usuário aciona "Entrar com Google" e autentica com uma conta `@01tec.com.br` THEN o sistema SHALL trocar o código OAuth por uma sessão Supabase válida e conceder acesso à aplicação.
2. WHEN o usuário autentica via Google com uma conta que **não** termina em `@01tec.com.br` THEN o sistema SHALL negar a criação de sessão persistente, encerrar qualquer sessão Supabase obtida no processo, e redirecionar para o Login com mensagem de erro clara — a verificação de domínio SHALL ocorrer no backend (callback), nunca depender só do parâmetro `hd` do Google no client.
3. WHEN a troca do código OAuth por sessão falha (erro do Google/Supabase, rede) THEN o sistema SHALL exibir mensagem de erro recuperável na tela de Login, sem travar a aplicação.
4. WHEN o login por e-mail/senha é usado (fluxo já existente) THEN o sistema SHALL continuar funcionando exatamente como hoje, sem nenhuma alteração de comportamento.

**Independent Test**: Acionar "Entrar com Google" com conta de teste `@01tec.com.br` e confirmar acesso à aplicação; repetir com conta Google fora do domínio e confirmar bloqueio + sem sessão; confirmar que login por senha continua funcionando.

---

### P1: Vínculo com `User` já cadastrado ⭐ MVP

**User Story**: Como colaborador que já foi cadastrado pelo RH/Gestor (com senha temporária), quero conseguir entrar com Google usando o mesmo e-mail, para não precisar continuar usando senha depois que meu acesso já existe.

**Why P1**: Sem isso, todo `User` pré-existente ficaria "sem dono" no primeiro login Google (sessão sem `User` correspondente) — quebraria o caso mais comum (usuário que já foi cadastrado por um admin).

**Acceptance Criteria**:

1. WHEN um usuário autentica via Google com um `email` que já corresponde a um `User` existente no Prisma THEN o sistema SHALL vincular essa sessão ao `User` existente (sem criar um segundo registro), preservando `role`, `gestor_id` e histórico já associados a ele.
2. WHEN esse `User` existente está com `ativo = false` THEN o sistema SHALL negar o acesso pelo mesmo contrato já usado no login por senha (`authService.getSessionUser` retornando negação + `Log` tipo `ERRO`), mesmo com login via Google bem-sucedido no provedor.

**Independent Test**: Cadastrar um usuário de teste via fluxo manual existente; logar com Google usando o mesmo e-mail e confirmar que o `role`/`gestor_id` corretos são resolvidos, sem duplicar o `User`; desativar o usuário e confirmar bloqueio mesmo via Google.

---

### P2: Auto-provisionamento como `SOLICITANTE`

**User Story**: Como colaborador `@01tec.com.br` que ainda não foi cadastrado por ninguém, quero conseguir entrar com Google mesmo assim, para não depender de alguém do RH me cadastrar manualmente antes do meu primeiro acesso.

**Why P2**: Reduz fricção de onboarding, mas o produto já funciona no MVP sem isso (P1 cobre quem já foi cadastrado) — pode ser entregue depois do núcleo de login.

**Acceptance Criteria**:

1. WHEN um usuário autentica via Google com `email` `@01tec.com.br` que **não** corresponde a nenhum `User` existente THEN o sistema SHALL criar automaticamente um `User` com `role = SOLICITANTE`, `gestor_id = null`, `ativo = true`, e conceder acesso.
2. WHEN esse auto-cadastro ocorre THEN o sistema SHALL gravar um `Log` tipo `AUDITORIA` registrando a criação automática via Google.
3. WHEN um `SOLICITANTE` auto-provisionado (com `gestor_id = null`) tenta criar uma `Solicitacao` que depende de aprovação de etapa `GESTOR` THEN o sistema SHALL seguir o comportamento de erro já definido pela feature `solicitacoes` para "colaborador sem gestor" (fora de escopo desta feature redefinir esse comportamento) — esta feature só garante que o `User` existe e está corretamente marcado como sem gestor.

**Independent Test**: Logar com uma conta Google `@01tec.com.br` nova (sem cadastro prévio), confirmar criação automática como `SOLICITANTE` com `gestor_id` nulo e `Log AUDITORIA` correspondente; confirmar acesso à aplicação.

---

## Edge Cases

- WHEN o usuário cancela o consentimento OAuth no Google (não completa o fluxo) THEN o sistema SHALL retornar ao Login sem criar sessão nem `User`.
- WHEN o e-mail retornado pelo Google não é verificado (`email_verified = false`, se aplicável) THEN o sistema SHALL tratar como inválido e negar acesso, pelo mesmo caminho de domínio incorreto.
- WHEN dois logins Google simultâneos chegam para o mesmo `email` novo (condição de corrida no auto-provisionamento) THEN o sistema SHALL garantir que só um `User` seja criado, respeitando a unicidade de `email` já garantida pelo schema (`AUTH-08`).
- WHEN o Supabase Auth ou o provedor Google está indisponível THEN o sistema SHALL exibir erro recuperável no Login, sem travar a aplicação (mesmo padrão do login por senha).

---

## Requirement Traceability

Cada requisito recebe um ID único para rastreamento em design, tasks e validação.

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| GAUTH-01 | P1: Login Google restrito ao domínio (troca de código e sessão) | - | Pending |
| GAUTH-02 | P1: Login Google restrito ao domínio (bloqueio server-side fora do domínio) | - | Pending |
| GAUTH-03 | P1: Login Google restrito ao domínio (erro recuperável na troca de código) | - | Pending |
| GAUTH-04 | P1: Login Google restrito ao domínio (login por senha sem regressão) | - | Pending |
| GAUTH-05 | P1: Vínculo com `User` existente (vincula sem duplicar) | - | Pending |
| GAUTH-06 | P1: Vínculo com `User` existente (`ativo = false` bloqueia mesmo via Google) | - | Pending |
| GAUTH-07 | P2: Auto-provisionamento (`User` criado como `SOLICITANTE`, `gestor_id` nulo) | - | Pending |
| GAUTH-08 | P2: Auto-provisionamento (`Log` `AUDITORIA` da criação automática) | - | Pending |
| GAUTH-09 | P2: Auto-provisionamento (comportamento de "sem gestor" delegado a `solicitacoes`) | - | Pending |

**ID format:** `GAUTH-[NUMBER]`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 9 total, 0 mapeados para tasks, 9 não mapeados ⚠️ (Design/Tasks ainda não executados para esta feature)

---

## Success Criteria

Como saberemos que a feature está bem-sucedida:

- [ ] Colaborador `@01tec.com.br` entra com Google e chega à aplicação autenticado, com `role`/`gestor_id` corretos resolvidos.
- [ ] Nenhuma conta Google fora de `@01tec.com.br` obtém sessão persistente, em nenhum cenário testado.
- [ ] Nenhum `User` duplicado é criado quando alguém que já tinha cadastro manual loga com Google pela primeira vez.
- [ ] Login por e-mail/senha passa nos mesmos testes de `autenticacao-usuarios` sem nenhuma regressão.
- [ ] Usuário novo `@01tec.com.br` (sem cadastro prévio) consegue logar via Google e aparece como `SOLICITANTE` sem gestor, com `Log AUDITORIA` gravado.

---

## Questões em Aberto

1. **Estratégia técnica de vínculo de `id`** (upsert por e-mail atualizando `User.id` para o novo id do Supabase Auth vs. outra abordagem de correlação) — decisão de implementação, fica para a fase de Design.
2. **Configuração externa** (habilitar provider Google no painel do Supabase, criar OAuth client no Google Cloud Console, configurar redirect URLs) é pré-requisito de infraestrutura fora do repositório — não é um requisito de código, mas bloqueia o teste end-to-end até ser feita.