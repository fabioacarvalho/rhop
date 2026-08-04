"use client";

import { useState } from "react";
import type { CampoFormularioDefinicao } from "@/lib/validations/tipoFluxo";
import { createBrowserClient } from "@/lib/supabase/client";
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
  const [isUploading, setIsUploading] = useState(false);
  const supabase = createBrowserClient();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("anexos")
      .upload(fileName, file);

    if (uploadError) {
      alert(`Erro no upload: ${uploadError.message}`);
      setIsUploading(false);
      return;
    }

    const { data } = supabase.storage.from("anexos").getPublicUrl(fileName);
    onChange(data.publicUrl);
    setIsUploading(false);
  };

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
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {value ? (
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <a href={value} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-fg-accent)" }}>
                Ver arquivo atual
              </a>
              <button type="button" onClick={() => onChange("")} style={{ fontSize: "0.875rem", color: "var(--color-danger-fg)" }}>
                Remover
              </button>
            </div>
          ) : (
            <>
              <input
                type="file"
                className={styles.input}
                required={campo.obrigatorio}
                onChange={handleFileUpload}
                disabled={isUploading}
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              />
              {isUploading && <span style={{ fontSize: "0.875rem", color: "var(--color-fg-muted)" }}>Enviando arquivo...</span>}
            </>
          )}
        </div>
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
