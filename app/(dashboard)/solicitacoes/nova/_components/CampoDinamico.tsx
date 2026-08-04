"use client";

import type { CampoFormularioDefinicao } from "@/lib/validations/tipoFluxo";
import styles from "../../solicitacoes.module.css";

interface CampoDinamicoProps {
  campo: CampoFormularioDefinicao;
  value: string;
  onChange: (value: string) => void;
  erro?: string;
}

/**
 * Renderiza o input correto por `tipo` semântico de campo (SOL-05):
 * `texto`→text, `numero`→number, `data`→date, `selecao`→select com `opcoes`.
 * `obrigatorio`/`min`/`max` viram atributos HTML nativos — validação real
 * acontece no backend via `solicitacaoDados.validarDados`, isto aqui é só UX.
 *
 * Componente controlado: `value`/`onChange` sobem o estado para o form pai
 * (`NovaSolicitacaoForm`), sempre como `string` (o form envia `dados` como
 * `Record<string, unknown>` só na hora do submit).
 */
export default function CampoDinamico({
  campo,
  value,
  onChange,
  erro,
}: CampoDinamicoProps) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{campo.rotulo}</span>

      {campo.tipo === "selecao" ? (
        <select
          className={styles.select}
          value={value}
          required={campo.obrigatorio}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Selecione...</option>
          {(campo.opcoes ?? []).map((opcao) => (
            <option key={opcao} value={opcao}>
              {opcao}
            </option>
          ))}
        </select>
      ) : campo.tipo === "numero" ? (
        <input
          type="number"
          className={styles.input}
          value={value}
          required={campo.obrigatorio}
          min={campo.min}
          max={campo.max}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : campo.tipo === "data" ? (
        <input
          type="date"
          className={styles.input}
          value={value}
          required={campo.obrigatorio}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : campo.tipo === "anexo" ? (
        <input
          type="url"
          placeholder="https://..."
          className={styles.input}
          value={value}
          required={campo.obrigatorio}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type="text"
          className={styles.input}
          value={value}
          required={campo.obrigatorio}
          minLength={campo.min}
          maxLength={campo.max}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {erro ? <span className={styles.formError}>{erro}</span> : null}
    </label>
  );
}
