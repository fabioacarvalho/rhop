"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { HelpModal } from "@/components/ajuda/HelpModal";
import styles from "./error.module.css";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const pathname = usePathname();
  const [reportar, setReportar] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [screenshotBase64, setScreenshotBase64] = useState<string | undefined>();

  useEffect(() => {
    fetch("/api/erros/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mensagem: error.message,
        digest: error.digest ?? null,
        rota: pathname,
      }),
    }).catch(() => {});
  }, [error, pathname]);

  const handleReportar = async () => {
    setCapturing(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(document.body, { useCORS: true });
      setScreenshotBase64(canvas.toDataURL("image/png"));
    } catch (e) {
      console.error("Erro ao capturar tela:", e);
    } finally {
      setCapturing(false);
      setReportar(true);
    }
  };

  const titulo = error.message.trim().slice(0, 80) || "Erro inesperado no sistema";
  const descricao = [
    "Erro capturado automaticamente pelo sistema.",
    "",
    `Mensagem: ${error.message || "(sem mensagem)"}`,
    `Digest: ${error.digest ?? "N/A"}`,
  ].join("\n");

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.titulo}>Algo deu errado</h1>
        <p className={styles.texto}>
          Ocorreu um erro inesperado nesta tela. Você pode tentar novamente ou
          reportar o problema para a equipe.
        </p>
        <div className={styles.acoes}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={reset}
          >
            Tentar novamente
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleReportar}
            disabled={capturing}
          >
            {capturing ? "Capturando tela..." : "Reportar este erro no GitHub"}
          </button>
        </div>
      </div>

      {reportar && (
        <HelpModal
          onClose={() => setReportar(false)}
          valoresIniciais={{ tipo: "Bug", titulo, descricao }}
          screenshotBase64={screenshotBase64}
        />
      )}
    </div>
  );
}
