"use client";

import { useState } from "react";
import { PAPEIS_APROVADOR, type PapelAprovador } from "@/lib/validations/tipoFluxo";

interface EtapasEditorProps {
  value: PapelAprovador[];
  onChange: (proximo: PapelAprovador[]) => void;
}

const RATULO_PAPEL: Record<PapelAprovador, string> = {
  GESTOR: "Gestor",
  RH_ADMIN: "RH Admin",
};

/**
 * Editor da lista ordenada de etapas de aprovação (`TipoFluxo.etapas`,
 * CONF-04) — cada item é o papel aprovador de uma etapa, na ordem em que a
 * aprovação acontece (`etapas[i]` = etapa `i+1`).
 *
 * Componente controlado: `value`/`onChange` sobem o estado para
 * `TipoFluxoForm` (estado compartilhado do formulário, ver `design.md`).
 * Reordenação é só subir/descer (sem drag-and-drop, conforme task T6) e não
 * há restrição de papel repetido — o design não proíbe a mesma role em mais
 * de uma etapa.
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
      <h3 style={{ marginBottom: "0.5rem" }}>Etapas de aprovação</h3>

      {value.length === 0 ? (
        <p style={{ color: "#64748b" }}>Nenhuma etapa adicionada ainda.</p>
      ) : (
        <ol style={{ padding: 0, listStyle: "none", marginBottom: "0.75rem" }}>
          {value.map((papel, indice) => (
            <li
              key={indice}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.4rem 0",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <span style={{ minWidth: "1.5rem" }}>{indice + 1}.</span>
              <span style={{ flex: 1 }}>{RATULO_PAPEL[papel]}</span>
              <button
                type="button"
                onClick={() => mover(indice, -1)}
                disabled={indice === 0}
                aria-label={`Mover etapa ${indice + 1} para cima`}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => mover(indice, 1)}
                disabled={indice === value.length - 1}
                aria-label={`Mover etapa ${indice + 1} para baixo`}
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => remover(indice)}
                aria-label={`Remover etapa ${indice + 1}`}
              >
                Remover
              </button>
            </li>
          ))}
        </ol>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <select
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
        <button type="button" onClick={adicionar}>
          Adicionar etapa
        </button>
      </div>
    </div>
  );
}
