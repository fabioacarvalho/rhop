import { beforeEach, describe, expect, it, vi } from "vitest";

// Garante que o guard de auto-execucao em migrate-equipes.ts (baseado em
// `process.env.VITEST`) esteja ativo antes de importar o modulo — Vitest ja
// define essa variavel por padrao, mas deixamos explicito aqui pela mesma
// razao do comentario no arquivo testado: importar o modulo NUNCA deve
// disparar `main()` de verdade.
process.env.VITEST = process.env.VITEST ?? "true";

// Mock de `@/lib/prisma` e `@/lib/services/logService` — unit test isolado,
// nunca deve bater no banco real (mesmo padrão de equipeService.test.ts).
vi.mock("@/lib/prisma", () => ({
  prisma: {
    equipe: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/services/logService", () => ({
  registrar: vi.fn(),
}));

// `dotenv/config` tenta ler um `.env` real na raiz do projeto — nao e
// necessario (e nao deve ser necessario) para este teste, entao mockamos
// para um modulo vazio e evitamos qualquer efeito colateral de I/O.
vi.mock("dotenv/config", () => ({}));

import { prisma } from "@/lib/prisma";
import { registrar } from "@/lib/services/logService";
import { Role, type Equipe, type User } from "@/lib/generated/prisma/client";
import {
  identificarInconsistencias,
  migrarGestor,
} from "./migrate-equipes";

const mockEquipeFindUnique = vi.mocked(prisma.equipe.findUnique);
const mockEquipeCreate = vi.mocked(prisma.equipe.create);
const mockUserFindMany = vi.mocked(prisma.user.findMany);
const mockUserCount = vi.mocked(prisma.user.count);
const mockUserUpdateMany = vi.mocked(prisma.user.updateMany);
const mockRegistrar = vi.mocked(registrar);

beforeEach(() => {
  mockEquipeFindUnique.mockReset();
  mockEquipeCreate.mockReset();
  mockUserFindMany.mockReset();
  mockUserCount.mockReset();
  mockUserUpdateMany.mockReset();
  mockRegistrar.mockReset().mockResolvedValue(undefined);
});

function gestorFake(overrides: Partial<User> = {}): User {
  return {
    id: "gestor-1",
    nome: "Gestor Um",
    email: "gestor@empresa.com",
    role: Role.GESTOR,
    gestor_id: null,
    ativo: true,
    equipe_id: null,
    ...overrides,
  } as User;
}

function usuarioFake(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    nome: "Usuario Um",
    email: "usuario@empresa.com",
    role: Role.SOLICITANTE,
    gestor_id: null,
    ativo: true,
    equipe_id: null,
    ...overrides,
  } as User;
}

