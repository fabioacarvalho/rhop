"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import styles from "../banco-de-talentos.module.css";

type Props = {
  candidatoId: string;
};

/**
 * Botão "Reprocessar" da linha `falhou` (TAL-29) — dispara
 * `POST /api/candidatos/[id]/reprocessar`, com estado de carregamento e
 * feedback de erro; sucesso atualiza a linha via `router.refresh()`.
 */
export function ReprocessarButton({ candidatoId }: Props) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reprocessar() {
    setErro(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/candidatos/${candidatoId}/reprocessar`, {
          method: "POST",
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          setErro(body?.error ?? "Nao foi possivel reprocessar agora.");
          return;
        }

        router.refresh();
      } catch {
        setErro("Falha de rede ao reprocessar.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        className={styles.btnReprocessar}
        disabled={pending}
        onClick={reprocessar}
      >
        {pending ? "Reprocessando..." : "Reprocessar"}
      </button>
      {erro ? <span className={styles.reprocessarErro}>{erro}</span> : null}
    </>
  );
}
