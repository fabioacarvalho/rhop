import { describe, expect, it } from "vitest";
import { validarDados } from "./solicitacaoDados";
import type { CampoFormularioDefinicao } from "@/lib/validations/tipoFluxo";

const campoValorNumero: CampoFormularioDefinicao = {
  chave: "valor",
  rotulo: "Valor",
  tipo: "numero",
  obrigatorio: true,
  min: 1,
  max: 500,
};

const campoDataDespesa: CampoFormularioDefinicao = {
  chave: "data_despesa",
  rotulo: "Data da despesa",
  tipo: "data",
  obrigatorio: true,
};

const campoDescricao: CampoFormularioDefinicao = {
  chave: "descricao",
  rotulo: "Descrição",
  tipo: "texto",
  obrigatorio: true,
  min: 5,
  max: 200,
};

const campoMotivo: CampoFormularioDefinicao = {
  chave: "motivo",
  rotulo: "Motivo",
  tipo: "selecao",
  obrigatorio: true,
  opcoes: ["Viagem", "Saúde"],
};

const campoObservacao: CampoFormularioDefinicao = {
  chave: "observacao",
  rotulo: "Observação",
  tipo: "texto",
  obrigatorio: false,
};

const camposCompletos = [
  campoValorNumero,
  campoDataDespesa,
  campoDescricao,
  campoMotivo,
];

describe("validarDados", () => {
  it("caminho feliz: todos os campos válidos", () => {
    const resultado = validarDados(
      {
        valor: 340,
        data_despesa: "2026-07-28",
        descricao: "Transporte em visita a cliente",
        motivo: "Viagem",
      },
      camposCompletos,
    );

    expect(resultado.valido).toBe(true);
  });

  it("campo obrigatório ausente gera erro", () => {
    const resultado = validarDados(
      {
        data_despesa: "2026-07-28",
        descricao: "Transporte em visita a cliente",
        motivo: "Viagem",
      },
      camposCompletos,
    );

    expect(resultado.valido).toBe(false);
    if (!resultado.valido) {
      expect(resultado.erros.some((e) => e.chave === "valor")).toBe(true);
    }
  });

  it("campo obrigatório vazio (string vazia) gera erro", () => {
    const resultado = validarDados(
      { ...baseValida(), descricao: "" },
      camposCompletos,
    );

    expect(resultado.valido).toBe(false);
    if (!resultado.valido) {
      expect(resultado.erros.some((e) => e.chave === "descricao")).toBe(true);
    }
  });

  it("tipo 'numero': valor não numérico gera erro", () => {
    const resultado = validarDados(
      { ...baseValida(), valor: "abc" },
      camposCompletos,
    );

    expect(resultado.valido).toBe(false);
    if (!resultado.valido) {
      expect(resultado.erros.some((e) => e.chave === "valor")).toBe(true);
    }
  });

  it("tipo 'numero': valor fora de min/max gera erro", () => {
    const resultado = validarDados(
      { ...baseValida(), valor: 999 },
      camposCompletos,
    );

    expect(resultado.valido).toBe(false);
    if (!resultado.valido) {
      expect(resultado.erros.some((e) => e.chave === "valor")).toBe(true);
    }
  });

  it("tipo 'data': valor não parseável gera erro", () => {
    const resultado = validarDados(
      { ...baseValida(), data_despesa: "não é data" },
      camposCompletos,
    );

    expect(resultado.valido).toBe(false);
    if (!resultado.valido) {
      expect(resultado.erros.some((e) => e.chave === "data_despesa")).toBe(true);
    }
  });

  it("tipo 'selecao': valor fora de opcoes gera erro", () => {
    const resultado = validarDados(
      { ...baseValida(), motivo: "Outro" },
      camposCompletos,
    );

    expect(resultado.valido).toBe(false);
    if (!resultado.valido) {
      expect(resultado.erros.some((e) => e.chave === "motivo")).toBe(true);
    }
  });

  it("tipo 'texto': fora do tamanho mínimo gera erro", () => {
    const resultado = validarDados(
      { ...baseValida(), descricao: "abc" },
      camposCompletos,
    );

    expect(resultado.valido).toBe(false);
    if (!resultado.valido) {
      expect(resultado.erros.some((e) => e.chave === "descricao")).toBe(true);
    }
  });

  it("tipo 'texto': fora do tamanho máximo gera erro", () => {
    const resultado = validarDados(
      { ...baseValida(), descricao: "a".repeat(300) },
      camposCompletos,
    );

    expect(resultado.valido).toBe(false);
    if (!resultado.valido) {
      expect(resultado.erros.some((e) => e.chave === "descricao")).toBe(true);
    }
  });

  it("chave em 'dados' sem correspondência em 'campos_formulario' é ignorada", () => {
    const resultado = validarDados(
      { ...baseValida(), chave_desconhecida: "qualquer coisa" },
      camposCompletos,
    );

    expect(resultado.valido).toBe(true);
  });

  it("campo opcional ausente não gera erro", () => {
    const resultado = validarDados(baseValida(), [
      ...camposCompletos,
      campoObservacao,
    ]);

    expect(resultado.valido).toBe(true);
  });
});

function baseValida(): Record<string, unknown> {
  return {
    valor: 340,
    data_despesa: "2026-07-28",
    descricao: "Transporte em visita a cliente",
    motivo: "Viagem",
  };
}
