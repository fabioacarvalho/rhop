# Gestão de Equipes Tasks

**Design**: `.specs/features/gestao-equipes/design.md`
**Status**: Draft

---

## Nota sobre estratégia de execução e teste

Convenção de teste já estabelecida no repo (Vitest, `npm run test`, ver `cadastro-usuarios/tasks.md`):

| Code Layer | Test Type | Parallel-Safe |
| --- | --- | --- |
| `lib/services/*.ts` (`equipeService`, `userService`, `aprovacaoService`, `dashboardService`, `insightsService`, `authService`) | unit (Vitest, Prisma mockado) | Yes |
| `lib/validations/*.ts` (Zod) | unit (Vitest) | Yes |
| `prisma/schema.prisma` | none — `prisma validate` + migration real | Yes |
| API Routes (`app/api/**/route.ts`) | none — finas por convenção do `CLAUDE.md` | Yes |
| `scripts/*.ts` (migração, seed) | none — verificação manual contra dados reais/seed local | **Não** — toca dados reais, executar 1 vez, sob supervisão |
| Componentes de UI / `navConfig.ts` | none — cenário manual (`npm run dev`) | Yes |

Gate check commands:
- `quick`: `npm run test`
- `build`: `npm run build` (+ `npx prisma validate` quando a task tocar `schema.prisma`)
- `full`: `npm run build && npx prisma validate && npm run test`
- `data`: execução manual documentada no "Verify" da própria task — sem gate automatizado (mexe em dados reais).

**Regra de ordem inegociável** (ver `design.md`, "Ordem de execução"): a migration que remove `User.gestor_id` (T16) só pode ser aplicada depois que T13 (script de migração de dados) tiver sido **executado com sucesso contra o banco real** (T14) — não só escrito/testado. Nenhum sub-agente deve rodar T16 sem confirmação explícita de que T14 já rodou em produção/no ambiente de dados real do projeto.

---

## Execution Plan

```
Phase A (Parallel — schema aditivo + fundações independentes):
  ├── T1 [P] (schema: model Equipe + User.equipe_id, gestor_id mantido)
  ├── T2 [P] (validations Zod de Equipe)
  └── T3 [P] (navConfig: item Equipes)

Phase B (Parallel — depende só do schema aditivo):
  T1        done → T4 [P] (equipeService)
  T1        done → T5 [P] (aprovacaoService revisado)
  T1        done → T7 [P] (authService revisado)

Phase C (depende de equipeService):
  T4        done → T6 [P] (dashboardService/insightsService revisados)
  T2,T4     done → T8 [P] (rotas app/api/equipes/**)
  T1,T4     done → T9 [P] (validations/usuario.ts revisado)

Phase D (depende de T9/T4):
  T4,T9     done → T10 (userService revisado)

Phase E (Parallel — UI):
  T8,T4     done → T11 [P] (UI /equipes)
  T10,T4    done → T12 [P] (UI /usuarios revisado)

Phase F (dados — sequencial, fora do fluxo de código):
  T1        done → T13 (script scripts/migrate-equipes.ts)
  T13       done → T14 (execução manual do script contra dados reais)
  T1,T4     done → T15 (scripts/seed-users.ts revisado)

Phase G (Sequencial — fecha a feature, exige tudo acima):
  T5,T6,T7,T9,T10,T11,T12,T14,T15 done → T16 (remove gestor_id do schema + atualiza CLAUDE.md)
```

---

## Task Breakdown

### T1: Schema aditivo — model `Equipe` + `User.equipe_id` [P]

**What**: Adicionar `model Equipe` (`id`, `nome` único, `gestor_id` obrigatório referenciando `User`, `membros User[]`, `ativo`, `criado_em`, `atualizado_em`) e o campo `equipe_id String?` + relação `equipe Equipe?` em `User` (relação `"EquipeMembros"`) + `equipesGerenciadas Equipe[]` (relação `"EquipeGestor"`), conforme `design.md` seção "Data Models". **`User.gestor_id` e a relação `"Hierarquia"` NÃO são tocados nesta task** — ficam em paralelo até T16. Gerar e aplicar migration real (aditiva, sem `DROP COLUMN`).
**Where**: `prisma/schema.prisma`, `prisma/migrations/`
**Depends on**: None
**Reuses**: mesmo padrão de `id` (`cuid()`), `ativo`, `criado_em`/`atualizado_em` já usado em `TipoFluxo`/`User`
**Requirement**: EQP-01 (fundação de dados)

**Tools**: MCP: NONE · Skill: `supabase-postgres-best-practices` (antes de escrever a migration)

