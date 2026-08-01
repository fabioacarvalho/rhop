import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/slaService", () => ({
  verificarSla: vi.fn(),
}));

import { verificarSla } from "@/lib/services/slaService";
import { GET } from "./route";

const mockVerificarSla = vi.mocked(verificarSla);
const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;

function requestComAuth(authorization?: string) {
  const headers = new Headers();
  if (authorization !== undefined) {
    headers.set("authorization", authorization);
  }
  return new Request("http://localhost/api/cron/sla-check", { headers });
}

beforeEach(() => {
  mockVerificarSla.mockReset();
  process.env.CRON_SECRET = "segredo-teste";
});

afterEach(() => {
  process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
});

describe("GET /api/cron/sla-check", () => {
  it("sem header Authorization retorna 401 e nao chama verificarSla", async () => {
    const response = await GET(requestComAuth());
    expect(response.status).toBe(401);
    expect(mockVerificarSla).not.toHaveBeenCalled();
  });

  it("com Bearer incorreto retorna 401 e nao chama verificarSla", async () => {
    const response = await GET(requestComAuth("Bearer errado"));
    expect(response.status).toBe(401);
    expect(mockVerificarSla).not.toHaveBeenCalled();
  });

  it("sem CRON_SECRET configurado retorna 401 mesmo com Bearer presente", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(requestComAuth("Bearer segredo-teste"));
    expect(response.status).toBe(401);
    expect(mockVerificarSla).not.toHaveBeenCalled();
  });

  it("com Bearer correto executa verificarSla e retorna 200 com o resumo", async () => {
    mockVerificarSla.mockResolvedValueOnce({
      verificadas: 3,
      marcadas_atrasadas: 1,
      cobrancas_disparadas: 1,
      erros: 0,
    });

    const response = await GET(requestComAuth("Bearer segredo-teste"));

    expect(response.status).toBe(200);
    expect(mockVerificarSla).toHaveBeenCalledTimes(1);
    const body = await response.json();
    expect(body).toEqual({
      verificadas: 3,
      marcadas_atrasadas: 1,
      cobrancas_disparadas: 1,
      erros: 0,
    });
  });
});
