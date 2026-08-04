"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TipoFluxoResumo } from "@/lib/services/tipoFluxoService";
import type { InsightResultado } from "@/lib/services/insightsService";
import { FormattedIaSummary } from "@/components/FormattedIaSummary";
import styles from "../insights.module.css";

type Props = {
  tipos: TipoFluxoResumo[];
};

const PERIODOS = [
  { valor: "ULTIMOS_30_DIAS", rotulo: "Últimos 30 dias" },
  { valor: "ULTIMOS_90_DIAS", rotulo: "Últimos 90 dias" },
  { valor: "ANO_ATUAL", rotulo: "Ano atual" },
] as const;

const DIMENSOES = [
  { valor: "STATUS", rotulo: "Por status" },
  { valor: "MES", rotulo: "Por mês" },
] as const;

/**
 * Painel de Insights (INSIGHT-01, INSIGHT-03, INSIGHT-05, INSIGHT-07,
 * INSIGHT-08, INSIGHT-11) — Client Component único: filtro, gráfico
 * Recharts e callout de IA nascem do mesmo `fetch`, sem estado
 * compartilhado entre componentes irmãos (`design.md`).
 */
export function InsightsPanel({ tipos }: Props) {
  const [isMounted, setIsMounted] = useState(false);
  const [tipoFluxoId, setTipoFluxoId] = useState(tipos[0]?.id ?? "");
  const [periodo, setPeriodo] =
    useState<(typeof PERIODOS)[number]["valor"]>("ULTIMOS_30_DIAS");
  const [dimensao, setDimensao] =
    useState<(typeof DIMENSOES)[number]["valor"]>("STATUS");
  const [resultado, setResultado] = useState<InsightResultado | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!tipoFluxoId) {
      return;
    }

    const controller = new AbortController();

    async function buscar() {
      setCarregando(true);
      setErro(null);

      try {
        const params = new URLSearchParams({ tipoFluxoId, periodo, dimensao });
        const res = await fetch(`/api/insights?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          setErro(body?.error ?? "Não foi possível carregar os insights.");
          setResultado(null);
          return;
        }

        const dados = (await res.json()) as InsightResultado;
        setResultado(dados);
      } catch (falha) {
        if (falha instanceof Error && falha.name === "AbortError") {
          return;
        }
        setErro("Falha de rede ao carregar os insights.");
        setResultado(null);
      } finally {
        setCarregando(false);
      }
    }

    buscar();

    return () => controller.abort();
  }, [tipoFluxoId, periodo, dimensao]);

  return (
    <div className={styles.stack}>
      <div className={styles.filterBar}>
        <label className={styles.filterField}>
          <span>Tipo de fluxo</span>
          <select
            value={tipoFluxoId}
            onChange={(e) => setTipoFluxoId(e.target.value)}
          >
            {tipos.length === 0 ? (
              <option value="">Nenhum tipo cadastrado</option>
            ) : (
              tipos.map((tipo) => (
                <option key={tipo.id} value={tipo.id}>
                  {tipo.nome}
                </option>
              ))
            )}
          </select>
        </label>

        <label className={styles.filterField}>
          <span>Período</span>
          <select
            value={periodo}
            onChange={(e) =>
              setPeriodo(e.target.value as (typeof PERIODOS)[number]["valor"])
            }
          >
            {PERIODOS.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.filterField}>
          <span>Dimensão</span>
          <select
            value={dimensao}
            onChange={(e) =>
              setDimensao(
                e.target.value as (typeof DIMENSOES)[number]["valor"],
              )
            }
          >
            {DIMENSOES.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </select>
        </label>
      </div>

      {erro ? <p className={styles.erro}>{erro}</p> : null}

      {!erro && tipos.length === 0 ? (
        <p className={styles.empty}>
          Nenhum tipo de fluxo cadastrado ainda. Configure um em
          &quot;Configuração de Fluxos&quot; para ver insights.
        </p>
      ) : null}

      {!erro && tipos.length > 0 && resultado && resultado.total === 0 ? (
        <p className={styles.empty}>
          Sem dados no período selecionado.
        </p>
      ) : null}

      {!erro && resultado && resultado.total > 0 ? (
        <>
          <div className={styles.card}>
            <div className={styles.chartWrap} aria-busy={carregando}>
              {isMounted ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={resultado.itens}
                    margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
                  >
                    <defs>
                      <linearGradient id="insightBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#5F90BC" />
                        <stop offset="100%" stopColor="#1B356A" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#DCE3F0" />
                    <XAxis
                      dataKey="chave"
                      tick={{ fontSize: 11, fill: "#5B6B87" }}
                      axisLine={{ stroke: "#DCE3F0" }}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "#5B6B87" }}
                      axisLine={false}
                      tickLine={false}
                      width={32}
                    />
                    <Tooltip
                      cursor={{ fill: "#E4ECFA" }}
                      contentStyle={{
                        background: "#FFFFFF",
                        border: "1px solid #DCE3F0",
                        borderRadius: 8,
                        fontSize: 12.5,
                      }}
                      labelStyle={{ color: "#2E5E8C", fontWeight: 600 }}
                    />
                    <Bar
                      dataKey="quantidade"
                      fill="url(#insightBar)"
                      radius={[6, 6, 3, 3]}
                      maxBarSize={56}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 260 }} />
              )}
            </div>
          </div>

          {resultado.resumo_ia ? (
            <div className={styles.callout}>
              <div className={styles.calloutTag}>
                ✦ Leitura da IA sobre os números acima
              </div>
              <FormattedIaSummary text={resultado.resumo_ia} />
            </div>
          ) : (
            <div className={`${styles.callout} ${styles.calloutFallback}`}>
              <div className={styles.calloutTag}>Resumo indisponível</div>
              O resumo por IA não pôde ser gerado no momento. Os números
              acima continuam corretos.
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