**Done when**:
- [ ] `Equipe` presente com `nome @unique`, `gestor_id @db.Uuid` (não nullable), `ativo Boolean @default(true)`
- [ ] `User.equipe_id` presente, nullable, sem `@default`
- [ ] `User.gestor_id`/relação `"Hierarquia"` inalterados nesta task
- [ ] Migration gerada e aplicada sem erro contra o Supabase real; nenhum dado existente perdido (é só `ADD`)
- [ ] Gate check passa: `npx prisma validate` + `prisma migrate status` (up to date)

**Tests**: none
**Gate**: build

**Commit**: `feat(gestao-equipes): adiciona model Equipe e campo equipe_id em User`

---

### T2: Schemas Zod de `Equipe` [P]

**What**: `lib/validations/equipe.ts` com `equipeInputSchema` (`nome` trim/min 1, `gestor_id` UUID obrigatório) e `definirStatusEquipeInputSchema` (`{ ativo: z.boolean() }`), mesma convenção de `lib/validations/tipoFluxo.ts`.
**Where**: `lib/validations/equipe.ts`, `lib/validations/equipe.test.ts`
**Depends on**: None
**Reuses**: mesmo padrão de `lib/validations/tipoFluxo.ts`
**Requirement**: EQP-01, EQP-03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `nome` vazio/só espaços → rejeitado; presente → aceito
- [ ] `gestor_id` ausente ou não-UUID → rejeitado; UUID válido → aceito
- [ ] `definirStatusEquipeInputSchema` sem `ativo`/tipo errado → rejeitado
- [ ] Gate check passa: `npm run test`

**Tests**: unit
**Gate**: quick

**Verify**: `npm run test -- equipe`

**Commit**: `feat(gestao-equipes): adiciona schemas zod de equipe`

---

### T3: Item "Equipes" no menu de Administração [P]

**What**: Adicionar `{ label: "Equipes", href: "/equipes", roles: [Role.RH_ADMIN] }` ao array `items` do grupo `administracao` em `navConfig.ts`.
**Where**: `lib/navigation/navConfig.ts` (modify)
**Depends on**: None
**Reuses**: `getVisibleGroups`/`resolveScreenTitle` (sem mudança de lógica)
**Requirement**: EQP-04, EQP-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `RH_ADMIN` vê "Equipes" na sidebar, dentro de "Administração"
- [ ] `GESTOR`/`SOLICITANTE` não veem o item
- [ ] Gate check passa: `npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(gestao-equipes): adiciona item Equipes ao menu de administracao`

---

### T4: `equipeService` — CRUD e leituras reusadas [P]

**What**: Novo `lib/services/equipeService.ts` com `criar`, `editar`, `definirStatus`, `listar`, `buscarPorId`, `listarAtivasParaSelecao`, `listarGeridasPor`, `contarGeridasAtivasPor` (usada por `userService.editar` para o bloqueio de dependência), conforme `design.md` seção "Components". Novos erros `ErroNaoEncontradoEquipe`, `ErroValidacaoEquipe`, `ErroEdicaoBloqueadaEquipe`.
**Where**: `lib/services/equipeService.ts`, `lib/services/equipeService.test.ts`
**Depends on**: T1
**Reuses**: padrão `criar`/`editar`/`ErroValidacao*` de `lib/services/tipoFluxoService.ts`, `logService.registrar`
**Requirement**: EQP-01 a EQP-09, EQP-26

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `criar` com `gestor_id` de um `User` `role = GESTOR`/`ativo = true` → cria `Equipe`, grava `AUDITORIA`/`CRIACAO`
- [ ] `criar`/`editar` com `nome` duplicado (`P2002`) → `ErroValidacaoEquipe`, nenhuma escrita
- [ ] `criar`/`editar` com `gestor_id` inexistente, `role != GESTOR`, ou `ativo = false` → `ErroValidacaoEquipe`, nenhuma escrita
- [ ] `editar` em `id` inexistente (`P2025`) → `ErroNaoEncontradoEquipe`
- [ ] `definirStatus(id, false, ...)` com `>=1` membro `ativo = true` associado → `ErroEdicaoBloqueadaEquipe`, nenhuma escrita
- [ ] `definirStatus(id, false, ...)` sem membro ativo → `update` aplicado, `AUDITORIA`/`DESATIVACAO`
- [ ] `definirStatus(id, true, ...)` sempre permitido (sem checagem de membros), `AUDITORIA`/`REATIVACAO`
- [ ] `listar` retorna nome do gestor + contagem de membros ativos por `Equipe`
- [ ] `listarGeridasPor(gestorId)` retorna só `Equipe` `ativo = true` com `gestor_id = gestorId`
- [ ] `contarGeridasAtivasPor(userId)` retorna a contagem correta (0 quando não gerencia nenhuma)
- [ ] Gate check passa: `npm run test`

**Tests**: unit
**Gate**: quick

**Verify**: `npm run test -- equipeService`

**Commit**: `feat(gestao-equipes): implementa cadastro, edicao, status e listagem de equipes`

