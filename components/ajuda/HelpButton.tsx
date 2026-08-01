"use client";

import { useState } from "react";
import { HelpModal } from "./HelpModal";
import styles from "./ajuda.module.css";

export function HelpButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={styles.fab}
        title="Ajuda / reportar problema"
        onClick={() => setOpen(true)}
      >
        ?
      </button>

      {open && <HelpModal onClose={() => setOpen(false)} />}
    </>
  );
}