function equipeFake(overrides: Partial<Equipe> = {}): Equipe {
  return {
    id: "equipe-1",
    nome: "Equipe de Gestor Um",
    gestor_id: "gestor-1",
    ativo: true,
    criado_em: new Date("2026-01-01T00:00:00.000Z"),
    atualizado_em: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as Equipe;
}

describe("migrarGestor", () => {
  it("GESTOR com subordinados -> cria 1 Equipe nova e migra os subordinados", async () => {
    const gestor = gestorFake();
    mockUserCount.mockResolvedValueOnce(3);
    mockEquipeFindUnique.mockResolvedValueOnce(null);
    mockEquipeCreate.mockResolvedValueOnce(equipeFake());
    mockUserUpdateMany.mockResolvedValueOnce({ count: 3 });

    const resultado = await migrarGestor(gestor);

    expect(resultado).toEqual({
      equipeId: "equipe-1",
      equipeNome: "Equipe de Gestor Um",
      criada: true,
      usuariosMigrados: 3,
    });
    expect(mockUserCount).toHaveBeenCalledWith({
      where: { gestor_id: "gestor-1", role: Role.SOLICITANTE },
    });
    expect(mockEquipeFindUnique).toHaveBeenCalledWith({
      where: { nome: "Equipe de Gestor Um" },
    });
    expect(mockEquipeCreate).toHaveBeenCalledTimes(1);
    expect(mockEquipeCreate).toHaveBeenCalledWith({
      data: { nome: "Equipe de Gestor Um", gestor_id: "gestor-1" },
    });
    expect(mockUserUpdateMany).toHaveBeenCalledWith({
      where: { gestor_id: "gestor-1", role: Role.SOLICITANTE },
      data: { equipe_id: "equipe-1" },
    });
  });

  it("GESTOR sem subordinados -> retorna null, nenhuma Equipe criada", async () => {
    const gestor = gestorFake();
    mockUserCount.mockResolvedValueOnce(0);

    const resultado = await migrarGestor(gestor);

    expect(resultado).toBeNull();
    expect(mockEquipeFindUnique).not.toHaveBeenCalled();
    expect(mockEquipeCreate).not.toHaveBeenCalled();
    expect(mockUserUpdateMany).not.toHaveBeenCalled();
  });

  it("idempotencia: Equipe com o mesmo nome ja existe -> reusa em vez de criar de novo", async () => {
    const gestor = gestorFake();
    const equipeExistente = equipeFake();
    mockUserCount.mockResolvedValueOnce(3);
    mockEquipeFindUnique.mockResolvedValueOnce(equipeExistente);
    mockUserUpdateMany.mockResolvedValueOnce({ count: 3 });

    const resultado = await migrarGestor(gestor);

    expect(resultado).toEqual({
      equipeId: "equipe-1",
      equipeNome: "Equipe de Gestor Um",
      criada: false,
      usuariosMigrados: 3,
    });
    expect(mockEquipeCreate).not.toHaveBeenCalled();
    expect(mockUserUpdateMany).toHaveBeenCalledWith({
      where: { gestor_id: "gestor-1", role: Role.SOLICITANTE },
      data: { equipe_id: "equipe-1" },
    });
  });

  it("rodar a logica 2x seguidas -> segunda rodada reusa a Equipe da primeira, sem duplicar", async () => {
    const gestor = gestorFake();

    // 1a rodada: ainda nao existe Equipe com esse nome.
    mockUserCount.mockResolvedValueOnce(2);
    mockEquipeFindUnique.mockResolvedValueOnce(null);
    mockEquipeCreate.mockResolvedValueOnce(equipeFake());
    mockUserUpdateMany.mockResolvedValueOnce({ count: 2 });

    const primeira = await migrarGestor(gestor);
    expect(primeira?.criada).toBe(true);

    // 2a rodada: a Equipe criada na 1a rodada agora existe no banco.
    mockUserCount.mockResolvedValueOnce(2);
    mockEquipeFindUnique.mockResolvedValueOnce(equipeFake());
    mockUserUpdateMany.mockResolvedValueOnce({ count: 2 });

    const segunda = await migrarGestor(gestor);

    expect(segunda?.criada).toBe(false);
    expect(segunda?.equipeId).toBe(primeira?.equipeId);
    // `create` so foi chamado uma vez no total (1a rodada) -> nao duplicou.
    expect(mockEquipeCreate).toHaveBeenCalledTimes(1);
  });
});

describe("identificarInconsistencias", () => {
  it("User com gestor_id apontando para nao-GESTOR -> grava Log ERRO e retorna a inconsistencia", async () => {
    const gestorValido = gestorFake({ id: "gestor-1" });
    const naoGestor = usuarioFake({ id: "nao-gestor-1", role: Role.SOLICITANTE });
    const usuarioInconsistente = usuarioFake({
      id: "user-inconsistente",
      gestor_id: "nao-gestor-1",
    });
    const usuarioConsistente = usuarioFake({
      id: "user-consistente",
      gestor_id: "gestor-1",
    });

    mockUserFindMany.mockResolvedValueOnce([
      gestorValido,
      naoGestor,
      usuarioInconsistente,
      usuarioConsistente,
    ]);

    const resultado = await identificarInconsistencias();

    expect(resultado).toEqual([
      { usuarioId: "user-inconsistente", gestorId: "nao-gestor-1" },
    ]);
    expect(mockRegistrar).toHaveBeenCalledTimes(1);
    expect(mockRegistrar).toHaveBeenCalledWith({
      tipo: "ERRO",
      entidade: "User",
      entidade_id: "user-inconsistente",
      acao: "GESTOR_ID_INCONSISTENTE",
      detalhes: { gestor_id: "nao-gestor-1" },
    });
  });

  it("nenhum User com gestor_id inconsistente -> retorna lista vazia, sem gravar Log", async () => {
    const gestorValido = gestorFake({ id: "gestor-1" });
    const usuarioConsistente = usuarioFake({
      id: "user-consistente",
      gestor_id: "gestor-1",
    });

    mockUserFindMany.mockResolvedValueOnce([gestorValido, usuarioConsistente]);

    const resultado = await identificarInconsistencias();

    expect(resultado).toEqual([]);
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it("User sem gestor_id -> ignorado, nao gera inconsistencia", async () => {
    const semGestor = usuarioFake({ id: "user-sem-gestor", gestor_id: null });

    mockUserFindMany.mockResolvedValueOnce([semGestor]);

    const resultado = await identificarInconsistencias();

    expect(resultado).toEqual([]);
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it("gestor_id apontando para id que nao existe mais -> ignorado (fora de escopo desta checagem)", async () => {
    const orfao = usuarioFake({ id: "user-orfao", gestor_id: "id-inexistente" });

    mockUserFindMany.mockResolvedValueOnce([orfao]);

    const resultado = await identificarInconsistencias();

    expect(resultado).toEqual([]);
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it("GESTOR cujo gestor_id antigo aponta pra RH_ADMIN (hierarquia de pessoal valida no modelo antigo) -> nao e inconsistencia", async () => {
    const rhAdmin = usuarioFake({ id: "rh-1", role: Role.RH_ADMIN, gestor_id: null });
    const gestorReportandoParaRh = gestorFake({ id: "gestor-1", gestor_id: "rh-1" });

    mockUserFindMany.mockResolvedValueOnce([rhAdmin, gestorReportandoParaRh]);

    const resultado = await identificarInconsistencias();

    expect(resultado).toEqual([]);
    expect(mockRegistrar).not.toHaveBeenCalled();
  });
});
