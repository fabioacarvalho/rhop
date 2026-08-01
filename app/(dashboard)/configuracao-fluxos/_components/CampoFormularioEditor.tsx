"use client";

import {
  TIPOS_CAMPO,
  type CampoFormularioDefinicao,
  type TipoCampo,
} from "@/lib/validations/tipoFluxo";
import styles from "../configuracao-fluxos.module.css";

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
      {value.length === 0 ? (
        <p className={styles.emptyInline}>Nenhum campo adicionado ainda.</p>
      ) : (
        <div>
          {value.map((campo, indice) => (
            <div key={indice} className={styles.fieldCard}>
              <div className={styles.fieldCardHead}>
                <span className={styles.fieldCardTitle}>Campo {indice + 1}</span>
                <div className={styles.fieldCardActions}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => moverCampo(indice, -1)}
                    disabled={indice === 0}
                    aria-label={`Mover campo ${indice + 1} para cima`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => moverCampo(indice, 1)}
                    disabled={indice === value.length - 1}
                    aria-label={`Mover campo ${indice + 1} para baixo`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                    onClick={() => removerCampo(indice)}
                    aria-label={`Remover campo ${indice + 1}`}
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className={styles.fieldGrid}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Chave</span>
                  <input
                    type="text"
                    className={styles.input}
                    value={campo.chave}
                    onChange={(e) =>
                      atualizarCampo(indice, { chave: e.target.value })
                    }
                    placeholder="ex: cargo_pretendido"
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Rótulo</span>
                  <input
                    type="text"
                    className={styles.input}
                    value={campo.rotulo}
                    onChange={(e) =>
                      atualizarCampo(indice, { rotulo: e.target.value })
                    }
                    placeholder="ex: Cargo pretendido"
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Tipo</span>
                  <select
                    className={styles.select}
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

                <label className={styles.checkboxField}>
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
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>
                        {campo.tipo === "numero" ? "Valor mínimo" : "Tamanho mínimo"}
                      </span>
                      <input
                        type="number"
                        className={styles.input}
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

                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>
                        {campo.tipo === "numero" ? "Valor máximo" : "Tamanho máximo"}
                      </span>
                      <input
                        type="number"
                        className={styles.input}
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
                <div className={styles.opcoesBox}>
                  <span className={styles.opcoesLabel}>Opções</span>
                  {(campo.opcoes ?? []).map((opcao, indiceOpcao) => (
                    <div key={indiceOpcao} className={styles.opcaoRow}>
                      <input
                        type="text"
                        className={styles.input}
                        value={opcao}
                        onChange={(e) =>
                          atualizarOpcao(indice, indiceOpcao, e.target.value)
                        }
                        placeholder={`Opção ${indiceOpcao + 1}`}
                      />
                      <button
                        type="button"
                        className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                        onClick={() => removerOpcao(indice, indiceOpcao)}
                        aria-label={`Remover opção ${indiceOpcao + 1} do campo ${
                          indice + 1
                        }`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnGhost}`}
                    style={{ marginTop: "10px" }}
                    onClick={() => adicionarOpcao(indice)}
                  >
                    + Adicionar opção
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        className={`${styles.btn} ${styles.btnGhost}`}
        onClick={adicionarCampo}
      >
        + Adicionar campo
      </button>
    </div>
  );
}
