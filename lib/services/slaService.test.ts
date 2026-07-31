import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    solicitacao: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/services/logService", () => ({
  registrar: vi.fn(),
}));

vi.mock("@/lib/services/notificacaoService", () => ({
  notificacaoService: { notificarEvento: vi.fn() },
}));

import { prisma } from "@/lib/prisma";
import { registrar } from "@/lib/services/logService";
import { notificacaoService } from "@/lib/services/notificacaoService";
import { Role, StatusSolicitacao } from "@/lib/generated/prisma/client";
import { resolveAprovadores, verificarSla } from "./slaService";

const mockFindMany = vi.mocked(prisma.solicitacao.findMany);
const mockUpdateMany = vi.mocked(prisma.solicitacao.updateMany);
const mockFindUnique = vi.mocked(prisma.solicitacao.findUnique);
const mockUpdate = vi.mocked(prisma.solicitacao.update);
const mockUserFindMany = vi.mocked(prisma.user.findMany);
const mockRegistrar = vi.mocked(registrar);
const mockNotificar = vi.mocked(notificacaoService.notificarEvento);

const NOW = new Date("2026-07-31T12:00:00Z");

function candidata(overrides: Record<string, unknown> = {}) {
  return {
    id: "sol-1",
    tipo_fluxo_id: "tf-1",
    solicitante_id: "user-1",
    dados: {},
    status: StatusSolicitacao.PENDENTE,
    etapa_atual: Role.GESTOR,
    prazo_sla: new Date("2026-07-01T00:00:00Z"),
    atrasada_em: null,
    ultima_cobranca_em: null,
    criado_em: new Date("2026-06-01T00:00:00Z"),
    solicitante: { gestor_id: "gestor-1" },
    ...overrides,
  };
}

beforeEach(() => {
  mockFindMany.mockReset();
  mockUpdateMany.mockReset();
  mockFindUnique.mockReset();
  mockUpdate.mockReset();
  mockUserFindMany.mockReset();
  mockRegistrar.mockReset();
  mockNotificar.mockReset();
  mockRegistrar.mockResolvedValue(undefined);
  mockNotificar.mockResolvedValue(undefined);
  mockUpdate.mockResolvedValue({} as never);
});

describe("resolveAprovadores", () => {
  it("GESTOR com gestor_id retorna o gestor", async () => {
    const ids = await resolveAprovadores({
      etapa_atual: Role.GESTOR,
      solicitante: { gestor_id: "gestor-1" },
    } as never);
    expect(ids).toEqual(["gestor-1"]);
  });

  it("GESTOR sem gestor_id retorna vazio", async () => {
    const ids = await resolveAprovadores({
      etapa_atual: Role.GESTOR,
      solicitante: { gestor_id: null },
    } as never);
    expect(ids).toEqual([]);
  });

  it("RH_ADMIN retorna todos os ids com esse role", async () => {
    mockUserFindMany.mockResolvedValueOnce([
      { id: "rh-1" },
      { id: "rh-2" },
    ] as never);
    const ids = await resolveAprovadores({
      etapa_atual: Role.RH_ADMIN,
      solicitante: { gestor_id: null },
    } as never);
    expect(ids).toEqual(["rh-1", "rh-2"]);
    expect(mockUserFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { role: Role.RH_ADMIN } }),
    );
  });

  it("RH_ADMIN sem nenhum admin retorna vazio", async () => {
    mockUserFindMany.mockResolvedValueOnce([] as never);
    const ids = await resolveAprovadores({
      etapa_atual: Role.RH_ADMIN,
      solicitante: { gestor_id: null },
    } as never);
    expect(ids).toEqual([]);
  });
});

