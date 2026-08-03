# Cadastro de Usuários Tasks

**Design**: `.specs/features/cadastro-usuarios/design.md`
**Status**: Draft

---

## Nota sobre estratégia de execução e teste

Convenção de teste já estabelecida no repo (Vitest, `npm run test`, ver `configuracao-fluxos/tasks.md`):

| Code Layer | Test Type | Parallel-Safe |
| --- | --- | --- |
| `lib/services/*.ts` (`userService`, `authService`) | unit (Vitest, Prisma/Supabase Admin/`resendService`/`logService` mockados) | Yes |
| `lib/validations/*.ts` (Zod) | unit (Vitest) | Yes |
| `lib/supabase/admin.ts` (client thin wrapper) | none (mesmo padrão de `lib/supabase/server.ts`, sem teste) | Yes |
| `prisma/schema.prisma` | none — `prisma validate` + migration real | Yes |
| API Routes (`app/api/**/route.ts`) | none — finas por convenção do `CLAUDE.md` (auth + Zod + service, sem lógica própria) | Yes |
| Componentes de UI / `navConfig.ts` | none — cenário manual (`npm run dev`) | Yes |

Gate check commands:
- `quick`: `npm run test`
- `build`: `npm run build` (+ `npx prisma validate` quando a task tocar `schema.prisma`)
- `full`: `npm run build && npx prisma validate && npm run test`

---

## Execution Plan

```
Phase 1 (Parallel):
  ├── T1 [P] (schema: campo ativo)
  ├── T2 [P] (validations Zod)
  ├── T3 [P] (supabase admin client)
  └── T7 [P] (navConfig: item Usuarios)

Phase 2 (Parallel):
  T1,T2,T3 done → T4 [P] (userService: cadastro/edicao/status/listagem)
  T1        done → T5 [P] (authService: bloqueio de usuario inativo)

Phase 3 (Sequential):
  T2,T4 done → T6 (rotas app/api/usuarios/**)

Phase 4 (Parallel):
  T4,T6 done → T8 [P] (UI: listagem)
  T6      done → T9 [P] (UI: UsuarioForm)

Phase 5 (Sequential):
  T9,T4 done → T10 (UI: paginas novo/editar)
```

---

## Task Breakdown

### T1: Campo `ativo` no modelo `User` [P]

**What**: Adicionar `ativo Boolean @default(true)` ao `model User` em `schema.prisma` (conforme `design.md`, seção "Data Models"). Gerar e aplicar migration real.
**Where**: `prisma/schema.prisma`, `prisma/migrations/`
**Depends on**: None
**Reuses**: nenhum model existente é recriado — só 1 campo novo em `User`
**Requirement**: USR-21 a USR-25 (fundação de dados)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `User.ativo` presente, `Boolean`, `@default(true)`
- [ ] Migration gerada e aplicada sem erro contra o Supabase real; usuários já existentes (seed) permanecem `ativo = true` sem backfill manual (garantido pelo `@default`)
- [ ] Gate check passa: `npx prisma validate` + `prisma migrate status` (up to date)

**Tests**: none
**Gate**: build

**Commit**: `feat(cadastro-usuarios): adiciona campo ativo ao modelo User`

---

### T2: Schemas Zod de cadastro/edição de usuário [P]

**What**: `lib/validations/usuario.ts` com `cadastrarUsuarioInputSchema` (`nome` trim/min 1, `email` formato válido, `role` ∈ enum `Role`, `gestor_id` UUID nullable/opcional), `editarUsuarioInputSchema` (mesmos campos `.partial()`, `.refine` exigindo ao menos 1 campo presente) e `definirStatusInputSchema` (`{ ativo: z.boolean() }`).
**Where**: `lib/validations/usuario.ts`, `lib/validations/usuario.test.ts`
**Depends on**: None
**Reuses**: mesmo padrão de `lib/validations/tipoFluxo.ts`
**Requirement**: USR-05

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `nome` vazio/só espaços → rejeitado; `email` sem formato válido → rejeitado; `role` fora do enum → rejeitado
- [ ] `gestor_id` ausente/`null`/UUID válido → aceito; string não-UUID → rejeitado
- [ ] `editarUsuarioInputSchema` com objeto vazio `{}` → rejeitado (`.refine`); com ao menos 1 campo → aceito
- [ ] `definirStatusInputSchema` sem `ativo` ou com tipo errado → rejeitado
- [ ] Gate check passa: `npm run test`

