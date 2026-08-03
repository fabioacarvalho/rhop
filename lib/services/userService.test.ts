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
    equipe: {
      findUnique: vi.fn(),
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

vi.mock("@/lib/services/equipeService", () => ({
  listarGeridasPor: vi.fn(),
  contarGeridasAtivasPor: vi.fn(),
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
import * as equipeService from "@/lib/services/equipeService";
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
  provisionarViaGoogle,
  type ProvisionarInput,
} from "./userService";

const mockFindUnique = vi.mocked(prisma.user.findUnique);
const mockCreate = vi.mocked(prisma.user.create);
const mockUpdate = vi.mocked(prisma.user.update);
const mockFindMany = vi.mocked(prisma.user.findMany);
const mockEquipeFindUnique = vi.mocked(prisma.equipe.findUnique);
const mockRegistrar = vi.mocked(registrar);
const mockEnviarEmail = vi.mocked(resendService.enviarEmail);
const mockListarGeridasPor = vi.mocked(equipeService.listarGeridasPor);
const mockContarGeridasAtivasPor = vi.mocked(
  equipeService.contarGeridasAtivasPor,
);

const EQUIPE_ATIVA = { id: "equipe-1", nome: "Equipe A", ativo: true };

const RH_ADMIN: AuthenticatedUser = {
  id: "rh-1",
  nome: "RH Admin",
  email: "rh@empresa.com",
  role: Role.RH_ADMIN,
};

const GESTOR: AuthenticatedUser = {
  id: "gestor-1",
  nome: "Gestor",
  email: "gestor@empresa.com",
  role: Role.GESTOR,
};

function usuarioFake(overrides: Partial<User> = {}): User {
  return {
    id: "user-x",
    nome: "Fulano",
    email: "fulano@empresa.com",
    role: Role.SOLICITANTE,
    equipe_id: "equipe-1",
    ativo: true,
    ...overrides,
  } as User;
}

beforeEach(() => {
  mockFindUnique.mockReset();
  mockCreate.mockReset();
  mockUpdate.mockReset();
  mockFindMany.mockReset();
  mockEquipeFindUnique.mockReset();
  mockRegistrar.mockReset().mockResolvedValue(undefined);
  mockEnviarEmail.mockReset().mockResolvedValue(true);
  mockCreateUser.mockReset();
  mockDeleteUser.mockReset();
  mockListarGeridasPor.mockReset().mockResolvedValue([]);
  mockContarGeridasAtivasPor.mockReset().mockResolvedValue(0);
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
    expect(mockEquipeFindUnique).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejeita equipe_id nulo quando role === SOLICITANTE", async () => {
    const input: ProvisionarInput = {
      id: "user-2",
      nome: "Solicitante Sem Equipe",
      email: "solicitante@example.com",
      role: Role.SOLICITANTE,
      equipe_id: null,
    };

    const erro = await capturarErro(input);

    expect(erro).toBeInstanceOf(ErroValidacaoUsuario);
    expect((erro as Error).message).toMatch(/equipe_id e obrigatorio/i);
    expect(mockEquipeFindUnique).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("aceita equipe_id nulo quando role === RH_ADMIN", async () => {
    const input: ProvisionarInput = {
      id: "user-3",
      nome: "Admin RH",
      email: "admin@example.com",
      role: Role.RH_ADMIN,
      equipe_id: null,
    };

    mockCreate.mockResolvedValueOnce({
      id: "user-3",
      nome: "Admin RH",
      email: "admin@example.com",
      role: Role.RH_ADMIN,
      equipe_id: null,
    } as never);

    await expect(provisionar(input)).resolves.toMatchObject({ id: "user-3" });
    expect(mockEquipeFindUnique).not.toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        id: "user-3",
        nome: "Admin RH",
        email: "admin@example.com",
        role: Role.RH_ADMIN,
        equipe_id: null,
      },
    });
  });

  it("rejeita equipe_id quando role !== SOLICITANTE", async () => {
    const input: ProvisionarInput = {
      id: "user-4",
      nome: "Gestor Com Equipe",
      email: "gestor@example.com",
      role: Role.GESTOR,
      equipe_id: "equipe-1",
    };

    const erro = await capturarErro(input);

    expect(erro).toBeInstanceOf(ErroValidacaoUsuario);
    expect((erro as Error).message).toMatch(/nao e permitido/i);
    expect(mockEquipeFindUnique).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejeita equipe_id que nao corresponde a nenhuma equipe existente", async () => {
    mockEquipeFindUnique.mockResolvedValueOnce(null);

    const input: ProvisionarInput = {
      id: "user-5",
      nome: "Sem Equipe Valida",
      email: "sem-equipe@example.com",
      role: Role.SOLICITANTE,
      equipe_id: "equipe-inexistente",
    };

    const erro = await capturarErro(input);

    expect(erro).toBeInstanceOf(ErroValidacaoUsuario);
    expect((erro as Error).message).toMatch(
      /nao corresponde a nenhuma equipe existente/i,
    );
    expect(mockEquipeFindUnique).toHaveBeenCalledWith({
      where: { id: "equipe-inexistente" },
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejeita equipe_id de equipe inativa", async () => {
    mockEquipeFindUnique.mockResolvedValueOnce({
      ...EQUIPE_ATIVA,
      ativo: false,
    } as never);

    const input: ProvisionarInput = {
      id: "user-5b",
      nome: "Equipe Inativa",
      email: "equipe-inativa@example.com",
      role: Role.SOLICITANTE,
      equipe_id: "equipe-1",
    };

    const erro = await capturarErro(input);

    expect(erro).toBeInstanceOf(ErroValidacaoUsuario);
    expect((erro as Error).message).toMatch(/equipe inativa/i);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("traduz email duplicado (P2002) para ErroValidacaoUsuario legivel", async () => {
    mockEquipeFindUnique.mockResolvedValueOnce(EQUIPE_ATIVA as never);
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
      equipe_id: "equipe-1",
    };

    const erro = await capturarErro(input);

    expect(erro).toBeInstanceOf(ErroValidacaoUsuario);
    expect((erro as Error).message).toMatch(/ja esta cadastrado/i);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});

describe("userService.cadastrar", () => {
  it("RH_ADMIN cria com role/equipe_id validos: cria Auth + User, envia email, grava AUDITORIA", async () => {
    mockCreateUser.mockResolvedValueOnce({
      data: { user: { id: "auth-novo" } },
      error: null,
    });
    mockEquipeFindUnique.mockResolvedValueOnce(EQUIPE_ATIVA as never);
    mockCreate.mockResolvedValueOnce(
      usuarioFake({ id: "auth-novo", role: Role.SOLICITANTE }) as never,
    );

    const resultado = await cadastrar(
      {
        nome: "Novo Usuario",
        email: "novo@empresa.com",
        role: Role.SOLICITANTE,
        equipe_id: "equipe-1",
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

  it("GESTOR cadastra SOLICITANTE numa equipe que ele gerencia", async () => {
    mockListarGeridasPor.mockResolvedValueOnce([EQUIPE_ATIVA]);
    mockCreateUser.mockResolvedValueOnce({
      data: { user: { id: "auth-novo" } },
      error: null,
    });
    mockEquipeFindUnique.mockResolvedValueOnce(EQUIPE_ATIVA as never);
    mockCreate.mockResolvedValueOnce(
      usuarioFake({ id: "auth-novo", equipe_id: "equipe-1" }) as never,
    );

    await cadastrar(
      {
        nome: "Subordinado",
        email: "subordinado@empresa.com",
        role: Role.SOLICITANTE,
        equipe_id: "equipe-1",
      },
      GESTOR,
    );

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        role: Role.SOLICITANTE,
        equipe_id: "equipe-1",
      }),
    });
  });

  it("GESTOR tentando equipe que nao gerencia -> ErroPermissaoUsuario, nenhuma chamada ao Supabase Admin", async () => {
    mockListarGeridasPor.mockResolvedValueOnce([
      { id: "equipe-outra", nome: "Equipe Outra" },
    ]);

    await expect(
      cadastrar(
        {
          nome: "Tentativa",
          email: "tentativa@empresa.com",
          role: Role.SOLICITANTE,
          equipe_id: "equipe-1",
        },
        GESTOR,
      ),
    ).rejects.toBeInstanceOf(ErroPermissaoUsuario);

    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("GESTOR tentando outro role -> ErroPermissaoUsuario, nenhuma chamada ao Supabase Admin", async () => {
    mockListarGeridasPor.mockResolvedValueOnce([EQUIPE_ATIVA]);

    await expect(
      cadastrar(
        {
          nome: "Tentativa",
          email: "tentativa@empresa.com",
          role: Role.GESTOR,
          equipe_id: "equipe-1",
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
      usuarioFake({ id: "auth-novo", role: Role.RH_ADMIN, equipe_id: null }) as never,
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
      usuarioFake({ id: "alvo-2", equipe_id: "equipe-outra" }) as never,
    );
    mockListarGeridasPor.mockResolvedValueOnce([EQUIPE_ATIVA]);

    await expect(
      editar("alvo-2", { nome: "X" }, GESTOR),
    ).rejects.toBeInstanceOf(ErroPermissaoUsuario);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("troca de role de quem gerencia equipe(s) ativa(s) para SOLICITANTE -> ErroEdicaoBloqueadaUsuario, nenhum update", async () => {
    mockFindUnique.mockResolvedValueOnce(
      usuarioFake({ id: "alvo-3", role: Role.GESTOR, equipe_id: null }) as never,
    );
    mockContarGeridasAtivasPor.mockResolvedValueOnce(2);

    await expect(
      editar("alvo-3", { role: Role.SOLICITANTE }, RH_ADMIN),
    ).rejects.toBeInstanceOf(ErroEdicaoBloqueadaUsuario);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("troca de role de SOLICITANTE para GESTOR limpa equipe_id automaticamente", async () => {
    mockFindUnique.mockResolvedValueOnce(
      usuarioFake({ id: "alvo-3b", role: Role.SOLICITANTE, equipe_id: "equipe-1" }) as never,
    );
    mockUpdate.mockResolvedValueOnce(
      usuarioFake({ id: "alvo-3b", role: Role.GESTOR, equipe_id: null }) as never,
    );

    await editar("alvo-3b", { role: Role.GESTOR }, RH_ADMIN);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "alvo-3b" },
      data: { role: Role.GESTOR, equipe_id: null },
    });
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

  it("GESTOR enviando role/equipe_id -> ErroPermissaoUsuario", async () => {
    mockFindUnique.mockResolvedValueOnce(
      usuarioFake({ id: "alvo-4", equipe_id: "equipe-1" }) as never,
    );
    mockListarGeridasPor.mockResolvedValueOnce([EQUIPE_ATIVA]);

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
      usuarioFake({ id: "alvo-6", equipe_id: "equipe-1" }) as never,
    );
    mockListarGeridasPor.mockResolvedValueOnce([EQUIPE_ATIVA]);
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
      { ...usuarioFake({ id: "u1" }), equipe: { nome: "Equipe A" } },
    ] as never);

    const resultado = await listar(RH_ADMIN);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
    expect(resultado[0].equipe_nome).toBe("Equipe A");
  });

  it("GESTOR recebe so SOLICITANTE com equipe_id entre as equipes geridas", async () => {
    mockListarGeridasPor.mockResolvedValueOnce([
      { id: "equipe-1", nome: "Equipe A" },
      { id: "equipe-2", nome: "Equipe B" },
    ]);
    mockFindMany.mockResolvedValueOnce([]);

    await listar(GESTOR);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          role: Role.SOLICITANTE,
          equipe_id: { in: ["equipe-1", "equipe-2"] },
        },
      }),
    );
  });
});

describe("userService.buscarPorId", () => {
  it("fora do escopo do GESTOR -> ErroNaoEncontradoUsuario (nao revela existencia)", async () => {
    mockFindUnique.mockResolvedValueOnce(
      usuarioFake({ id: "alvo-7", equipe_id: "equipe-outra" }) as never,
    );
    mockListarGeridasPor.mockResolvedValueOnce([EQUIPE_ATIVA]);

    await expect(buscarPorId("alvo-7", GESTOR)).rejects.toBeInstanceOf(
      ErroNaoEncontradoUsuario,
    );
  });

  it("dentro do escopo do GESTOR -> retorna o usuario", async () => {
    mockFindUnique.mockResolvedValueOnce(
      usuarioFake({ id: "alvo-8", equipe_id: "equipe-1" }) as never,
    );
    mockListarGeridasPor.mockResolvedValueOnce([EQUIPE_ATIVA]);

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

describe("userService.provisionarViaGoogle", () => {
  const INPUT = {
    id: "google-user-1",
    nome: "Fulano Google",
    email: "fulano@01tec.com.br",
    equipe_id: "equipe-1",
  };

  it("User inexistente + equipe_id valido/ativo -> cria via provisionar e grava Log AUDITORIA CRIACAO_AUTO_GOOGLE", async () => {
    mockFindUnique.mockResolvedValueOnce(null); // checagem de idempotencia
    mockEquipeFindUnique.mockResolvedValueOnce(EQUIPE_ATIVA as never); // validarVinculoEquipe
    mockCreate.mockResolvedValueOnce(usuarioFake({ id: INPUT.id }) as never);

    const resultado = await provisionarViaGoogle(INPUT);

    expect(resultado.id).toBe(INPUT.id);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockRegistrar).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "AUDITORIA",
        entidade: "User",
        entidade_id: INPUT.id,
        acao: "CRIACAO_AUTO_GOOGLE",
        usuario_id: null,
      }),
    );
  });

  it("User ja existente (mesmo id) -> retorna o registro existente, sem chamar provisionar/registrar de novo", async () => {
    mockFindUnique.mockResolvedValueOnce(usuarioFake({ id: INPUT.id }) as never);

    const resultado = await provisionarViaGoogle(INPUT);

    expect(resultado.id).toBe(INPUT.id);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it("equipe_id invalido/inativo -> propaga ErroValidacaoUsuario de provisionar, sem tratamento especial", async () => {
    mockFindUnique.mockResolvedValueOnce(null); // checagem de idempotencia
    mockEquipeFindUnique.mockResolvedValueOnce(null); // validarVinculoEquipe: equipe nao existe
    mockFindUnique.mockResolvedValueOnce(null); // re-checagem apos ErroValidacaoUsuario: ninguem criou

    await expect(provisionarViaGoogle(INPUT)).rejects.toBeInstanceOf(
      ErroValidacaoUsuario,
    );
  });

  it("simulacao de corrida: provisionar lanca ErroValidacaoUsuario (e-mail duplicado) e o segundo findUnique encontra o registro -> retorna em vez de lancar", async () => {
    mockFindUnique.mockResolvedValueOnce(null); // checagem de idempotencia
    mockEquipeFindUnique.mockResolvedValueOnce(EQUIPE_ATIVA as never); // validarVinculoEquipe
    mockCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("email ja existe", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    mockFindUnique.mockResolvedValueOnce(usuarioFake({ id: INPUT.id }) as never); // a outra requisicao venceu a corrida

    const resultado = await provisionarViaGoogle(INPUT);

    expect(resultado.id).toBe(INPUT.id);
    expect(mockRegistrar).not.toHaveBeenCalled();
  });
});
