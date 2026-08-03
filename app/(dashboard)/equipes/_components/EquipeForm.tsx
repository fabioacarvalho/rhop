"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "../equipes.module.css";

interface GestorElegivel {
  id: string;
  nome: string;
}

interface EquipeInicial {
  id: string;
  nome: string;
  gestor_id: string;
}

interface EquipeFormProps {
  modo: "criar" | "editar";
  gestoresElegiveis: GestorElegivel[];
  /** Só passado quando `modo === 'editar'`. */
  equipeInicial?: EquipeInicial;
}

interface RespostaErro {
  error?: string;
}

/**
 * Formulário de criação/edição de `Equipe` (T11, EQP-01, EQP-03) — Client
 * Component compartilhado entre `/equipes/novo` e `/equipes/[id]/editar`.
 *
 * `gestor_id` é sempre obrigatório — toda `Equipe` precisa de um responsável
 * (sem opção "nenhum"), decisão travada em `design.md`.
 */
export default function EquipeForm({
  modo,
  gestoresElegiveis,
  equipeInicial,
}: EquipeFormProps) {
  const router = useRouter();

  const [nome, setNome] = useState(equipeInicial?.nome ?? "");
  const [gestorId, setGestorId] = useState<string>(
    equipeInicial?.gestor_id ?? ""
  );

  const [erroValidacao, setErroValidacao] = useState<string | null>(null);
  const [erroSubmissao, setErroSubmissao] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (nome.trim().length === 0) {
      setErroValidacao("Informe o nome da equipe.");
      return;
    }
    if (gestorId.length === 0) {
      setErroValidacao("Selecione um gestor responsável.");
      return;
    }

    setErroValidacao(null);
    setErroSubmissao(null);
    setEnviando(true);

    try {
      const corpo = { nome, gestor_id: gestorId };
      const url =
        modo === "criar" ? "/api/equipes" : `/api/equipes/${equipeInicial?.id}`;
      const method = modo === "criar" ? "POST" : "PUT";

      const resposta = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });

      if (!resposta.ok) {
        const corpoErro: RespostaErro = await resposta.json().catch(() => ({}));
        setErroSubmissao(
          corpoErro.error ?? `Falha ao salvar equipe (status ${resposta.status}).`
        );
        setEnviando(false);
        return;
      }

      router.push("/equipes");
      router.refresh();
    } catch {
      setErroSubmissao("Não foi possível salvar a equipe. Tente novamente.");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${styles.card} ${styles.ruled}`} style={{ padding: "22px 24px" }}>
      <div className={styles.field}>
        <label htmlFor="nome" className={styles.fieldLabel}>
          Nome
        </label>
        <input
          id="nome"
          type="text"
          className={styles.input}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="ex: Recrutamento e Seleção"
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="gestor" className={styles.fieldLabel}>
          Gestor responsável
        </label>
        <select
          id="gestor"
          className={styles.select}
          value={gestorId}
          onChange={(e) => setGestorId(e.target.value)}
        >
          <option value="">Selecione um gestor</option>
          {gestoresElegiveis.map((gestor) => (
            <option key={gestor.id} value={gestor.id}>
              {gestor.nome}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.formFooter}>
        {(erroValidacao || erroSubmissao) && (
          <p role="alert" className={styles.formError}>
            {erroValidacao ?? erroSubmissao}
          </p>
        )}
        <Link href="/equipes" className={`${styles.btn} ${styles.btnLg} ${styles.btnGhost}`}>
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={enviando}
          className={`${styles.btn} ${styles.btnLg} ${styles.btnPrimary}`}
        >
          {enviando
            ? "Salvando..."
            : modo === "criar"
              ? "Criar equipe"
              : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}
