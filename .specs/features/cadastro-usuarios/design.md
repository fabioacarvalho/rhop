# Cadastro de Usuários Design

**Spec**: `.specs/features/cadastro-usuarios/spec.md`
**Context**: `.specs/features/cadastro-usuarios/context.md`
**Status**: Draft

---

## Decisões travadas em `context.md` (não reabrir sem novo `/discuss`)

- RH_ADMIN: qualquer `role`/`gestor_id` válido. GESTOR: só `SOLICITANTE` com `gestor_id` fixo = próprio `id`.
- Senha temporária gerada pelo backend, nunca digitada por quem cadastra; enviada por e-mail (Resend).
- Falha de e-mail nunca desfaz a criação; falha de `provisionar` desfaz a conta Supabase Auth já criada.
- Escopo CRUD: criar + editar (`nome`/`role`/`gestor_id`) + desativar/reativar (toggle de `ativo`). Sem editar `email`, sem hard delete.
- Ninguém edita/desativa a si mesmo por esta tela.

---

## Architecture Overview

```mermaid
graph TD
    UI_LISTA["/usuarios (Server Component)"] -->|requireUser GESTOR|RH_ADMIN| US_LISTAR[userService.listar]
    UI_NOVO["/usuarios/novo (Server Component + Form)"] -->|POST| API_POST["/api/usuarios POST"]
    UI_EDITAR["/usuarios/[id]/editar"] -->|PUT| API_PUT["/api/usuarios/[id] PUT"]
    UI_LISTA -->|toggle ativo| API_STATUS["/api/usuarios/[id]/status PATCH"]

    API_POST --> US_CADASTRAR[userService.cadastrar]
    API_PUT --> US_EDITAR[userService.editar]
    API_STATUS --> US_STATUS[userService.definirStatus]

    US_CADASTRAR -->|gera senha temp| SENHA[gerarSenhaTemporaria]
    US_CADASTRAR -->|admin.createUser| SB_ADMIN[(Supabase Auth - service role)]
    US_CADASTRAR -->|reusa validacao + create| US_PROVISIONAR[userService.provisionar]
    US_CADASTRAR -->|falha no provisionar| SB_DELETE[admin.deleteUser - compensacao]
    US_CADASTRAR -->|sucesso| EMAIL[resendService.enviarEmail]
    US_CADASTRAR -->|sempre| LOG1[logService.registrar]

    US_EDITAR --> DB[(Postgres via Prisma)]
    US_STATUS --> DB
    US_PROVISIONAR --> DB
    US_LISTAR --> DB

    AUTH_SVC[authService.getSessionUser] -->|checa ativo| DB
```

