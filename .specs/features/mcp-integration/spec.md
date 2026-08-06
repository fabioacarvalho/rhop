# MCP Integration Specification

## Problem Statement

O sistema precisa se conectar a ferramentas externas e permitir que agentes de IA externos leiam dados do RHOP.
A padronização Model Context Protocol (MCP) é a ideal para essa interoperabilidade bi-direcional.

Hoje o servidor MCP expõe só uma tool de leitura (`listar_pendentes`) que aceita `usuario_id`/`papel` como parâmetros **livres** do chamador, sem qualquer verificação contra o banco. Isso é um risco tolerável para uma listagem, mas inaceitável para tools de escrita: qualquer chamador MCP poderia criar dados em nome de outra pessoa ou, pior, aprovar/rejeitar solicitações reais de RH em nome de qualquer `GESTOR`/`RH_ADMIN`. Antes de adicionar tools de escrita, o servidor MCP precisa de uma identidade real por sessão, amarrada a um `User` de verdade.

## Goals

- [x] Transformar o RHOP em um Servidor MCP (via HTTP/SSE)
- [ ] Transformar o RHOP em um Cliente MCP (conectando a servidores externos)
- [ ] Amarrar cada sessão MCP a um `User` real do sistema (identidade não forjável por parâmetro do chamador)
- [ ] Expor `adicionar-curriculo`, `adicionar-solicitacao`, `aprovar-solicitacao` e `exibir-detalhes` como tools MCP, reusando 100% dos services já existentes (`candidatoService`, `solicitacaoService`, `aprovacaoService`)

## Out of Scope

| Feature | Reason |
| --- | --- |
| stdio transport | Incompatível com o ambiente serverless (Next.js na Vercel). |
| ~~Auth avançado~~ Revalidação de ApiKey no POST `/api/mcp/messages` | Risco pré-existente (transporte confia só no `sessionId`), não introduzido por esta rodada — permanece registrado como débito técnico. |
| Upload de arquivo binário via MCP (ex: base64) | Fora de escopo do projeto (anexos não são suportados — CLAUDE.md). `curriculo_arquivo_url` continua sendo texto/link. |
| Corrigir os Resources `solicitacoes-pendentes` / `solicitacao-detalhe` (acesso direto ao Prisma, sem checar visibilidade) | Decisão explícita do usuário nesta rodada — ver `context.md`. Registrado como débito técnico separado. |
| Múltiplos aprovadores em paralelo / motor de workflow visual | Fora de escopo do projeto (CLAUDE.md). |

---

## User Stories

### P1: Servidor MCP Core ⭐ MVP

**User Story**: Como uma IA externa (ex: Cursor, Claude Desktop), quero me conectar ao servidor MCP do RHOP para ler dados via protocol MCP.

**Why P1**: É a fundação para interoperabilidade.

**Acceptance Criteria**:

1. WHEN um cliente faz um GET para `/api/mcp` com `Authorization: Bearer <key>` válido THEN system SHALL iniciar conexão SSE.
2. WHEN o cliente solicita `solicitacoes://pendentes` THEN system SHALL retornar a lista JSON de solicitações.

**Independent Test**: Usar o `@modelcontextprotocol/sdk/client` apontando para a URL local.

---

### P1: Identidade real por sessão MCP ⭐ MVP

**User Story**: Como responsável pela segurança do sistema, quero que toda tool MCP saiba com certeza qual `User` está por trás da chamada, para que nenhuma ação (criação ou aprovação) possa ser atribuída a uma identidade forjada.

**Why P1**: É pré-requisito de segurança para todas as tools de escrita abaixo — sem isso, `aprovar-solicitacao` permitiria que qualquer chamador decidisse fluxos de RH reais em nome de qualquer gestor/RH_Admin.

**Acceptance Criteria**:

1. WHEN o handshake `GET /api/mcp` usa uma `ApiKey` com `usuario_id` vinculado a um `User` ativo THEN system SHALL registrar essa identidade para a sessão MCP (`sessionId → usuario_id`).
2. WHEN o handshake `GET /api/mcp` usa uma `ApiKey` sem `usuario_id` vinculado (chave de sistema genérica) THEN system SHALL permitir a conexão SSE normalmente, mas nenhuma tool que exija identidade poderá ser executada nela.
3. WHEN qualquer tool MCP (`listar_pendentes`, `adicionar-curriculo`, `adicionar-solicitacao`, `aprovar-solicitacao`, `exibir-detalhes`) é chamada em uma sessão sem identidade resolvida THEN system SHALL retornar erro (`isError: true`) sem executar nenhuma ação, e SHALL NOT aceitar `usuario_id`/`papel` como parâmetro de input dessas tools.
4. WHEN o `User` vinculado à sessão foi desativado (`ativo: false`) após a conexão já estar aberta THEN system SHALL re-verificar isso a cada chamada de tool (busca fresca no Prisma, não cacheada) e bloquear a execução.
5. WHEN a conexão SSE é encerrada (`onclose`) THEN system SHALL remover o vínculo `sessionId → usuario_id` do registry em memória.

