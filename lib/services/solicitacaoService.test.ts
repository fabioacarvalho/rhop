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
      update: vi.fn(),
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

vi.mock("@/lib/services/resumoSolicitanteService", () => ({
  gerarEPersistir: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { registrar } from "@/lib/services/logService";
import * as tipoFluxoService from "@/lib/services/tipoFluxoService";
import { gerarEPersistir } from "@/lib/services/resumoSolicitanteService";
import { Role } from "@/lib/generated/prisma/client";
import {
  ErroAcessoNegado,
  ErroCancelamentoInvalido,
  ErroDadosInvalidos,
  ErroNaoAutorizadoCancelamento,
  ErroNaoEncontrado,
  ErroTipoFluxoNaoEncontrado,
  SLA_HORAS,
  buscarDetalhePorId,
  cancelar,
  criar,
  listarMinhas,
} from "./solicitacaoService";
import type { SolicitacaoInput } from "@/lib/validations/solicitacao";

const mockCreate = vi.mocked(prisma.solicitacao.create);
const mockFindMany = vi.mocked(prisma.solicitacao.findMany);
const mockFindUnique = vi.mocked(prisma.solicitacao.findUnique);
const mockUpdate = vi.mocked(prisma.solicitacao.update);
const mockRegistrar = vi.mocked(registrar);
const mockBuscarPorId = vi.mocked(tipoFluxoService.buscarPorId);
const mockGerarEPersistir = vi.mocked(gerarEPersistir);

beforeEach(() => {
  mockCreate.mockReset();
  mockFindMany.mockReset();
  mockFindUnique.mockReset();
  mockUpdate.mockReset();
  mockRegistrar.mockReset();
  mockBuscarPorId.mockReset();
  mockGerarEPersistir.mockReset();
  mockGerarEPersistir.mockResolvedValue(undefined);
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

  it("dispara gerarEPersistir(solicitacao.id) sem aguardar (fire-and-forget)", async () => {
    mockBuscarPorId.mockResolvedValueOnce(TIPO_FLUXO_REEMBOLSO as never);
    mockCreate.mockResolvedValueOnce(SOLICITACAO_CRIADA as never);

    let resolvePendente: () => void = () => {};
    mockGerarEPersistir.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePendente = resolve;
      }),
    );

    await expect(criar(INPUT_VALIDO, "user-1")).resolves.toEqual(
      SOLICITACAO_CRIADA,
    );
    expect(mockGerarEPersistir).toHaveBeenCalledWith(SOLICITACAO_CRIADA.id);

    resolvePendente();
  });

  it("criar resolve mesmo se gerarEPersistir rejeitar (nao propaga, nao trava)", async () => {
    mockBuscarPorId.mockResolvedValueOnce(TIPO_FLUXO_REEMBOLSO as never);
    mockCreate.mockResolvedValueOnce(SOLICITACAO_CRIADA as never);
    mockGerarEPersistir.mockRejectedValueOnce(new Error("falha inesperada"));

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

describe("solicitacaoService.cancelar", () => {
  const SOLICITANTE = {
    id: "user-1",
    nome: "Solicitante",
    email: "solicitante@example.com",
    role: Role.SOLICITANTE,
  };

  const OUTRO_SOLICITANTE = {
    id: "user-2",
    nome: "Outro Solicitante",
    email: "outro@example.com",
    role: Role.SOLICITANTE,
  };

  const RH_ADMIN = {
    id: "rh-1",
    nome: "RH",
    email: "rh@example.com",
    role: Role.RH_ADMIN,
  };

  const GESTOR = {
    id: "gestor-1",
    nome: "Gestor",
    email: "gestor@example.com",
    role: Role.GESTOR,
  };

  const SOLICITACAO_PENDENTE = {
    ...SOLICITACAO_CRIADA,
    status: "PENDENTE",
    solicitante_id: "user-1",
    etapa_atual: Role.GESTOR,
  };

  it("id inexistente -> lanca ErroNaoEncontrado", async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    await expect(
      cancelar("sol-inexistente", SOLICITANTE),
    ).rejects.toBeInstanceOf(ErroNaoEncontrado);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("solicitante dono + status=PENDENTE -> sucesso, status vira CANCELADA, Log AUDITORIA gravado", async () => {
    mockFindUnique.mockResolvedValueOnce(SOLICITACAO_PENDENTE as never);
    mockUpdate.mockResolvedValueOnce({
      ...SOLICITACAO_PENDENTE,
      status: "CANCELADA",
    } as never);

    const resultado = await cancelar("sol-1", SOLICITANTE);

    expect(resultado.status).toBe("CANCELADA");
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "sol-1" },
      data: { status: "CANCELADA" },
    });
    expect(mockRegistrar).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "AUDITORIA",
        entidade: "Solicitacao",
        entidade_id: "sol-1",
        acao: "CANCELAMENTO",
        usuario_id: "user-1",
      }),
    );
  });

  it("RH_ADMIN + status=PENDENTE de outro solicitante -> sucesso (mesmo efeito)", async () => {
    mockFindUnique.mockResolvedValueOnce(SOLICITACAO_PENDENTE as never);
    mockUpdate.mockResolvedValueOnce({
      ...SOLICITACAO_PENDENTE,
      status: "CANCELADA",
    } as never);

    const resultado = await cancelar("sol-1", RH_ADMIN);

    expect(resultado.status).toBe("CANCELADA");
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "sol-1" },
      data: { status: "CANCELADA" },
    });
    expect(mockRegistrar).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "AUDITORIA",
        entidade: "Solicitacao",
        entidade_id: "sol-1",
        acao: "CANCELAMENTO",
        usuario_id: "rh-1",
      }),
    );
  });

  it("GESTOR (mesmo sendo aprovador da etapa atual) -> ErroNaoAutorizadoCancelamento", async () => {
    mockFindUnique.mockResolvedValueOnce(SOLICITACAO_PENDENTE as never);

    await expect(cancelar("sol-1", GESTOR)).rejects.toBeInstanceOf(
      ErroNaoAutorizadoCancelamento,
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("outro solicitante (nao dono) -> ErroNaoAutorizadoCancelamento", async () => {
    mockFindUnique.mockResolvedValueOnce(SOLICITACAO_PENDENTE as never);

    await expect(
      cancelar("sol-1", OUTRO_SOLICITANTE),
    ).rejects.toBeInstanceOf(ErroNaoAutorizadoCancelamento);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it.each(["APROVADA", "REJEITADA", "CANCELADA"])(
    "status ja %s -> ErroCancelamentoInvalido, sem chamar update",
    async (status) => {
      mockFindUnique.mockResolvedValueOnce({
        ...SOLICITACAO_PENDENTE,
        status,
      } as never);

      await expect(cancelar("sol-1", SOLICITANTE)).rejects.toBeInstanceOf(
        ErroCancelamentoInvalido,
      );
      expect(mockUpdate).not.toHaveBeenCalled();
    },
  );
});
