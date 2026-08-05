import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { tool, jsonSchema } from "ai";

// Polyfill EventSource for Next.js environment if needed (Edge/Node)
if (typeof global.EventSource === "undefined") {
  (global as any).EventSource = require("eventsource");
}

// Singleton for the MCP Client connected to Github (or multiple tools)
let githubMcpClient: Client | null = null;
let githubToolsCache: Record<string, any> | null = null;

export async function getGithubMcpTools() {
  if (githubToolsCache) return githubToolsCache;

  try {
    if (!githubMcpClient) {
      // Conecta no wrapper local rodando na porta 4000
      const transport = new SSEClientTransport(
        new URL("http://127.0.0.1:4000/sse")
      );
      
      const client = new Client({
        name: "rhop-ai-client",
        version: "1.0.0"
      }, {
        capabilities: {}
      });

      await client.connect(transport);
      githubMcpClient = client;
    }

    // Busca as tools fornecidas pelo Github MCP
    const { tools } = await githubMcpClient.listTools();
    
    // Converte para formato do Vercel AI SDK
    const aiTools: Record<string, any> = {};
    
    for (const t of tools) {
      aiTools[t.name] = tool({
        description: t.description || "",
        // Converte o JSON Schema nativo do MCP para o Vercel AI SDK (via jsonSchema helper)
        parameters: jsonSchema(t.inputSchema),
        execute: async (args) => {
          console.log(`[MCP Client] Chamando tool '${t.name}' com:`, args);
          try {
            const result = await githubMcpClient!.callTool({
              name: t.name,
              arguments: args
            });
            return result.content;
          } catch (e: any) {
            console.error(`[MCP Client] Erro na tool '${t.name}':`, e);
            return `Erro ao executar ferramenta MCP: ${e?.message}`;
          }
        }
      });
    }

    githubToolsCache = aiTools;
    return aiTools;
  } catch (error) {
    console.error("Falha ao inicializar o MCP Client (verifique se o github-mcp-sse.ts está rodando):", error);
    return {}; // Se falhar (wrapper offline), apenas não retorna tools e segue sem elas
  }
}
