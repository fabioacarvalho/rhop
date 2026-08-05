import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import * as authService from "@/lib/services/authService";
import { Role } from "@/lib/generated/prisma/client";
import { streamText } from "ai";

// Mock das dependências
vi.mock("@/lib/services/authService", () => ({
  requireUser: vi.fn(),
  ErroNaoAutenticado: class ErroNaoAutenticado extends Error {},
}));

vi.mock("ai", () => ({
  streamText: vi.fn(),
  tool: vi.fn((opts) => opts),
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn(),
}));

describe("Chat API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve retornar 401 se o usuário não estiver autenticado", async () => {
    vi.mocked(authService.requireUser).mockRejectedValueOnce(
      new authService.ErroNaoAutenticado("Não autenticado")
    );

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({ messages: [] }),
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
  });

  it("deve chamar streamText com o modelo correto e as tools se autenticado", async () => {
    vi.mocked(authService.requireUser).mockResolvedValueOnce({
      id: "user-123",
      email: "teste@teste.com",
      nome: "Teste",
      role: Role.GESTOR,
      equipe_id: null,
      criado_em: new Date(),
    });

    const mockToDataStreamResponse = vi.fn().mockReturnValue(new Response("ok"));
    vi.mocked(streamText).mockReturnValueOnce({
      toDataStreamResponse: mockToDataStreamResponse,
    } as any);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({ messages: [{ role: "user", content: "oi" }] }),
    });

    const response = await POST(req);
    
    expect(authService.requireUser).toHaveBeenCalled();
    expect(streamText).toHaveBeenCalled();
    
    const streamArgs = vi.mocked(streamText).mock.calls[0][0];
    expect(streamArgs.messages).toEqual([{ role: "user", content: "oi" }]);
    expect(streamArgs.system).toContain("Você é um assistente interno de RH do sistema OP Conecta");
    expect(streamArgs.tools).toHaveProperty("get_indicadores_dashboard");
    expect(streamArgs.tools).toHaveProperty("get_solicitacoes_pendentes");
    
    expect(mockToDataStreamResponse).toHaveBeenCalled();
    expect(response).toBeInstanceOf(Response);
  });
});
