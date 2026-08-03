import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dos 3 pontos de I/O externo que authService toca — unit test isolado,
// nunca deve bater em Supabase real nem no banco (mesmo padrão de
// logService.test.ts / userService.test.ts).
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/services/logService", () => ({
  registrar: vi.fn(),
}));

import { createServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { registrar } from "@/lib/services/logService";
import { Role } from "@/lib/generated/prisma/client";
import {
  ErroNaoAutenticado,
  ErroNaoAutorizado,
  getSessionUser,
  requireUser,
} from "./authService";

const mockCreateServerClient = vi.mocked(createServerClient);
const mockFindUnique = vi.mocked(prisma.user.findUnique);
const mockRegistrar = vi.mocked(registrar);

/**
 * Mock mínimo do client Supabase retornado por `createServerClient` —
 * `authService` só usa `auth.getUser()` nele. Enfileira um valor via
 * `mockResolvedValueOnce`, então pode ser chamado mais de uma vez por teste
 * quando o cenário exige múltiplas chamadas a `getSessionUser`/`requireUser`.
 */
function enfileirarSupabaseAuth(getUser: ReturnType<typeof vi.fn>) {
  mockCreateServerClient.mockResolvedValueOnce({
    auth: { getUser },
  } as never);
}

beforeEach(() => {
  mockCreateServerClient.mockReset();
  mockFindUnique.mockReset();
  mockRegistrar.mockReset();
});

describe("authService.getSessionUser", () => {
  it("sessao valida + User existente no Prisma -> retorna objeto completo (sem gestor_id)", async () => {
    enfileirarSupabaseAuth(
      vi.fn().mockResolvedValueOnce({
        data: { user: { id: "user-1", email: "fulano@example.com" } },
        error: null,
      }),
    );
    mockFindUnique.mockResolvedValueOnce({
      id: "user-1",
      nome: "Fulano",
      email: "fulano@example.com",
      role: Role.GESTOR,
    } as never);

    const result = await getSessionUser();

    expect(result).toEqual({
      id: "user-1",
      nome: "Fulano",
      email: "fulano@example.com",
      role: Role.GESTOR,
    });
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "user-1" } });
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it("sessao valida sem User correspondente no Prisma -> retorna null e grava Log tipo ERRO", async () => {
    enfileirarSupabaseAuth(
      vi.fn().mockResolvedValueOnce({
        data: { user: { id: "user-2", email: "orfao@example.com" } },
        error: null,
      }),
    );
    mockFindUnique.mockResolvedValueOnce(null);

    const result = await getSessionUser();

    expect(result).toBeNull();
    expect(mockRegistrar).toHaveBeenCalledTimes(1);
    expect(mockRegistrar).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "ERRO",
        entidade: "User",
        entidade_id: "user-2",
      }),
    );
  });

  it("User com ativo = false -> retorna null e grava Log tipo ERRO (USUARIO_INATIVO)", async () => {
    enfileirarSupabaseAuth(
      vi.fn().mockResolvedValueOnce({
        data: { user: { id: "user-inativo", email: "inativo@example.com" } },
        error: null,
      }),
    );
    mockFindUnique.mockResolvedValueOnce({
      id: "user-inativo",
      nome: "Inativo",
      email: "inativo@example.com",
      role: Role.SOLICITANTE,
      ativo: false,
    } as never);

    const result = await getSessionUser();

    expect(result).toBeNull();
    expect(mockRegistrar).toHaveBeenCalledTimes(1);
    expect(mockRegistrar).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "ERRO",
        entidade: "User",
        entidade_id: "user-inativo",
        acao: "USUARIO_INATIVO",
        usuario_id: null,
      }),
    );
  });

  it("User com ativo = true -> comportamento inalterado", async () => {
    enfileirarSupabaseAuth(
      vi.fn().mockResolvedValueOnce({
        data: { user: { id: "user-ativo", email: "ativo@example.com" } },
        error: null,
      }),
    );
    mockFindUnique.mockResolvedValueOnce({
      id: "user-ativo",
      nome: "Ativo",
      email: "ativo@example.com",
      role: Role.SOLICITANTE,
      ativo: true,
    } as never);

    const result = await getSessionUser();

    expect(result).toEqual({
      id: "user-ativo",
      nome: "Ativo",
      email: "ativo@example.com",
      role: Role.SOLICITANTE,
    });
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it("sem sessao (user null ou erro do Supabase) -> retorna null sem chamar logService", async () => {
    // Variante 1: auth.getUser() resolve sem erro mas sem user.
    enfileirarSupabaseAuth(
      vi.fn().mockResolvedValueOnce({
        data: { user: null },
        error: null,
      }),
    );
    const semUser = await getSessionUser();

    // Variante 2: auth.getUser() resolve com erro (ex: token invalido).
    enfileirarSupabaseAuth(
      vi.fn().mockResolvedValueOnce({
        data: { user: null },
        error: { message: "invalid token", status: 401 },
      }),
    );
    const comErro = await getSessionUser();

    expect(semUser).toBeNull();
    expect(comErro).toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockRegistrar).not.toHaveBeenCalled();
  });
});

describe("authService.requireUser", () => {
  it("lanca erro distinguivel: ErroNaoAutenticado sem sessao/User, ErroNaoAutorizado com role fora da lista", async () => {
    // Caso 1: sem sessao -> ErroNaoAutenticado (rota converte em 401).
    enfileirarSupabaseAuth(
      vi.fn().mockResolvedValueOnce({
        data: { user: null },
        error: null,
      }),
    );

    const erroAutenticacao = await requireUser().catch((error: unknown) => error);

    expect(erroAutenticacao).toBeInstanceOf(ErroNaoAutenticado);
    expect(erroAutenticacao).not.toBeInstanceOf(ErroNaoAutorizado);

    // Caso 2: sessao/User validos, mas role fora da lista permitida ->
    // ErroNaoAutorizado (rota converte em 403).
    enfileirarSupabaseAuth(
      vi.fn().mockResolvedValueOnce({
        data: { user: { id: "user-3", email: "solicitante@example.com" } },
        error: null,
      }),
    );
    mockFindUnique.mockResolvedValueOnce({
      id: "user-3",
      nome: "Solicitante",
      email: "solicitante@example.com",
      role: Role.SOLICITANTE,
    } as never);

    const erroAutorizacao = await requireUser([Role.RH_ADMIN, Role.GESTOR]).catch(
      (error: unknown) => error,
    );

    expect(erroAutorizacao).toBeInstanceOf(ErroNaoAutorizado);
    expect(erroAutorizacao).not.toBeInstanceOf(ErroNaoAutenticado);
  });
});
