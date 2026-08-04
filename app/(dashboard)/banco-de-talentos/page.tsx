import Link from "next/link";
import { redirect } from "next/navigation";
import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import { listar } from "@/lib/services/candidatoService";
import { Role } from "@/lib/generated/prisma/client";
import { ReprocessarButton } from "./_components/ReprocessarButton";
import styles from "./banco-de-talentos.module.css";

function formatarData(data: Date): string {
  return data.toLocaleDateString("pt-BR");
}

function stampInfo(status: "pendente" | "processado" | "falhou"): {
  texto: string;
  classe: string;
} {
  if (status === "processado") {
    return { texto: "Processado", classe: styles.stampProcessado };
  }
  if (status === "falhou") {
    return { texto: "Falhou", classe: styles.stampFalhou };
  }
  return { texto: "Pendente", classe: styles.stampPendente };
}

/**
 * Tela Listar Candidatos (TAL-08 a TAL-11, TAL-29) — Server Component:
 * mesmo gate de acesso das demais telas do módulo. `candidatoService.listar()`
 * é chamado direto aqui, sem round-trip por `GET /api/candidatos`.
 */
export default async function Page() {
  let usuario;
  try {
    usuario = await requireUser([Role.GESTOR, Role.RH_ADMIN]);
  } catch (erro) {
    if (erro instanceof ErroNaoAutenticado) {
      redirect("/login");
    }
    if (erro instanceof ErroNaoAutorizado) {
      return (
        <main className={styles.restrito}>
          <h1>Acesso restrito</h1>
          <p>Apenas gestores e RH podem acessar o Banco de Talentos.</p>
        </main>
      );
    }
    throw erro;
  }

  const candidatos = await listar();

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Banco de Talentos</h1>
          <p className={styles.subtitle}>
            Candidatos cadastrados e disponíveis para busca por perfil.
          </p>
        </div>
        <div className={styles.headerActions}>
          {usuario.role === Role.RH_ADMIN ? (
            <Link
              href="/banco-de-talentos/tags"
              className={`${styles.btn} ${styles.btnGhost}`}
            >
              Gerenciar tags
            </Link>
          ) : null}
          <Link
            href="/banco-de-talentos/busca"
            className={`${styles.btn} ${styles.btnGhost}`}
          >
            Buscar candidatos
          </Link>
          <Link
            href="/banco-de-talentos/novo"
            className={`${styles.btn} ${styles.btnPrimary}`}
          >
            Novo candidato
          </Link>
        </div>
      </header>

      {candidatos.length === 0 ? (
        <p className={styles.empty}>Nenhum candidato cadastrado ainda.</p>
      ) : (
        <div className={styles.card}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Candidato</th>
                <th>Status</th>
                <th>Cadastrado em</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {candidatos.map((candidato) => {
                const stamp = stampInfo(candidato.status_embedding);
                return (
                  <tr key={candidato.id}>
                    <td>
                      <div className={styles.nome}>{candidato.nome}</div>
                      <div className={styles.email}>{candidato.email}</div>
                    </td>
                    <td>
                      <span className={`${styles.stamp} ${stamp.classe}`}>
                        {stamp.texto}
                      </span>
                    </td>
                    <td className={styles.mono}>
                      {formatarData(candidato.criado_em)}
                    </td>
                    <td className={styles.acoes}>
                      {candidato.status_embedding === "falhou" ? (
                        <ReprocessarButton candidatoId={candidato.id} />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