---

### T5: `aprovacaoService` — aprovação roteada por `Equipe` [P]

**What**: Revisar `SolicitacaoComRelacoes`, `assertPodeDecidir`, `listarPendentes`, `listarHistorico` para ler `solicitante.equipe.gestor_id` em vez de `solicitante.gestor_id` (includes ajustados), conforme `design.md`.
**Where**: `lib/services/aprovacaoService.ts` (modify), `lib/services/aprovacaoService.test.ts` (modify)
**Depends on**: T1
**Reuses**: estrutura existente de `assertPodeDecidir`/`listarPendentes` (só troca o campo lido)
**Requirement**: EQP-15, EQP-16, EQP-17

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Etapa `GESTOR` decidida pelo `User` que é `gestor_id` da `Equipe` do solicitante → sucesso
- [ ] Etapa `GESTOR` decidida por qualquer outro `User` (mesmo outro `GESTOR` de outra equipe) → `ErroNaoAutorizadoAprovacao` (403)
- [ ] Solicitante com `equipe_id = null` → `ErroNaoAutorizadoAprovacao` para qualquer usuário
- [ ] `listarPendentes`/`listarHistorico` de um `GESTOR` só retornam solicitações de solicitantes cuja `Equipe.gestor_id` é ele
- [ ] Nenhum teste pré-existente de `aprovacaoService` que dependia de `gestor_id` direto sobrevive sem ajuste (arquivo de teste revisado, não só o código)
- [ ] Gate check passa: `npm run test`

**Tests**: unit
**Gate**: quick

**Verify**: `npm run test -- aprovacaoService`

**Commit**: `feat(gestao-equipes): roteia aprovacao da etapa gestor pela equipe do solicitante`

---

### T6: `dashboardService`/`insightsService` — visibilidade agregada por equipes geridas [P]

**What**: Revisar `visibilidadeSolicitacaoWhere` (`dashboardService`) e `resolverIdsVisiveis` (`insightsService`) para, no caso `GESTOR`, chamar `equipeService.listarGeridasPor(usuario.id)` e filtrar por `equipe_id: { in: ids } }` em vez de `gestor_id: usuario.id`, conforme `design.md`.
**Where**: `lib/services/dashboardService.ts` (modify), `lib/services/insightsService.ts` (modify), respectivos `*.test.ts`
**Depends on**: T4
**Reuses**: `equipeService.listarGeridasPor`
**Requirement**: EQP-19, EQP-20, EQP-21

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `GESTOR` responsável por 2 `Equipe`s vê solicitações/contadores agregando membros de ambas
- [ ] `GESTOR` sem nenhuma `Equipe` gerida → escopo `[usuario.id]` apenas (não lança, não quebra — mesmo contrato de hoje)
- [ ] `RH_ADMIN` sem mudança de comportamento (`null`/sem filtro)
- [ ] Gate check passa: `npm run test`

**Tests**: unit
**Gate**: quick

**Verify**: `npm run test -- dashboardService insightsService`

**Commit**: `feat(gestao-equipes): agrega visibilidade de dashboard e insights por equipes geridas`

---

### T7: `authService` — remove `gestor_id` de `AuthenticatedUser` [P]

**What**: Remover o campo `gestor_id` da interface `AuthenticatedUser` e do retorno de `getSessionUser` — confirmado nesta sessão que nenhum consumidor lê `ator.gestor_id`/`usuario.gestor_id` (só o `gestor_id` do **alvo**, buscado fresco do banco, é usado — ver `design.md`, Tech Decisions).
**Where**: `lib/services/authService.ts` (modify), `lib/services/authService.test.ts` (modify)
**Depends on**: T1
**Reuses**: estrutura existente de `getSessionUser` (só remove 1 campo do objeto retornado)
**Requirement**: fundação (suporte a EQP-10 a EQP-21, sem requisito próprio)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `AuthenticatedUser` não tem mais `gestor_id`
- [ ] `getSessionUser()` não seleciona/retorna `gestor_id`
- [ ] Nenhum teste pré-existente de `authService` regride
- [ ] Gate check passa: `npm run test`

**Tests**: unit
**Gate**: quick

**Verify**: `npm run test -- authService`

**Commit**: `refactor(gestao-equipes): remove gestor_id de AuthenticatedUser`

---

### T8: Rotas `app/api/equipes/**` [P]

