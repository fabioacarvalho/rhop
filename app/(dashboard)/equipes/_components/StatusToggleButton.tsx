"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../equipes.module.css";

interface StatusToggleButtonProps {
  equipeId: string;
  ativo: boolean;
}

/**
 * Alterna `ativo` de uma equipe (EQP-07, EQP-09) — `PATCH
 * /api/equipes/[id]/status`, `router.refresh()` no sucesso para refletir o
 * novo status na listagem.
 *
 * Desativação com membro ativo vinculado retorna 409
 * (`ErroEdicaoBloqueadaEquipe`) — exibido aqui como qualquer outro erro do
 * backend, sem lógica especial para esse status.
 */
export default function StatusToggleButton({
  equipeId,
  ativo,
}: StatusToggleButtonProps) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleClick() {
    setEnviando(true);
    setErro(null);

    try {
      const resposta = await fetch(`/api/equipes/${equipeId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !ativo }),
      });

      if (!resposta.ok) {
        const corpo: { error?: string } = await resposta.json().catch(() => ({}));
        setErro(corpo.error ?? `Falha ao atualizar status (status ${resposta.status}).`);
        setEnviando(false);
        return;
      }

      router.refresh();
    } catch {
      setErro("Não foi possível atualizar o status. Tente novamente.");
      setEnviando(false);
    }
  }

  return (
    <span>
      <button
        type="button"
        onClick={handleClick}
        disabled={enviando}
        className={`${styles.btn} ${styles.btnGhost} ${styles.btnGhostSm} ${
          ativo ? styles.btnDanger : ""
        }`}
      >
        {enviando ? "Aguarde..." : ativo ? "Desativar" : "Reativar"}
      </button>
      {erro && (
        <p role="alert" className={styles.formError}>
          {erro}
        </p>
      )}
    </span>
  );
}
