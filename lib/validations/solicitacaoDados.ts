import type { CampoFormularioDefinicao } from "@/lib/validations/tipoFluxo";

/** Um erro de validação de um campo dinâmico específico. */
export interface ErroValidacaoCampo {
  chave: string;
  mensagem: string;
}

export type ResultadoValidacaoDados =
  | { valido: true }
  | { valido: false; erros: ErroValidacaoCampo[] };

function vazio(valor: unknown): boolean {
  return valor === undefined || valor === null || valor === "";
}

/**
 * Valida `dados` (submetido pelo formulário dinâmico) contra a definição
 * `campos_formulario` de um `TipoFluxo` (SOL-06).
 *
 * Itera sobre `campos` (não sobre as chaves de `dados`) — por isso qualquer
 * chave em `dados` sem correspondência em `campos_formulario` nunca é
 * inspecionada e é silenciosamente ignorada, conforme `design.md`.
 */
export function validarDados(
  dados: Record<string, unknown>,
  campos: CampoFormularioDefinicao[],
): ResultadoValidacaoDados {
  const erros: ErroValidacaoCampo[] = [];

  for (const campo of campos) {
    const valor = dados[campo.chave];

    if (vazio(valor)) {
      if (campo.obrigatorio) {
        erros.push({
          chave: campo.chave,
          mensagem: `${campo.rotulo} é obrigatório.`,
        });
      }
      continue;
    }

    switch (campo.tipo) {
      case "numero": {
        const numero =
          typeof valor === "number"
            ? valor
            : typeof valor === "string" && valor.trim() !== ""
              ? Number(valor)
              : NaN;

        if (Number.isNaN(numero)) {
          erros.push({
            chave: campo.chave,
            mensagem: `${campo.rotulo} deve ser um número.`,
          });
          break;
        }
        if (campo.min !== undefined && numero < campo.min) {
          erros.push({
            chave: campo.chave,
            mensagem: `${campo.rotulo} deve ser maior ou igual a ${campo.min}.`,
          });
        }
        if (campo.max !== undefined && numero > campo.max) {
          erros.push({
            chave: campo.chave,
            mensagem: `${campo.rotulo} deve ser menor ou igual a ${campo.max}.`,
          });
        }
        break;
      }

      case "data": {
        const data =
          typeof valor === "string" || valor instanceof Date
            ? new Date(valor)
            : null;

        if (!data || Number.isNaN(data.getTime())) {
          erros.push({
            chave: campo.chave,
            mensagem: `${campo.rotulo} deve ser uma data válida.`,
          });
        }
        break;
      }

      case "selecao": {
        const opcoes = campo.opcoes ?? [];
        if (typeof valor !== "string" || !opcoes.includes(valor)) {
          erros.push({
            chave: campo.chave,
            mensagem: `${campo.rotulo} deve ser uma das opções válidas.`,
          });
        }
        break;
      }

      case "texto": {
        if (typeof valor !== "string") {
          erros.push({
            chave: campo.chave,
            mensagem: `${campo.rotulo} deve ser texto.`,
          });
          break;
        }
        if (campo.min !== undefined && valor.length < campo.min) {
          erros.push({
            chave: campo.chave,
            mensagem: `${campo.rotulo} deve ter ao menos ${campo.min} caractere(s).`,
          });
        }
        if (campo.max !== undefined && valor.length > campo.max) {
          erros.push({
            chave: campo.chave,
            mensagem: `${campo.rotulo} deve ter no máximo ${campo.max} caractere(s).`,
          });
        }
        break;
      }
    }
  }

  return erros.length > 0 ? { valido: false, erros } : { valido: true };
}