**What**: `app/api/equipes/route.ts` (`POST` → `criar`), `app/api/equipes/[id]/route.ts` (`PUT` → `editar`), `app/api/equipes/[id]/status/route.ts` (`PATCH` → `definirStatus`) — `authService.requireUser([Role.RH_ADMIN])` → Zod (T2) → `equipeService` (T4). Mapeamento: `ErroNaoAutenticado`→401, `ErroNaoAutorizado`→403, Zod inválido→400, `ErroNaoEncontradoEquipe`→404, `ErroValidacaoEquipe`/`ErroEdicaoBloqueadaEquipe`→409.
**Where**: `app/api/equipes/route.ts`, `app/api/equipes/[id]/route.ts`, `app/api/equipes/[id]/status/route.ts`
**Depends on**: T2, T4
**Reuses**: `authService.requireUser`, padrão de `app/api/tipos-fluxo/**`/`app/api/usuarios/**`
**Requirement**: EQP-01, EQP-02, EQP-03, EQP-05, EQP-06, EQP-07, EQP-09

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Sem sessão ou papel `!= RH_ADMIN` → 401/403, `equipeService` nunca é chamado
- [ ] Corpo inválido (Zod) → 400, `equipeService` nunca é chamado
- [ ] `POST` válido → 201 com `{ equipe }`
- [ ] `PUT` em `id` inexistente → 404; `nome` duplicado/`gestor_id` inválido → 409
- [ ] `PATCH` bloqueado por membros ativos → 409; válido → 200 com `{ equipe }`
- [ ] Gate check passa: `npm run build`

**Tests**: none
**Gate**: build

**Verify**: smoke manual via `npm run dev` + fetch — confirmar cada status HTTP acima com sessão `RH_ADMIN` real seedada e com sessão `GESTOR`/`SOLICITANTE` pra confirmar o bloqueio.

**Commit**: `feat(gestao-equipes): implementa rotas de cadastro/edicao/status de equipe`

---

### T9: `lib/validations/usuario.ts` revisado — `equipe_id` em vez de `gestor_id` [P]

**What**: Trocar `gestor_id: z.string().uuid().nullable().optional()` por `equipe_id: z.string().nullable().optional()` (não é UUID — `Equipe.id` é `cuid()`) em `cadastrarUsuarioInputSchema`/`editarUsuarioInputSchema`. `definirStatusInputSchema` inalterado.
**Where**: `lib/validations/usuario.ts` (modify), `lib/validations/usuario.test.ts` (modify)
**Depends on**: T1
**Reuses**: mesma estrutura de schema, só troca o campo/formato
**Requirement**: EQP-10 a EQP-14

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `equipe_id` ausente/`null`/string não vazia → aceito pelo Zod (validação de existência/status é regra de serviço, não de formato — mesma separação já usada pra `gestor_id`)
- [ ] Nenhum teste antigo de `gestor_id` sobrevive sem atualização (arquivo revisado, não só código de produção)
- [ ] Gate check passa: `npm run test`

**Tests**: unit
**Gate**: quick

**Verify**: `npm run test -- usuario`

**Commit**: `feat(gestao-equipes): troca gestor_id por equipe_id nos schemas de usuario`

---

### T10: `userService` revisado — escopo e hierarquia por `Equipe`

**What**: Revisar `AlvoEscopo`/`estaNoEscopo`/`assertEscopoGestao`/`validarHierarquia`/`provisionar`/`cadastrar`/`editar`/`listar`/`buscarPorId`/`UsuarioResumo` conforme `design.md` seção "`userService` (revisado)": `gestor_id` → `equipe_id`; escopo do `GESTOR` passa por `equipeService.listarGeridasPor`/`contarGeridasAtivasPor`; bloqueio de "role trocado deixaria dependentes órfãos" passa a contar `Equipe`s geridas ativas em vez de subordinados diretos.
**Where**: `lib/services/userService.ts` (modify), `lib/services/userService.test.ts` (modify/extend)
**Depends on**: T4, T9
**Reuses**: `equipeService.listarGeridasPor`/`contarGeridasAtivasPor`/`buscarPorId` (T4), `logService.registrar`, `ErroPermissaoUsuario`/`ErroEdicaoBloqueadaUsuario` (já existentes)
**Requirement**: EQP-10 a EQP-14, edge case "editar role de gestor responsável por equipe ativa", edge case "limpar equipe_id ao trocar role"

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `cadastrar` por `RH_ADMIN` com `role = SOLICITANTE` e `equipe_id` de qualquer `Equipe` ativa → sucesso
- [ ] `cadastrar` por `RH_ADMIN` com `role = SOLICITANTE` sem `equipe_id` → rejeitado (obrigatório)
- [ ] `cadastrar` por `RH_ADMIN` com `role != SOLICITANTE` e `equipe_id` informado → rejeitado
- [ ] `cadastrar` por `GESTOR` com `equipe_id` entre as próprias `equipesGerenciadas` → `role` forçado `SOLICITANTE`, sucesso
- [ ] `cadastrar` por `GESTOR` com `equipe_id` de uma equipe que ele NÃO gerencia → `ErroPermissaoUsuario`, nenhuma chamada ao Supabase Admin
- [ ] `editar` trocando `role` de um `SOLICITANTE` com `equipe_id` preenchido para `GESTOR`/`RH_ADMIN` → `equipe_id` limpo automaticamente (`null`)
- [ ] `editar` trocando `role` de um `GESTOR` responsável por `Equipe` `ativo = true` para outro papel → `ErroEdicaoBloqueadaUsuario`, nenhuma escrita
- [ ] `listar` por `GESTOR` com 2 `Equipe`s geridas retorna `SOLICITANTE`s de ambas
- [ ] `buscarPorId` fora do escopo do `GESTOR` (equipe que ele não gerencia) → `ErroNaoEncontradoUsuario`
- [ ] `UsuarioResumo` expõe `equipe_id`/`equipe_nome` (não mais `gestor_id`/`gestor_nome`)
- [ ] Gate check passa: `npm run test`

