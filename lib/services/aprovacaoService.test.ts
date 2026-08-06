import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    solicitacao: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    aprovacao: {
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

vi.mock("@/lib/services/logService", () => ({
  registrar: vi.fn(),
}));

vi.mock("@/lib/services/iaService", () => ({
  gerarResumoSolicitacao: vi.fn(),
}));

vi.mock("@/lib/events/solicitacaoEvents", () => ({
  emitirAvancoEtapa: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { registrar } from "@/lib/services/logService";
import { gerarResumoSolicitacao } from "@/lib/services/iaService";
import { emitirAvancoEtapa } from "@/lib/events/solicitacaoEvents";
import {
  DecisaoAprovacao,
  Role,
  StatusSolicitacao,
} from "@/lib/generated/prisma/client";
import type { AuthenticatedUser } from "@/lib/services/authService";
import {
  ErroDecisaoInvalida,
  ErroNaoAutorizadoAprovacao,
  ErroNaoEncontrado,
  decidir,
  listarHistorico,
  listarPendentes,
} from "./aprovacaoService";

const mockFindMany = vi.mocked(prisma.solicitacao.findMany);
const mockFindUnique = vi.mocked(prisma.solicitacao.findUnique);
const mockSolicitacaoUpdate = vi.mocked(prisma.solicitacao.update);
const mockAprovacaoCreate = vi.mocked(prisma.aprovacao.create);
const mockAprovacaoUpdate = vi.mocked(prisma.aprovacao.update);
const mockTransaction = vi.mocked(prisma.$transaction);
const mockRegistrar = vi.mocked(registrar);
const mockGerarResumo = vi.mocked(gerarResumoSolicitacao);
const mockEmitirAvanco = vi.mocked(emitirAvancoEtapa);

const GESTOR: AuthenticatedUser = {
  id: "gestor-1",
  nome: "Marina",
  email: "marina@ex.com",
  role: Role.GESTOR,
};

const GESTOR_OUTRO: AuthenticatedUser = {
  id: "gestor-2",
  nome: "Outro",
  email: "outro@ex.com",
  role: Role.GESTOR,
};

const RH: AuthenticatedUser = {
  id: "rh-1",
  nome: "RH Admin",
  email: "rh@ex.com",
  role: Role.RH_ADMIN,
};

function baseSolicitacao(overrides: Record<string, unknown> = {}) {
  return {
    id: "sol-1",
    tipo_fluxo_id: "tf-1",
    solicitante_id: "user-1",
    dados: { valor: 100 },
    status: StatusSolicitacao.PENDENTE,
    etapa_atual: Role.GESTOR,
    prazo_sla: new Date("2026-08-01T12:00:00Z"),
    criado_em: new Date("2026-07-30T10:00:00Z"),
    tipoFluxo: {
      id: "tf-1",
      nome: "Reembolso",
      etapas: [Role.GESTOR, Role.RH_ADMIN],
    },
    solicitante: {
      id: "user-1",
      nome: "Rafael Lima",
      email: "rafael@ex.com",
      equipe: { gestor_id: "gestor-1" },
    },
    aprovacoes: [],
    ...overrides,
  };
}

beforeEach(() => {
  mockFindMany.mockReset();
  mockFindUnique.mockReset();
  mockSolicitacaoUpdate.mockReset();
  mockAprovacaoCreate.mockReset();
  mockAprovacaoUpdate.mockReset();
  mockTransaction.mockReset();
  mockRegistrar.mockReset();
  mockGerarResumo.mockReset();
  mockEmitirAvanco.mockReset();
  mockTransaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
  mockRegistrar.mockResolvedValue(undefined);
  mockGerarResumo.mockResolvedValue(null);
  mockEmitirAvanco.mockResolvedValue(undefined);
});

describe("listarPendentes", () => {
  it("GESTOR ve apenas equipe na etapa GESTOR e gera resumo", async () => {
    const sol = baseSolicitacao();
    mockFindMany.mockResolvedValue([sol] as never);
    mockAprovacaoCreate.mockResolvedValue({
      id: "apr-1",
      solicitacao_id: "sol-1",
      etapa: 1,
      aprovador_role: Role.GESTOR,
      aprovador_id: null,
      decisao: null,
      comentario: null,
      resumo_ia: null,
      decidido_em: null,
    } as never);
    mockGerarResumo.mockResolvedValue("Resumo IA de teste");
    mockAprovacaoUpdate.mockResolvedValue({} as never);

    const cards = await listarPendentes(GESTOR);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: StatusSolicitacao.PENDENTE,
          etapa_atual: Role.GESTOR,
          solicitante: { equipe: { gestor_id: GESTOR.id } },
        },
      }),
    );
    expect(cards).toHaveLength(1);
    expect(cards[0].resumo_ia).toBe("Resumo IA de teste");
    expect(cards[0].solicitante_nome).toBe("Rafael Lima");
  });

  it("RH_ADMIN filtra por etapa RH_ADMIN", async () => {
    mockFindMany.mockResolvedValue([] as never);
    await listarPendentes(RH);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: StatusSolicitacao.PENDENTE,
          etapa_atual: Role.RH_ADMIN,
        },
      }),
    );
  });

  it("falha de IA deixa resumo_ia null no card", async () => {
    const sol = baseSolicitacao({
      aprovacoes: [
        {
          id: "apr-1",
          solicitacao_id: "sol-1",
          etapa: 1,
          aprovador_role: Role.GESTOR,
          aprovador_id: null,
          decisao: null,
          comentario: null,
          resumo_ia: null,
          decidido_em: null,
        },
      ],
    });
    mockFindMany.mockResolvedValue([sol] as never);
    mockGerarResumo.mockResolvedValue(null);

    const cards = await listarPendentes(GESTOR);
    expect(cards[0].resumo_ia).toBeNull();
  });
});

