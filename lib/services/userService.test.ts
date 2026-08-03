import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock de `@/lib/prisma` — unit test isolado, nunca deve bater no banco real
// (o caminho contra Supabase real já foi validado manualmente em outra task).
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/services/logService", () => ({
  registrar: vi.fn(),
}));

vi.mock("@/lib/services/resendService", () => ({
  resendService: {
    enviarEmail: vi.fn(),
  },
}));

const mockCreateUser = vi.fn();
const mockDeleteUser = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        createUser: mockCreateUser,
        deleteUser: mockDeleteUser,
      },
    },
  })),
}));

import { prisma } from "@/lib/prisma";
import { Prisma, Role, type User } from "@/lib/generated/prisma/client";
import { registrar } from "@/lib/services/logService";
import { resendService } from "@/lib/services/resendService";
import type { AuthenticatedUser } from "@/lib/services/authService";
import {
  buscarPorId,
  cadastrar,
  definirStatus,
  editar,
  ErroEdicaoBloqueadaUsuario,
  ErroNaoEncontradoUsuario,
  ErroPermissaoUsuario,
  ErroValidacaoUsuario,
  listar,
  provisionar,
  type ProvisionarInput,
} from "./userService";

const mockFindUnique = vi.mocked(prisma.user.findUnique);
const mockCreate = vi.mocked(prisma.user.create);
const mockUpdate = vi.mocked(prisma.user.update);
const mockCount = vi.mocked(prisma.user.count);
const mockFindMany = vi.mocked(prisma.user.findMany);
const mockRegistrar = vi.mocked(registrar);
const mockEnviarEmail = vi.mocked(resendService.enviarEmail);

const RH_ADMIN: AuthenticatedUser = {
  id: "rh-1",
  nome: "RH Admin",
  email: "rh@empresa.com",
  role: Role.RH_ADMIN,
  gestor_id: null,
};

const GESTOR: AuthenticatedUser = {
  id: "gestor-1",
  nome: "Gestor",
  email: "gestor@empresa.com",
  role: Role.GESTOR,
  gestor_id: "rh-1",
};

function usuarioFake(overrides: Partial<User> = {}): User {
  return {
    id: "user-x",
    nome: "Fulano",
    email: "fulano@empresa.com",
    role: Role.SOLICITANTE,
    gestor_id: "gestor-1",
    ativo: true,
    ...overrides,
  } as User;
}

