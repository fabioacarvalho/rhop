import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    candidato: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/services/logService", () => ({
  registrar: vi.fn(),
}));

vi.mock("@/lib/services/embeddingService", () => ({
  gerar: vi.fn(),
  persistirEmbedding: vi.fn(),
  marcarFalha: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { registrar } from "@/lib/services/logService";
import * as embeddingService from "@/lib/services/embeddingService";
import { Prisma, type Candidato } from "@/lib/generated/prisma/client";
import {
  ErroEmailDuplicado,
  ErroNaoEncontrado,
  ErroReprocessamentoNaoPermitido,
  cadastrar,
  listar,
  reprocessarEmbedding,
} from "./candidatoService";
import type { CandidatoInput } from "@/lib/validations/candidato";

const mockCreate = vi.mocked(prisma.candidato.create);
const mockFindMany = vi.mocked(prisma.candidato.findMany);
const mockFindUnique = vi.mocked(prisma.candidato.findUnique);
const mockRegistrar = vi.mocked(registrar);
const mockGerar = vi.mocked(embeddingService.gerar);
const mockPersistirEmbedding = vi.mocked(embeddingService.persistirEmbedding);
const mockMarcarFalha = vi.mocked(embeddingService.marcarFalha);

beforeEach(() => {
  mockCreate.mockReset();
  mockFindMany.mockReset();
  mockFindUnique.mockReset();
  mockRegistrar.mockReset();
  mockRegistrar.mockResolvedValue(undefined);
  mockGerar.mockReset();
  mockPersistirEmbedding.mockReset();
  mockMarcarFalha.mockReset();
});

const DADOS_VALIDOS: CandidatoInput = {
  nome: "Marina Costa",
  email: "marina.costa@empresa.com",
  telefone: "11999998888",
  curriculo_texto: "Engenheira de dados.",
  parecer_tecnico: "Entrevista tecnica solida.",
};

const CANDIDATO_CRIADO: Candidato = {
  id: "cand-1",
  nome: DADOS_VALIDOS.nome,
  email: DADOS_VALIDOS.email,
  telefone: DADOS_VALIDOS.telefone,
  curriculo_texto: DADOS_VALIDOS.curriculo_texto,
  curriculo_arquivo_url: null,
  parecer_tecnico: DADOS_VALIDOS.parecer_tecnico,
  status_embedding: "pendente",
  solicitacao_id: null,
  criado_por: "user-1",
  criado_em: new Date("2026-08-01T00:00:00.000Z"),
} as unknown as Candidato;

describe("candidatoService.cadastrar", () => {
  it("caminho feliz + embedding com sucesso -> cria, persiste embedding, grava AUDITORIA", async () => {
    mockCreate.mockResolvedValueOnce(CANDIDATO_CRIADO);
    mockGerar.mockResolvedValueOnce([0.1, 0.2]);

    const result = await cadastrar(DADOS_VALIDOS, "user-1");

    expect(result).toEqual(CANDIDATO_CRIADO);
    expect(mockGerar).toHaveBeenCalledWith(
      `${DADOS_VALIDOS.curriculo_texto}\n${DADOS_VALIDOS.parecer_tecnico}`,
    );
    expect(mockPersistirEmbedding).toHaveBeenCalledWith("cand-1", [0.1, 0.2]);
    expect(mockMarcarFalha).not.toHaveBeenCalled();
    expect(mockRegistrar).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "AUDITORIA",
        entidade: "Candidato",
        entidade_id: "cand-1",
        acao: "CRIACAO",
        usuario_id: "user-1",
      }),
    );
  });

  it("embedding falha -> marcarFalha chamado, cadastro ainda retorna sucesso", async () => {
    mockCreate.mockResolvedValueOnce(CANDIDATO_CRIADO);
    mockGerar.mockResolvedValueOnce(null);

    const result = await cadastrar(DADOS_VALIDOS, "user-1");

    expect(result).toEqual(CANDIDATO_CRIADO);
    expect(mockMarcarFalha).toHaveBeenCalledWith("cand-1");
    expect(mockPersistirEmbedding).not.toHaveBeenCalled();
    expect(mockRegistrar).toHaveBeenCalledWith(
      expect.objectContaining({ acao: "CRIACAO" }),
    );
  });

  it("e-mail duplicado (P2002) -> ErroEmailDuplicado, nada persistido", async () => {
    mockCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    await expect(cadastrar(DADOS_VALIDOS, "user-1")).rejects.toThrow(
      ErroEmailDuplicado,
    );
    expect(mockGerar).not.toHaveBeenCalled();
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it("falha de logService.registrar (mockada rejeitando) nao impede cadastrar de retornar sucesso", async () => {
    mockCreate.mockResolvedValueOnce(CANDIDATO_CRIADO);
    mockGerar.mockResolvedValueOnce([0.1, 0.2]);
    mockRegistrar.mockRejectedValueOnce(new Error("db indisponivel"));

    const result = await cadastrar(DADOS_VALIDOS, "user-1");

    expect(result).toEqual(CANDIDATO_CRIADO);
  });

  it("envia solicitacao_id null quando ausente no input", async () => {
    mockCreate.mockResolvedValueOnce(CANDIDATO_CRIADO);
    mockGerar.mockResolvedValueOnce([0.1, 0.2]);

    await cadastrar(DADOS_VALIDOS, "user-1");

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ solicitacao_id: null }),
      }),
    );
  });

  it("conecta tags quando tag_ids informado", async () => {
    mockCreate.mockResolvedValueOnce(CANDIDATO_CRIADO);
    mockGerar.mockResolvedValueOnce([0.1, 0.2]);

    await cadastrar({ ...DADOS_VALIDOS, tag_ids: ["tag-1", "tag-2"] }, "user-1");

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tags: { connect: [{ id: "tag-1" }, { id: "tag-2" }] },
        }),
      }),
    );
  });

  it("nao conecta tags quando tag_ids ausente", async () => {
    mockCreate.mockResolvedValueOnce(CANDIDATO_CRIADO);
    mockGerar.mockResolvedValueOnce([0.1, 0.2]);

    await cadastrar(DADOS_VALIDOS, "user-1");

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tags: undefined }),
      }),
    );
  });
});

