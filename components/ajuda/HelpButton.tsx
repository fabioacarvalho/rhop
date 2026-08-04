"use client";

import { useState } from "react";
import { HelpModal } from "./HelpModal";
import styles from "./ajuda.module.css";

export function HelpButton() {
  const [open, setOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [screenshotBase64, setScreenshotBase64] = useState<string | undefined>();

  const handleOpen = async () => {
    setCapturing(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(document.body, { useCORS: true });
      setScreenshotBase64(canvas.toDataURL("image/png"));
    } catch (e) {
      console.error("Erro ao capturar tela:", e);
    } finally {
      setCapturing(false);
      setOpen(true);
    }
  };

  return (
    <>
      <button
        type="button"
        className={styles.fab}
        title="Ajuda / reportar problema"
        onClick={handleOpen}
        disabled={capturing}
      >
        {capturing ? "..." : "?"}
      </button>

      {open && (
        <HelpModal 
          onClose={() => setOpen(false)} 
          screenshotBase64={screenshotBase64} 
        />
      )}
    </>
  );
}