Fluxo síncrono, sem fila/job: a criação de usuário faz `admin.createUser` → `provisionar` → `enviarEmail` na mesma requisição HTTP. Aceitável porque `admin.createUser` e o envio de e-mail são operações rápidas (mesmo padrão de latência já aceito em `notificacaoService`/`iaService`, que também rodam inline).

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
| --- | --- | --- |
| `authService.requireUser(roles?)` | `lib/services/authService.ts` | Gate de rota nas 3 API routes e nas 3 páginas — mesmo padrão de `configuracao-fluxos`. |
| `authService.getSessionUser()` | `lib/services/authService.ts` | Estendido (não reescrito) para checar `user.ativo` — ver seção Tech Decisions. |
| `userService.provisionar` | `lib/services/userService.ts` | Reusado por dentro de `userService.cadastrar` — toda a validação de hierarquia (`role` ∈ enum, `gestor_id` nulo só se `RH_ADMIN`, sem auto-referência, `gestor_id` deve existir, `email` único) já existe e não é duplicada. |
| `userService.ErroValidacaoUsuario` | `lib/services/userService.ts` | Reusado como está para os erros de hierarquia/duplicidade herdados de `provisionar`. |
| `logService.registrar` | `lib/services/logService.ts` (feature `auditoria-logs`) | Toda auditoria (`CRIACAO`, `EDICAO`, `DESATIVACAO`, `REATIVACAO`) e erro (`FALHA_ENVIO_EMAIL_SENHA_TEMP`, `SESSAO_USUARIO_INATIVO`) passam por aqui — não redefine o serviço. |
| `resendService.enviarEmail` | `lib/services/resendService.ts` (feature `notificacoes`) | Reusado como está para o e-mail de senha temporária — já trata falha com `Log` tipo `ERRO` internamente e nunca lança. |
| Padrão de rota fina (auth → Zod → service → status HTTP) | `app/api/tipos-fluxo/**/route.ts`, `app/api/aprovacoes/[solicitacaoId]/decidir/route.ts` | Mesmo padrão aplicado a `app/api/usuarios/**`. |
| Padrão de Server Component com gate de papel | `app/(dashboard)/configuracao-fluxos/page.tsx` | Mesmo padrão de `try/catch` em `ErroNaoAutenticado`/`ErroNaoAutorizado` aplicado às 3 páginas novas. |
| `navConfig.ts` (grupo "Administração") | `lib/navigation/navConfig.ts` | Adiciona 1 item novo (`Usuários`), reusando a mesma fonte única de verdade da navegação — não recria o mecanismo de menu. |
| Design tokens (`.stamp-badge`, cores de status) | `docs/design-ux-ui/fluxorh-ui-layout-specs.md` §1 | Badge Ativo/Inativo reusa o mesmo padrão visual dos carimbos de status (`--verde`/`--verde-bg` para Ativo, `--vermelho`/`--vermelho-bg` para Inativo) já usado em `Minhas Solicitações`/`Aprovações`. |

### Integration Points

| Sistema | Método de integração |
| --- | --- |
| Supabase Auth (admin) | Novo `lib/supabase/admin.ts` — client `@supabase/supabase-js` com `SUPABASE_SERVICE_ROLE_KEY`, mesmo padrão já usado em `scripts/seed-users.ts` (extraído para reuso, sem alterar o script existente). |
| Resend | `resendService.enviarEmail` (já existe, sem mudança de contrato). |
| Postgres (via Prisma) | Novo campo `ativo` em `User`; nenhuma tabela nova. |
| `auditoria-logs` | `logService.registrar` para toda auditoria/erro desta feature. |

---

## Components

### `lib/supabase/admin.ts` (novo)