**Independent Test**: Gerar uma `ApiKey` vinculada a um `User` `SOLICITANTE`, conectar via MCP, chamar `aprovar-solicitacao` → deve ser bloqueado com erro de autorização (papel incompatível), nunca por identidade forjada.

---

### P1: `adicionar-curriculo`

**User Story**: Como integrador externo (via MCP), quero cadastrar um candidato/currículo no RHOP, para que ele entre no funil de talentos sem precisar da UI.

**Why P1**: Parte do pedido original do usuário; reusa `candidatoService.cadastrar` já existente e testado.

**Acceptance Criteria**:

1. WHEN a tool é chamada por uma sessão sem identidade resolvida THEN system SHALL retornar erro, sem chamar o service.
2. WHEN a tool é chamada por um `User` com papel `SOLICITANTE` THEN system SHALL retornar erro de autorização (requer `GESTOR` ou `RH_ADMIN`, espelhando `POST /api/candidatos`).
3. WHEN o input não bate com o shape de `candidatoInputSchema` (`lib/validations/candidato.ts`) THEN system SHALL retornar erro de validação antes de chamar o service.
4. WHEN o `email` informado já existe em outro `Candidato` THEN system SHALL retornar erro equivalente a `ErroEmailDuplicado`.
5. WHEN os dados são válidos e o papel é permitido THEN system SHALL criar o `Candidato` via `candidatoService.cadastrar(dados, usuario.id)` e retornar o registro criado.

**Independent Test**: Chamar a tool com um payload válido autenticado como `RH_ADMIN` → `Candidato` aparece em `/talentos`.

---

### P1: `adicionar-solicitacao`

**User Story**: Como integrador externo (via MCP), quero criar uma nova solicitação (vaga, férias, reembolso etc.) no RHOP, para iniciar um fluxo de aprovação sem precisar da UI.

**Why P1**: Parte do pedido original do usuário; reusa `solicitacaoService.criar` já existente (validação de `dados` contra `TipoFluxo.campos_formulario` já embutida no service).

**Acceptance Criteria**:

1. WHEN a tool é chamada por uma sessão sem identidade resolvida THEN system SHALL retornar erro, sem chamar o service.
2. WHEN `tipo_fluxo_id` não corresponde a um `TipoFluxo` existente THEN system SHALL retornar erro equivalente a `ErroTipoFluxoNaoEncontrado`.
3. WHEN `dados` não atende aos `campos_formulario` daquele `TipoFluxo` THEN system SHALL retornar erro equivalente a `ErroDadosInvalidos`, incluindo o detalhe por campo no texto de retorno (para o chamador/LLM corrigir e tentar de novo).
4. WHEN a geração do resumo IA falhar internamente durante a criação THEN a `Solicitacao` SHALL ser criada normalmente mesmo assim (regra CLAUDE.md: IA nunca trava o fluxo) e o erro SHALL ser gravado em `Log` tipo `ERRO`.
5. WHEN os dados são válidos THEN system SHALL criar a `Solicitacao` via `solicitacaoService.criar(input, usuario.id)` e retornar `{ id, status, etapa_atual, prazo_sla }`.

**Independent Test**: Chamar a tool autenticado como qualquer papel, com um `tipo_fluxo_id` válido → `Solicitacao` aparece em "Minhas Solicitações" com status `PENDENTE`.

---

### P1: `aprovar-solicitacao`

**User Story**: Como gestor ou RH_Admin (via MCP), quero aprovar ou rejeitar uma solicitação pendente na minha etapa, para decidir fluxos de RH sem precisar da UI.

**Why P1**: É a tool mais sensível do pedido — decide fluxos reais de RH. Depende diretamente da story de Identidade real por sessão MCP.

**Acceptance Criteria**:

1. WHEN a tool é chamada por uma sessão sem identidade resolvida THEN system SHALL retornar erro, sem alterar nenhuma `Solicitacao`.
2. WHEN o `User` da sessão tem papel `SOLICITANTE` THEN system SHALL retornar erro de autorização antes mesmo de consultar a solicitação (espelha `POST /api/aprovacoes/[id]/decidir`).
3. WHEN `solicitacao_id` não existe THEN system SHALL retornar erro equivalente a `ErroNaoEncontrado`.
4. WHEN o papel do `User` não corresponde ao `aprovador_role` da etapa atual, ou (sendo `GESTOR`) ele não é o `gestor_id` responsável pela `Equipe` do solicitante THEN system SHALL retornar erro equivalente a `ErroNaoAutorizadoAprovacao`, e a `Solicitacao` SHALL permanecer inalterada.
5. WHEN a solicitação já foi decidida/encerrada naquela etapa THEN system SHALL retornar erro equivalente a `ErroDecisaoInvalida`.
6. WHEN a decisão é válida e autorizada THEN system SHALL chamar `aprovacaoService.decidir(solicitacao_id, usuario, { decisao, comentario })`, gravar `Log` tipo `AUDITORIA` (já feito pelo service) e retornar a `Solicitacao` atualizada.

