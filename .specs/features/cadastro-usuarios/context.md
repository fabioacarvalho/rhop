# Cadastro de Usuários Context

**Gathered:** 2026-08-03
**Spec:** `.specs/features/cadastro-usuarios/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Tela de administração (RH_Admin/Gestor) para criar, editar e desativar `User`, preenchendo a lacuna deixada por `autenticacao-usuarios` ("CRUD de usuários / edição de papel e gestor pela UI" estava fora de escopo daquela feature — provisionamento era só via `scripts/seed-users.ts`).

---

## Implementation Decisions

### Quem pode cadastrar/editar quem

- **RH_ADMIN**: cadastra usuário com **qualquer** `role` (`SOLICITANTE`, `GESTOR`, `RH_ADMIN`) e qualquer `gestor_id` válido (respeitando as regras já travadas em `userService`: só `RH_ADMIN` pode ter `gestor_id` nulo). Pode editar/desativar qualquer usuário, exceto a si mesmo.
- **GESTOR**: cadastra **apenas** `SOLICITANTE`, com `gestor_id` sempre igual ao próprio `id` (sem campo de seleção — fixo no backend, não só escondido na UI). Só pode editar/desativar usuários que já são seus subordinados diretos (`gestor_id === GESTOR.id` e `role === SOLICITANTE`).
- **SOLICITANTE**: sem acesso a esta tela (bloqueado no backend, mesmo padrão de `configuracao-fluxos`/`auditoria-logs`).
- Ninguém edita ou desativa a si mesmo por esta tela (guarda contra lockout — decisão do agente, não perguntada explicitamente, mas necessária para não deixar um `RH_ADMIN` se autodesativar/rebaixar sem saída).

### Senha inicial do novo usuário

- O sistema **gera uma senha temporária aleatória** no backend e cria a conta no Supabase Auth (`admin.createUser`) com ela — ninguém que cadastra vê ou digita a senha.
- A senha temporária é enviada por e-mail via `resendService` (já existente, reusado de `notificacaoService`).
- Falha no envio do e-mail **não** desfaz a criação do usuário (mesmo princípio de resiliência de IA/notificação do projeto) — grava `Log` tipo `ERRO` e a resposta da API sinaliza que o e-mail não foi confirmado como enviado, para quem cadastrou avisar o colaborador por fora.
- **Fora de escopo**: reenvio de e-mail de senha temporária, "esqueci minha senha" (já fora de escopo em `autenticacao-usuarios`), redefinição de senha por admin depois da criação.

### Escopo de CRUD

- **Criação** + **edição** (`nome`, `role`, `gestor_id` — dentro dos limites de quem edita) + **desativação/reativação** (toggle de um campo `ativo`, não é exclusão definitiva).
- `email` **não é editável** — é a chave de correlação com Supabase Auth; editar exigiria sincronizar as duas contas, não pedido e não necessário para o MVP desta feature.
- Sem exclusão definitiva (hard delete) — preserva integridade referencial de `Log`, `Solicitacao.solicitante_id`, `Aprovacao.aprovador_id`, etc.
- Editar o `role` de alguém que ainda é `gestor_id` de outros usuários (equipe não vazia) para um papel que não pode ter subordinados é bloqueado (mesmo padrão de bloqueio por dependência já usado em `tipoFluxoService.editar`/`ErroEdicaoBloqueada`).

### Agent's Discretion

- Geração exata da senha temporária (comprimento/formato) — critério do Design, documentado com nota de incerteza sobre a política de senha padrão do Supabase Auth (não confirmada em documentação durante esta sessão).
- Rotas exatas (`/usuarios`, `/usuarios/novo`, `/usuarios/[id]/editar`) e onde entra o item de menu (grupo "Administração" do `navConfig.ts` existente, visível a `GESTOR` e `RH_ADMIN`).
- Reativação foi incluída como o lado reverso do mesmo toggle de desativação (não é uma feature nova, é a mesma ação com o valor oposto) — decisão do agente para não deixar "desativar" como porta sem volta.

---

## Specific References

Nenhuma referência visual específica no mockup (`docs/design-ux-ui/fluxorh-mockup.html`) — esta tela não existe no mockup original. Reusar os tokens/padrões visuais definidos em `docs/design-ux-ui/fluxorh-ui-layout-specs.md` (§1 Design System, `.stamp-badge` para status Ativo/Inativo) e a estrutura de listagem+form já usada em `configuracao-fluxos` (Screen 7) como referência de layout mais próxima.

---

## Deferred Ideas

- Reenvio de e-mail de senha temporária / redefinição de senha por admin — pós-MVP.
- Reassociação em massa de equipe ao desativar um gestor com subordinados ativos — pós-MVP, não bloqueado nesta versão.
- GESTOR cadastrar/gerenciar outro GESTOR (sub-hierarquia) — não pedido; ficou de fora.
