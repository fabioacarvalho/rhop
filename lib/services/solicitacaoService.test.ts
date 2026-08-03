import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock de `@/lib/prisma`, `@/lib/services/logService` e
// `@/lib/services/tipoFluxoService` — unit test isolado, nunca deve bater no
// banco real (mesmo padrão de `tipoFluxoService.test.ts` / `aprovacaoService.test.ts`).
vi.mock("@/lib/prisma", () => ({
  prisma: {
    solicitacao: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/services/logService", () => ({
  registrar: vi.fn(),
}));

vi.mock("@/lib/services/tipoFluxoService", () => {
  class ErroNaoEncontrado extends Error {
    constructor(message = "Tipo de fluxo nao encontrado.") {
      super(message);
      this.name = "ErroNaoEncontrado";
    }
  }

  return {
    buscarPorId: vi.fn(),
    ErroNaoEncontrado,
  };
});

import { prisma } from "@/lib/prisma";
import { registrar } from "@/lib/services/logService";
import * as tipoFluxoService from "@/lib/services/tipoFluxoService";
import { Role } from "@/lib/generated/prisma/client";
import {
  ErroAcessoNegado,
  ErroDadosInvalidos,
  ErroNaoEncontrado,
  ErroTipoFluxoNaoEncontrado,
  SLA_HORAS,
  buscarDetalhePorId,
  criar,
  listarMinhas,
} from "./solicitacaoService";
import type { SolicitacaoInput } from "@/lib/validations/solicitacao";

const mockCreate = vi.mocked(prisma.solicitacao.create);
const mockFindMany = vi.mocked(prisma.solicitacao.findMany);
const mockFindUnique = vi.mocked(prisma.solicitacao.findUnique);
const mockRegistrar = vi.mocked(registrar);
const mockBuscarPorId = vi.mocked(tipoFluxoService.buscarPorId);

beforeEach(() => {
  mockCreate.mockReset();
  mockFindMany.mockReset();
  mockFindUnique.mockReset();
  mockRegistrar.mockReset();
  mockBuscarPorId.mockReset();
});

const TIPO_FLUXO_REEMBOLSO = {
  id: "tipo-1",
  nome: "Reembolso",
  campos_formulario: [
    {
      chave: "valor",
      rotulo: "Valor",
      tipo: "numero",
      obrigatorio: true,
      min: 1,
      max: 500,
    },
  ],
  etapas: ["GESTOR", "RH_ADMIN"],
  criado_em: new Date("2026-01-01T00:00:00.000Z"),
  atualizado_em: new Date("2026-01-01T00:00:00.000Z"),
};

const INPUT_VALIDO: SolicitacaoInput = {
  tipo_fluxo_id: "tipo-1",
  dados: { valor: 340 },
};

const SOLICITACAO_CRIADA = {
  id: "sol-1",
  tipo_fluxo_id: "tipo-1",
  solicitante_id: "user-1",
  dados: { valor: 340 },
  status: "PENDENTE",
  etapa_atual: Role.GESTOR,
  prazo_sla: new Date("2026-01-03T00:00:00.000Z"),
  atrasada_em: null,
  ultima_cobranca_em: null,
  criado_em: new Date("2026-01-01T00:00:00.000Z"),
};

describe("solicitacaoService.criar", () => {
  it("cria com sucesso: etapa_atual=etapas[0], prazo_sla=now+SLA_HORAS, grava Log AUDITORIA", async () => {
    mockBuscarPorId.mockResolvedValueOnce(TIPO_FLUXO_REEMBOLSO as never);
    mockCreate.mockResolvedValueOnce(SOLICITACAO_CRIADA as never);

    const resultado = await criar(INPUT_VALIDO, "user-1");

    expect(resultado).toEqual(SOLICITACAO_CRIADA);
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo_fluxo_id: "tipo-1",
        solicitante_id: "user-1",
        etapa_atual: Role.GESTOR,
      }),
    });
    expect(mockRegistrar).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "AUDITORIA",
        entidade: "Solicitacao",
        acao: "CRIACAO",
        usuario_id: "user-1",
      }),
    );
  });

  it("define prazo_sla como now + SLA_HORAS horas", async () => {
    mockBuscarPorId.mockResolvedValueOnce(TIPO_FLUXO_REEMBOLSO as never);
    mockCreate.mockResolvedValueOnce(SOLICITACAO_CRIADA as never);

    await criar(INPUT_VALIDO, "user-1");

    const chamada = mockCreate.mock.calls[0][0] as {
      data: { prazo_sla: Date };
    };
    const diffHoras =
      (chamada.data.prazo_sla.getTime() - Date.now()) / (1000 * 60 * 60);

    expect(diffHoras).toBeGreaterThan(SLA_HORAS - 1);
    expect(diffHoras).toBeLessThan(SLA_HORAS + 1);
  });

  it("tipo_fluxo_id inexistente -> lanca ErroTipoFluxoNaoEncontrado e nao persiste", async () => {
    mockBuscarPorId.mockRejectedValueOnce(
      new tipoFluxoService.ErroNaoEncontrado(),
    );

    await expect(criar(INPUT_VALIDO, "user-1")).rejects.toBeInstanceOf(
      ErroTipoFluxoNaoEncontrado,
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("dados invalido contra campos_formulario -> lanca ErroDadosInvalidos e nao persiste", async () => {
    mockBuscarPorId.mockResolvedValueOnce(TIPO_FLUXO_REEMBOLSO as never);

    const erro = await criar(
      { tipo_fluxo_id: "tipo-1", dados: { valor: "abc" } },
      "user-1",
    ).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroDadosInvalidos);
    expect((erro as ErroDadosInvalidos).erros.length).toBeGreaterThan(0);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("falha de logService.registrar (mockada rejeitando) nao impede criar de retornar sucesso", async () => {
    mockBuscarPorId.mockResolvedValueOnce(TIPO_FLUXO_REEMBOLSO as never);
    mockCreate.mockResolvedValueOnce(SOLICITACAO_CRIADA as never);
    mockRegistrar.mockRejectedValueOnce(new Error("log indisponivel"));

    await expect(criar(INPUT_VALIDO, "user-1")).resolves.toEqual(
      SOLICITACAO_CRIADA,
    );
  });
});

describe("solicitacaoService.listarMinhas", () => {
  it("filtra por solicitante_id, orderBy criado_em desc, inclui tipoFluxo.nome", async () => {
    const lista = [
      { ...SOLICITACAO_CRIADA, tipoFluxo: { nome: "Reembolso" } },
    ];
    mockFindMany.mockResolvedValueOnce(lista as never);

    await expect(listarMinhas("user-1")).resolves.toEqual(lista);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { solicitante_id: "user-1" },
      include: { tipoFluxo: { select: { nome: true } } },
      orderBy: { criado_em: "desc" },
    });
  });

  it("retorna lista vazia quando o solicitante nao tem nenhuma Solicitacao", async () => {
    mockFindMany.mockResolvedValueOnce([] as never);

    await expect(listarMinhas("user-sem-solicitacoes")).resolves.toEqual([]);
  });
});

