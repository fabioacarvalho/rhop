"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TagForm from "./TagForm";
import styles from "../tags.module.css";

interface TagItem {
  id: string;
  nome: string;
  funcao: string;
  ativo: boolean;
}

interface TagListProps {
  tags: TagItem[];
}

/**
 * Lista de Tags cadastradas (TAL-37) — nome, função, status ativo/inativo e
 * ações. "Editar" troca a linha por `TagForm` inline; "Ativar"/"Desativar"
 * chama `PATCH /api/tags/[id]` direto, mesmo padrão de
 * `equipes/_components/StatusToggleButton.tsx` (TAL-40, TAL-41).
 */
export default function TagList({ tags }: TagListProps) {
  const router = useRouter();
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [alternandoId, setAlternandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function handleAlternarAtivo(tag: TagItem) {
    setAlternandoId(tag.id);
    setErro(null);

    try {
      const resposta = await fetch(`/api/tags/${tag.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !tag.ativo }),
      });

      if (!resposta.ok) {
        const corpo: { error?: string } = await resposta.json().catch(() => ({}));
        setErro(corpo.error ?? "Nao foi possivel atualizar o status da tag.");
        return;
      }

      router.refresh();
    } catch {
      setErro("Falha de rede ao atualizar o status da tag.");
    } finally {
      setAlternandoId(null);
    }
  }

  if (tags.length === 0) {
    return <p className={styles.empty}>Nenhuma tag cadastrada ainda.</p>;
  }

  return (
    <div className={styles.card}>
      {erro ? <p className={styles.formError} style={{ padding: "12px 14px 0" }}>{erro}</p> : null}
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Função</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {tags.map((tag) =>
            editandoId === tag.id ? (
              <tr key={tag.id}>
                <td colSpan={4} style={{ padding: 0 }}>
                  <TagForm
                    modo="editar"
                    tagInicial={{ id: tag.id, nome: tag.nome, funcao: tag.funcao }}
                    onSalvo={() => setEditandoId(null)}
                  />
                </td>
              </tr>
            ) : (
              <tr key={tag.id}>
                <td className={styles.nome}>{tag.nome}</td>
                <td>{tag.funcao}</td>
                <td>
                  <span
                    className={`${styles.stamp} ${
                      tag.ativo ? styles.stampAtivo : styles.stampInativo
                    }`}
                  >
                    {tag.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td>
                  <div className={styles.acoes}>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnGhost} ${styles.btnGhostSm}`}
                      onClick={() => setEditandoId(tag.id)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnGhost} ${styles.btnGhostSm} ${
                        tag.ativo ? styles.btnDanger : ""
                      }`}
                      disabled={alternandoId === tag.id}
                      onClick={() => handleAlternarAtivo(tag)}
                    >
                      {alternandoId === tag.id
                        ? "Aguarde..."
                        : tag.ativo
                          ? "Desativar"
                          : "Ativar"}
                    </button>
                  </div>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}
