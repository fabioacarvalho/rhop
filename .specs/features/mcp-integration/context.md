# MCP Integration Context

**Gathered:** 2026-08-06
**Spec:** `.specs/features/mcp-integration/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Adicionar identidade real por sessão ao servidor MCP do RHOP (hoje forjável via `usuario_id`/`papel` livres) e expor 4 tools novas de escrita/consulta (`adicionar-curriculo`, `adicionar-solicitacao`, `aprovar-solicitacao`, `exibir-detalhes`), todas reusando os services já existentes (`candidatoService`, `solicitacaoService`, `aprovacaoService`) e nunca acessando o Prisma diretamente.

---

## Implementation Decisions

### Identidade nas tools MCP (API/auth)

- `ApiKey` passa a poder ser vinculada a um `User` real (`usuario_id` nullable) — uma chave = uma pessoa, na prática um "personal access token".
- Nenhuma tool nova aceita `usuario_id`/`papel` como parâmetro de input. A identidade vem sempre da sessão MCP resolvida no handshake (`GET /api/mcp`), nunca do que o chamador (ou um LLM operando o cliente MCP) informa por parâmetro.
- Rejeitada a alternativa de manter `usuario_id`/`papel` livres (risco aceito) — inaceitável principalmente para `aprovar-solicitacao`, que decidiria fluxos de RH reais em nome de qualquer gestor/RH_Admin sem prova de identidade.
- Rejeitada também a alternativa de uma única `ApiKey` de sistema com papel fixo — perde rastreabilidade de quem realmente decidiu/criou algo.

### Retrofit de `listar_pendentes`

- A tool existente hoje (`usuario_id`/`papel` livres) é migrada para o mesmo mecanismo de identidade (`requireMcpUser`) nesta mesma rodada, em vez de ficar como débito técnico separado — evita ter 1 tool insegura ao lado de 4 seguras no mesmo servidor MCP.

### Resources `solicitacoes-pendentes` / `solicitacao-detalhe`

- Decisão explícita: **não mexer agora**. Esses dois Resources continuam acessando o Prisma diretamente sem checar visibilidade — é uma falha pré-existente, mas fora do escopo desta rodada.

---

## Agent's Discretion

- Nome exato e localização do módulo que guarda o registry `sessionId → usuario_id` (proposto: `lib/services/mcpSessionRegistry.ts`, para evitar import circular entre `authService.ts` e `mcpServerManager.ts`) — decisão técnica, não de produto.
- Formato exato da mensagem de erro textual dentro de `content` para cada tool (`isError: true`), desde que inclua o suficiente para o chamador entender o motivo (ex: incluir `erro.erros` de `ErroDadosInvalidos` no texto).
- Ordem de implementação das 4 tools dentro da Fase 2 do plano de tasks.

---

## Specific References

- Nenhuma referência de produto externa foi trazida pelo usuário — o pedido partiu de "analisar o MCP existente e avaliar a criação dessas 4 tools", sem exemplo de outra ferramenta/produto a espelhar.
- Padrão de autorização a espelhar é o já existente nas rotas REST do próprio projeto (`authService.requireUser`, `POST /api/candidatos`, `POST /api/aprovacoes/[id]/decidir`, `GET /api/solicitacoes/[id]`, `GET /api/candidatos`) — não um padrão externo.

---

## Deferred Ideas

- Corrigir/aposentar os Resources `solicitacoes-pendentes` e `solicitacao-detalhe` para respeitar a regra de visibilidade (acesso direto ao Prisma hoje, sem checar dono/gestor/RH_Admin) — registrado como débito técnico, não faz parte desta rodada.
- Revalidação da `ApiKey` a cada `POST /api/mcp/messages` (hoje só confia no `sessionId`) — risco operacional pré-existente, fora de escopo.
- MCP-03 (RHOP como cliente MCP de servidores externos) — já registrado no spec como P2 separado, não tocado nesta rodada.
