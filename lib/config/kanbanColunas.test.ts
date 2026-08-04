import { describe, expect, it } from "vitest";
import { StatusSolicitacao } from "@/lib/generated/prisma/enums";
import { KANBAN_COLUNAS_PADRAO, colunaPorChave } from "./kanbanColunas";

describe("KANBAN_COLUNAS_PADRAO", () => {
  it("tem 4 colunas na ordem exata: pendente, em_aprovacao, aprovado, cancelado", () => {
    expect(KANBAN_COLUNAS_PADRAO.map((c) => c.chave)).toEqual([
      "pendente",
      "em_aprovacao",
      "aprovado",
      "cancelado",
    ]);
  });

  it("mapeia cada coluna para os status corretos", () => {
    const porChave = Object.fromEntries(
      KANBAN_COLUNAS_PADRAO.map((c) => [c.chave, c.statuses])
    );

    expect(porChave.pendente).toEqual([StatusSolicitacao.PENDENTE]);
    expect(porChave.em_aprovacao).toEqual([]);
    expect(porChave.aprovado).toEqual([StatusSolicitacao.APROVADA]);
    expect(porChave.cancelado).toEqual([
      StatusSolicitacao.REJEITADA,
      StatusSolicitacao.CANCELADA,
    ]);
  });
});

describe("colunaPorChave", () => {
  it("retorna a config quando a chave existe", () => {
    const config = colunaPorChave("cancelado");

    expect(config).toBeDefined();
    expect(config?.label).toBe("Cancelado");
    expect(config?.statuses).toEqual([
      StatusSolicitacao.REJEITADA,
      StatusSolicitacao.CANCELADA,
    ]);
  });

  it("retorna undefined quando a chave nao existe", () => {
    expect(colunaPorChave("inexistente")).toBeUndefined();
  });
});
