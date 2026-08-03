"use client";

import { useEffect, useState } from "react";
import { HelpModal } from "@/components/ajuda/HelpModal";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Boundary de ultima instancia (erro dentro do proprio `app/layout.tsx`).
 * Precisa definir <html>/<body> proprios e usa apenas estilo inline: nao
 * pode depender de nada que possa ter quebrado junto com o layout raiz.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const [reportar, setReportar] = useState(false);

  useEffect(() => {
    fetch("/api/erros/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mensagem: error.message,
        digest: error.digest ?? null,
        rota: window.location.pathname,
      }),
    }).catch(() => {});
  }, [error]);

  const titulo = error.message.trim().slice(0, 80) || "Erro inesperado no sistema";
  const descricao = [
    "Erro capturado automaticamente pelo sistema.",
    "",
    `Mensagem: ${error.message || "(sem mensagem)"}`,
    `Digest: ${error.digest ?? "N/A"}`,
  ].join("\n");

  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            style={{
              maxWidth: 460,
              width: "100%",
              background: "#fff",
              border: "1px solid #dce3f0",
              borderRadius: 10,
              boxShadow: "0 8px 24px -12px rgba(20, 42, 82, 0.18)",
              padding: 28,
              textAlign: "center",
            }}
          >
            <h1 style={{ fontSize: 20, color: "#16233d", marginBottom: 8 }}>
              Algo deu errado
            </h1>
            <p style={{ fontSize: 13.5, color: "#5b6b87", lineHeight: 1.5, marginBottom: 22 }}>
              Ocorreu um erro inesperado no sistema. Você pode tentar
              novamente ou reportar o problema para a equipe.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                type="button"
                onClick={reset}
                style={{
                  border: "none",
                  borderRadius: 8,
                  padding: "11px 18px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: "#e4ecfa",
                  color: "#142a52",
                }}
              >
                Tentar novamente
              </button>
              <button
                type="button"
                onClick={() => setReportar(true)}
                style={{
                  border: "none",
                  borderRadius: 8,
                  padding: "11px 18px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: "#dda02a",
                  color: "#142a52",
                }}
              >
                Reportar este erro no GitHub
              </button>
            </div>
          </div>
        </div>

        {reportar && (
          <HelpModal
            onClose={() => setReportar(false)}
            valoresIniciais={{ tipo: "Bug", titulo, descricao }}
          />
        )}
      </body>
    </html>
  );
}
