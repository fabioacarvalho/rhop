import Link from "next/link";
import { redirect } from "next/navigation";
import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import { listar } from "@/lib/services/userService";
import { Role } from "@/lib/generated/prisma/client";
import StatusToggleButton from "./_components/StatusToggleButton";
import styles from "./usuarios.module.css";

const ROTULO_PAPEL: Record<Role, string> = {
  SOLICITANTE: "Solicitante",
  GESTOR: "Gestor",
  RH_ADMIN: "RH_Admin",
};

/**
 * Tela de listagem de usuários (USR-13, USR-14, USR-15) — Server Component.
 *
 * Mesmo padrão de gate de acesso de `configuracao-fluxos/page.tsx`: a
 * checagem roda no backend, antes de qualquer leitura de `User` — quem não é
 * GESTOR/RH_ADMIN nunca chega a disparar `userService.listar()`.
 *
 * Título/dado adaptado ao papel: RH_Admin vê "Usuários" (todos); Gestor vê
 * "Minha equipe" (só a própria equipe — `userService.listar` já aplica esse
 * filtro no backend).
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
          <p>Você não tem permissão para acessar esta página.</p>
        </main>
      );
    }
    throw erro;
  }

  const usuarios = await listar(usuario);
  const ehRhAdmin = usuario.role === Role.RH_ADMIN;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>
            {ehRhAdmin ? "Usuários" : "Minha equipe"}
          </h1>
          <p className={styles.subtitle}>
            {ehRhAdmin
              ? "Todos os usuários cadastrados no FluxoRH."
              : "Colaboradores sob sua gestão."}
          </p>
        </div>
        <Link href="/usuarios/novo" className={`${styles.btn} ${styles.btnPrimary}`}>
          + Novo usuário
        </Link>
      </header>

      {usuarios.length === 0 ? (
        <p className={styles.empty}>
          {ehRhAdmin
            ? "Nenhum usuário cadastrado ainda."
            : "Você ainda não tem colaboradores na sua equipe."}
        </p>
      ) : (
        <div className={styles.card}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Papel</th>
                <th>Equipe</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((item) => (
                <tr key={item.id}>
                  <td className={styles.nome}>{item.nome}</td>
                  <td className={styles.mono}>{item.email}</td>
                  <td>
                    <span className={styles.chipRole}>
                      {ROTULO_PAPEL[item.role]}
                    </span>
                  </td>
                  <td>{item.equipe_nome ?? "—"}</td>
                  <td>
                    <span
                      className={`${styles.stamp} ${
                        item.ativo ? styles.stampAtivo : styles.stampInativo
                      }`}
                    >
                      {item.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td>
                    <div className={styles.acoes}>
                      <Link
                        href={`/usuarios/${item.id}/editar`}
                        className={`${styles.btn} ${styles.btnGhost} ${styles.btnGhostSm}`}
                      >
                        Editar
                      </Link>
                      <StatusToggleButton usuarioId={item.id} ativo={item.ativo} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