**Tests**: unit
**Gate**: quick

**Verify**: `npm run test -- userService`

**Commit**: `feat(gestao-equipes): migra escopo e hierarquia de usuarios para equipe`

---

### T11: UI — tela `/equipes` [P]

**What**: `app/(dashboard)/equipes/page.tsx` (listagem: nome, gestor responsável, contagem de membros ativos, status, ações), `app/(dashboard)/equipes/_components/EquipeForm.tsx` (form nome + `<select>` de gestor via `userService.listarElegiveisComoGestor()` filtrado a `role === GESTOR`), `app/(dashboard)/equipes/_components/StatusToggleButton.tsx` (mesmo padrão do de `usuarios`, chama `PATCH /api/equipes/[id]/status`), `app/(dashboard)/equipes/novo/page.tsx`, `app/(dashboard)/equipes/[id]/editar/page.tsx` (inclui detalhe de membros — EQP-26).
**Where**: `app/(dashboard)/equipes/**`
**Depends on**: T8, T4
**Reuses**: estrutura de `configuracao-fluxos`/`usuarios` (listagem+form+`StatusToggleButton`)
**Requirement**: EQP-01 a EQP-09, EQP-26

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `RH_ADMIN` cria, edita, lista e desativa/reativa `Equipe` pela UI
- [ ] `GESTOR`/`SOLICITANTE` bloqueados no backend (mesmo padrão de `configuracao-fluxos`)
- [ ] Tentativa de desativar `Equipe` com membro ativo mostra o erro 409 de forma legível
- [ ] Página de edição lista os membros atuais (nome/e-mail/status)
- [ ] Gate check passa: `npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(gestao-equipes): implementa tela de gestao de equipes`

---

### T12: UI — `/usuarios` revisado (`equipe_id` em vez de `gestor_id`) [P]

**What**: Revisar `UsuarioForm.tsx` (troca `<select>` de `gestor_id` por `<select>` de `equipe_id` — populado por `equipeService.listarAtivasParaSelecao()` quando `atorRole === RH_ADMIN`, ou `equipeService.listarGeridasPor(ator.id)` quando `atorRole === GESTOR`), `app/(dashboard)/usuarios/novo/page.tsx`, `app/(dashboard)/usuarios/[id]/editar/page.tsx` (trocam a fonte de dados do `<select>`), `app/(dashboard)/usuarios/page.tsx` (coluna "Gestor" → "Equipe").
**Where**: `app/(dashboard)/usuarios/_components/UsuarioForm.tsx`, `app/(dashboard)/usuarios/novo/page.tsx`, `app/(dashboard)/usuarios/[id]/editar/page.tsx`, `app/(dashboard)/usuarios/page.tsx`
**Depends on**: T10, T4
**Reuses**: estrutura existente dos componentes (só troca a fonte/campo)
**Requirement**: EQP-10 a EQP-14

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Cadastro de `SOLICITANTE` por `RH_ADMIN` mostra `<select>` com todas as `Equipe`s ativas
- [ ] Cadastro de `SOLICITANTE` por `GESTOR` mostra `<select>` só com as equipes que ele gerencia (pré-selecionado se só 1)
- [ ] Cadastro/edição de `GESTOR`/`RH_ADMIN` não mostra campo de equipe
- [ ] Listagem `/usuarios` mostra coluna "Equipe" com o nome resolvido
- [ ] Gate check passa: `npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(gestao-equipes): revisa formulario e listagem de usuarios para usar equipe`

---

### T13: Script de migração de dados `scripts/migrate-equipes.ts`