beforeEach(() => {
  mockFindUnique.mockReset();
  mockCreate.mockReset();
  mockUpdate.mockReset();
  mockCount.mockReset();
  mockFindMany.mockReset();
  mockRegistrar.mockReset().mockResolvedValue(undefined);
  mockEnviarEmail.mockReset().mockResolvedValue(true);
  mockCreateUser.mockReset();
  mockDeleteUser.mockReset();
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

describe("userService.cadastrar", () => {
  it("RH_ADMIN cria com role/gestor_id validos: cria Auth + User, envia email, grava AUDITORIA", async () => {
    mockCreateUser.mockResolvedValueOnce({
      data: { user: { id: "auth-novo" } },
      error: null,
    });
    mockFindUnique.mockResolvedValueOnce({ id: "gestor-1" } as never); // gestor_id existe
    mockCreate.mockResolvedValueOnce(
      usuarioFake({ id: "auth-novo", role: Role.SOLICITANTE }) as never,
    );

    const resultado = await cadastrar(
      {
        nome: "Novo Usuario",
        email: "novo@empresa.com",
        role: Role.SOLICITANTE,
        gestor_id: "gestor-1",
      },
      RH_ADMIN,
    );

    expect(resultado.usuario.id).toBe("auth-novo");
    expect(resultado.emailEnviado).toBe(true);
    expect(mockEnviarEmail).toHaveBeenCalledTimes(1);
    expect(mockDeleteUser).not.toHaveBeenCalled();
    expect(mockRegistrar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "AUDITORIA", acao: "CRIACAO" }),
    );
  });

  it("GESTOR forca role SOLICITANTE e gestor_id do proprio ator", async () => {
    mockCreateUser.mockResolvedValueOnce({
      data: { user: { id: "auth-novo" } },
      error: null,
    });
    mockFindUnique.mockResolvedValueOnce({ id: GESTOR.id } as never); // gestor_id (GESTOR.id) existe
    mockCreate.mockResolvedValueOnce(
      usuarioFake({ id: "auth-novo", gestor_id: GESTOR.id }) as never,
    );

    await cadastrar(
      {
        nome: "Subordinado",
        email: "subordinado@empresa.com",
        role: Role.SOLICITANTE,
        gestor_id: "outro-id-qualquer",
      },
      GESTOR,
    );

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ role: Role.SOLICITANTE, gestor_id: GESTOR.id }),
    });
  });

  it("GESTOR tentando outro role -> ErroPermissaoUsuario, nenhuma chamada ao Supabase Admin", async () => {
    await expect(
      cadastrar(
        {
          nome: "Tentativa",
          email: "tentativa@empresa.com",
          role: Role.GESTOR,
        },
        GESTOR,
      ),
    ).rejects.toBeInstanceOf(ErroPermissaoUsuario);

    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("provisionar falhando (email duplicado) -> admin.deleteUser chamado, erro original propagado", async () => {
    mockCreateUser.mockResolvedValueOnce({
      data: { user: { id: "auth-orfa" } },
      error: null,
    });
    mockCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["email"] },
      }),
    );

    await expect(
      cadastrar(
        {
          nome: "Duplicado",
          email: "duplicado@empresa.com",
          role: Role.RH_ADMIN,
        },
        RH_ADMIN,
      ),
    ).rejects.toBeInstanceOf(ErroValidacaoUsuario);

    expect(mockDeleteUser).toHaveBeenCalledWith("auth-orfa");
  });

  it("enviarEmail retornando false -> criacao NAO desfeita, emailEnviado: false", async () => {
    mockCreateUser.mockResolvedValueOnce({
      data: { user: { id: "auth-novo" } },
      error: null,
    });
    mockCreate.mockResolvedValueOnce(
      usuarioFake({ id: "auth-novo", role: Role.RH_ADMIN, gestor_id: null }) as never,
    );
    mockEnviarEmail.mockResolvedValueOnce(false);

    const resultado = await cadastrar(
      { nome: "Sem Email", email: "sememail@empresa.com", role: Role.RH_ADMIN },
      RH_ADMIN,
    );

    expect(resultado.emailEnviado).toBe(false);
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });
});

