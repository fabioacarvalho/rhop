import { describe, expect, it } from "vitest";
import { Role } from "@/lib/generated/prisma/enums";
import { getVisibleGroups, resolveScreenTitle } from "./navConfig";

describe("getVisibleGroups", () => {
  it("SOLICITANTE ve so o grupo Meu trabalho, sem Aprovacoes Pendentes", () => {
    const groups = getVisibleGroups(Role.SOLICITANTE);

    expect(groups.map((g) => g.key)).toEqual(["meu-trabalho"]);
    const itens = groups[0].items.map((i) => i.label);
    expect(itens).toEqual(["Minhas Solicitações", "Minha jornada"]);
  });

  it("GESTOR ve Meu trabalho completo, Visao geral, Recrutamento e Administracao (so Usuarios)", () => {
    const groups = getVisibleGroups(Role.GESTOR);

    expect(groups.map((g) => g.key)).toEqual([
      "meu-trabalho",
      "visao-geral",
      "recrutamento",
      "administracao",
    ]);

    const meuTrabalho = groups.find((g) => g.key === "meu-trabalho")!;
    expect(meuTrabalho.items.map((i) => i.label)).toEqual([
      "Minhas Solicitações",
      "Minha jornada",
      "Aprovações Pendentes",
    ]);

    const administracao = groups.find((g) => g.key === "administracao")!;
    expect(administracao.items.map((i) => i.label)).toEqual(["Usuários"]);
  });

  it("RH_ADMIN ve os 4 grupos, 11 itens no total", () => {
    const groups = getVisibleGroups(Role.RH_ADMIN);

    expect(groups.map((g) => g.key)).toEqual([
      "meu-trabalho",
      "visao-geral",
      "recrutamento",
      "administracao",
    ]);

    const totalItens = groups.reduce((soma, g) => soma + g.items.length, 0);
    expect(totalItens).toBe(11);
  });

  it("grupo sem nenhum item visivel nao aparece no array retornado", () => {
    const groups = getVisibleGroups(Role.SOLICITANTE);

    expect(groups.some((g) => g.key === "visao-geral")).toBe(false);
    expect(groups.some((g) => g.key === "recrutamento")).toBe(false);
    expect(groups.some((g) => g.key === "administracao")).toBe(false);
  });
});

describe("resolveScreenTitle", () => {
  it("casa rota exata de item nao-raiz", () => {
    expect(resolveScreenTitle("/aprovacoes")).toEqual({
      eyebrow: "Meu trabalho",
      titulo: "Aprovações Pendentes",
    });
  });

  it("casa rota raiz exata sem confundir com prefixo", () => {
    expect(resolveScreenTitle("/")).toEqual({
      eyebrow: "Visão geral",
      titulo: "Dashboard",
    });
  });

  it("casa por prefixo mais longo em rota aninhada (fallback)", () => {
    expect(resolveScreenTitle("/solicitacoes/abc123")).toEqual({
      eyebrow: "Meu trabalho",
      titulo: "Minhas Solicitações",
    });
  });

  it("prefere o prefixo mais especifico entre /solicitacoes e /minha-jornada", () => {
    expect(resolveScreenTitle("/minha-jornada")).toEqual({
      eyebrow: "Meu trabalho",
      titulo: "Minha jornada",
    });
  });

  it("rota desconhecida cai no fallback generico, sem lancar erro", () => {
    expect(resolveScreenTitle("/rota-inexistente")).toEqual({
      eyebrow: "OP Conecta",
      titulo: "Tela",
    });
  });
});
