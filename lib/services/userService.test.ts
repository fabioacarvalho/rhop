import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock de `@/lib/prisma` — unit test isolado, nunca deve bater no banco real
// (o caminho contra Supabase real já foi validado manualmente em outra task).
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { Prisma, Role } from "@/lib/generated/prisma/client";
import {
  ErroValidacaoUsuario,
  provisionar,
  type ProvisionarInput,
} from "./userService";

const mockFindUnique = vi.mocked(prisma.user.findUnique);
const mockCreate = vi.mocked(prisma.user.create);

beforeEach(() => {
  mockFindUnique.mockReset();
  mockCreate.mockReset();
});

/**
 * Chama `provisionar` uma unica vez e captura o erro lancado (se houver).
 * Evita consumir mocks `mockResolvedValueOnce`/`mockRejectedValueOnce` duas
 * vezes ao verificar tanto o tipo quanto a mensagem do erro numa mesma
 * asserção de teste.
 */
async function capturarErro(input: ProvisionarInput): Promise<unknown> {
  try {
    await provisionar(input);
    return undefined;
  } catch (error) {
    return error;
  }
}

describe("userService.provisionar", () => {
  it("rejeita role fora do enum com erro descritivo", async () => {
    const input = {
      id: "user-1",
      nome: "Fulano",
      email: "fulano@example.com",
      role: "GERENTE_REGIONAL",
    } as unknown as ProvisionarInput;

    const erro = await capturarErro(input);

    expect(erro).toBeInstanceOf(ErroValidacaoUsuario);
    expect((erro as Error).message).toMatch(/role invalido/i);
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejeita gestor_id nulo quando role !== RH_ADMIN", async () => {
    const input: ProvisionarInput = {
      id: "user-2",
      nome: "Solicitante Sem Gestor",
      email: "solicitante@example.com",
      role: Role.SOLICITANTE,
      gestor_id: null,
    };

    const erro = await capturarErro(input);

    expect(erro).toBeInstanceOf(ErroValidacaoUsuario);
    expect((erro as Error).message).toMatch(/gestor_id e obrigatorio/i);
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("aceita gestor_id nulo quando role === RH_ADMIN", async () => {
    const input: ProvisionarInput = {
      id: "user-3",
      nome: "Admin RH",
      email: "admin@example.com",
      role: Role.RH_ADMIN,
      gestor_id: null,
    };

    mockCreate.mockResolvedValueOnce({
      id: "user-3",
      nome: "Admin RH",
      email: "admin@example.com",
      role: Role.RH_ADMIN,
      gestor_id: null,
    } as never);

    await expect(provisionar(input)).resolves.toMatchObject({ id: "user-3" });
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        id: "user-3",
        nome: "Admin RH",
        email: "admin@example.com",
        role: Role.RH_ADMIN,
        gestor_id: null,
      },
    });
  });

  it("rejeita gestor_id igual ao id do proprio usuario (auto-referencia)", async () => {
    const input: ProvisionarInput = {
      id: "user-4",
      nome: "Auto Referencia",
      email: "auto@example.com",
      role: Role.GESTOR,
      gestor_id: "user-4",
    };

    const erro = await capturarErro(input);

    expect(erro).toBeInstanceOf(ErroValidacaoUsuario);
    expect((erro as Error).message).toMatch(/auto-referencia/i);
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejeita gestor_id que nao corresponde a nenhum usuario existente", async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    const input: ProvisionarInput = {
      id: "user-5",
      nome: "Sem Gestor Valido",
      email: "sem-gestor@example.com",
      role: Role.SOLICITANTE,
      gestor_id: "gestor-inexistente",
    };

    const erro = await capturarErro(input);

    expect(erro).toBeInstanceOf(ErroValidacaoUsuario);
    expect((erro as Error).message).toMatch(
      /nao corresponde a nenhum usuario existente/i,
    );
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "gestor-inexistente" },
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("traduz email duplicado (P2002) para ErroValidacaoUsuario legivel", async () => {
    mockFindUnique.mockResolvedValueOnce({ id: "gestor-1" } as never);
    mockCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed on the fields: (`email`)",
        {
          code: "P2002",
          clientVersion: "test",
          meta: { target: ["email"] },
        },
      ),
    );

    const input: ProvisionarInput = {
      id: "user-6",
      nome: "Email Duplicado",
      email: "duplicado@example.com",
      role: Role.SOLICITANTE,
      gestor_id: "gestor-1",
    };

    const erro = await capturarErro(input);

    expect(erro).toBeInstanceOf(ErroValidacaoUsuario);
    expect((erro as Error).message).toMatch(/ja esta cadastrado/i);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});
