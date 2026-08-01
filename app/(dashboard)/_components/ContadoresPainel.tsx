"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import styles from "../dashboard.module.css";
import type { ContadoresDashboard } from "@/lib/services/dashboardService";

type StatusFiltro = "PENDENTE" | "ATRASADO" | "APROVADA" | "REJEITADA";

const TILES: {
  chave: keyof ContadoresDashboard;
  label: string;
  status: StatusFiltro;
  accent?: boolean;
  cor?: string;
}[] = [
  { chave: "pendentes", label: "Pendentes", status: "PENDENTE" },
  {
    chave: "atrasados",
    label: "Atrasadas",
    status: "ATRASADO",
    accent: true,
    cor: "var(--laranja)",
  },
  {
    chave: "aprovados",
    label: "Aprovadas",
    status: "APROVADA",
    cor: "var(--verde)",
  },
  {
    chave: "rejeitados",
    label: "Rejeitadas",
    status: "REJEITADA",
    cor: "var(--vermelho)",
  },
];

/**
 * Painel de contadores (DASH-01, DASH-10) — busca `GET /api/dashboard/contadores`
 * uma única vez no mount, sem depender de `searchParams`: os contadores
 * sempre refletem o escopo de visibilidade completo do usuário, independente
 * dos filtros aplicados à lista (design.md, seção 0, Q#2). Clicar em um card
 * apenas escreve `status` na URL (atalho de filtro, DASH-10) — nunca refaz o
 * próprio fetch dos contadores.
 */
export default function ContadoresPainel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [contadores, setContadores] = useState<ContadoresDashboard | null>(
    null,
  );
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function buscar() {
      setErro(null);
      try {
        const resposta = await fetch("/api/dashboard/contadores");
        if (!resposta.ok) {
          throw new Error(
            `Falha ao carregar contadores (status ${resposta.status}).`,
          );
        }
        const dados: ContadoresDashboard = await resposta.json();
        if (!cancelado) {
          setContadores(dados);
        }
      } catch {
        if (!cancelado) {
          setErro("Não foi possível carregar os contadores.");
        }
      }
    }

    buscar();

    return () => {
      cancelado = true;
    };
  }, []);

  function filtrarPorStatus(status: StatusFiltro) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("status", status);
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  if (erro) {
    return <p className={styles.erro} role="alert">{erro}</p>;
  }

  return (
    <div className={styles.statsGrid}>
      {TILES.map((tile) => (
        <button
          key={tile.chave}
          type="button"
          className={`${styles.statTile} ${tile.accent ? styles.accent : ""}`}
          onClick={() => filtrarPorStatus(tile.status)}
          aria-label={`Filtrar por ${tile.label.toLowerCase()}`}
        >
          <div
            className={`${styles.statNum} ${!contadores ? styles.statSkeleton : ""}`}
            style={tile.cor ? { color: tile.cor } : undefined}
          >
            {contadores ? contadores[tile.chave] : "–"}
          </div>
          <div className={styles.statLabel}>{tile.label}</div>
        </button>
      ))}
    </div>
  );
}
