# Autenticação e Usuários Context

**Gathered:** 2026-07-30
**Spec:** `.specs/features/autenticacao-usuarios/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Login via Supabase Auth (e-mail/senha) + modelo `User` (id, nome, email, role, gestor_id) que serve de base de autorização para todas as outras features.

---

## Implementation Decisions

### Provisionamento de usuários (Questão em Aberto #1)

- Cadastro de usuário usa o **e-mail corporativo do funcionário** como identificador de setup (ex.: seed/admin backend cria o `User` já com esse e-mail).
- Não há tela de self-service signup no MVP (confirmado, mantém-se fora de escopo).

### Vínculo Supabase Auth ↔ `User` do Prisma (Questão em Aberto #2)

- O `id` do `User` no Prisma é o **mesmo id** do usuário no Supabase Auth (não são identificadores separados a correlacionar por lookup).
- O **e-mail** é usado como facilitador de acesso/correlação prática (ex.: no provisionamento, para confirmar que o `User` certo está sendo vinculado à conta certa do Supabase Auth) — mas a chave de junção efetiva é o `id` compartilhado.

### Agent's Discretion

- Detalhe exato do mecanismo de seed (script vs. endpoint administrativo) fica a critério do Design.

---

## Specific References

Nenhuma referência visual específica — decisão é de modelo de dados/identidade, não de UI.

---

## Deferred Ideas

None — discussão ficou dentro do escopo da feature.
