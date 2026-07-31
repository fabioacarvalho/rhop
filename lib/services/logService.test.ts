import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock de `@/lib/prisma` — unit test isolado, nunca deve bater no banco real
// (o caminho contra Supabase real já foi validado manualmente em outra task).
vi.mock("@/lib/prisma", () => ({
  prisma: {
    log: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { registrar, type LogEvento } from "./logService";

const mockCreate = vi.mocked(prisma.log.create);

beforeEach(() => {
  mockCreate.mockReset();
});

describe("logService.registrar", () => {
  it("persiste um evento tipo AUDITORIA corretamente", async () => {
    mockCreate.mockResolvedValueOnce({} as never);

    const evento: LogEvento = {
      tipo: "AUDITORIA",
      entidade: "Solicitacao",
      entidade_id: "sol-1",
      acao: "CRIACAO",
      usuario_id: "user-1",
    };

    await registrar(evento);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        tipo: "AUDITORIA",
        entidade: "Solicitacao",
        entidade_id: "sol-1",
        acao: "CRIACAO",
        usuario_id: "user-1",
        detalhes: undefined,
      },
    });
  });

  it("persiste um evento tipo ERRO corretamente", async () => {
    mockCreate.mockResolvedValueOnce({} as never);

    const evento: LogEvento = {
      tipo: "ERRO",
      entidade: "IA",
      entidade_id: "sol-2",
      acao: "FALHA_IA",
      usuario_id: "user-2",
      detalhes: { motivo: "timeout" },
    };

    await registrar(evento);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        tipo: "ERRO",
        entidade: "IA",
        entidade_id: "sol-2",
        acao: "FALHA_IA",
        usuario_id: "user-2",
        detalhes: { motivo: "timeout" },
      },
    });
  });

  it("nao envia criado_em para o create — preenchimento e responsabilidade do @default(now()) do schema", async () => {
    mockCreate.mockResolvedValueOnce({} as never);

    await registrar({
      tipo: "AUDITORIA",
      entidade: "Solicitacao",
      entidade_id: "sol-3",
      acao: "APROVACAO",
      usuario_id: "user-3",
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const dataArg = mockCreate.mock.calls[0][0].data;
    expect(dataArg).not.toHaveProperty("criado_em");
  });

  it("aceita usuario_id nulo sem lancar erro", async () => {
    mockCreate.mockResolvedValueOnce({} as never);

    const evento: LogEvento = {
      tipo: "AUDITORIA",
      entidade: "Solicitacao",
      entidade_id: "sol-4",
      acao: "CRIACAO",
      usuario_id: null,
    };

    await expect(registrar(evento)).resolves.toBeUndefined();
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        tipo: "AUDITORIA",
        entidade: "Solicitacao",
        entidade_id: "sol-4",
        acao: "CRIACAO",
        usuario_id: null,
        detalhes: undefined,
      },
    });
  });

  it("contem falha do Prisma ao gravar — nao propaga exceção ao chamador", async () => {
    mockCreate.mockRejectedValueOnce(new Error("conexao com o banco falhou"));

    const evento: LogEvento = {
      tipo: "ERRO",
      entidade: "Solicitacao",
      entidade_id: "sol-5",
      acao: "FALHA_IA",
      usuario_id: null,
    };

    await expect(registrar(evento)).resolves.toBeUndefined();
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  // Bônus (AUD-04): não conta para os 5 oficiais, mas cobre comportamento já
  // existente em `registrar` que não deve perder cobertura.
  it("[bonus] tipo invalido lanca erro sincrono e prisma.log.create nunca e chamado", async () => {
    const eventoInvalido = {
      tipo: "INVALIDO",
      entidade: "Solicitacao",
      entidade_id: "sol-6",
      acao: "CRIACAO",
    } as unknown as LogEvento;

    await expect(registrar(eventoInvalido)).rejects.toThrow(
      /tipo invalido/i
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
