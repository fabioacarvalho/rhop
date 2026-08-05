import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as dashboardService from "./dashboardService";
import { prisma } from "../prisma";
import { Role } from "../generated/prisma/client";

// Singleton for the MCP Server
let mcpServerInstance: McpServer | null = null;

export function getMcpServer(): McpServer {
  if (mcpServerInstance) return mcpServerInstance;

  const server = new McpServer({
    name: "rhop-mcp",
    version: "1.0.0",
  });

  // Resources
  server.resource(
    "solicitacoes-pendentes",
    "solicitacoes://pendentes",
    { description: "Lista todas as solicitações pendentes" },
    async (uri) => {
      try {
        const solicitacoes = await prisma.solicitacao.findMany({
          where: { status: "PENDENTE" },
          include: { solicitante: true, tipoFluxo: true }
        });

        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(solicitacoes, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (e) {
        throw new Error("Erro ao listar solicitações pendentes via MCP");
      }
    }
  );

  server.resource(
    "solicitacao-detalhe",
    new ResourceTemplate("solicitacoes://{id}", { list: undefined }),
    { description: "Detalhes de uma solicitação específica" },
    async (uri, { id }) => {
      try {
        const solicitacao = await prisma.solicitacao.findUnique({
          where: { id: String(id) },
          include: { solicitante: true, tipoFluxo: true, aprovacoes: true }
        });

        if (!solicitacao) {
          throw new Error("Solicitação não encontrada");
        }

        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(solicitacao, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (e) {
        throw new Error("Erro ao buscar solicitação");
      }
    }
  );

  // Tools
  // Note: These actions require an approver ID or context, which the MCP client might not have directly unless mapped.
  server.tool(
    "listar_pendentes",
    "Lista todas as solicitações que estão aguardando aprovação para um determinado usuário (como gestor/admin)",
    {
      usuario_id: z.string().describe("ID do usuário (gestor ou admin) que está solicitando a listagem"),
      papel: z.enum(["GESTOR", "RH_ADMIN"]).describe("Papel do usuário")
    },
    async ({ usuario_id, papel }) => {
      const result = await dashboardService.listar(
        { id: usuario_id, role: papel as Role, nome: "Sistema", email: "sistema@rhop.local" },
        {
          status: "PENDENTE",
          page: 1,
          pageSize: 10
        }
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    }
  );

  mcpServerInstance = server;
  return server;
}