**What**: Script one-off (mesmo estilo de `scripts/seed-users.ts`) que: 1) busca todo `User` `role = GESTOR`; 2) pula os sem nenhum subordinado via `gestor_id` (EQP-24); 3) cria 1 `Equipe` (`nome: "Equipe de {nome}"`, `gestor_id`) por gestor com subordinado; 4) `updateMany` preenchendo `equipe_id` dos subordinados; 5) registra (`Log` tipo `ERRO`) e pula `User` cujo `gestor_id` aponta pra alguém que não é `role = GESTOR`, sem interromper o restante.
**Where**: `scripts/migrate-equipes.ts`
**Depends on**: T1
**Reuses**: `lib/prisma.ts`, `logService.registrar` — não usa `equipeService` (escrita direta, script one-off fora do runtime da app)
**Requirement**: EQP-22, EQP-23, EQP-24, edge case "gestor_id inconsistente"

**Tools**: MCP: NONE · Skill: `supabase-postgres-best-practices`

**Done when**:
- [ ] Rodado contra uma cópia/seed dos dados atuais: cada `GESTOR` com subordinado ganha exatamente 1 `Equipe`; cada subordinado ganha o `equipe_id` correto
- [ ] `GESTOR` sem subordinado não gera `Equipe` vazia
- [ ] `User` com `gestor_id` inconsistente (apontando pra não-`GESTOR`) é pulado e logado, sem interromper os demais
- [ ] Script é idempotente o suficiente para rodar 2x sem duplicar `Equipe`s (checar `nome` existente antes de criar, ou aceitar erro de duplicidade tratado) — documentar a escolha no próprio script
- [ ] Gate check passa: `npm run build` (script compila/typa)

**Tests**: none
**Gate**: build

**Verify**: rodar `npx tsx scripts/migrate-equipes.ts` contra o ambiente de desenvolvimento/seed local primeiro; inspecionar `Equipe`s e `equipe_id` resultantes manualmente antes de considerar pronto para T14.

**Commit**: `feat(gestao-equipes): adiciona script de migracao de gestor_id para equipe`

---

### T14: Execução do script de migração contra dados reais

**What**: Executar `scripts/migrate-equipes.ts` (T13) contra o banco Supabase real do projeto — **ação sobre dados reais, requer confirmação explícita do usuário antes de rodar**, e backup/snapshot prévio se disponível no plano do Supabase.
**Where**: N/A (execução, não código)
**Depends on**: T13
**Reuses**: N/A
**Requirement**: EQP-22, EQP-23, EQP-24 (efetivação em produção)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Confirmação explícita do usuário obtida antes da execução (ação irreversível sem backup)
- [ ] Script executado sem erro contra o banco real
- [ ] Contagem de `Equipe`s criadas e `User`s com `equipe_id` preenchido conferida manualmente contra a contagem esperada (baseada nos `gestor_id` existentes antes da execução)
- [ ] Nenhum `Log` tipo `ERRO` de "gestor_id inconsistente" inesperado (se houver, revisado manualmente antes de prosseguir para T16)

**Tests**: none
**Gate**: data

**Commit**: N/A (execução, sem diff de código)

---

### T15: `scripts/seed-users.ts` revisado — usa `Equipe`/`equipe_id`

**What**: Atualizar o seed para criar `Equipe`s de exemplo (1+ por `GESTOR` seedado) e usar `equipe_id` nos `SOLICITANTE`s seedados, em vez de `gestor_email -> gestor_id`. Necessário **antes** de T16 (remoção de `gestor_id` do schema) — senão o seed quebra a build de qualquer dev que rodar `npm run build`/o próprio script depois do merge.
**Where**: `scripts/seed-users.ts` (modify)
**Depends on**: T1, T4
**Reuses**: mesmo client admin já usado no script (inalterado nesta feature)
**Requirement**: fundação (bloqueador de deploy, sem requisito próprio — ver `design.md`, Riscos)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Seed roda do zero (`npx tsx scripts/seed-users.ts`) e cria `GESTOR`s, `Equipe`s (com esses `GESTOR`s como responsáveis) e `SOLICITANTE`s com `equipe_id` preenchido, sem usar `gestor_id`
- [ ] Nenhuma referência a `gestor_id`/`gestor_email` sobra no script
- [ ] Gate check passa: `npm run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(gestao-equipes): atualiza seed de usuarios para usar equipe`

---

### T16: Remove `gestor_id`/`"Hierarquia"` do schema + atualiza `CLAUDE.md`

**What**: Migration que remove `User.gestor_id` e a auto-relação `"Hierarquia"` (`User.gestor`/lado inverso) do `schema.prisma`. Atualiza `CLAUDE.md` (regra de visibilidade) conforme `design.md` seção "`CLAUDE.md` (revisado)". **Só pode rodar depois de T5, T6, T7, T9, T10, T11, T12, T14, T15 confirmados** (nenhum código de produção lendo `gestor_id`, dados já migrados).
**Where**: `prisma/schema.prisma`, `prisma/migrations/`, `CLAUDE.md`
**Depends on**: T5, T6, T7, T9, T10, T11, T12, T14, T15
**Reuses**: nenhum — task de fechamento
**Requirement**: EQP-25