describe("verificarSla", () => {
  it("marca atrasada, grava AUDITORIA e dispara cobranca (GESTOR)", async () => {
    mockFindMany.mockResolvedValueOnce([candidata()] as never);
    mockUpdateMany.mockResolvedValueOnce({ count: 1 } as never);
    mockFindUnique.mockResolvedValueOnce(candidata({ atrasada_em: NOW }) as never);

    const resumo = await verificarSla(NOW);

    expect(resumo).toEqual({
      verificadas: 1,
      marcadas_atrasadas: 1,
      cobrancas_disparadas: 1,
      erros: 0,
    });
    expect(mockRegistrar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "AUDITORIA", acao: "MARCACAO_ATRASO", entidade_id: "sol-1" }),
    );
    expect(mockNotificar).toHaveBeenCalledWith({
      usuario_id: "gestor-1",
      solicitacao_id: "sol-1",
      tipo: "COBRANCA_SLA",
      mensagem: expect.stringContaining("sol-1"),
      link: "/aprovacoes",
    });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "sol-1" },
      data: { ultima_cobranca_em: NOW },
    });
    expect(mockRegistrar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "AUDITORIA", acao: "SLA_CHECK_RESUMO", detalhes: resumo }),
    );
  });

  it("ja atrasada e dentro do throttle: nao repete transicao nem cobra de novo", async () => {
    mockFindMany.mockResolvedValueOnce([
      candidata({ atrasada_em: new Date("2026-07-30T00:00:00Z") }),
    ] as never);
    mockUpdateMany.mockResolvedValueOnce({ count: 0 } as never);
    mockFindUnique.mockResolvedValueOnce(
      candidata({ atrasada_em: new Date("2026-07-30T00:00:00Z"), ultima_cobranca_em: NOW }) as never,
    );

    const resumo = await verificarSla(NOW);

    expect(resumo.marcadas_atrasadas).toBe(0);
    expect(resumo.cobrancas_disparadas).toBe(0);
    expect(mockNotificar).not.toHaveBeenCalled();
    expect(mockRegistrar).not.toHaveBeenCalledWith(
      expect.objectContaining({ acao: "MARCACAO_ATRASO" }),
    );
  });

  it("throttle 24h: ultima_cobranca_em recente impede nova cobranca", async () => {
    mockFindMany.mockResolvedValueOnce([
      candidata({ atrasada_em: new Date("2026-07-31T11:00:00Z") }),
    ] as never);
    mockUpdateMany.mockResolvedValueOnce({ count: 0 } as never);
    mockFindUnique.mockResolvedValueOnce(
      candidata({
        atrasada_em: new Date("2026-07-31T11:00:00Z"),
        ultima_cobranca_em: new Date("2026-07-31T10:00:00Z"),
      }) as never,
    );

    const resumo = await verificarSla(NOW);

    expect(resumo.cobrancas_disparadas).toBe(0);
    expect(mockNotificar).not.toHaveBeenCalled();
  });

  it("falha ao notificar grava Log ERRO e nao reverte marcacao", async () => {
    mockFindMany.mockResolvedValueOnce([candidata()] as never);
    mockUpdateMany.mockResolvedValueOnce({ count: 1 } as never);
    mockFindUnique.mockResolvedValueOnce(candidata({ atrasada_em: NOW }) as never);
    mockNotificar.mockRejectedValueOnce(new Error("indisponivel"));

    const resumo = await verificarSla(NOW);

    expect(resumo.marcadas_atrasadas).toBe(1);
    expect(resumo.cobrancas_disparadas).toBe(0);
    expect(resumo.erros).toBe(1);
    expect(mockRegistrar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "ERRO", acao: "FALHA_COBRANCA_SLA" }),
    );
    expect(mockUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { ultima_cobranca_em: NOW } }),
    );
  });

  it("sem aprovador resolvido: Log ERRO DESTINATARIO_SLA e nao cobra", async () => {
    mockFindMany.mockResolvedValueOnce([
      candidata({ solicitante: { gestor_id: null } }),
    ] as never);
    mockUpdateMany.mockResolvedValueOnce({ count: 1 } as never);
    mockFindUnique.mockResolvedValueOnce(
      candidata({ atrasada_em: NOW, solicitante: { gestor_id: null } }) as never,
    );

    const resumo = await verificarSla(NOW);

    expect(resumo.erros).toBe(1);
    expect(resumo.cobrancas_disparadas).toBe(0);
    expect(mockNotificar).not.toHaveBeenCalled();
    expect(mockRegistrar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "ERRO", acao: "DESTINATARIO_SLA" }),
    );
  });

  it("decidida entre a leitura e o processamento: ignora sem marcar nem cobrar", async () => {
    mockFindMany.mockResolvedValueOnce([candidata()] as never);
    mockUpdateMany.mockResolvedValueOnce({ count: 0 } as never);
    mockFindUnique.mockResolvedValueOnce(
      candidata({ status: StatusSolicitacao.APROVADA }) as never,
    );

    const resumo = await verificarSla(NOW);

    expect(resumo.marcadas_atrasadas).toBe(0);
    expect(resumo.cobrancas_disparadas).toBe(0);
    expect(mockNotificar).not.toHaveBeenCalled();
  });

  it("falha isolada em uma solicitacao nao impede o processamento das demais", async () => {
    mockFindMany.mockResolvedValueOnce([
      candidata({ id: "sol-erro" }),
      candidata({ id: "sol-2" }),
    ] as never);
    mockUpdateMany
      .mockRejectedValueOnce(new Error("db indisponivel"))
      .mockResolvedValueOnce({ count: 1 } as never);
    mockFindUnique.mockResolvedValueOnce(
      candidata({ id: "sol-2", atrasada_em: NOW }) as never,
    );

    const resumo = await verificarSla(NOW);

    expect(resumo.verificadas).toBe(2);
    expect(resumo.marcadas_atrasadas).toBe(1);
    expect(resumo.erros).toBe(1);
    expect(mockRegistrar).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "ERRO",
        acao: "ERRO_PROCESSAMENTO_SLA",
        entidade_id: "sol-erro",
      }),
    );
  });

  it("nenhuma candidata: resumo zerado e apenas o Log de resumo e gravado", async () => {
    mockFindMany.mockResolvedValueOnce([] as never);

    const resumo = await verificarSla(NOW);

    expect(resumo).toEqual({
      verificadas: 0,
      marcadas_atrasadas: 0,
      cobrancas_disparadas: 0,
      erros: 0,
    });
    expect(mockRegistrar).toHaveBeenCalledTimes(1);
    expect(mockRegistrar).toHaveBeenCalledWith(
      expect.objectContaining({ acao: "SLA_CHECK_RESUMO" }),
    );
  });

  it("etapa RH_ADMIN dispara cobranca para todos os admins (fan-out)", async () => {
    mockFindMany.mockResolvedValueOnce([
      candidata({ etapa_atual: Role.RH_ADMIN }),
    ] as never);
    mockUpdateMany.mockResolvedValueOnce({ count: 1 } as never);
    mockFindUnique.mockResolvedValueOnce(
      candidata({ etapa_atual: Role.RH_ADMIN, atrasada_em: NOW }) as never,
    );
    mockUserFindMany.mockResolvedValueOnce([
      { id: "rh-1" },
      { id: "rh-2" },
    ] as never);

    const resumo = await verificarSla(NOW);

    expect(resumo.cobrancas_disparadas).toBe(2);
    expect(mockNotificar).toHaveBeenCalledTimes(2);
    expect(mockNotificar).toHaveBeenCalledWith(
      expect.objectContaining({ usuario_id: "rh-1" }),
    );
    expect(mockNotificar).toHaveBeenCalledWith(
      expect.objectContaining({ usuario_id: "rh-2" }),
    );
  });
});
