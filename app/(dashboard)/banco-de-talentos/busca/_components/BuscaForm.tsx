"use client";

import { useState, type FormEvent } from "react";
import type { ResultadoBusca } from "@/lib/services/talentoSearchService";
import { CandidatoCard } from "./CandidatoCard";
import styles from "../busca.module.css";

interface RespostaErro {
  error?: string;
}

const N_PADRAO = 20;

/**
 * Formulário de busca/ranking de talentos (TAL-15, TAL-16, TAL-26, TAL-30,
 * TAL-31) — texto livre + N; submete `POST /api/candidatos/busca` e
 * renderiza os resultados como `CandidatoCard`. N inválido (não numérico ou
 * ≤ 0) bloqueia o submit antes de chamar a API, espelhando a regra de
 * `talentoSearchService` (o teto máximo em si só é validado no backend, que
 * conhece `TALENTO_BUSCA_N_MAXIMO`).
 */
export function BuscaForm() {
  const [texto, setTexto] = useState("");
  const [n, setN] = useState(String(N_PADRAO));
  const [resultado, setResultado] = useState<ResultadoBusca | null>(null);
  const [erroValidacao, setErroValidacao] = useState<string | null>(null);
  const [erroApi, setErroApi] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);

  async function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErroValidacao(null);
    setErroApi(null);

    if (texto.trim().length === 0) {
      setErroValidacao("Descreva o perfil que você está buscando.");
      return;
    }

    const nNumero = Number(n);
    if (!Number.isInteger(nNumero) || nNumero <= 0) {
      setErroValidacao("N deve ser um número inteiro maior que zero.");
      return;
    }

    setBuscando(true);
    setResultado(null);

    try {
      const res = await fetch("/api/candidatos/busca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto, n: nNumero }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as RespostaErro | null;
        setErroApi(body?.error ?? "Não foi possível processar a busca agora.");
        return;
      }

      const dados = (await res.json()) as ResultadoBusca;
      setResultado(dados);
    } catch {
      setErroApi("Falha de rede ao buscar candidatos.");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <>
      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={`${styles.field} ${styles.fieldTexto}`}>
          <span>Perfil desejado</span>
          <input
            type="text"
            placeholder="ex.: engenheiro de dados senior, forte em SQL"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            disabled={buscando}
          />
        </label>

        <label className={`${styles.field} ${styles.fieldN}`}>
          <span>N resultados</span>
          <input
            type="number"
            min={1}
            value={n}
            onChange={(e) => setN(e.target.value)}
            disabled={buscando}
          />
        </label>

        <button type="submit" className={styles.btn} disabled={buscando}>
          {buscando ? "Buscando..." : "Buscar candidatos"}
        </button>

        {erroValidacao ? (
          <p className={styles.erroValidacao}>{erroValidacao}</p>
        ) : null}
      </form>

      {erroApi ? <p className={styles.erroApi}>{erroApi}</p> : null}

      {resultado && !resultado.disponivel ? (
        <p className={styles.empty}>
          Nenhum candidato disponível para busca ainda.
        </p>
      ) : null}

      {resultado && resultado.disponivel ? (
        <div className={styles.resultados}>
          {resultado.candidatos.map((candidato) => (
            <CandidatoCard key={candidato.id} candidato={candidato} />
          ))}
        </div>
      ) : null}
    </>
  );
}
