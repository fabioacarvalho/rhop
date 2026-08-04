"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "../novo.module.css";

interface RespostaErro {
  error?: string;
}

interface TagOpcao {
  id: string;
  nome: string;
}

/**
 * Formulário de cadastro de candidato (TAL-06, TAL-28, TAL-32, TAL-33,
 * TAL-43, TAL-44) — Client Component.
 *
 * Currículo aceita texto colado OU upload de arquivo (PDF/Word/Markdown,
 * coexistência decidida em `context.md`) — o upload chama
 * `POST /api/candidatos/extrair-curriculo` e preenche o campo de texto com
 * o resultado pra conferência/edição antes de salvar, nunca substitui a
 * possibilidade de colar/editar manualmente. Tags ativas são carregadas de
 * `GET /api/tags?ativo=true` para o multi-select opcional.
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
  const [curriculoArquivoUrl, setCurriculoArquivoUrl] = useState<
    string | null
  >(null);
  const [parecerTecnico, setParecerTecnico] = useState("");

  const [tagsDisponiveis, setTagsDisponiveis] = useState<TagOpcao[]>([]);
  const [tagsSelecionadas, setTagsSelecionadas] = useState<string[]>([]);

  const [extraindoArquivo, setExtraindoArquivo] = useState(false);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);

  const [erroEmail, setErroEmail] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let cancelado = false;

    fetch("/api/tags?ativo=true")
      .then((res) => (res.ok ? res.json() : { tags: [] }))
      .then((body: { tags?: TagOpcao[] }) => {
        if (!cancelado) {
          setTagsDisponiveis(body.tags ?? []);
        }
      })
      .catch(() => {
        if (!cancelado) {
          setTagsDisponiveis([]);
        }
      });

    return () => {
      cancelado = true;
    };
  }, []);

  function toggleTag(id: string) {
    setTagsSelecionadas((atual) =>
      atual.includes(id) ? atual.filter((tagId) => tagId !== id) : [...atual, id],
    );
  }

  async function handleArquivoChange(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = "";

    if (!arquivo) {
      return;
    }

    setErroArquivo(null);
    setExtraindoArquivo(true);

    try {
      const formData = new FormData();
      formData.append("arquivo", arquivo);

      const res = await fetch("/api/candidatos/extrair-curriculo", {
        method: "POST",
        body: formData,
      });

      const body = (await res.json().catch(() => null)) as
        | (RespostaErro & { texto?: string; arquivo_url?: string })
        | null;

      if (!res.ok) {
        setErroArquivo(
          body?.error ?? "Nao foi possivel extrair texto deste arquivo.",
        );
        return;
      }

      setCurriculoTexto(body?.texto ?? "");
      setCurriculoArquivoUrl(body?.arquivo_url ?? null);
    } catch {
      setErroArquivo("Falha de rede ao processar o arquivo.");
    } finally {
      setExtraindoArquivo(false);
    }
  }

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
          curriculo_arquivo_url: curriculoArquivoUrl ?? undefined,
          parecer_tecnico: parecerTecnico,
          tag_ids: tagsSelecionadas,
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
          <label htmlFor="curriculo_arquivo">
            Currículo — enviar arquivo (PDF, Word ou Markdown)
          </label>
          <div className={styles.fileRow}>
            <input
              id="curriculo_arquivo"
              type="file"
              accept=".pdf,.docx,.md,.markdown"
              onChange={handleArquivoChange}
              disabled={enviando || extraindoArquivo}
            />
            {extraindoArquivo ? <span className={styles.fileHint}>Extraindo texto...</span> : null}
          </div>
          {erroArquivo ? <span className={styles.campoErro}>{erroArquivo}</span> : null}
          <span className={styles.fileHint}>
            Ou cole/edite o texto diretamente no campo abaixo.
          </span>
        </div>

        <div className={styles.field}>
          <label htmlFor="curriculo_texto">Currículo (texto)</label>
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
          <label htmlFor="parecer_tecnico">Parecer técnico</label>
          <textarea
            id="parecer_tecnico"
            required
            rows={6}
            value={parecerTecnico}
            onChange={(e) => setParecerTecnico(e.target.value)}
            disabled={enviando}
          />
        </div>

        {tagsDisponiveis.length > 0 ? (
          <div className={styles.field}>
            <label>Tags</label>
            <div className={styles.tagChecklist}>
              {tagsDisponiveis.map((tag) => (
                <label key={tag.id} className={styles.tagChip}>
                  <input
                    type="checkbox"
                    checked={tagsSelecionadas.includes(tag.id)}
                    onChange={() => toggleTag(tag.id)}
                    disabled={enviando}
                  />
                  {tag.nome}
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {erroGeral ? <p className={styles.erroGeral}>{erroGeral}</p> : null}

        <div className={styles.footer}>
          <button type="submit" className={styles.btn} disabled={enviando || extraindoArquivo}>
            {enviando ? "Cadastrando..." : "Cadastrar candidato"}
          </button>
        </div>
      </form>
    </div>
  );
}