**Independent Test**: Autenticar como `GESTOR` responsável pela equipe do solicitante, chamar a tool com `decisao: "APROVADA"` numa solicitação na etapa `GESTOR` → status muda e aparece no histórico de aprovações. Testar também como `GESTOR` de outra equipe → deve ser bloqueado.

---

### P2: `exibir-detalhes`

**User Story**: Como integrador externo (via MCP), quero consultar os detalhes de uma solicitação ou de um currículo específico, para inspecionar o estado de um fluxo sem precisar da UI.

**Why P2**: Útil, mas não bloqueia as demais — pode ser adicionada depois das tools de escrita.

**Acceptance Criteria**:

1. WHEN a tool é chamada com `tipo: "solicitacao"` por uma sessão sem identidade resolvida THEN system SHALL retornar erro, sem consultar o banco.
2. WHEN `tipo: "solicitacao"` e o `User` não é o solicitante dono, nem gestor da equipe dele, nem `RH_ADMIN` THEN system SHALL retornar erro equivalente a `ErroAcessoNegado` (regra de visibilidade do CLAUDE.md, aplicada via `solicitacaoService.buscarDetalhePorId`).
3. WHEN `tipo: "solicitacao"` e o `id` não existe THEN system SHALL retornar erro equivalente a `ErroNaoEncontrado`.
4. WHEN `tipo: "curriculo"` e o `User` tem papel `SOLICITANTE` THEN system SHALL retornar erro de autorização (requer `GESTOR` ou `RH_ADMIN`, espelhando `GET /api/candidatos`).
5. WHEN `tipo: "curriculo"` e o `id` não existe THEN system SHALL retornar erro equivalente a `ErroNaoEncontrado`.
6. WHEN os parâmetros são válidos e autorizados THEN system SHALL retornar o JSON do detalhe correspondente.

**Independent Test**: Como `SOLICITANTE`, pedir detalhe da própria solicitação → sucesso; pedir detalhe da solicitação de outro solicitante → bloqueado. Como `GESTOR`, pedir detalhe de um currículo → sucesso.

---

## Edge Cases

- `ApiKey` válida, mas sem `usuario_id` vinculado (chave de sistema genérica pré-existente) chamando qualquer tool nova → erro de identidade, conexão SSE em si não é afetada.
- `User` vinculado à `ApiKey` desativado (`ativo: false`) depois que a sessão MCP já está aberta → bloqueado na próxima chamada de tool (busca fresca, não cacheada).
- `tipo_fluxo_id` inexistente em `adicionar-solicitacao`.
- `solicitacao_id` já decidida/encerrada em `aprovar-solicitacao`.
- `id` inexistente em `exibir-detalhes`, para os dois valores de `tipo`.
- `email` duplicado em `adicionar-curriculo`.
- Falha da OpenAI durante `adicionar-solicitacao` (resumo IA) → não deve impedir a criação (regra CLAUDE.md).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| MCP-01 | P1: Setup SSE Server | Executing | Implementing |
| MCP-02 | P1: Resources & Tools | Executing | Implementing |
| MCP-03 | P2: Client MCP | Design | Pending |
| MCP-04 | P1: Identidade real por sessão MCP — `ApiKey.usuario_id` | Design | Pending |
| MCP-05 | P1: Identidade real por sessão MCP — `mcpSessionRegistry` | Design | Pending |
| MCP-06 | P1: Identidade real por sessão MCP — `requireMcpUser` | Design | Pending |
| MCP-07 | P1: Identidade real por sessão MCP — handshake `GET /api/mcp` resolve e registra identidade | Design | Pending |
| MCP-08 | P1: Identidade real por sessão MCP — migrar `listar_pendentes` para `requireMcpUser` | Design | Pending |
| MCP-09 | P1: `adicionar-curriculo` | Design | Pending |
| MCP-10 | P1: `adicionar-solicitacao` | Design | Pending |
| MCP-11 | P1: `aprovar-solicitacao` | Design | Pending |
| MCP-12 | P2: `exibir-detalhes` (tipo solicitacao) | Design | Pending |
| MCP-13 | P2: `exibir-detalhes` (tipo curriculo) | Design | Pending |

**Coverage:** 13 total, 0 mapped to tasks (aguardando fase Tasks), 13 unmapped ⚠️

---

## Success Criteria

- [x] Endpoint SSE aceita conexões seguras
- [ ] Ferramentas e resources respondem ao protocolo corretamente
- [ ] Nenhuma tool MCP aceita `usuario_id`/`papel` como parâmetro de input — identidade sempre resolvida via sessão
- [ ] `npm run build` e `npx prisma validate` passam após a migration aditiva em `ApiKey`
- [ ] Cenário manual documentado: "testei aprovar-solicitacao via MCP com usuário GESTOR de outra equipe → bloqueado corretamente"