- **Purpose**: Centralizar o client administrativo do Supabase Auth (service role key), hoje inline em `scripts/seed-users.ts`. Único ponto novo de configuração para operações `admin.*` a partir do runtime da aplicação (rotas de API), diferente de `lib/supabase/server.ts` (que usa cookies de sessão, não service role).
- **Location**: `lib/supabase/admin.ts`.
- **Interfaces**:
  - `createAdminClient(): SupabaseClient` — lê `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, `auth: { autoRefreshToken: false, persistSession: false }` (mesma config do seed).
- **Dependencies**: `@supabase/supabase-js` (já uma dependência do projeto).
- **Reuses**: Nenhum código existente é alterado — `scripts/seed-users.ts` continua com seu client inline (fora de escopo migrá-lo nesta feature); este helper é o client "oficial" para o runtime da aplicação a partir de agora.

### `userService` (estendido)

- **Purpose**: Adicionar cadastro/edição/desativação de `User` via UI, reusando `provisionar` para a escrita e validação de hierarquia já existentes.
- **Location**: `lib/services/userService.ts` (mesmo arquivo, novas exportações).
- **Interfaces**:
  - `cadastrar(dados: CadastrarUsuarioInput, criador: AuthenticatedUser): Promise<{ usuario: User; emailEnviado: boolean }>` — orquestra: valida escopo do `criador` (USR-06 a USR-09) → gera senha temporária → `admin.createUser` → `provisionar` (reuso) → compensação se `provisionar` falhar (USR-11) → `resendService.enviarEmail` (falha não propaga, USR-12) → `logService.registrar` `AUDITORIA`/`CRIACAO`.
  - `editar(id: string, dados: EditarUsuarioInput, editor: AuthenticatedUser): Promise<User>` — valida escopo do `editor` sobre o alvo (USR-16 a USR-19), bloqueio por equipe dependente (USR-20), reusa as mesmas checagens de hierarquia de `provisionar` (extraídas para uma função interna compartilhada — ver Tech Decisions) antes do `prisma.user.update`.
  - `definirStatus(id: string, ativo: boolean, ator: AuthenticatedUser): Promise<User>` — valida escopo do `ator` sobre o alvo + bloqueio de autoalteração (USR-21, USR-22, USR-25); grava `AUDITORIA`/`DESATIVACAO` ou `REATIVACAO`.
  - `listar(ator: AuthenticatedUser): Promise<UsuarioResumo[]>` — `RH_ADMIN`: todos; `GESTOR`: `where { role: SOLICITANTE, gestor_id: ator.id }` (USR-13, USR-14).
  - `listarElegiveisComoGestor(): Promise<{ id: string; nome: string; role: Role }[]>` — usado só pela página `/usuarios/novo`/`/[id]/editar` quando `criador/editor.role === RH_ADMIN`, para popular o `<select>` de `gestor_id` (usuários com `role` `GESTOR` ou `RH_ADMIN`, `ativo = true`).
- **Dependencies**: `lib/prisma.ts`, `lib/supabase/admin.ts` (novo), `logService.registrar`, `resendService.enviarEmail`, `provisionar` (já existente, reusado internamente).
- **Reuses**: `provisionar` (validação de hierarquia + escrita), `ErroValidacaoUsuario` (erros de hierarquia/duplicidade).
- **Novos erros exportados** (mesma convenção de classes de erro do resto do projeto):
  - `ErroNaoEncontradoUsuario` — `id` inexistente em `editar`/`definirStatus` → rota mapeia 404.
  - `ErroPermissaoUsuario` — Gestor fora do escopo, tentativa de role não autorizado, ou autoedição/autodesativação → rota mapeia 403.
  - `ErroEdicaoBloqueadaUsuario` — troca de `role` deixaria subordinados sem gestor capaz de gerir equipe → rota mapeia 409.

### Validação de escopo (função interna, não exportada)

- **Purpose**: Único lugar que decide "quem pode agir sobre quem" (USR-06 a USR-09, USR-16 a USR-19, USR-21, USR-22, USR-25) — evita duplicar a mesma árvore de decisão em `cadastrar`/`editar`/`definirStatus`.
- **Location**: `lib/services/userService.ts` (função privada `assertEscopoGestao`).
- **Regra** (mesma para os 3 usos, com pequenas variações documentadas em cada chamada):
  1. `ator.role === RH_ADMIN` → sempre permitido, EXCETO se `alvoId === ator.id` (autoação bloqueada em todos os 3 casos).
  2. `ator.role === GESTOR` → permitido apenas se `alvo.role === SOLICITANTE` e `alvo.gestor_id === ator.id`; em `cadastrar`, o "alvo" ainda não existe, então a checagem é sobre os dados submetidos (`dados.role === SOLICITANTE` e `dados.gestor_id` forçado para `ator.id`, ignorando valor submetido — USR-07/USR-08); em `editar`, Gestor só pode alterar `nome` (qualquer tentativa de mandar `role`/`gestor_id` diferente do atual é rejeitada, mesmo que o valor "bateria" com a regra — simplicidade: Gestor nunca manda esses campos).
  3. Qualquer outro `ator.role` (`SOLICITANTE`) → nunca chega aqui (bloqueado antes, em `requireUser([GESTOR, RH_ADMIN])` na rota).

### API Routes

- **Purpose**: Camada fina de HTTP — auth, Zod, delega pro service, mapeia erro pra status.
- **Location**:
  - `app/api/usuarios/route.ts` — `POST` (cadastrar).
  - `app/api/usuarios/[id]/route.ts` — `PUT` (editar).
  - `app/api/usuarios/[id]/status/route.ts` — `PATCH` (definir `ativo`).
- **Interfaces**: seguem exatamente o padrão de `app/api/tipos-fluxo/**` e `app/api/aprovacoes/[solicitacaoId]/decidir/route.ts` — `requireUser([Role.GESTOR, Role.RH_ADMIN])` primeiro, depois `safeParse` do Zod correspondente, depois chama o service, depois mapeia erro:
  - `ErroNaoAutenticado` → 401
  - `ErroNaoAutorizado` (papel fora de GESTOR/RH_ADMIN) → 403
  - Zod inválido → 400
  - `ErroPermissaoUsuario` → 403
  - `ErroNaoEncontradoUsuario` → 404
  - `ErroValidacaoUsuario` (hierarquia/duplicidade, herdado de `provisionar`) → 409
  - `ErroEdicaoBloqueadaUsuario` → 409
  - Sucesso `POST` → 201 com `{ usuario, emailEnviado }`; `PUT`/`PATCH` → 200 com `{ usuario }`.
- **Dependencies**: `authService.requireUser`, `lib/validations/usuario.ts` (novo), `userService`.
- **Reuses**: Padrão de mapeamento de erro idêntico ao de `configuracao-fluxos`/`aprovacoes`.

### `lib/validations/usuario.ts` (novo)

- **Purpose**: Schemas Zod dos payloads de entrada, mesma convenção de `lib/validations/tipoFluxo.ts`.
- **Location**: `lib/validations/usuario.ts`.
- **Interfaces**:
  - `cadastrarUsuarioInputSchema` — `nome` (`trim().min(1)`), `email` (`.email()`), `role` (`z.nativeEnum(Role)`), `gestor_id` (`z.string().uuid().nullable().optional()`). A validação de "Gestor só pode mandar `role: SOLICITANTE` sem `gestor_id`" fica no service (é regra de autorização por ator, não de formato — Zod valida forma, `userService` valida quem pode o quê).
  - `editarUsuarioInputSchema` — mesmos campos, todos opcionais (`.partial()`), pelo menos 1 presente (`.refine`).
  - `definirStatusInputSchema` — `{ ativo: z.boolean() }`.
- **Dependencies**: `zod`, `Role` (Prisma).
- **Reuses**: Mesmo padrão de `lib/validations/tipoFluxo.ts` (schema + `superRefine` quando necessário).

### UI — Listagem (`/usuarios`)

- **Purpose**: Tela única, título/dado adaptado ao papel (RH_Admin vê "Usuários"; Gestor vê "Minha equipe").
- **Location**: `app/(dashboard)/usuarios/page.tsx` (Server Component) + `_components/StatusToggleButton.tsx` (Client Component, chama `PATCH .../status` e recarrega a lista).
- **Interfaces**: Sem props externas — chama `requireUser([GESTOR, RH_ADMIN])` e `userService.listar(usuario)` direto (mesmo padrão de `configuracao-fluxos/page.tsx`, sem round-trip por API na leitura).
- **Dependencies**: `authService.requireUser`, `userService.listar`.
- **Reuses**: Estrutura de card/tabela de `configuracao-fluxos/page.tsx`; badge de status reusa os tokens de `.stamp-badge` (`--verde-bg`/`--vermelho-bg`).
- **Comportamento**:
  - Tabela: Nome, E-mail, Papel, Gestor (nome resolvido), Status (badge), Ações (`Editar`, `Desativar`/`Reativar`).
  - Lista vazia → estado vazio explícito (Gestor sem subordinados ainda; RH_Admin nunca deveria ver vazio pós-seed, mas trata do mesmo jeito).
  - Botão "+ Novo usuário" → `/usuarios/novo`.

### UI — Formulário (`UsuarioForm`, compartilhado entre criar/editar)

- **Purpose**: Um único componente adaptando os campos visíveis ao papel de quem está preenchendo — evita duas implementações quase idênticas.
- **Location**: `app/(dashboard)/usuarios/_components/UsuarioForm.tsx` (Client Component).
- **Interfaces**: Props — `modo: 'criar' | 'editar'`, `atorRole: Role`, `gestoresElegiveis?: { id, nome, role }[]` (só passado quando `atorRole === RH_ADMIN`), `usuarioInicial?: { id, nome, email, role, gestor_id }` (só em modo editar).
- **Dependencies**: `POST`/`PUT /api/usuarios` (conforme modo).
- **Reuses**: Estilo de formulário de `configuracao-fluxos/_components/TipoFluxoForm.tsx` (mesmos tokens de `.card.ruled`, inputs, botões `btnPrimary`/`btnGhost`).
- **Comportamento por papel**:
  - `atorRole === RH_ADMIN`: mostra `nome`, `email` (só em modo criar — bloqueado/`disabled` em modo editar, USR out-of-scope de edição de e-mail), `role` (`<select>` com os 3 valores), `gestor_id` (`<select>` com `gestoresElegiveis`, desabilitado/oculto quando `role === RH_ADMIN` selecionado).
  - `atorRole === GESTOR`: mostra só `nome` e `email` (modo criar) ou só `nome` (modo editar) — sem `role`/`gestor_id` em nenhum dos dois modos (fixos no backend).
  - Submit → erro do backend (400/403/404/409) exibido de forma legível, sem crash; sucesso → redireciona pra `/usuarios`.

### UI — Páginas `/usuarios/novo` e `/usuarios/[id]/editar`

- **Purpose**: Wrapper fino de Server Component — gate de papel, carrega dados necessários, renderiza `UsuarioForm`.
- **Location**: `app/(dashboard)/usuarios/novo/page.tsx`, `app/(dashboard)/usuarios/[id]/editar/page.tsx`.
- **Interfaces**: Sem props externas.
- **Dependencies**: `authService.requireUser`, `userService.listarElegiveisComoGestor` (só se `RH_ADMIN`), `userService` (busca do alvo em modo editar — reusa `prisma.user.findUnique` já indiretamente coberto por `editar`/uma nova `buscarPorId` simples).
- **Reuses**: Mesmo padrão de `configuracao-fluxos/novo/page.tsx` e `.../[id]/editar/page.tsx`.
- **Comportamento**:
  - `/novo`: `RH_ADMIN` ou `GESTOR` → formulário vazio em modo criar (props adaptadas ao papel).
  - `/[id]/editar`: busca o `User` alvo; `id` inexistente → 404; Gestor fora do escopo (`gestor_id !== ator.id` ou `role !== SOLICITANTE`) → mesma tela "Acesso restrito" de `configuracao-fluxos` (não 404, pra não revelar existência vs. permissão de forma inconsistente com o resto do app — mesmo padrão de resposta genérica já usado em `autenticacao-usuarios`).

### `navConfig.ts` (modificado)

- **Purpose**: Adicionar item "Usuários" ao grupo `administracao`, visível a `GESTOR` e `RH_ADMIN` (diferente de `Configuração de Fluxos`/`Auditoria & Logs`, que são só `RH_ADMIN` — aqui o Gestor também precisa do link pra gerenciar a própria equipe).
- **Location**: `lib/navigation/navConfig.ts` (append ao array `items` do grupo `administracao`).
- **Mudança**:
  ```ts
  {
    label: "Usuários",
    href: "/usuarios",
    roles: [Role.GESTOR, Role.RH_ADMIN],
  }
  ```
- **Reuses**: `getVisibleGroups`/`resolveScreenTitle` já existentes, sem mudança de lógica.

---

## Data Models

### `User` (campo novo)

```prisma
model User {
  id        String  @id @db.Uuid
  nome      String
  email     String  @unique
  role      Role
  gestor_id String? @db.Uuid
  ativo     Boolean @default(true)   // NOVO — USR-21 a USR-25

  gestor       User?         @relation("Hierarquia", fields: [gestor_id], references: [id])
  equipe       User[]        @relation("Hierarquia")
  logs         Log[]
  notificacoes Notificacao[] @relation("NotificacoesUsuario")
  solicitacoes Solicitacao[]
  aprovacoes   Aprovacao[]
  feedbacks    Feedback[]
  candidatos   Candidato[]
}
```

**Relationships**: sem mudança nas relações existentes. `ativo` é um campo simples, sem relação — `@default(true)` garante que todo `User` já existente (seed, provisionamento atual) continua ativo após a migration, sem backfill manual.

**Campos e nomenclatura**: `ativo` segue a mesma convenção de nome de campo em português já usada no resto do `User` (`nome`, `email`, `role`, `gestor_id`).

---

## Error Handling Strategy

| Cenário | Tratamento | Impacto no usuário |
| --- | --- | --- |
| `Supabase Auth admin.createUser` falha (rede/indisponibilidade) | `cadastrar` propaga o erro antes de tocar Prisma — nada é criado | API responde 502/500 genérico (mesmo padrão de erro não mapeado das outras rotas); nenhum `User` órfão. |
| `provisionar` falha após `admin.createUser` ter sucesso (USR-11) | `cadastrar` chama `admin.deleteUser(id)` (compensação) antes de propagar o erro original | Usuário recebe a mesma mensagem de erro de hierarquia/duplicidade; nenhuma conta órfã fica no Supabase Auth. |
| Envio de e-mail falha (USR-12) | `resendService.enviarEmail` já grava `Log` tipo `ERRO` internamente e retorna `false` (nunca lança); `cadastrar` propaga `emailEnviado: false` na resposta | Criação reportada como sucesso; quem cadastrou vê aviso "e-mail não confirmado" e pode avisar o colaborador por fora. |
| Gestor tenta agir fora do escopo (USR-06 a USR-09, USR-17, USR-22) | `assertEscopoGestao` lança `ErroPermissaoUsuario` ANTES de qualquer escrita | 403, nada alterado. |
| Autoedição/autodesativação (USR-19, USR-25) | Mesma função `assertEscopoGestao`, checagem `alvoId === ator.id` primeiro, independente do papel | 403, nada alterado. |
| Edição de `role` com equipe dependente (USR-20) | `editar` conta `prisma.user.count({ where: { gestor_id: id } })` antes do `update`; > 0 e novo `role` não é `GESTOR`/`RH_ADMIN` → `ErroEdicaoBloqueadaUsuario` | 409 com mensagem citando quantos subordinados ficariam órfãos. |
| Usuário desativado tenta autenticar (USR-23) | `authService.getSessionUser` — depois do `findUnique`, checa `user.ativo === false` → mesmo caminho de "sessão sem `User`": grava `Log` tipo `ERRO` (`acao: 'USUARIO_INATIVO'`) e retorna `null` | Tratado como não autenticado — redirect (página) ou 401 (API), consistente com o resto do app. |

---

## Tech Decisions (only non-obvious ones)

| Decisão | Escolha | Racional |
| --- | --- | --- |
| `cadastrar` reusa `provisionar` em vez de duplicar a escrita | `admin.createUser` → `provisionar({ id: authUser.id, ... })` | Toda a validação de hierarquia (USR-02, USR-03, USR-04) já existe, testada, em `provisionar` — reescrever seria duplicar lógica e risco de regressão. |
| Extração de client admin do Supabase para `lib/supabase/admin.ts`, sem tocar `scripts/seed-users.ts` | Novo arquivo, script antigo inalterado | Reduz duplicação de configuração pro código novo, mas evita ampliar o escopo desta feature refatorando um script que já funciona e não faz parte do pedido. |
| Checagem de escopo (`assertEscopoGestao`) centralizada, não uma checagem por função | Uma função privada compartilhada por `cadastrar`/`editar`/`definirStatus` | As 3 operações têm exatamente a mesma árvore de decisão "RH_Admin sempre pode (exceto self), Gestor só no próprio time (exceto self)" — centralizar evita 3 implementações que podem divergir com o tempo. |
| `ativo` como `Boolean` simples, não um enum de status (`ATIVO`/`INATIVO`/`SUSPENSO`) | Campo booleano | Spec só pede 2 estados (ativo/inativo, com reativação = toggle de volta); um enum de 3+ estados seria over-engineering não pedido. |
| Compensação síncrona (`admin.deleteUser`) em vez de fila de reconciliação | Chamada direta dentro do mesmo `try/catch` de `cadastrar` | Volume baixo (cadastro de usuário não é operação de alto throughput) — uma fila de reconciliação adicionaria infraestrutura não justificada pelo volume; a janela de inconsistência (conta Auth órfã) é fechada na mesma requisição. |
| Gestor não pode editar `role`/`gestor_id` do próprio subordinado, mesmo que o valor "resultante" seria válido | Backend rejeita qualquer payload de Gestor que inclua `role`/`gestor_id` diferentes dos atuais | Simplicidade e defesa em profundidade: a UI do Gestor nunca renderiza esses campos, então qualquer requisição com eles só pode vir de manipulação direta — tratado como tentativa fora do escopo, não como "edição parcialmente válida". |
| `/usuarios/[id]/editar` fora do escopo do Gestor responde "Acesso restrito" (não 404) | Mesmo texto genérico de `configuracao-fluxos` para papel sem permissão | Evita vazar se o `id` existe ou não pra quem não tem permissão sobre ele — mesma postura de não-enumeração já usada em `autenticacao-usuarios` (AUTH-02, mensagem genérica de login). |

> **Nota de incerteza**: a política de senha padrão do Supabase Auth (comprimento mínimo, complexidade exigida) não foi confirmada em documentação durante esta sessão — `scripts/seed-users.ts` já usa uma senha fixa de 9 caracteres (`Teste@123`) sem erro relatado, então a geração de senha temporária desta feature (proposta: `crypto.randomBytes(9).toString('base64url')`, ~12 caracteres alfanuméricos) assume que qualquer string de comprimento equivalente ou maior passa a validação padrão do GoTrue. Confirmar na documentação oficial do Supabase Auth (ou testar contra o projeto real) antes de codar a Task correspondente — se houver requisito de complexidade não coberto (ex.: exigência de símbolo), ajustar o gerador.

---

## Riscos / Pontos a verificar na fase de Tasks

- Verificar se o SDK do Supabase (`@supabase/supabase-js@2.111.0`, já em uso no seed) expõe `admin.deleteUser(id)` com essa assinatura exata — `scripts/seed-users.ts` só usa `admin.createUser`/`admin.listUsers`, então o método de delete não foi exercitado ainda neste projeto; confirmar na doc oficial antes de implementar a compensação (USR-11).
- `assertEscopoGestao` precisa ser escrita e testada com atenção redobrada — é a única barreira entre "Gestor gerencia a própria equipe" e "Gestor gerencia a base inteira"; um teste unitário por combinação de papel/alvo é obrigatório na fase de Tasks (não amostragem).
- `authService.getSessionUser` já é consumido por toda a aplicação — adicionar a checagem de `ativo` ali afeta every rota protegida existente; a Task correspondente deve rodar a suíte de testes completa (`npm run test`), não só o teste novo, para garantir que nenhum fluxo existente que dependia de `getSessionUser` quebrou.
