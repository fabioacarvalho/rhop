# MCP Integration Specification

## Problem Statement

O sistema precisa se conectar a ferramentas externas e permitir que agentes de IA externos leiam dados do RHOP. 
A padronização Model Context Protocol (MCP) é a ideal para essa interoperabilidade bi-direcional.

## Goals

- [x] Transformar o RHOP em um Servidor MCP (via HTTP/SSE)
- [ ] Transformar o RHOP em um Cliente MCP (conectando a servidores externos)

## Out of Scope

| Feature     | Reason         |
| ----------- | -------------- |
| stdio transport | Incompatível com o ambiente serverless (Next.js na Vercel). |
| Auth avançado | Para o servidor MCP, uma simples API Key no header é suficiente inicialmente. |

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

## Requirement Traceability

| Requirement ID | Story       | Phase  | Status  |
| -------------- | ----------- | ------ | ------- |
| MCP-01      | P1: Setup SSE Server | Executing | Implementing |
| MCP-02      | P1: Resources & Tools | Executing | Implementing |
| MCP-03      | P2: Client MCP    | Design | Pending |

## Success Criteria

- [x] Endpoint SSE aceita conexões seguras
- [ ] Ferramentas e resources respondem ao protocolo corretamente
