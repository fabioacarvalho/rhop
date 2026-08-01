"use client";

import { useState } from "react";
import type { Role } from "@/lib/generated/prisma/enums";
import { HelpModal } from "./HelpModal";
import styles from "./ajuda.module.css";

interface HelpButtonProps {
  papel: Role;
}

export function HelpButton({ papel }: HelpButtonProps) {
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

      {open && <HelpModal papel={papel} onClose={() => setOpen(false)} />}
    </>
  );
}
