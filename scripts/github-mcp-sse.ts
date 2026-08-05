import express from "express";
import cors from "cors";
import { spawn, ChildProcess } from "child_process";
import * as crypto from "crypto";
import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.local" });

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

interface Session {
  id: string;
  response: express.Response;
  process: ChildProcess;
}

const sessions = new Map<string, Session>();

app.get("/sse", (req, res) => {
  console.log("Nova conexão SSE iniciada");
  
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  const sessionId = crypto.randomUUID();

  // Iniciar o processo Stdio do Github MCP Server
  const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
  const githubProcess = spawn(npxCommand, ["-y", "@modelcontextprotocol/server-github"], {
    env: { ...process.env, GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_PERSONAL_ACCESS_TOKEN },
    stdio: ["pipe", "pipe", "pipe"],
  });

  sessions.set(sessionId, { id: sessionId, response: res, process: githubProcess });

  // Disparar o endpoint pro Client saber a URL de messages
  res.write(`event: endpoint\ndata: /messages?sessionId=${sessionId}\n\n`);

  githubProcess.stdout?.on("data", (data: Buffer) => {
    // O stdout do stdio transport entrega JSON lines
    const text = data.toString("utf8");
    const lines = text.split("\n");
    for (const line of lines) {
      if (line.trim()) {
        res.write(`event: message\ndata: ${line}\n\n`);
      }
    }
  });

  githubProcess.stderr?.on("data", (data: Buffer) => {
    console.error(`[Github MCP stderr]: ${data.toString("utf8")}`);
  });

  req.on("close", () => {
    console.log(`Conexão SSE fechada para a sessão ${sessionId}`);
    sessions.delete(sessionId);
    githubProcess.kill();
  });
});

app.post("/messages", (req, res) => {
  const sessionId = req.query.sessionId as string;
  const session = sessions.get(sessionId);

  if (!session) {
    res.status(404).send("Session not found");
    return;
  }

  // Enviar a mensagem pro Stdio do processo local
  const message = JSON.stringify(req.body) + "\n";
  session.process.stdin?.write(message);
  
  res.status(202).send("Accepted");
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`🚀 Github MCP SSE Wrapper rodando em http://localhost:${PORT}/sse`);
  if (!process.env.GITHUB_PERSONAL_ACCESS_TOKEN) {
    console.warn("⚠️ AVISO: A variável GITHUB_PERSONAL_ACCESS_TOKEN não está definida no ambiente!");
  }
});
