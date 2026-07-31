# Notificações Tasks

**Design**: `.specs/features/notificacoes/design.md`
**Spec**: `.specs/features/notificacoes/spec.md`
**Status**: Draft

---

## Test Strategy

A feature de notificações possui forte dependência de integrações externas (banco e provedor de e-mail). A estratégia de testes foca na camada de serviço, isolando as integrações via mocks para garantir que as regras de resiliência e bloqueios não falhem, enquanto o schema e API são validados via testes de integração ou validações nativas.

### Test Coverage Matrix

| Code Layer | Test Type | Parallel-Safe |
| --- | --- | --- |
| `lib/services/notificacaoService.ts` | unit (Vitest, mock `resend` e `logService`) | Yes |
| `lib/services/resendService.ts` | unit (Vitest, mock `resend` SDK) | Yes |
| `app/api/notificacoes/**/route.ts` | unit / request test | Yes |
| `prisma/schema.prisma` | none — `npx prisma validate` | Yes |
| Componentes de UI (Badge, Popover) | none — cenário manual | Yes |

### Gate Check Commands

| Gate | Command |
| --- | --- |
| `quick` | `npm run test` (vitest run) |
| `full` | `npm run build && npx prisma validate && npm run test` |
| `build` | `npm run build` |

---

## Execution Plan

```
Phase 1 (Sequential):
  T1 (Schema)

Phase 2 (Parallel):
  T1 done → 
    ├── T2 (resendService) [P]
    └── T3 (notificacaoService) [P] (mockado)

Phase 3 (Sequential):
  T2, T3 done → T4 (API Routes)

Phase 4 (Sequential):
  T4 done → T5 (UI Components)
```

---

## Task Breakdown

### T1: `Notificacao` model e relacionamentos

**What**: Adicionar `enum TipoNotificacao` e `model Notificacao` (`id`, `usuario_id`, `solicitacao_id`, `tipo`, `mensagem`, `lida`, `link`, `criado_em`) ao `schema.prisma`. Adicionar as relações inversas em `User` e `Solicitacao`.
**Where**: `prisma/schema.prisma`
**Depends on**: N/A (assume que `User` e `Solicitacao` já existam; se não, devem ser providenciados/atualizados).
**Reuses**: N/A
**Requirement**: Base para todas as notificações (NOTIF-01..06, NOTIF-12..15).

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `enum TipoNotificacao` criado.
- [ ] `model Notificacao` configurado com as FKs corretas.
- [ ] Relações inversas em `User` (`notificacoes`) e `Solicitacao` (`notificacoes`) adicionadas.
- [ ] Índice `@@index([usuario_id, lida])` incluído.
- [ ] Gate check passa: `npx prisma validate`.

**Tests**: none
**Gate**: build

**Commit**: `feat(notificacoes): adiciona modelo Notificacao no Prisma schema`

---

### T2: `resendService` (Integração de E-mail) [P]

**What**: Criar serviço que engloba a dependência do SDK do Resend. Implementa `enviarEmail(input)` isolado com bloco `try/catch` impenetrável.
**Where**: `lib/services/resendService.ts`
**Depends on**: T1
**Reuses**: `logService` (para reportar eventuais erros sistêmicos que não são de envio normal).
**Requirement**: NOTIF-07, NOTIF-08, NOTIF-09, NOTIF-10.

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] O SDK `resend` é inicializado usando a variável de ambiente segura.
- [ ] O método `enviarEmail` captura os erros (timeout/rate limit) e retorna silenciosamente (ex: `boolean` para sucesso/falha), gravando log se necessário, sem disparar `throw`.
- [ ] Passa nos testes unitários validando falhas forçadas via mock.

**Tests**: unit
**Gate**: quick

**Commit**: `feat(notificacoes): implementa resendService para envio resiliente`

---

### T3: `notificacaoService` core logic [P]

**What**: Criar a orquestração central. `notificarEvento` cria in-app, aciona e-mail (T2) e loga falhas (via `logService`); `listarNotificacoes`, `marcarComoLida`, `obterContagemNaoLidas` fornecem a base de leitura. Incluir throttle de 1x/dia para `COBRANCA_SLA`.
**Where**: `lib/services/notificacaoService.ts`
**Depends on**: T1, T2 (contrato/mock)
**Reuses**: `resendService`, `logService`, `lib/prisma.ts`
**Requirement**: NOTIF-01..11

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Valida se `destinatario_id` existe e tem e-mail. Se não, Log ERRO e aborta e-mail (ou tudo se não houver destinatário).
- [ ] Grava `Notificacao` in-app corretamente no DB.
- [ ] Dispara `resendService.enviarEmail` (assíncrono) encapsulado e não impede retorno de sucesso se e-mail falhar, mas grava `Log` (ERRO).
- [ ] Se o evento for `COBRANCA_SLA`, verifica antes se já houve notificação similar nas últimas 24h.
- [ ] Gate check passa: `npm run test` com pelo menos 5 testes (mockando falha de DB, falha de e-mail, e throttle SLA).

**Tests**: unit
**Gate**: quick

**Commit**: `feat(notificacoes): implementa notificacaoService central`

---

### T4: API Routes da Central de Notificações

**What**: Expor as funções de leitura/marcação de forma segura para o client. `GET /api/notificacoes` e `PATCH /api/notificacoes/[id]/lida`.
**Where**: `app/api/notificacoes/route.ts`, `app/api/notificacoes/[id]/lida/route.ts`
**Depends on**: T3
**Reuses**: `notificacaoService`, `authService` (para visibilidade restrita)
**Requirement**: NOTIF-06, NOTIF-12..14

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Ambas rotas exigem sessão via `authService.requireUser()`.
- [ ] O `GET` retorna apenas notificações pertencentes ao usuário logado, com contagem separada de não lidas (ou endpoint para badge).
- [ ] O `PATCH` verifica se a notificação sendo marcada pertence ao próprio solicitante.
- [ ] Gate check passa: `npm run build`.

**Tests**: unit/request (opcional para routes, mas o gate build deve validar tipos).
**Gate**: build

**Commit**: `feat(notificacoes): cria rotas API para leitura de notificações`

---

### T5: Componentes de UI (Badge e Lista)

**What**: A interface consumindo T4. `NotificacaoBadge` (ícone no header com contador) e `NotificacoesPopover` (lista interativa, marcando como lida ao clicar e redirecionando via router).
**Where**: `components/notificacoes/NotificacoesPopover.tsx`, `components/notificacoes/NotificacaoBadge.tsx`
**Depends on**: T4
**Reuses**: N/A
**Requirement**: NOTIF-12, NOTIF-13, NOTIF-14, NOTIF-15

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Popover renderiza lista cronológica.
- [ ] Se houver não lidas, exibe um contador visual (badge vermelho/ponto).
- [ ] Clicar no item chama `PATCH` na API, ajusta estado local, e faz `router.push(link)`.
- [ ] Renderiza UI de 'Vazio' caso não haja notificações.
- [ ] O componente trata latência graciosamente (optimistic update na marcação como lida).

**Tests**: manual
**Gate**: build

**Commit**: `feat(notificacoes): adiciona componentes visuais in-app`
