"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { resolveScreenTitle } from "@/lib/navigation/navConfig";
import type { TipoRelato } from "@/lib/helpers/githubIssue";
import styles from "./ajuda.module.css";

const TIPOS: TipoRelato[] = ["Bug", "Melhoria", "Dúvida"];

interface ValoresIniciais {
  tipo: TipoRelato;
  titulo: string;
  descricao: string;
}

interface HelpModalProps {
  onClose: () => void;
  valoresIniciais?: ValoresIniciais;
}

interface SucessoEnvio {
  url: string;
  numero: number;
}

export function HelpModal({ onClose, valoresIniciais }: HelpModalProps) {
  const pathname = usePathname();
  const tela = resolveScreenTitle(pathname).titulo;

  const [tipo, setTipo] = useState<TipoRelato>(valoresIniciais?.tipo ?? "Bug");
  const [titulo, setTitulo] = useState(valoresIniciais?.titulo ?? "");
  const [descricao, setDescricao] = useState(valoresIniciais?.descricao ?? "");
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState<SucessoEnvio | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  async function handleSubmit() {
    setEnviando(true);
    setErro(null);

    try {
      const resposta = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          titulo,
          descricao,
          tela_contexto: tela,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        setErro(dados.error ?? "Não foi possível criar a issue agora.");
        return;
      }

      setSucesso({ url: dados.url, numero: dados.numero });
      setTitulo("");
      setDescricao("");
    } catch {
      setErro("Não foi possível criar a issue agora. Verifique sua conexão e tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modalCard}>
        <div className={styles.modalHead}>
          <div className={styles.modalHeadBrand}>
            <div className={styles.modalSeal}>OP</div>
            <strong className={styles.modalHeadTitle}>Reportar algo</strong>
          </div>
          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          {sucesso ? (
            <>
              <div className={styles.sucesso}>
                Issue <strong>#{sucesso.numero}</strong> criada no GitHub com
                sucesso.
                <a
                  className={styles.sucessoLink}
                  href={sucesso.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver issue ↗
                </a>
              </div>
              <div className={styles.rowBetween}>
                <span />
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={onClose}
                >
                  Fechar
                </button>
              </div>
            </>
          ) : (
            <>
              <p className={styles.intro}>
                Encontrou um problema ou tem uma ideia? Isso cria uma issue no
                GitHub do projeto direto, já com a tela atual anexada ao
                relato.
              </p>

              <div className={styles.aviso}>
                Não inclua dados pessoais ou de solicitações específicas.
              </div>

              <div className={styles.field}>
                <label>Tipo</label>
                <div className={styles.tabToggle}>
                  {TIPOS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={
                        t === tipo ? styles.tabToggleActive : undefined
                      }
                      onClick={() => setTipo(t)}
                      disabled={enviando}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.field}>
                <label>Título</label>
                <input
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Resuma em uma frase"
                  disabled={enviando}
                />
              </div>

              <div className={styles.field}>
                <label>Descrição</label>
                <textarea
                  rows={4}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="O que aconteceu? O que você esperava que acontecesse?"
                  disabled={enviando}
                />
              </div>

              <div className={styles.cellSub}>
                Tela atual: <strong>{tela}</strong>
              </div>

              {erro && <div className={styles.erro}>{erro}</div>}

              <div className={styles.rowBetween}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnGhost}`}
                  onClick={onClose}
                  disabled={enviando}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={handleSubmit}
                  disabled={enviando}
                >
                  {enviando ? "Criando issue…" : "Abrir issue no GitHub ↗"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