describe("decidir", () => {
  it("bloqueia gestor de outra equipe", async () => {
    mockFindUnique.mockResolvedValue(baseSolicitacao() as never);
    await expect(
      decidir("sol-1", GESTOR_OUTRO, { decisao: "APROVADA" }),
    ).rejects.toBeInstanceOf(ErroNaoAutorizadoAprovacao);
    expect(mockAprovacaoUpdate).not.toHaveBeenCalled();
  });

  it("bloqueia RH em etapa GESTOR", async () => {
    mockFindUnique.mockResolvedValue(baseSolicitacao() as never);
    await expect(
      decidir("sol-1", RH, { decisao: "APROVADA" }),
    ).rejects.toBeInstanceOf(ErroNaoAutorizadoAprovacao);
  });

  it("bloqueia quando solicitante nao tem equipe", async () => {
    mockFindUnique.mockResolvedValue(
      baseSolicitacao({
        solicitante: {
          id: "user-1",
          nome: "Rafael",
          email: "r@ex.com",
          equipe: null,
        },
      }) as never,
    );
    await expect(
      decidir("sol-1", GESTOR, { decisao: "APROVADA" }),
    ).rejects.toBeInstanceOf(ErroNaoAutorizadoAprovacao);
  });

  it("bloqueia solicitacao ja encerrada", async () => {
    mockFindUnique.mockResolvedValue(
      baseSolicitacao({ status: StatusSolicitacao.APROVADA }) as never,
    );
    await expect(
      decidir("sol-1", GESTOR, { decisao: "APROVADA" }),
    ).rejects.toBeInstanceOf(ErroDecisaoInvalida);
  });

  // Nao ha mais um teste de "etapa ja decidida" com `etapa_atual` estagnado
  // (ex: etapa_atual=GESTOR com a Aprovacao da etapa 1 ja APROVADA): esse
  // estado exigia as duas escritas de `decidir` (Aprovacao.decisao e
  // Solicitacao.status/etapa_atual) fora de uma transacao — agora que
  // `decidir` grava as duas atomicamente (`prisma.$transaction`), essa
  // inconsistencia nao pode mais ser produzida por `decidir()`.

  it("numera a proxima etapa pela ultima Aprovacao, nao pelo papel — evita colisao quando GESTOR e substituido por RH_ADMIN", async () => {
    // Fluxo GESTOR -> RH_ADMIN cujo solicitante nao tem Equipe: a etapa 1
    // (planejada GESTOR) foi substituida para RH_ADMIN (`papelEfetivo`), e a
    // etapa 2 (planejada RH_ADMIN) tambem e RH_ADMIN — duas etapas seguidas
    // com o mesmo papel efetivo.
    const sol = baseSolicitacao({
      etapa_atual: Role.RH_ADMIN,
      solicitante: {
        id: "user-1",
        nome: "Rafael Lima",
        email: "rafael@ex.com",
        equipe: null,
      },
      aprovacoes: [
        {
          id: "apr-1",
          solicitacao_id: "sol-1",
          etapa: 1,
          aprovador_role: Role.RH_ADMIN,
          aprovador_id: "rh-1",
          decisao: DecisaoAprovacao.APROVADA,
          comentario: null,
          resumo_ia: "x",
          decidido_em: new Date(),
        },
      ],
    });
    mockFindUnique.mockResolvedValue(sol as never);
    mockAprovacaoUpdate.mockResolvedValue({} as never);
    mockAprovacaoCreate.mockResolvedValue({
      id: "apr-2",
      solicitacao_id: "sol-1",
      etapa: 2,
      aprovador_role: Role.RH_ADMIN,
      aprovador_id: null,
      decisao: null,
      comentario: null,
      resumo_ia: null,
      decidido_em: null,
    } as never);
    mockSolicitacaoUpdate.mockResolvedValue({
      ...sol,
      status: StatusSolicitacao.APROVADA,
    } as never);

    await decidir("sol-1", RH, { decisao: "APROVADA" });

    // A etapa 1 (ja decidida) nunca deveria ser reaberta: a decisao desta
    // chamada precisa ter sido gravada contra uma linha NOVA (etapa 2), nao
    // contra "apr-1".
    expect(mockAprovacaoUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "apr-1" } }),
    );
    expect(mockAprovacaoCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ etapa: 2, aprovador_role: Role.RH_ADMIN }),
      }),
    );
    // Etapa 2 e a ultima planejada (etapas=[GESTOR,RH_ADMIN]) -> encerra.
    expect(mockSolicitacaoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: StatusSolicitacao.APROVADA } }),
    );
  });

  it("aprovar com proxima etapa avanca e emite evento", async () => {
    const sol = baseSolicitacao({
      aprovacoes: [
        {
          id: "apr-1",
          solicitacao_id: "sol-1",
          etapa: 1,
          aprovador_role: Role.GESTOR,
          aprovador_id: null,
          decisao: null,
          comentario: null,
          resumo_ia: "resumo",
          decidido_em: null,
        },
      ],
    });
    mockFindUnique.mockResolvedValue(sol as never);
    mockAprovacaoUpdate.mockResolvedValue({} as never);
    mockSolicitacaoUpdate.mockResolvedValue({
      ...sol,
      etapa_atual: Role.RH_ADMIN,
    } as never);
    mockAprovacaoCreate.mockResolvedValue({
      id: "apr-2",
      solicitacao_id: "sol-1",
      etapa: 2,
      aprovador_role: Role.RH_ADMIN,
      aprovador_id: null,
      decisao: null,
      comentario: null,
      resumo_ia: null,
      decidido_em: null,
    } as never);

    const result = await decidir("sol-1", GESTOR, {
      decisao: "APROVADA",
      comentario: "ok",
    });

    expect(mockAprovacaoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "apr-1" },
        data: expect.objectContaining({
          aprovador_id: GESTOR.id,
          decisao: DecisaoAprovacao.APROVADA,
          comentario: "ok",
        }),
      }),
    );
    expect(mockSolicitacaoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          etapa_atual: Role.RH_ADMIN,
          status: StatusSolicitacao.PENDENTE,
        },
      }),
    );
    expect(mockEmitirAvanco).toHaveBeenCalledWith({
      solicitacao_id: "sol-1",
      etapa_atual: Role.RH_ADMIN,
    });
    expect(mockRegistrar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "AUDITORIA", acao: "APROVACAO" }),
    );
    expect(result.etapa_atual).toBe(Role.RH_ADMIN);
  });

  it("aprovar na ultima etapa marca APROVADA", async () => {
    const sol = baseSolicitacao({
      etapa_atual: Role.RH_ADMIN,
      aprovacoes: [
        {
          id: "apr-2",
          solicitacao_id: "sol-1",
          etapa: 2,
          aprovador_role: Role.RH_ADMIN,
          aprovador_id: null,
          decisao: null,
          comentario: null,
          resumo_ia: null,
          decidido_em: null,
        },
      ],
    });
    mockFindUnique.mockResolvedValue(sol as never);
    mockAprovacaoUpdate.mockResolvedValue({} as never);
    mockSolicitacaoUpdate.mockResolvedValue({
      ...sol,
      status: StatusSolicitacao.APROVADA,
    } as never);

    await decidir("sol-1", RH, { decisao: "APROVADA" });

    expect(mockSolicitacaoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: StatusSolicitacao.APROVADA },
      }),
    );
    expect(mockEmitirAvanco).not.toHaveBeenCalled();
  });

  it("rejeitar marca REJEITADA sem avancar", async () => {
    const sol = baseSolicitacao({
      aprovacoes: [
        {
          id: "apr-1",
          solicitacao_id: "sol-1",
          etapa: 1,
          aprovador_role: Role.GESTOR,
          aprovador_id: null,
          decisao: null,
          comentario: null,
          resumo_ia: null,
          decidido_em: null,
        },
      ],
    });
    mockFindUnique.mockResolvedValue(sol as never);
    mockAprovacaoUpdate.mockResolvedValue({} as never);
    mockSolicitacaoUpdate.mockResolvedValue({
      ...sol,
      status: StatusSolicitacao.REJEITADA,
    } as never);

    await decidir("sol-1", GESTOR, { decisao: "REJEITADA" });

    expect(mockSolicitacaoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: StatusSolicitacao.REJEITADA },
      }),
    );
    expect(mockEmitirAvanco).not.toHaveBeenCalled();
  });

  it("solicitacao inexistente lanca ErroNaoEncontrado", async () => {
    mockFindUnique.mockResolvedValue(null);
    await expect(
      decidir("missing", GESTOR, { decisao: "APROVADA" }),
    ).rejects.toBeInstanceOf(ErroNaoEncontrado);
  });
});

describe("listarHistorico", () => {
  it("RH_ADMIN ve historico ordenado", async () => {
    mockFindUnique.mockResolvedValue({
      id: "sol-1",
      solicitante_id: "user-1",
      solicitante: { id: "user-1", equipe: { gestor_id: "gestor-1" } },
      aprovacoes: [
        { id: "a1", etapa: 1 },
        { id: "a2", etapa: 2 },
      ],
    } as never);

    const hist = await listarHistorico("sol-1", RH);
    expect(hist).toHaveLength(2);
  });

  it("nega visibilidade a gestor de outra equipe", async () => {
    mockFindUnique.mockResolvedValue({
      id: "sol-1",
      solicitante_id: "user-1",
      solicitante: { id: "user-1", equipe: { gestor_id: "gestor-1" } },
      aprovacoes: [],
    } as never);

    await expect(listarHistorico("sol-1", GESTOR_OUTRO)).rejects.toBeInstanceOf(
      ErroNaoAutorizadoAprovacao,
    );
  });
});
