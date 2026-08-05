import { getMcpServer } from "@/lib/services/mcpServerManager";
import { NextSSEServerTransport } from "@/lib/services/NextSSEServerTransport";
import { prisma } from "@/lib/prisma";

// In a real serverless deployment, holding transports in memory like this is problematic
// if requests are routed to different instances. But for Next.js dev server and 
// single-instance deployments, it works for testing MCP over HTTP.
export const transports = new Map<string, NextSSEServerTransport>();

export async function GET(req: Request) {
  // Validate API Key
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const token = authHeader.split(" ")[1];
  const apiKey = await prisma.apiKey.findUnique({
    where: { key: token, ativo: true }
  });

  if (!apiKey) {
    return new Response("Unauthorized - Invalid API Key", { status: 401 });
  }

  const transport = new NextSSEServerTransport("/api/mcp/messages");
  transports.set(transport.sessionId, transport);

  // When the transport is closed, remove it from the map
  transport.onclose = () => {
    transports.delete(transport.sessionId);
  };

  // Force stream initialization before connect()
  const stream = transport.stream;

  const server = getMcpServer();
  server.connect(transport).catch(console.error);
  
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  });
}
