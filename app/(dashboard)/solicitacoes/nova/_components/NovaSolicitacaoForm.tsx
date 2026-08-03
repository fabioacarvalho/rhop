"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CampoDinamico from "./CampoDinamico";
import type {
  CampoFormularioDefinicao,
  PapelAprovador,
} from "@/lib/validations/tipoFluxo";
import type { TipoFluxoResumo } from "@/lib/services/tipoFluxoService";
import styles from "../../solicitacoes.module.css";

interface Props {
  tiposDisponiveis: TipoFluxoResumo[];
}

const ROTULO_PAPEL: Record<PapelAprovador, string> = {
  GESTOR: "Gestor",
  RH_ADMIN: "RH_Admin",
};

/**
 * Formulário de Nova Solicitação (SOL-05, SOL-06, SOL-09) — Client Component.
 *
 * Ao selecionar um tipo de fluxo, busca `campos_formulario`/`etapas` via
 * `GET /api/tipos-fluxo/[id]` (rota já existente de `configuracao-fluxos`) e
 * renderiza um `CampoDinamico` por campo. Submit fica desabilitado durante o
 * `fetch` do POST — única defesa anti-duplicação prevista (`design.md`).
 */
export default function NovaSolicitacaoForm({ tiposDisponiveis }: Props) {
  const router = useRouter();
  const [tipoSelecionadoId, setTipoSelecionadoId] = useState<string | null>(
    null,
  );
  const [campos, setCampos] = useState<CampoFormularioDefinicao[]>([]);
  const [etapas, setEtapas] = useState<PapelAprovador[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [carregandoCampos, setCarregandoCampos] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [errosPorCampo, setErrosPorCampo] = useState<Record<string, string>>(
    {},
  );

  const tipoSelecionado =
    tiposDisponiveis.find((t) => t.id === tipoSelecionadoId) ?? null;

  async function selecionarTipo(tipo: TipoFluxoResumo) {
    setTipoSelecionadoId(tipo.id);
    setValores({});
    setErrosPorCampo({});
    setErroGeral(null);
    setCarregandoCampos(true);

    try {
      const res = await fetch(`/api/tipos-fluxo/${tipo.id}`);

      if (!res.ok) {
        setErroGeral(
          "Não foi possível carregar os campos deste tipo de fluxo.",
        );
        setCampos([]);
        setEtapas([]);
        return;
      }

      const body = await res.json();
      setCampos(
        (body.tipoFluxo.campos_formulario ?? []) as CampoFormularioDefinicao[],
      );
      setEtapas((body.tipoFluxo.etapas ?? []) as PapelAprovador[]);
    } catch {
      setErroGeral("Falha de rede ao carregar os campos.");
    } finally {
      setCarregandoCampos(false);
    }
  }

  function atualizarValor(chave: string, valor: string) {
    setValores((prev) => ({ ...prev, [chave]: valor }));
  }

  async function enviar() {
    if (!tipoSelecionado) {
      return;
    }

    setEnviando(true);
    setErroGeral(null);
    setErrosPorCampo({});

    try {
      const res = await fetch("/api/solicitacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo_fluxo_id: tipoSelecionado.id,
          dados: valores,
        }),
      });

      if (res.status === 201) {
        router.push("/solicitacoes");
        return;
      }

      const body = (await res.json().catch(() => null)) as {
        error?: string;
        erros?: Array<{ chave: string; mensagem: string }>;
      } | null;

      if (res.status === 400 && Array.isArray(body?.erros)) {
        const mapa: Record<string, string> = {};
        for (const erro of body.erros) {
          mapa[erro.chave] = erro.mensagem;
        }
        setErrosPorCampo(mapa);
        setErroGeral(body?.error ?? "Dados inválidos.");
        return;
      }

      setErroGeral(body?.error ?? "Não foi possível enviar a solicitação.");
    } catch {
      setErroGeral("Falha de rede ao enviar a solicitação.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={styles.stack16}>
      <div>
        <div className={styles.eyebrow}>1. Tipo de fluxo</div>
        <div className={styles.flowGrid}>
          {tiposDisponiveis.map((tipo) => (
            <button
              key={tipo.id}
              type="button"
              className={`${styles.flowTypeCard} ${
                tipo.id === tipoSelecionadoId ? styles.selected : ""
              }`}
              onClick={() => selecionarTipo(tipo)}
            >
              <span className={styles.flowIcon}>
                {tipo.nome.charAt(0).toUpperCase()}
              </span>
              <div className={styles.flowNome}>{tipo.nome}</div>
            </button>
          ))}
        </div>
      </div>

      {tipoSelecionado ? (
        <div className={`${styles.card} ${styles.cardPad} ${styles.ruled}`}>
          <div className={styles.eyebrow}>
            2. Detalhes — {tipoSelecionado.nome}
          </div>

          {carregandoCampos ? (
            <p className={styles.hint}>Carregando campos...</p>
          ) : (
            <form
              className={styles.stack16}
              onSubmit={(e) => {
                e.preventDefault();
                void enviar();
              }}
            >
              <div className={styles.fieldGrid}>
                {campos.map((campo) => (
                  <CampoDinamico
                    key={campo.chave}
                    campo={campo}
                    value={valores[campo.chave] ?? ""}
                    onChange={(valor) => atualizarValor(campo.chave, valor)}
                    erro={errosPorCampo[campo.chave]}
                  />
                ))}
              </div>

              {etapas.length > 0 ? (
                <div className={styles.stepsRow}>
                  <span className={styles.eyebrow} style={{ margin: 0 }}>
                    Etapas:
                  </span>
                  {etapas.map((papel, indice) => (
                    <span key={indice} style={{ display: "contents" }}>
                      {indice > 0 && (
                        <span className={styles.stepArrow}>→</span>
                      )}
                      <span className={styles.stepPill}>
                        {ROTULO_PAPEL[papel]}
                      </span>
                    </span>
                  ))}
                </div>
              ) : null}

              <div className={styles.formFooter}>
                {erroGeral ? (
                  <span className={styles.formError}>{erroGeral}</span>
                ) : null}
                <button
                  type="submit"
                  className={`${styles.btn} ${styles.btnPrimary} ${styles.btnLg}`}
                  disabled={enviando || campos.length === 0}
                >
                  {enviando ? "Enviando..." : "Enviar solicitação"}
                </button>
              </div>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}
