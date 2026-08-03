# Integrar Login Google Context

**Gathered:** 2026-08-03
**Spec:** `.specs/features/integrar-login-google/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Adicionar "Entrar com Google" como método de login alternativo, restrito a contas do domínio `@01tec.com.br`, no FluxoRH. Não substitui o login por e-mail/senha já existente (`autenticacao-usuarios`).

---

## Implementation Decisions

### Convivência com login por senha

- Login Google é **adicionado**, não substitui e-mail/senha. Ambos os métodos ficam disponíveis na tela de Login.
- Fluxo de cadastro manual (`userService.cadastrar`, senha temporária por e-mail) não é alterado por esta feature.

### Usuário sem cadastro prévio tentando entrar com Google

- Conta Google do domínio `@01tec.com.br` sem `User` correspondente ainda **é auto-criada** no primeiro login, com `role = SOLICITANTE`.
- `gestor_id` fica `null` nesse auto-cadastro (não há como o sistema adivinhar o gestor a partir só do login Google).
- Consequência aceita pelo usuário: solicitações desse `SOLICITANTE` que dependem de aprovação de `GESTOR` ficam sem aprovador resolvível até que `gestor_id` seja definido — correção de `gestor_id` é tratada pela feature `cadastro-usuarios` (edição de usuário), não por esta feature.

### Restrição de domínio

- Enforcement é **sempre server-side**, no momento da troca do code OAuth pela sessão. O hint `hd` do Google (se usado na UI) é só cosmético, nunca a única barreira.
- Conta fora de `@01tec.com.br` é rejeitada: sessão é encerrada, nenhum `User` é criado ou vinculado.

### Vínculo de identidade

- Se já existir `User` com o mesmo `email` (cadastrado antes via `userService.cadastrar`), o login Google **vincula-se a esse registro existente** (atualiza a correlação de identidade para o novo `id` do Supabase Auth gerado pelo fluxo Google) em vez de criar um segundo `User` duplicado.

### Agent's Discretion

- Nome exato/copy do botão "Entrar com Google" e seu posicionamento na tela de Login.
- Mensagem de erro exibida quando domínio é rejeitado.
- Estratégia técnica exata de vínculo de `id` (upsert vs update) fica para a fase de Design.

---

## Specific References

Nenhuma referência de produto específica trazida pelo usuário — abertura inicial foi "seria possível isso" (pergunta de viabilidade/custo), não uma visão de UI pronta.

---

## Deferred Ideas

- Definir automaticamente `gestor_id` de usuários auto-provisionados via Google (ex.: por heurística de departamento/e-mail) — não discutido, fica para eventual feature futura se necessário.
- Suporte a outros provedores OAuth (Microsoft/Azure AD, etc.) — não pedido, fora desta feature.