describe("candidatoService.listar", () => {
  it("retorna todos os candidatos, sem filtro por criado_por, incluindo tags", async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: "cand-1",
        nome: "Marina",
        email: "marina@empresa.com",
        status_embedding: "processado",
        criado_em: new Date("2026-08-01T00:00:00.000Z"),
        tags: [{ id: "tag-1", nome: "Sênior" }],
      },
    ] as never);

    const result = await listar();

    expect(result).toHaveLength(1);
    expect(result[0].tags).toEqual([{ id: "tag-1", nome: "Sênior" }]);
    expect(mockFindMany).toHaveBeenCalledWith({
      select: {
        id: true,
        nome: true,
        email: true,
        status_embedding: true,
        criado_em: true,
        tags: { select: { id: true, nome: true } },
      },
      orderBy: { criado_em: "desc" },
    });
  });
});

describe("candidatoService.reprocessarEmbedding", () => {
  it("caminho feliz -> reprocessa embedding falho e retorna candidato atualizado", async () => {
    const falho = { ...CANDIDATO_CRIADO, status_embedding: "falhou" };
    const atualizado = { ...CANDIDATO_CRIADO, status_embedding: "processado" };
    mockFindUnique
      .mockResolvedValueOnce(falho as never)
      .mockResolvedValueOnce(atualizado as never);
    mockGerar.mockResolvedValueOnce([0.3, 0.4]);

    const result = await reprocessarEmbedding("cand-1", "user-1");

    expect(result).toEqual(atualizado);
    expect(mockPersistirEmbedding).toHaveBeenCalledWith("cand-1", [0.3, 0.4]);
    expect(mockRegistrar).toHaveBeenCalledWith(
      expect.objectContaining({ acao: "REPROCESSAMENTO" }),
    );
  });

  it("id inexistente -> ErroNaoEncontrado", async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    await expect(reprocessarEmbedding("cand-x", "user-1")).rejects.toThrow(
      ErroNaoEncontrado,
    );
    expect(mockGerar).not.toHaveBeenCalled();
  });

  it("status_embedding diferente de 'falhou' -> ErroReprocessamentoNaoPermitido", async () => {
    mockFindUnique.mockResolvedValueOnce({
      ...CANDIDATO_CRIADO,
      status_embedding: "processado",
    } as never);

    await expect(reprocessarEmbedding("cand-1", "user-1")).rejects.toThrow(
      ErroReprocessamentoNaoPermitido,
    );
    expect(mockGerar).not.toHaveBeenCalled();
  });

  it("embedding falha novamente durante reprocessamento -> marcarFalha chamado", async () => {
    const falho = { ...CANDIDATO_CRIADO, status_embedding: "falhou" };
    mockFindUnique
      .mockResolvedValueOnce(falho as never)
      .mockResolvedValueOnce(falho as never);
    mockGerar.mockResolvedValueOnce(null);

    const result = await reprocessarEmbedding("cand-1", "user-1");

    expect(result).toEqual(falho);
    expect(mockMarcarFalha).toHaveBeenCalledWith("cand-1");
    expect(mockPersistirEmbedding).not.toHaveBeenCalled();
  });
});
