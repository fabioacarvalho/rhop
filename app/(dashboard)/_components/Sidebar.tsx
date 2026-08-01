"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Role } from "@/lib/generated/prisma/enums";
import { getVisibleGroups } from "@/lib/navigation/navConfig";
import { logout } from "@/lib/actions/logout";
import styles from "./Sidebar.module.css";

function itemEstaAtivo(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface SidebarProps {
  role: Role;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const grupos = getVisibleGroups(role);

  const [colapsados, setColapsados] = useState<Record<string, boolean>>({});
  const [mobileAberta, setMobileAberta] = useState(false);

  const alternarGrupo = (key: string) => {
    setColapsados((atual) => ({ ...atual, [key]: !atual[key] }));
  };

  return (
    <>
      <button
        type="button"
        className={styles.mobileToggle}
        onClick={() => setMobileAberta(true)}
        aria-label="Abrir menu de navegação"
      >
        ☰
      </button>

      {mobileAberta && (
        <div
          className={styles.backdrop}
          onClick={() => setMobileAberta(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`${styles.sidebar} ${mobileAberta ? styles.sidebarOpen : ""}`}
      >
        <div className={styles.brand}>
          <div className={styles.seal}>OP</div>
          <div className={styles.brandWord}>OP Conecta</div>
        </div>

        <nav className={styles.nav}>
          {grupos.map((grupo) => {
            const colapsado = Boolean(colapsados[grupo.key]);

            return (
              <div key={grupo.key} className={styles.navGroup}>
                <div
                  className={styles.navGroupLabel}
                  onClick={() => alternarGrupo(grupo.key)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      alternarGrupo(grupo.key);
                    }
                  }}
                >
                  <span>{grupo.label}</span>
                  <span
                    className={styles.chevron}
                    style={
                      colapsado ? { transform: "rotate(-90deg)" } : undefined
                    }
                  >
                    ▾
                  </span>
                </div>

                {!colapsado && (
                  <div className={styles.navGroupItems}>
                    {grupo.items.map((item) => {
                      const ativo = itemEstaAtivo(pathname, item.href);

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`${styles.navItem} ${ativo ? styles.navItemActive : ""}`}
                          onClick={() => setMobileAberta(false)}
                        >
                          <span className={styles.dot} />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className={styles.footer}>
          <form action={logout}>
            <button type="submit" className={styles.logoutLink}>
              ← Sair
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
