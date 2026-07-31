import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse, NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";

// Mock do único ponto de I/O externo que `middleware.ts` toca — unit test
// isolado, nunca deve bater em Supabase real (mesmo padrão de
// logService.test.ts / userService.test.ts / authService.test.ts).
vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: vi.fn(),
}));

import { updateSession } from "@/lib/supabase/middleware";
import { middleware, config } from "./middleware";

const mockUpdateSession = vi.mocked(updateSession);

beforeEach(() => {
  mockUpdateSession.mockReset();
});

describe("middleware", () => {
  it("sem sessao + rota /api/* -> 401 JSON, sem invocar o handler (nao chama NextResponse.next())", async () => {
    mockUpdateSession.mockResolvedValueOnce({
      user: null,
      response: NextResponse.next(),
    });

    const request = new NextRequest("https://example.com/api/algo");
    const response = await middleware(request);

    expect(mockUpdateSession).toHaveBeenCalledWith(request);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Não autenticado.",
    });
  });

  it("sem sessao + rota de pagina -> redirect para /login", async () => {
    mockUpdateSession.mockResolvedValueOnce({
      user: null,
      response: NextResponse.next(),
    });

    const request = new NextRequest("https://example.com/auditoria-logs");
    const response = await middleware(request);

    expect([307, 308]).toContain(response.status);
    expect(response.headers.get("location")).toBe(
      "https://example.com/login",
    );
  });

  it("sessao valida -> passthrough (equivalente a NextResponse.next()), sem redirect nem 401", async () => {
    const passthroughResponse = NextResponse.next();
    mockUpdateSession.mockResolvedValueOnce({
      // Middleware não olha o formato de `user`, só se é truthy — mock
      // mínimo, igual ao `authService.test.ts` para `data.user`.
      user: { id: "user-1" } as never,
      response: passthroughResponse,
    });

    const request = new NextRequest("https://example.com/");
    const response = await middleware(request);

    expect(response).toBe(passthroughResponse);
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});

describe("middleware config.matcher", () => {
  // Testa o `config.matcher` diretamente contra o utilitário oficial de teste
  // do Next.js (`unstable_doesMiddlewareMatch`, de
  // `next/experimental/testing/server`), sem instanciar o middleware — é a
  // forma mais direta de validar o array de matcher em si (path-to-regexp
  // interno do Next), e a alternativa sugerida pela própria task em vez de
  // reinvocar `middleware()` para um caso que não depende de `updateSession`.
  it("nao intercepta /login nem assets estaticos, mas intercepta paginas e /api/*", () => {
    const casosExcluidos = [
      "https://example.com/login",
      "https://example.com/favicon.ico",
      "https://example.com/_next/static/chunks/algo.js",
      "https://example.com/_next/image?url=x",
    ];
    const casosIncluidos = [
      "https://example.com/auditoria-logs",
      "https://example.com/api/algo",
      "https://example.com/",
    ];

    for (const url of casosExcluidos) {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
    }
    for (const url of casosIncluidos) {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    }
  });
});
