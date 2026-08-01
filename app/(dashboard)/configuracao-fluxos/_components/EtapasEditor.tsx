"use client";

import { useState } from "react";
import { PAPEIS_APROVADOR, type PapelAprovador } from "@/lib/validations/tipoFluxo";
import styles from "../configuracao-fluxos.module.css";

interface EtapasEditorProps {
  value: PapelAprovador[];
  onChange: (proximo: PapelAprovador[]) => void;
}

const RATULO_PAPEL: Record<PapelAprovador, string> = {
  GESTOR: "Gestor",
  RH_ADMIN: "RH_Admin",
};

/**
 * Editor da lista ordenada de etapas de aprovação (`TipoFluxo.etapas`,
 * CONF-04) — cada item é o papel aprovador de uma etapa, na ordem em que a
 * aprovação acontece (`etapas[i]` = etapa `i+1`).
 *
 * Componente controlado: `value`/`onChange` sobem o estado para
 * `TipoFluxoForm`. Reordenação é só subir/descer (sem drag-and-drop, conforme
 * task T6) e não há restrição de papel repetido — o design não proíbe a
 * mesma role em mais de uma etapa.
 */
export default function EtapasEditor({ value, onChange }: EtapasEditorProps) {
  const [papelParaAdicionar, setPapelParaAdicionar] = useState<PapelAprovador>(
    PAPEIS_APROVADOR[0]
  );

  function adicionar() {
    onChange([...value, papelParaAdicionar]);
  }

  function remover(indice: number) {
    onChange(value.filter((_, i) => i !== indice));
  }

  function mover(indice: number, direcao: -1 | 1) {
    const destino = indice + direcao;
    if (destino < 0 || destino >= value.length) {
      return;
    }
    const proximo = [...value];
    [proximo[indice], proximo[destino]] = [proximo[destino], proximo[indice]];
    onChange(proximo);
  }

  return (
    <div>
      {value.length === 0 ? (
        <p className={styles.emptyInline}>Nenhuma etapa adicionada ainda.</p>
      ) : (
        <ol style={{ listStyle: "none" }}>
          {value.map((papel, indice) => (
            <li key={indice} className={styles.stepRow}>
              <span className={styles.stepPill}>
                {indice + 1} · {RATULO_PAPEL[papel]}
              </span>
              <span className={styles.stepRowSpacer} />
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => mover(indice, -1)}
                disabled={indice === 0}
                aria-label={`Mover etapa ${indice + 1} para cima`}
              >
                ↑
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => mover(indice, 1)}
                disabled={indice === value.length - 1}
                aria-label={`Mover etapa ${indice + 1} para baixo`}
              >
                ↓
              </button>
              <button
                type="button"
                className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                onClick={() => remover(indice)}
                aria-label={`Remover etapa ${indice + 1}`}
              >
                ×
              </button>
            </li>
          ))}
        </ol>
      )}

      <div className={styles.addRow}>
        <select
          className={styles.select}
          value={papelParaAdicionar}
          onChange={(e) => setPapelParaAdicionar(e.target.value as PapelAprovador)}
          aria-label="Papel da nova etapa"
        >
          {PAPEIS_APROVADOR.map((papel) => (
            <option key={papel} value={papel}>
              {RATULO_PAPEL[papel]}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnGhost}`}
          onClick={adicionar}
        >
          + Adicionar etapa
        </button>
      </div>
    </div>
  );
}