**Tests**: unit
**Gate**: quick

**Verify**:
```
npm run test -- usuario
```

**Commit**: `feat(cadastro-usuarios): adiciona schemas zod de cadastro/edicao de usuario`

---

### T3: Client administrativo do Supabase Auth [P]

**What**: `lib/supabase/admin.ts` com `createAdminClient()` — mesma configuração já usada inline em `scripts/seed-users.ts` (`createClient` de `@supabase/supabase-js` com `SUPABASE_SERVICE_ROLE_KEY`, `autoRefreshToken: false`, `persistSession: false`), extraída para reuso pelo runtime da aplicação. `scripts/seed-users.ts` **não é modificado** nesta task (fora de escopo, ver `design.md`).
**Where**: `lib/supabase/admin.ts`
**Depends on**: None
**Reuses**: mesma configuração de client já validada em `scripts/seed-users.ts`
**Requirement**: USR-01, USR-11 (fundação)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `createAdminClient()` lança erro claro se `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` ausentes (mesmo comportamento de checagem já usado no seed)
- [ ] `scripts/seed-users.ts` inalterado
- [ ] Gate check passa: `npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(cadastro-usuarios): adiciona client admin do supabase auth`

---

### T4: `userService` — cadastro, edição, status e listagem [P]

**What**: Estender `lib/services/userService.ts` com: função privada `assertEscopoGestao` (regra única "quem age sobre quem", conforme `design.md"); `cadastrar(dados, criador)` (gera senha temporária, `admin.createUser`, reusa `provisionar` para escrita, compensa com `admin.deleteUser` se `provisionar` falhar, envia e-mail via `resendService.enviarEmail` sem propagar falha, grava `Log` `AUDITORIA`/`CRIACAO`); `editar(id, dados, editor)` (valida escopo, bloqueia troca de `role` com equipe dependente, reusa validação de hierarquia de `provisionar` fatorada numa função interna compartilhada, grava `AUDITORIA`/`EDICAO`); `definirStatus(id, ativo, ator)` (valida escopo + autoação, grava `AUDITORIA`/`DESATIVACAO` ou `REATIVACAO`); `listar(ator)` (RH_ADMIN: todos; GESTOR: só `SOLICITANTE` com `gestor_id = ator.id`); `listarElegiveisComoGestor()` (usuários `GESTOR`/`RH_ADMIN` ativos); `buscarPorId(id, ator)` (aplica o mesmo escopo de `listar`, usado pela página de edição). Novas classes `ErroNaoEncontradoUsuario`, `ErroPermissaoUsuario`, `ErroEdicaoBloqueadaUsuario`.
**Where**: `lib/services/userService.ts` (modify), `lib/services/userService.test.ts` (modify/extend)
**Depends on**: T1, T2, T3
**Reuses**: `provisionar` (validação de hierarquia + escrita), `ErroValidacaoUsuario`, `logService.registrar`, `resendService.enviarEmail`, `lib/supabase/admin.ts` (T3)
**Requirement**: USR-01 a USR-04, USR-06 a USR-14, USR-16 a USR-22, USR-24, USR-25

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `cadastrar` por `RH_ADMIN` com `role`/`gestor_id` válidos → cria Auth + `User`, chama `enviarEmail`, retorna `{ usuario, emailEnviado }`, grava `AUDITORIA`
- [ ] `cadastrar` por `GESTOR` força `role = SOLICITANTE` e `gestor_id = ator.id`; tentativa de outro `role` → `ErroPermissaoUsuario`, nenhuma chamada ao Supabase Admin
- [ ] `cadastrar` com `provisionar` falhando (email duplicado) → `admin.deleteUser` chamado com o `id` recém-criado, erro original propagado
- [ ] `cadastrar` com `enviarEmail` retornando `false` → `usuario` criado normalmente, `emailEnviado: false` na resposta, criação NÃO desfeita
- [ ] `editar` por `RH_ADMIN` válido → `update` aplicado, `AUDITORIA`/`EDICAO`
- [ ] `editar` por `GESTOR` sobre alvo fora do escopo (`gestor_id !== ator.id` ou `role !== SOLICITANTE`) → `ErroPermissaoUsuario`, nenhum `update`
- [ ] `editar` tentando mudar `role` de alguém com `equipe.length > 0` para papel ≠ `GESTOR`/`RH_ADMIN` → `ErroEdicaoBloqueadaUsuario`, nenhum `update`
- [ ] `editar`/`definirStatus` com `id === ator.id` (qualquer papel) → `ErroPermissaoUsuario`, nenhuma escrita
- [ ] `definirStatus(id, false, ...)` e `definirStatus(id, true, ...)` por `RH_ADMIN` e por `GESTOR` dentro do escopo → `update` aplicado, `AUDITORIA`/`DESATIVACAO` ou `REATIVACAO`
- [ ] `listar` por `RH_ADMIN` retorna todos; por `GESTOR` retorna só `SOLICITANTE` com `gestor_id = ator.id`
- [ ] `buscarPorId` fora do escopo do `GESTOR` → `ErroNaoEncontradoUsuario` (não revela existência)
- [ ] Gate check passa: `npm run test`

**Tests**: unit
**Gate**: quick

**Verify**:
```
npm run test -- userService
```

**Commit**: `feat(cadastro-usuarios): implementa cadastro, edicao, status e listagem de usuarios`

---

### T5: `authService` — bloqueio de sessão de usuário inativo [P]

**What**: Em `getSessionUser()`, depois de resolver o `User` via `prisma.user.findUnique`, checar `user.ativo === false` → gravar `Log` tipo `ERRO` (`entidade: 'User'`, `acao: 'USUARIO_INATIVO'`, `usuario_id: null`, `detalhes: { id: user.id, email: user.email }`) e retornar `null` (mesmo contrato de "sessão sem `User`" já existente).
**Where**: `lib/services/authService.ts` (modify), `lib/services/authService.test.ts` (modify/extend, se já existir)
**Depends on**: T1
**Reuses**: estrutura existente de `getSessionUser` (mesmo `if` de "sem `User` correspondente", só adiciona a checagem de `ativo`)
**Requirement**: USR-23

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `User` com `ativo = false` → `getSessionUser()` retorna `null`, `logService.registrar` chamado com `acao: 'USUARIO_INATIVO'`
- [ ] `User` com `ativo = true` → comportamento inalterado (retorna `AuthenticatedUser` normalmente)
- [ ] Nenhum teste pré-existente de `authService`/rotas protegidas regride
- [ ] Gate check passa: `npm run test` (suíte completa, não só o arquivo novo — `design.md` "Riscos")

**Tests**: unit
**Gate**: full

**Verify**:
```
npm run test
```

**Commit**: `feat(cadastro-usuarios): bloqueia sessao de usuario inativo em authService`

---

### T6: Rotas `app/api/usuarios/**`

**What**: `app/api/usuarios/route.ts` (`POST` → `cadastrar`), `app/api/usuarios/[id]/route.ts` (`PUT` → `editar`), `app/api/usuarios/[id]/status/route.ts` (`PATCH` → `definirStatus`) — `authService.requireUser([Role.GESTOR, Role.RH_ADMIN])` → Zod correspondente (T2) → `userService` (T4). Mapeamento: `ErroNaoAutenticado`→401, `ErroNaoAutorizado`/`ErroPermissaoUsuario`→403, Zod inválido→400, `ErroNaoEncontradoUsuario`→404, `ErroValidacaoUsuario`/`ErroEdicaoBloqueadaUsuario`→409.
**Where**: `app/api/usuarios/route.ts`, `app/api/usuarios/[id]/route.ts`, `app/api/usuarios/[id]/status/route.ts`
**Depends on**: T2, T4
**Reuses**: `authService.requireUser`, schemas de T2, funções de T4
**Requirement**: USR-01, USR-05, USR-06, USR-16, USR-21, USR-24

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Sem sessão ou papel `SOLICITANTE` → 401/403, `userService` nunca é chamado
- [ ] `POST`/`PUT`/`PATCH` com corpo inválido (Zod) → 400, `userService` nunca é chamado
- [ ] `POST` válido (RH_Admin ou Gestor) → 201 com `{ usuario, emailEnviado }`
- [ ] `PUT` em `id` inexistente ou fora do escopo do Gestor → 404
- [ ] `PUT`/`PATCH` com `ErroPermissaoUsuario` → 403
- [ ] `PUT` bloqueado por equipe dependente → 409
- [ ] `PATCH` válido → 200 com `{ usuario }`
- [ ] Gate check passa: `npm run build`

**Tests**: none
**Gate**: build

**Verify**: smoke manual via `npm run dev` + fetch — confirmar cada status HTTP acima com sessão `RH_ADMIN` real seedada (`rh.admin@01tec.com.br`/`Teste@123`) e com sessão `GESTOR`/`SOLICITANTE` pra confirmar o bloqueio.

**Commit**: `feat(cadastro-usuarios): implementa rotas de cadastro/edicao/status de usuario`

---

### T7: Item "Usuários" no menu de Administração [P]

**What**: Adicionar `{ label: "Usuários", href: "/usuarios", roles: [Role.GESTOR, Role.RH_ADMIN] }` ao array `items` do grupo `administracao` em `navConfig.ts`.
**Where**: `lib/navigation/navConfig.ts` (modify)
**Depends on**: None
**Reuses**: `getVisibleGroups`/`resolveScreenTitle` (sem mudança de lógica, só de dado)
**Requirement**: USR-13, USR-14

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `GESTOR` e `RH_ADMIN` veem "Usuários" na sidebar, dentro de "Administração"
- [ ] `SOLICITANTE` não vê o item
- [ ] Gate check passa: `npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(cadastro-usuarios): adiciona item Usuarios ao menu de administracao`

---

### T8: UI — listagem de usuários [P]

**What**: `app/(dashboard)/usuarios/page.tsx` (Server Component: `requireUser([GESTOR, RH_ADMIN])`, mesmo padrão `try/catch` de `configuracao-fluxos/page.tsx`; chama `userService.listar(usuario)` direto; tabela com Nome/E-mail/Papel/Gestor/Status/Ações; título adaptado ao papel — "Usuários" para RH_Admin, "Minha equipe" para Gestor; estado vazio explícito; botão "+ Novo usuário") + `_components/StatusToggleButton.tsx` (Client Component: chama `PATCH /api/usuarios/[id]/status`, `router.refresh()` no sucesso).
**Where**: `app/(dashboard)/usuarios/page.tsx`, `app/(dashboard)/usuarios/_components/StatusToggleButton.tsx`, `app/(dashboard)/usuarios/usuarios.module.css`
**Depends on**: T4, T6
**Reuses**: `userService.listar`, `authService.requireUser`, tokens de `.stamp-badge` (verde/vermelho) do design system
**Requirement**: USR-13, USR-14, USR-15, USR-21, USR-24

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `RH_ADMIN` vê todos os usuários; `GESTOR` vê só a própria equipe (`SOLICITANTE` sob ele)
- [ ] `SOLICITANTE` bloqueado no backend (mesmo padrão de `configuracao-fluxos`)
- [ ] Lista vazia → estado vazio explícito, sem erro
- [ ] Clique em "Desativar"/"Reativar" reflete o novo status após reload
- [ ] Gate check passa: `npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(cadastro-usuarios): implementa listagem de usuarios com toggle de status`

---

### T9: UI — `UsuarioForm` (compartilhado criar/editar) [P]

**What**: `app/(dashboard)/usuarios/_components/UsuarioForm.tsx` (Client Component) — props `modo: 'criar' | 'editar'`, `atorRole: Role`, `gestoresElegiveis?`, `usuarioInicial?`; renderiza campos conforme papel (RH_Admin: nome+email+role+gestor; Gestor: só nome[+email em criar]); submete `POST`/`PUT /api/usuarios` conforme `modo`; exibe erro do backend de forma legível; sucesso → redireciona pra `/usuarios`.
**Where**: `app/(dashboard)/usuarios/_components/UsuarioForm.tsx`
**Depends on**: T6
**Reuses**: `POST`/`PUT /api/usuarios` (T6), tokens/estilo de `configuracao-fluxos/_components/TipoFluxoForm.tsx`
**Requirement**: USR-01, USR-02, USR-03, USR-05, USR-07, USR-16, USR-18

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Modo `criar` + `atorRole = RH_ADMIN`: campos nome/email/role/gestor visíveis; `gestor` desabilitado/oculto quando `role = RH_ADMIN`
- [ ] Modo `criar` + `atorRole = GESTOR`: só nome/email visíveis, sem role/gestor
- [ ] Modo `editar` + `atorRole = RH_ADMIN`: nome/role/gestor editáveis, `email` bloqueado
- [ ] Modo `editar` + `atorRole = GESTOR`: só `nome` editável
- [ ] Submit com erro do backend (400/403/404/409) → mensagem legível, sem crash
- [ ] Submit bem-sucedido → redireciona pra `/usuarios`
- [ ] Gate check passa: `npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(cadastro-usuarios): implementa formulario de usuario compartilhado`

---

### T10: UI — páginas `/usuarios/novo` e `/usuarios/[id]/editar`

**What**: `app/(dashboard)/usuarios/novo/page.tsx` (Server Component: gate `[GESTOR, RH_ADMIN]`; se `RH_ADMIN`, chama `userService.listarElegiveisComoGestor()`; renderiza `UsuarioForm` modo `criar`) e `app/(dashboard)/usuarios/[id]/editar/page.tsx` (Server Component: gate `[GESTOR, RH_ADMIN]`; chama `userService.buscarPorId(id, ator)` — fora do escopo do Gestor ou `id` inexistente → tela "Acesso restrito"/404 conforme `design.md`; renderiza `UsuarioForm` modo `editar`).
**Where**: `app/(dashboard)/usuarios/novo/page.tsx`, `app/(dashboard)/usuarios/[id]/editar/page.tsx`
**Depends on**: T9, T4
**Reuses**: `UsuarioForm` (T9), `userService.listarElegiveisComoGestor`/`buscarPorId` (T4), `authService.requireUser`
**Requirement**: USR-01, USR-07, USR-16, USR-17, USR-18

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `/novo` por `RH_ADMIN` → formulário com lista de gestores elegíveis carregada
- [ ] `/novo` por `GESTOR` → formulário simplificado, sem chamada a `listarElegiveisComoGestor`
- [ ] `/[id]/editar` com alvo dentro do escopo → formulário pré-preenchido com dados reais
- [ ] `/[id]/editar` com alvo fora do escopo do Gestor ou `id` inexistente → "Acesso restrito"/404, sem vazar dado do alvo
- [ ] `SOLICITANTE` bloqueado em ambas
- [ ] Gate check passa: `npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(cadastro-usuarios): implementa paginas de criacao e edicao de usuario`

---

## Parallel Execution Map

```
Phase 1 (Parallel):
  ├── T1 [P]
  ├── T2 [P]
  ├── T3 [P]
  └── T7 [P]

Phase 2 (Parallel):
  T1,T2,T3 done → T4 [P]
  T1        done → T5 [P]

Phase 3 (Sequential):
  T2,T4 done → T6

Phase 4 (Parallel):
  T4,T6 done → T8 [P]
  T6      done → T9 [P]

Phase 5 (Sequential):
  T9,T4 done → T10
```

Execução real recomendada: Phase 1 e Phase 2 podem ser delegadas a sub-agentes em paralelo (arquivos disjuntos); Phase 3 em diante segue o mesmo padrão sequencial usado nas features anteriores (um sub-agente por vez), já que T6 é pré-requisito compartilhado de T8/T9.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Campo `ativo` | 1 campo em 1 model | ✅ Granular |
| T2: Schemas Zod | 1 arquivo, 3 schemas relacionados | ✅ Granular |
| T3: Client admin Supabase | 1 arquivo, 1 função | ✅ Granular |
| T4: `userService` estendido | 1 arquivo, 1 concern coeso (administração de usuários — cadastro/edição/status/listagem compartilham a mesma regra de escopo) | ✅ Granular (cohesivo, mesmo padrão de `tipoFluxoService` T3 em `configuracao-fluxos`) |
| T5: `authService` — bloqueio inativo | 1 arquivo, 1 checagem adicional | ✅ Granular |
| T6: Rotas `app/api/usuarios/**` | 3 arquivos, 1 concern (CRUD HTTP de usuário) | ✅ Granular |
| T7: `navConfig.ts` | 1 arquivo, 1 item de dado | ✅ Granular |
| T8: UI listagem | 2 arquivos, 1 concern (listagem + toggle) | ✅ Granular |
| T9: UI `UsuarioForm` | 1 arquivo | ✅ Granular |
| T10: UI páginas novo/editar | 2 arquivos, 1 concern (wrapper fino do formulário) | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Fase 1, sem seta de entrada | ✅ Match |
| T2 | None | Fase 1, sem seta de entrada | ✅ Match |
| T3 | None | Fase 1, sem seta de entrada | ✅ Match |
| T7 | None | Fase 1, sem seta de entrada | ✅ Match |
| T4 | T1, T2, T3 | Fase 2 ← T1,T2,T3 | ✅ Match |
| T5 | T1 | Fase 2 ← T1 | ✅ Match |
| T6 | T2, T4 | Fase 3 ← T2,T4 | ✅ Match |
| T8 | T4, T6 | Fase 4 ← T4,T6 | ✅ Match |
| T9 | T6 | Fase 4 ← T6 | ✅ Match |
| T10 | T9, T4 | Fase 5 ← T9,T4 | ✅ Match |

Nenhuma task `[P]` depende de outra `[P]` na mesma fase (T1/T2/T3/T7 independentes entre si; T4/T5 dependem só de fases anteriores; T8/T9 idem) — verificado.

---

## Test Co-location Validation

| Task | Código Criado/Modificado | Convenção Exige | Task Diz | Status |
| --- | --- | --- | --- | --- |
| T1: Schema | schema (sem lógica própria) | none | none | ✅ OK |
| T2: Zod schemas | `lib/validations/usuario.ts` | unit | unit | ✅ OK |
| T3: Client admin | `lib/supabase/admin.ts` | none | none | ✅ OK |
| T4: `userService` | `lib/services/userService.ts` | unit | unit | ✅ OK |
| T5: `authService` | `lib/services/authService.ts` | unit | unit (gate `full`, suíte completa) | ✅ OK |
| T6: Rotas | API route (fina, sem lógica própria) | none | none | ✅ OK |
| T7: `navConfig` | dado de configuração, sem lógica | none | none | ✅ OK |
| T8: UI listagem | Componente de UI | none | none | ✅ OK |
| T9: UI formulário | Componente de UI | none | none | ✅ OK |
| T10: UI páginas | Componente de UI (wrapper) | none | none | ✅ OK |

Nenhuma violação — T4 e T5 (únicas tasks que tocam `lib/services/*.ts`) escrevem seus próprios testes, sem deferir para outra task.

---

## Requirement Traceability (atualização)

| Requirement ID | Task(s) |
| --- | --- |
| USR-01 | T3, T4, T6, T9, T10 |
| USR-02 | T4 |
| USR-03 | T4 |
| USR-04 | T4 |
| USR-05 | T2, T6, T9 |
| USR-06 | T4, T6 |
| USR-07 | T4, T9, T10 |
| USR-08 | T4 |
| USR-09 | T4 |
| USR-10 | T4 |
| USR-11 | T3, T4 |
| USR-12 | T4 |
| USR-13 | T4, T7, T8 |
| USR-14 | T4, T7, T8 |
| USR-15 | T8 |
| USR-16 | T4, T6, T9, T10 |
| USR-17 | T4, T10 |
| USR-18 | T4, T9, T10 |
| USR-19 | T4 |
| USR-20 | T4 |
| USR-21 | T4, T6, T8 |
| USR-22 | T4 |
| USR-23 | T5 |
| USR-24 | T4, T6, T8 |
| USR-25 | T4 |

Coverage: 25/25 requisitos mapeados para pelo menos 1 task.

---

## Riscos / Pontos a verificar na fase de Execute

- `admin.deleteUser` (compensação de T4) nunca foi exercitado neste projeto — confirmar assinatura exata na doc oficial do `@supabase/supabase-js` antes de codar, não assumir.
- Geração de senha temporária (T4) usa comprimento equivalente ao já aceito pelo seed (`Teste@123`, 9 caracteres) — sem confirmação da política de senha padrão do Supabase Auth (ver "Nota de incerteza" em `design.md`); se a criação falhar por senha rejeitada em teste manual, ajustar o gerador antes de prosseguir.
- T5 (bloqueio de usuário inativo em `authService.getSessionUser`) afeta toda rota protegida do sistema — rodar a suíte completa (`npm run test`), não só o teste novo, e validar manualmente login de um usuário ativo real antes de considerar a task concluída.
- `assertEscopoGestao` (dentro de T4) é a única barreira entre "Gestor gerencia a própria equipe" e "Gestor gerencia a base inteira" — cobrir cada combinação de papel/alvo com teste unitário explícito, sem amostragem.
