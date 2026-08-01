"use client";

import { usePathname } from "next/navigation";
import { resolveScreenTitle } from "@/lib/navigation/navConfig";
import { NotificationBell } from "./NotificationBell";
import styles from "./Topbar.module.css";

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

interface TopbarProps {
  nome: string;
  papelLabel: string;
}

export function Topbar({ nome, papelLabel }: TopbarProps) {
  const pathname = usePathname();
  const { eyebrow, titulo } = resolveScreenTitle(pathname);

  return (
    <header className={styles.topbar}>
      <div>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h2 className={styles.title}>{titulo}</h2>
      </div>

      <div className={styles.actions}>
        <NotificationBell />

        <div className={styles.userChip}>
          <div className={styles.userInfo}>
            <div className={styles.name} title={nome}>
              {nome}
            </div>
            <div className={styles.role}>{papelLabel}</div>
          </div>
          <div className={styles.avatar}>{iniciais(nome)}</div>
        </div>
      </div>
    </header>
  );
}
