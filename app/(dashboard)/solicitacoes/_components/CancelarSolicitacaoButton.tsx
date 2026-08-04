"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../solicitacoes.module.css";

interface CancelarSolicitacaoButtonProps {
  id: string;
}

/**
 * Ação de cancelamento de uma `Solicitacao` própria (PIPE-13) — `POST
 * /api/solicitacoes/[id]/cancelar` com confirmação simples, `router.refresh()`
 * no sucesso para que a página pai (Server Component) busque `listarMinhas`
 * de novo e reflita o novo status `CANCELADA`.
 */
export default function CancelarSolicitacaoButton({
  id,
}: CancelarSolicitacaoButtonProps) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleClick() {
    const confirmado = window.confirm(
      "Tem certeza que deseja cancelar esta solicitação?",
    );
    if (!confirmado) {
      return;
    }

    setCarregando(true);
    setErro(null);

    try {
      const resposta = await fetch(`/api/solicitacoes/${id}/cancelar`, {
        method: "POST",
      });

      if (!resposta.ok) {
        const corpo: { error?: string } = await resposta
          .json()
          .catch(() => ({}));
        setErro(
          corpo.error ?? `Não foi possível cancelar (status ${resposta.status}).`,
        );
        setCarregando(false);
        return;
      }

      router.refresh();
    } catch {
      setErro("Falha de rede ao cancelar a solicitação.");
      setCarregando(false);
    }
  }

  return (
    <span>
      <button
        type="button"
        onClick={handleClick}
        disabled={carregando}
        className={`${styles.btn} ${styles.btnGhost}`}
      >
        {carregando ? "Cancelando..." : "Cancelar"}
      </button>
      {erro ? <p className={styles.formError}>{erro}</p> : null}
    </span>
  );
}
