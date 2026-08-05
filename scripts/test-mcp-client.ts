import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { EventSource } from "eventsource";

// Polyfill EventSource for the Node.js environment because the SDK might use it internally
(global as any).EventSource = EventSource;

async function run() {
  console.log("Iniciando MCP Client...");
  
  // Use a chave gerada. Exemplo, pode ser passada por ENV ou hardcoded para o teste local.
  const apiKey = process.env.RHOP_API_KEY || "COLE_SUA_CHAVE_AQUI";
  
  if (apiKey === "COLE_SUA_CHAVE_AQUI") {
    console.error("Por favor, defina a chave RHOP_API_KEY no script ou no ambiente.");
    process.exit(1);
  }

  // A URL para o nosso próprio servidor
  const transport = new SSEClientTransport(
    new URL("http://127.0.0.1:3000/api/mcp"),
    {
      eventSourceInit: {
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      } as any,
      requestInit: {
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      }
    }
  );

  const client = new Client({
    name: "test-client",
    version: "1.0.0"
  }, {
    capabilities: {}
  });

  try {
    console.log("Conectando ao servidor MCP (SSE)...");
    await client.connect(transport);
    console.log("✅ Conectado com sucesso!");

    console.log("\nBuscando recursos disponíveis (Resources)...");
    const resources = await client.listResources();
    console.log("Resources:", JSON.stringify(resources, null, 2));

    console.log("\nBuscando ferramentas disponíveis (Tools)...");
    const tools = await client.listTools();
    console.log("Tools:", JSON.stringify(tools, null, 2));

    // Descomente abaixo para testar a chamada de uma Tool
    /*
    console.log("\nChamando a ferramenta 'listar_pendentes'...");
    const result = await client.callTool({
      name: "listar_pendentes",
      arguments: {
        usuario_id: "COLOQUE_UM_USER_ID_AQUI", // ID de um gestor ou admin
        papel: "RH_ADMIN"
      }
    });
    console.log("Resultado da Tool:", JSON.stringify(result, null, 2));
    */

  } catch (err) {
    console.error("❌ Erro durante o teste MCP:", err);
  } finally {
    // Para fechar o programa Node
    process.exit(0);
  }
}

run();
