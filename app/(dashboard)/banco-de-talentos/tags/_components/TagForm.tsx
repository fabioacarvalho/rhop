"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "../tags.module.css";

interface TagInicial {
  id: string;
  nome: string;
  funcao: string;
}

interface TagFormProps {
  modo: "criar" | "editar";
  tagInicial?: TagInicial;
  onSalvo?: () => void;
}

interface RespostaErro {
  error?: string;
}

/**
 * Formulário de criação/edição de Tag (TAL-38, TAL-39, TAL-40) — Client
 * Component reutilizado tanto pela criação (topo da página de gestão) quanto
 * pela edição inline de uma linha da `TagList`.
 *
 * Nome duplicado (409, `ErroTagDuplicada`) é exibido inline no campo nome.
 */
export default function TagForm({ modo, tagInicial, onSalvo }: TagFormProps) {
  const router = useRouter();

  const [nome, setNome] = useState(tagInicial?.nome ?? "");
  const [funcao, setFuncao] = useState(tagInicial?.funcao ?? "");
  const [erroNome, setErroNome] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErroNome(null);
    setErroGeral(null);
    setEnviando(true);

    try {
      const url = modo === "criar" ? "/api/tags" : `/api/tags/${tagInicial?.id}`;
      const method = modo === "criar" ? "POST" : "PATCH";

      const resposta = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, funcao }),
      });

      if (!resposta.ok) {
        const corpo: RespostaErro = await resposta.json().catch(() => ({}));

        if (resposta.status === 409) {
          setErroNome(corpo.error ?? "Ja existe uma tag com este nome.");
          return;
        }

        setErroGeral(corpo.error ?? "Nao foi possivel salvar a tag.");
        return;
      }

      if (modo === "criar") {
        setNome("");
        setFuncao("");
      }

      router.refresh();
      onSalvo?.();
    } catch {
      setErroGeral("Falha de rede ao salvar a tag.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.card} style={{ padding: "20px 22px" }}>
      <div className={styles.field}>
        <label htmlFor={`tag-nome-${tagInicial?.id ?? "novo"}`} className={styles.fieldLabel}>
          Nome
        </label>
        <input
          id={`tag-nome-${tagInicial?.id ?? "novo"}`}
          type="text"
          required
          className={styles.input}
          value={nome}
          onChange={(e) => {
            setNome(e.target.value);
            setErroNome(null);
          }}
          disabled={enviando}
          placeholder="ex: Sênior"
        />
        {erroNome ? <span className={styles.formError}>{erroNome}</span> : null}
      </div>

      <div className={styles.field}>
        <label htmlFor={`tag-funcao-${tagInicial?.id ?? "novo"}`} className={styles.fieldLabel}>
          Função
        </label>
        <input
          id={`tag-funcao-${tagInicial?.id ?? "novo"}`}
          type="text"
          required
          className={styles.input}
          value={funcao}
          onChange={(e) => setFuncao(e.target.value)}
          disabled={enviando}
          placeholder="ex: Nível de experiência do candidato"
        />
      </div>

      <div className={styles.formFooter}>
        {erroGeral ? <p className={styles.formError}>{erroGeral}</p> : null}
        <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={enviando}>
          {enviando ? "Salvando..." : modo === "criar" ? "Criar tag" : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}
