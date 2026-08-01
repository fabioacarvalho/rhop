"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "../novo.module.css";

interface RespostaErro {
  error?: string;
}

/**
 * Formulário de cadastro de candidato (TAL-06, TAL-28) — Client Component
 * com os 5 campos obrigatórios do P0 (currículo/transcrição colados, sem
 * upload). `required` nativo é só UX; a validação de verdade é
 * `candidatoInputSchema` no backend.
 *
 * Erro 409 (e-mail duplicado) é exibido inline no campo e-mail
 * especificamente (`context.md`); demais erros (400 Zod, falha de rede) em
 * uma mensagem geral acima do rodapé.
 */
export function NovoCandidatoForm() {
  const router = useRouter();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [curriculoTexto, setCurriculoTexto] = useState("");
  const [transcricaoTexto, setTranscricaoTexto] = useState("");

  const [erroEmail, setErroEmail] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErroEmail(null);
    setErroGeral(null);
    setEnviando(true);

    try {
      const res = await fetch("/api/candidatos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          email,
          telefone,
          curriculo_texto: curriculoTexto,
          transcricao_texto: transcricaoTexto,
        }),
      });

      if (res.status === 201) {
        router.push("/banco-de-talentos");
        return;
      }

      const body = (await res.json().catch(() => null)) as RespostaErro | null;

      if (res.status === 409) {
        setErroEmail(body?.error ?? "Ja existe candidato com este e-mail.");
        return;
      }

      setErroGeral(body?.error ?? "Nao foi possivel cadastrar o candidato.");
    } catch {
      setErroGeral("Falha de rede ao cadastrar o candidato.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={styles.card}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="nome">Nome</label>
          <input
            id="nome"
            type="text"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            disabled={enviando}
          />
        </div>

        <div className={`${styles.field} ${erroEmail ? styles.fieldErro : ""}`}>
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErroEmail(null);
            }}
            disabled={enviando}
          />
          {erroEmail ? <span className={styles.campoErro}>{erroEmail}</span> : null}
        </div>

        <div className={styles.field}>
          <label htmlFor="telefone">Telefone</label>
          <input
            id="telefone"
            type="text"
            required
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            disabled={enviando}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="curriculo_texto">Currículo (texto colado)</label>
          <textarea
            id="curriculo_texto"
            required
            rows={6}
            value={curriculoTexto}
            onChange={(e) => setCurriculoTexto(e.target.value)}
            disabled={enviando}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="transcricao_texto">Transcrição da entrevista (texto colado)</label>
          <textarea
            id="transcricao_texto"
            required
            rows={6}
            value={transcricaoTexto}
            onChange={(e) => setTranscricaoTexto(e.target.value)}
            disabled={enviando}
          />
        </div>

        {erroGeral ? <p className={styles.erroGeral}>{erroGeral}</p> : null}

        <div className={styles.footer}>
          <button type="submit" className={styles.btn} disabled={enviando}>
            {enviando ? "Cadastrando..." : "Cadastrar candidato"}
          </button>
        </div>
      </form>
    </div>
  );
}