describe("userService.editar", () => {
  it("RH_ADMIN edita valido -> update aplicado, AUDITORIA/EDICAO", async () => {
    mockFindUnique.mockResolvedValueOnce(usuarioFake({ id: "alvo-1" }) as never);
    mockUpdate.mockResolvedValueOnce(
      usuarioFake({ id: "alvo-1", nome: "Novo Nome" }) as never,
    );

    const resultado = await editar("alvo-1", { nome: "Novo Nome" }, RH_ADMIN);

    expect(resultado.nome).toBe("Novo Nome");
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "alvo-1" },
      data: { nome: "Novo Nome" },
    });
    expect(mockRegistrar).toHaveBeenCalledWith(
      expect.objectContaining({ acao: "EDICAO" }),
    );
  });

  it("GESTOR sobre alvo fora do escopo -> ErroPermissaoUsuario, nenhum update", async () => {
    mockFindUnique.mockResolvedValueOnce(
      usuarioFake({ id: "alvo-2", gestor_id: "outro-gestor" }) as never,
    );

    await expect(
      editar("alvo-2", { nome: "X" }, GESTOR),
    ).rejects.toBeInstanceOf(ErroPermissaoUsuario);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("troca de role de quem tem equipe para papel != GESTOR/RH_ADMIN -> ErroEdicaoBloqueadaUsuario, nenhum update", async () => {
    mockFindUnique.mockResolvedValueOnce(
      usuarioFake({ id: "alvo-3", role: Role.GESTOR, gestor_id: "rh-1" }) as never,
    );
    mockCount.mockResolvedValueOnce(2);

    await expect(
      editar("alvo-3", { role: Role.SOLICITANTE }, RH_ADMIN),
    ).rejects.toBeInstanceOf(ErroEdicaoBloqueadaUsuario);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("editar com id === ator.id -> ErroPermissaoUsuario, nenhuma escrita", async () => {
    mockFindUnique.mockResolvedValueOnce(usuarioFake({ id: RH_ADMIN.id }) as never);

    await expect(
      editar(RH_ADMIN.id, { nome: "X" }, RH_ADMIN),
    ).rejects.toBeInstanceOf(ErroPermissaoUsuario);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("id inexistente -> ErroNaoEncontradoUsuario", async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    await expect(
      editar("inexistente", { nome: "X" }, RH_ADMIN),
    ).rejects.toBeInstanceOf(ErroNaoEncontradoUsuario);
  });

  it("GESTOR enviando role/gestor_id -> ErroPermissaoUsuario", async () => {
    mockFindUnique.mockResolvedValueOnce(
      usuarioFake({ id: "alvo-4", gestor_id: GESTOR.id }) as never,
    );

    await expect(
      editar("alvo-4", { role: Role.GESTOR }, GESTOR),
    ).rejects.toBeInstanceOf(ErroPermissaoUsuario);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("userService.definirStatus", () => {
  it("RH_ADMIN desativa dentro do escopo -> update aplicado, AUDITORIA/DESATIVACAO", async () => {
    mockFindUnique.mockResolvedValueOnce(usuarioFake({ id: "alvo-5" }) as never);
    mockUpdate.mockResolvedValueOnce(
      usuarioFake({ id: "alvo-5", ativo: false }) as never,
    );

    await definirStatus("alvo-5", false, RH_ADMIN);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "alvo-5" },
      data: { ativo: false },
    });
    expect(mockRegistrar).toHaveBeenCalledWith(
      expect.objectContaining({ acao: "DESATIVACAO" }),
    );
  });

  it("GESTOR reativa dentro do escopo -> update aplicado, AUDITORIA/REATIVACAO", async () => {
    mockFindUnique.mockResolvedValueOnce(
      usuarioFake({ id: "alvo-6", gestor_id: GESTOR.id }) as never,
    );
    mockUpdate.mockResolvedValueOnce(
      usuarioFake({ id: "alvo-6", ativo: true }) as never,
    );

    await definirStatus("alvo-6", true, GESTOR);

    expect(mockRegistrar).toHaveBeenCalledWith(
      expect.objectContaining({ acao: "REATIVACAO" }),
    );
  });

  it("id === ator.id -> ErroPermissaoUsuario, nenhuma escrita", async () => {
    mockFindUnique.mockResolvedValueOnce(usuarioFake({ id: GESTOR.id }) as never);

    await expect(
      definirStatus(GESTOR.id, false, GESTOR),
    ).rejects.toBeInstanceOf(ErroPermissaoUsuario);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("userService.listar", () => {
  it("RH_ADMIN recebe todos os usuarios", async () => {
    mockFindMany.mockResolvedValueOnce([
      { ...usuarioFake({ id: "u1" }), gestor: { nome: "Gestor" } },
    ] as never);

    const resultado = await listar(RH_ADMIN);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
    expect(resultado[0].gestor_nome).toBe("Gestor");
  });

  it("GESTOR recebe so SOLICITANTE com gestor_id = ator.id", async () => {
    mockFindMany.mockResolvedValueOnce([]);

    await listar(GESTOR);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: Role.SOLICITANTE, gestor_id: GESTOR.id },
      }),
    );
  });
});

describe("userService.buscarPorId", () => {
  it("fora do escopo do GESTOR -> ErroNaoEncontradoUsuario (nao revela existencia)", async () => {
    mockFindUnique.mockResolvedValueOnce(
      usuarioFake({ id: "alvo-7", gestor_id: "outro-gestor" }) as never,
    );

    await expect(buscarPorId("alvo-7", GESTOR)).rejects.toBeInstanceOf(
      ErroNaoEncontradoUsuario,
    );
  });

  it("dentro do escopo do GESTOR -> retorna o usuario", async () => {
    mockFindUnique.mockResolvedValueOnce(
      usuarioFake({ id: "alvo-8", gestor_id: GESTOR.id }) as never,
    );

    const resultado = await buscarPorId("alvo-8", GESTOR);
    expect(resultado.id).toBe("alvo-8");
  });

  it("id inexistente -> ErroNaoEncontradoUsuario", async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    await expect(buscarPorId("inexistente", RH_ADMIN)).rejects.toBeInstanceOf(
      ErroNaoEncontradoUsuario,
    );
  });
});