**Tools**: MCP: NONE · Skill: `supabase-postgres-best-practices`

**Done when**:
- [ ] `npm run build` completo passa (não só `npm run test`) — garante que nenhum consumidor de `gestor_id`/`AuthenticatedUser.gestor_id` ficou órfão (TypeScript pega em tempo de build)
- [ ] `grep -r "gestor_id" --include=*.ts --include=*.tsx` (fora de `.specs/`/histórico de migrations antigas) não retorna nenhum uso em código de produção
- [ ] Migration aplicada com sucesso contra o banco real (depois de T14 confirmado)
- [ ] `CLAUDE.md` com a frase de visibilidade atualizada para `Equipe`
- [ ] Gate check passa: `npm run build && npx prisma validate && npm run test`

**Tests**: none
**Gate**: full

**Verify**: `npm run build && npx prisma validate && npm run test` + confirmação manual de login/aprovação ponta-a-ponta com um usuário real pós-migração.

**Commit**: `feat(gestao-equipes): remove gestor_id do schema e atualiza regra de visibilidade`

---

## Parallel Execution Map

```
Phase A (Parallel): T1 [P], T2 [P], T3 [P]
Phase B (Parallel): T1 done → T4 [P], T5 [P], T7 [P]
Phase C (Parallel): T4 done → T6 [P] · T2,T4 done → T8 [P] · T1,T4 done → T9 [P]
Phase D (Sequential): T4,T9 done → T10
Phase E (Parallel): T8,T4 done → T11 [P] · T10,T4 done → T12 [P]
Phase F (Sequential, dados): T1 done → T13 → T14 (manual/confirmação) · T1,T4 done → T15 [P com T13/T14]
Phase G (Sequential, fecha a feature): T5,T6,T7,T9,T10,T11,T12,T14,T15 done → T16
```

Execução real recomendada: Fases A/B/C podem ser delegadas a sub-agentes em paralelo (arquivos disjuntos). T14 (execução contra dados reais) **não** deve ser delegada sem confirmação explícita do usuário na hora — é a única task desta feature com esse requisito.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Schema `Equipe` + `equipe_id` | 1 model novo + 1 campo, aditivo | ✅ Granular |
| T2: Schemas Zod de Equipe | 1 arquivo, 2 schemas | ✅ Granular |
| T3: `navConfig.ts` | 1 arquivo, 1 item | ✅ Granular |
| T4: `equipeService` | 1 arquivo, 1 concern coeso (administração de equipe) | ✅ Granular (mesmo padrão de `tipoFluxoService`/`userService`) |
| T5: `aprovacaoService` revisado | 1 arquivo, 1 troca de campo em 3 funções relacionadas | ✅ Granular |
| T6: `dashboardService`/`insightsService` revisados | 2 arquivos, 1 concern (visibilidade agregada) | ✅ Granular |
| T7: `authService` revisado | 1 arquivo, 1 remoção de campo | ✅ Granular |
| T8: Rotas `app/api/equipes/**` | 3 arquivos, 1 concern (CRUD HTTP de equipe) | ✅ Granular |
| T9: `lib/validations/usuario.ts` revisado | 1 arquivo, 1 troca de campo | ✅ Granular |
| T10: `userService` revisado | 1 arquivo, 1 concern coeso (mesma extensão de escopo já feita em `cadastro-usuarios`) | ✅ Granular |
| T11: UI `/equipes` | 5 arquivos, 1 concern (CRUD completo de 1 tela) | ✅ Granular |
| T12: UI `/usuarios` revisado | 4 arquivos, 1 concern (troca de campo) | ✅ Granular |
| T13: Script de migração | 1 arquivo | ✅ Granular |
| T14: Execução da migração | 0 arquivos (ação) | ✅ Granular |
| T15: `scripts/seed-users.ts` revisado | 1 arquivo | ✅ Granular |
| T16: Remoção de `gestor_id` + doc | 2-3 arquivos, 1 concern (fechamento) | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Fase A, sem seta de entrada | ✅ Match |
| T2 | None | Fase A, sem seta de entrada | ✅ Match |
| T3 | None | Fase A, sem seta de entrada | ✅ Match |
| T4 | T1 | Fase B ← T1 | ✅ Match |
| T5 | T1 | Fase B ← T1 | ✅ Match |
| T7 | T1 | Fase B ← T1 | ✅ Match |
| T6 | T4 | Fase C ← T4 | ✅ Match |
| T8 | T2, T4 | Fase C ← T2,T4 | ✅ Match |
| T9 | T1, T4 | Fase C ← T1,T4 | ✅ Match |
| T10 | T4, T9 | Fase D ← T4,T9 | ✅ Match |
| T11 | T8, T4 | Fase E ← T8,T4 | ✅ Match |
| T12 | T10, T4 | Fase E ← T10,T4 | ✅ Match |
| T13 | T1 | Fase F ← T1 | ✅ Match |
| T14 | T13 | Fase F ← T13 | ✅ Match |
| T15 | T1, T4 | Fase F ← T1,T4 | ✅ Match |
| T16 | T5,T6,T7,T9,T10,T11,T12,T14,T15 | Fase G ← todas | ✅ Match |

