import { transports } from "../route";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    return new Response("Missing sessionId", { status: 400 });
  }

  const transport = transports.get(sessionId);

  if (!transport) {
    return new Response("Session not found", { status: 404 });
  }

  try {
    const body = await req.json();
    await transport.handlePostMessage(body);
    return new Response("Accepted", { status: 202 });
  } catch (error) {
    console.error("Error handling MCP message:", error);
    return new Response("Bad Request", { status: 400 });
  }
}
