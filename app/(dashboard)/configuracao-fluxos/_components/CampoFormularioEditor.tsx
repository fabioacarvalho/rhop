"use client";

import {
  TIPOS_CAMPO,
  type CampoFormularioDefinicao,
  type TipoCampo,
} from "@/lib/validations/tipoFluxo";

interface CampoFormularioEditorProps {
  value: CampoFormularioDefinicao[];
  onChange: (proximo: CampoFormularioDefinicao[]) => void;
}

const RATULO_TIPO: Record<TipoCampo, string> = {
  texto: "Texto",
  numero: "Número",
  data: "Data",
  selecao: "Seleção",
};

function campoVazio(): CampoFormularioDefinicao {
  return { chave: "", rotulo: "", tipo: "texto", obrigatorio: false };
}

/**
 * Editor da lista de campos do formulário dinâmico (`TipoFluxo.campos_formulario`,
 * CONF-03) — cada item é um `CampoFormularioDefinicao` (`design.md`, seção
 * "Data Models"): `chave`/`rotulo`/`tipo`/`obrigatorio` sempre visíveis,
 * `opcoes` só quando `tipo === 'selecao'` e `min`/`max` só quando `tipo` é
 * `texto`/`numero` (nos demais tipos o design diz que são "ignorados" — a
 * escolha de UX aqui é escondê-los, não só desabilitar).
 *
 * Componente controlado: `value`/`onChange` sobem o estado para
 * `TipoFluxoForm`. Validação de verdade (chave/rotulo obrigatórios, opcoes
 * exigido em `selecao`, etc.) acontece no backend via `campoFormularioSchema`
 * — aqui é só a montagem da estrutura.
 */
export default function CampoFormularioEditor({
  value,
  onChange,
}: CampoFormularioEditorProps) {
  function atualizarCampo(
    indice: number,
    patch: Partial<CampoFormularioDefinicao>
  ) {
    const proximo = value.map((campo, i) =>
      i === indice ? { ...campo, ...patch } : campo
    );
    onChange(proximo);
  }

  function mudarTipo(indice: number, tipo: TipoCampo) {
    const campo = value[indice];
    const patch: Partial<CampoFormularioDefinicao> = { tipo };
    if (tipo === "selecao" && !campo.opcoes) {
      patch.opcoes = [];
    }
    atualizarCampo(indice, patch);
  }

  function adicionarCampo() {
    onChange([...value, campoVazio()]);
  }

  function removerCampo(indice: number) {
    onChange(value.filter((_, i) => i !== indice));
  }

  function moverCampo(indice: number, direcao: -1 | 1) {
    const destino = indice + direcao;
    if (destino < 0 || destino >= value.length) {
      return;
    }
    const proximo = [...value];
    [proximo[indice], proximo[destino]] = [proximo[destino], proximo[indice]];
    onChange(proximo);
  }

  function adicionarOpcao(indice: number) {
    const opcoes = value[indice].opcoes ?? [];
    atualizarCampo(indice, { opcoes: [...opcoes, ""] });
  }

  function atualizarOpcao(indice: number, indiceOpcao: number, texto: string) {
    const opcoes = [...(value[indice].opcoes ?? [])];
    opcoes[indiceOpcao] = texto;
    atualizarCampo(indice, { opcoes });
  }

  function removerOpcao(indice: number, indiceOpcao: number) {
    const opcoes = (value[indice].opcoes ?? []).filter(
      (_, i) => i !== indiceOpcao
    );
    atualizarCampo(indice, { opcoes });
  }

  return (
    <div>
      <h3 style={{ marginBottom: "0.5rem" }}>Campos do formulário</h3>

      {value.length === 0 ? (
        <p style={{ color: "#64748b" }}>Nenhum campo adicionado ainda.</p>
      ) : (
        <ul style={{ padding: 0, listStyle: "none", marginBottom: "0.75rem" }}>
          {value.map((campo, indice) => (
            <li
              key={indice}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "4px",
                padding: "0.75rem",
                marginBottom: "0.75rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.5rem",
                }}
              >
                <strong>Campo {indice + 1}</strong>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={() => moverCampo(indice, -1)}
                    disabled={indice === 0}
                    aria-label={`Mover campo ${indice + 1} para cima`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moverCampo(indice, 1)}
                    disabled={indice === value.length - 1}
                    aria-label={`Mover campo ${indice + 1} para baixo`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removerCampo(indice)}
                    aria-label={`Remover campo ${indice + 1}`}
                  >
                    Remover
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                }}
              >
                <label
                  style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
                >
                  Chave
                  <input
                    type="text"
                    value={campo.chave}
                    onChange={(e) =>
                      atualizarCampo(indice, { chave: e.target.value })
                    }
                    placeholder="ex: cargo_pretendido"
                  />
                </label>

                <label
                  style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
                >
                  Rótulo
                  <input
                    type="text"
                    value={campo.rotulo}
                    onChange={(e) =>
                      atualizarCampo(indice, { rotulo: e.target.value })
                    }
                    placeholder="ex: Cargo pretendido"
                  />
                </label>

                <label
                  style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
                >
                  Tipo
                  <select
                    value={campo.tipo}
                    onChange={(e) => mudarTipo(indice, e.target.value as TipoCampo)}
                  >
                    {TIPOS_CAMPO.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {RATULO_TIPO[tipo]}
                      </option>
                    ))}
                  </select>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    alignSelf: "flex-end",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={campo.obrigatorio}
                    onChange={(e) =>
                      atualizarCampo(indice, { obrigatorio: e.target.checked })
                    }
                  />
                  Obrigatório
                </label>

                {(campo.tipo === "texto" || campo.tipo === "numero") && (
                  <>
                    <label
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.25rem",
                      }}
                    >
                      {campo.tipo === "numero" ? "Valor mínimo" : "Tamanho mínimo"}
                      <input
                        type="number"
                        value={campo.min ?? ""}
                        onChange={(e) =>
                          atualizarCampo(indice, {
                            min:
                              e.target.value === ""
                                ? undefined
                                : Number(e.target.value),
                          })
                        }
                      />
                    </label>

                    <label
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.25rem",
                      }}
                    >
                      {campo.tipo === "numero" ? "Valor máximo" : "Tamanho máximo"}
                      <input
                        type="number"
                        value={campo.max ?? ""}
                        onChange={(e) =>
                          atualizarCampo(indice, {
                            max:
                              e.target.value === ""
                                ? undefined
                                : Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  </>
                )}
              </div>

              {campo.tipo === "selecao" && (
                <div style={{ marginTop: "0.5rem" }}>
                  <span>Opções</span>
                  {(campo.opcoes ?? []).map((opcao, indiceOpcao) => (
                    <div
                      key={indiceOpcao}
                      style={{
                        display: "flex",
                        gap: "0.5rem",
                        marginTop: "0.25rem",
                      }}
                    >
                      <input
                        type="text"
                        value={opcao}
                        onChange={(e) =>
                          atualizarOpcao(indice, indiceOpcao, e.target.value)
                        }
                        placeholder={`Opção ${indiceOpcao + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => removerOpcao(indice, indiceOpcao)}
                        aria-label={`Remover opção ${indiceOpcao + 1} do campo ${
                          indice + 1
                        }`}
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => adicionarOpcao(indice)}
                    style={{ marginTop: "0.5rem" }}
                  >
                    Adicionar opção
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <button type="button" onClick={adicionarCampo}>
        Adicionar campo
      </button>
    </div>
  );
}