Nenhuma task `[P]` depende de outra `[P]` na mesma fase — verificado.

---

## Test Co-location Validation

| Task | Código Criado/Modificado | Convenção Exige | Task Diz | Status |
| --- | --- | --- | --- | --- |
| T1: Schema | schema (sem lógica própria) | none | none | ✅ OK |
| T2: Zod schemas | `lib/validations/equipe.ts` | unit | unit | ✅ OK |
| T4: `equipeService` | `lib/services/equipeService.ts` | unit | unit | ✅ OK |
| T5: `aprovacaoService` | `lib/services/aprovacaoService.ts` | unit | unit | ✅ OK |
| T6: `dashboardService`/`insightsService` | 2 arquivos de service | unit | unit | ✅ OK |
| T7: `authService` | `lib/services/authService.ts` | unit | unit | ✅ OK |
| T8: Rotas equipes | API route (fina) | none | none | ✅ OK |
| T9: `lib/validations/usuario.ts` | validation | unit | unit | ✅ OK |
| T10: `userService` | `lib/services/userService.ts` | unit | unit | ✅ OK |
| T11/T12: UI | Componentes de UI | none | none | ✅ OK |
| T13/T15: Scripts | script one-off | none (verificação manual) | none | ✅ OK |
| T14: Execução | N/A | N/A | N/A | ✅ OK |
| T16: Remoção de campo + doc | schema + doc | none (build completo cobre) | none | ✅ OK |

Nenhuma violação — todas as tasks que tocam `lib/services/*.ts`/`lib/validations/*.ts` escrevem/atualizam seus próprios testes.

---

## Requirement Traceability (atualização)

| Requirement ID | Task(s) |
| --- | --- |
| EQP-01 | T1, T2, T4, T8, T11 |
| EQP-02 | T4, T8 |
| EQP-03 | T2, T4, T8 |
| EQP-04 | T3, T4, T11 |
| EQP-05 | T4, T8, T11 |
| EQP-06 | T3, T4, T8 |
| EQP-07 | T4, T8, T11 |
| EQP-08 | T4, T11 |
| EQP-09 | T4, T8, T11 |
| EQP-10 | T9, T10, T12 |
| EQP-11 | T9, T10, T12 |
| EQP-12 | T9, T10 |
| EQP-13 | T9, T10, T12 |
| EQP-14 | T9, T10, T12 |
| EQP-15 | T5 |
| EQP-16 | T5 |
| EQP-17 | T5 |
| EQP-18 | T5 (consequência, sem checagem nova) |
| EQP-19 | T6, T10 |
| EQP-20 | T6 |
| EQP-21 | T6 |
| EQP-22 | T13, T14 |
| EQP-23 | T13, T14 |
| EQP-24 | T13, T14 |
| EQP-25 | T16 |
| EQP-26 | T4, T11 |

Coverage: 26/26 requisitos mapeados para pelo menos 1 task.

---

## Riscos / Pontos a verificar na fase de Execute

- **T14 é a task de maior risco da feature** — roda contra dados reais, sem rollback automático além de um backup manual do Supabase. Nenhum sub-agente deve executá-la sem confirmação explícita do usuário na hora, mesmo que T13 já esteja testado e aprovado.
- **T16 depende de 9 tasks anteriores confirmadas** — antes de aplicar a migration destrutiva, rodar `grep -r "gestor_id"` (fora de `.specs/`) e confirmar 0 ocorrências em código de produção; não confiar só na lista de dependências declarada.
- `assertEscopoGestao`/`estaNoEscopo` (T10) precisam de teste unitário por combinação de papel/alvo/equipe — a superfície de erro aumentou em relação a `cadastro-usuarios` (agora inclui "Gestor com 2 equipes, alvo em cada uma"); cobrir sem amostragem, mesmo cuidado já exigido na feature anterior.
- `scripts/seed-users.ts` (T15) e `scripts/migrate-equipes.ts` (T13) tocam o mesmo tipo de dado por caminhos diferentes — confirmar que rodar o seed **depois** da migração de dados reais (T14) não recria `Equipe`s duplicadas por nome (idempotência do seed em ambiente com dados já migrados, não só em banco vazio).
- Revalidar no início da fase Execute se algum código novo foi adicionado entre esta sessão de planejamento e a execução que também leia `gestor_id` (o `grep` desta sessão é uma foto do repo em 2026-08-03).
