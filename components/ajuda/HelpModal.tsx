"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/generated/prisma/client";
import { resolveScreenTitle } from "@/lib/navigation/navConfig";
import { buildGithubIssueUrl, type TipoRelato } from "@/lib/helpers/githubIssue";
import styles from "./ajuda.module.css";

const TIPOS: TipoRelato[] = ["Bug", "Melhoria", "Dúvida"];

interface HelpModalProps {
  papel: Role;
  onClose: () => void;
}

export function HelpModal({ papel, onClose }: HelpModalProps) {
  const pathname = usePathname();
  const tela = resolveScreenTitle(pathname).titulo;

  const [tipo, setTipo] = useState<TipoRelato>("Bug");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  function handleSubmit() {
    const url = buildGithubIssueUrl({
      repo: process.env.NEXT_PUBLIC_GITHUB_REPO!,
      tipo,
      tela,
      papel,
      titulo,
      descricao,
    });

    const novaAba = window.open(url, "_blank");

    if (!novaAba) {
      setFallbackUrl(url);
      return;
    }

    setTitulo("");
    setDescricao("");
    onClose();
  }

  async function handleCopyFallback() {
    if (!fallbackUrl) return;
    try {
      await navigator.clipboard.writeText(fallbackUrl);
    } catch {
      // Clipboard API indisponível — o link já está visível para copiar manualmente.
    }
  }

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modalCard}>
        <div className={styles.modalHead}>
          <div className={styles.modalHeadBrand}>
            <div className={styles.modalSeal}>OP</div>
            <strong className={styles.modalHeadTitle}>Reportar algo</strong>
          </div>
          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          <p className={styles.intro}>
            Encontrou um problema ou tem uma ideia? Isso abre uma issue no
            GitHub do projeto, já com a tela atual anexada ao relato.
          </p>

          <div className={styles.aviso}>
            Não inclua dados pessoais ou de solicitações específicas.
          </div>

          <div className={styles.field}>
            <label>Tipo</label>
            <div className={styles.tabToggle}>
              {TIPOS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={t === tipo ? styles.tabToggleActive : undefined}
                  onClick={() => setTipo(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label>Título</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Resuma em uma frase"
            />
          </div>

          <div className={styles.field}>
            <label>Descrição</label>
            <textarea
              rows={4}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="O que aconteceu? O que você esperava que acontecesse?"
            />
          </div>

          <div className={styles.cellSub}>
            Tela atual: <strong>{tela}</strong>
          </div>

          <div className={styles.rowBetween}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnGhost}`}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={handleSubmit}
            >
              Abrir issue no GitHub ↗
            </button>
          </div>

          {fallbackUrl && (
            <div className={styles.fallback}>
              <p className={styles.fallbackText}>
                Não foi possível abrir automaticamente (pop-up bloqueado).
                Copie o link abaixo:
              </p>
              <div className={styles.fallbackLinkRow}>
                <span className={styles.fallbackLink}>{fallbackUrl}</span>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnGhost}`}
                  onClick={handleCopyFallback}
                >
                  Copiar link
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