describe("solicitacaoService.buscarDetalhePorId", () => {
  it("retorna o detalhe completo quando e do proprio solicitante", async () => {
    const detalhe = {
      ...SOLICITACAO_CRIADA,
      tipoFluxo: {
        id: "tipo-1",
        nome: "Reembolso",
        campos_formulario: TIPO_FLUXO_REEMBOLSO.campos_formulario,
        etapas: TIPO_FLUXO_REEMBOLSO.etapas,
      },
    };
    mockFindUnique.mockResolvedValueOnce(detalhe as never);

    await expect(buscarDetalhePorId("sol-1", "user-1")).resolves.toEqual(
      detalhe,
    );
  });

  it("id inexistente -> lanca ErroNaoEncontrado", async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    await expect(
      buscarDetalhePorId("sol-inexistente", "user-1"),
    ).rejects.toBeInstanceOf(ErroNaoEncontrado);
  });

  it("de outro solicitante -> lanca ErroAcessoNegado", async () => {
    mockFindUnique.mockResolvedValueOnce({
      ...SOLICITACAO_CRIADA,
      solicitante_id: "outro-user",
      tipoFluxo: {
        id: "tipo-1",
        nome: "Reembolso",
        campos_formulario: [],
        etapas: [],
      },
    } as never);

    await expect(
      buscarDetalhePorId("sol-1", "user-1"),
    ).rejects.toBeInstanceOf(ErroAcessoNegado);
  });
});
