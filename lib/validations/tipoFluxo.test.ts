import { describe, expect, it } from "vitest";
import {
  campoFormularioSchema,
  tipoFluxoInputSchema,
  type CampoFormularioDefinicao,
  type TipoFluxoInput,
} from "./tipoFluxo";

const campoTexto: CampoFormularioDefinicao = {
  chave: "cargo_pretendido",
  rotulo: "Cargo pretendido",
  tipo: "texto",
  obrigatorio: true,
};

const campoNumero: CampoFormularioDefinicao = {
  chave: "quantidade_dias",
  rotulo: "Quantidade de dias",
  tipo: "numero",
  obrigatorio: true,
  min: 1,
  max: 30,
};

const campoData: CampoFormularioDefinicao = {
  chave: "data_inicio",
  rotulo: "Data de início",
  tipo: "data",
  obrigatorio: true,
};

const campoSelecao: CampoFormularioDefinicao = {
  chave: "motivo",
  rotulo: "Motivo",
  tipo: "selecao",
  obrigatorio: true,
  opcoes: ["Viagem", "Saúde"],
};

const campoAnexo: CampoFormularioDefinicao = {
  chave: "comprovante",
  rotulo: "Comprovante",
  tipo: "anexo",
  obrigatorio: false,
};

function tipoFluxoValido(
  overrides: Partial<TipoFluxoInput> = {}
): TipoFluxoInput {
  return {
    nome: "Solicitação de Férias",
    campos_formulario: [campoTexto],
    etapas: ["GESTOR", "RH_ADMIN"],
    categoria: "PADRAO",
    ...overrides,
  };
}

describe("campoFormularioSchema", () => {
  it("aceita um campo válido do tipo 'texto'", () => {
    expect(campoFormularioSchema.safeParse(campoTexto).success).toBe(true);
  });

  it("aceita um campo válido do tipo 'anexo'", () => {
    expect(campoFormularioSchema.safeParse(campoAnexo).success).toBe(true);
  });

  it("aceita um campo válido do tipo 'numero'", () => {
    expect(campoFormularioSchema.safeParse(campoNumero).success).toBe(true);
  });

  it("aceita um campo válido do tipo 'data'", () => {
    expect(campoFormularioSchema.safeParse(campoData).success).toBe(true);
  });

  it("aceita um campo válido do tipo 'selecao' com opcoes", () => {
    expect(campoFormularioSchema.safeParse(campoSelecao).success).toBe(true);
  });

  it("rejeita campo tipo 'selecao' sem opcoes", () => {
    const { opcoes: _opcoes, ...semOpcoes } = campoSelecao;
    const resultado = campoFormularioSchema.safeParse(semOpcoes);

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(
        resultado.error.issues.some((issue) => issue.path.includes("opcoes"))
      ).toBe(true);
    }
  });

  it("rejeita campo tipo 'selecao' com opcoes vazio", () => {
    const resultado = campoFormularioSchema.safeParse({
      ...campoSelecao,
      opcoes: [],
    });

    expect(resultado.success).toBe(false);
  });

  it("não rejeita 'min'/'max' presentes em tipos onde são ignorados (ex: 'data')", () => {
    const resultado = campoFormularioSchema.safeParse({
      ...campoData,
      min: 1,
      max: 10,
    });

    expect(resultado.success).toBe(true);
  });
});

describe("tipoFluxoInputSchema", () => {
  it("aceita um payload válido completo", () => {
    const resultado = tipoFluxoInputSchema.safeParse(tipoFluxoValido());
    expect(resultado.success).toBe(true);
  });

  it("rejeita 'nome' vazio", () => {
    const resultado = tipoFluxoInputSchema.safeParse(
      tipoFluxoValido({ nome: "" })
    );
    expect(resultado.success).toBe(false);
  });

  it("rejeita 'nome' só com espaços", () => {
    const resultado = tipoFluxoInputSchema.safeParse(
      tipoFluxoValido({ nome: "   " })
    );
    expect(resultado.success).toBe(false);
  });

  it("rejeita 'etapas' vazio", () => {
    const resultado = tipoFluxoInputSchema.safeParse(
      tipoFluxoValido({ etapas: [] })
    );
    expect(resultado.success).toBe(false);
  });

  it("rejeita 'etapas' com papel fora de {GESTOR, RH_ADMIN} (ex: SOLICITANTE)", () => {
    const resultado = tipoFluxoInputSchema.safeParse(
      tipoFluxoValido({
        etapas: ["SOLICITANTE"] as unknown as TipoFluxoInput["etapas"],
      })
    );
    expect(resultado.success).toBe(false);
  });

  it("rejeita 'etapas' com papel desconhecido/arbitrário", () => {
    const resultado = tipoFluxoInputSchema.safeParse(
      tipoFluxoValido({
        etapas: ["QUALQUER_COISA"] as unknown as TipoFluxoInput["etapas"],
      })
    );
    expect(resultado.success).toBe(false);
  });

  it("rejeita 'campos_formulario' vazio", () => {
    const resultado = tipoFluxoInputSchema.safeParse(
      tipoFluxoValido({ campos_formulario: [] })
    );
    expect(resultado.success).toBe(false);
  });

  it("aceita 'campos_formulario' com um campo válido de cada tipo semântico", () => {
    const resultado = tipoFluxoInputSchema.safeParse(
      tipoFluxoValido({
        campos_formulario: [campoTexto, campoNumero, campoData, campoSelecao, campoAnexo],
      })
    );
    expect(resultado.success).toBe(true);
  });

  it("rejeita quando 'campos_formulario' contém um campo 'selecao' inválido (sem opcoes)", () => {
    const { opcoes: _opcoes, ...selecaoSemOpcoes } = campoSelecao;
    const resultado = tipoFluxoInputSchema.safeParse(
      tipoFluxoValido({
        campos_formulario: [campoTexto, selecaoSemOpcoes as CampoFormularioDefinicao],
      })
    );
    expect(resultado.success).toBe(false);
  });

  it("assume 'categoria' como 'PADRAO' quando omitido", () => {
    const resultado = tipoFluxoInputSchema.safeParse(tipoFluxoValido());
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.categoria).toBe("PADRAO");
    }
  });

  it.each(["PADRAO", "FERIAS", "DAYOFF"] as const)(
    "aceita 'categoria' explícito: %s",
    (categoria) => {
      const resultado = tipoFluxoInputSchema.safeParse(
        tipoFluxoValido({ categoria })
      );
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.categoria).toBe(categoria);
      }
    }
  );

  it("rejeita 'categoria' fora do enum", () => {
    const resultado = tipoFluxoInputSchema.safeParse(
      tipoFluxoValido({
        categoria: "FOLGA" as unknown as TipoFluxoInput["categoria"],
      })
    );
    expect(resultado.success).toBe(false);
  });
});
