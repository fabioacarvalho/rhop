"use client";

import { useState } from "react";
import { ChatIAPanel } from "./ChatIAPanel";
import styles from "./chat.module.css";

export function ChatIAFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={styles.fab}
        title="Falar com a IA"
        onClick={() => setOpen(!open)}
      >
        ✦
      </button>

      {open && <ChatIAPanel onClose={() => setOpen(false)} />}
    </>
  );
}
