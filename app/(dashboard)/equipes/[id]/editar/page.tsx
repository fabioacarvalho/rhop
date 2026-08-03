import Link from "next/link";
import { redirect } from "next/navigation";
import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import {
  buscarPorId,
  buscarMembros,
  ErroNaoEncontradoEquipe,
} from "@/lib/services/equipeService";
import { listarElegiveisComoGestor } from "@/lib/services/userService";
import { Role } from "@/lib/generated/prisma/client";
import EquipeForm from "../../_components/EquipeForm";
import styles from "../../equipes.module.css";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Tela de edição de `Equipe` (T11, EQP-03) — Server Component, RH_Admin-only.
 *
 * `id` inexistente (`ErroNaoEncontradoEquipe`) -> mesma tela "Acesso
 * restrito" do gate de papel (não `notFound()`), mesma postura de
 * `usuarios/[id]/editar/page.tsx`.
 *
 * Bônus (EQP-26): lista os membros atuais da equipe abaixo do form, via
 * `equipeService.buscarMembros`.
 */
export default async function Page({ params }: PageProps) {
  try {
    await requireUser([Role.RH_ADMIN]);
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

  const { id } = await params;

  let equipe;
  try {
    equipe = await buscarPorId(id);
  } catch (erro) {
    if (erro instanceof ErroNaoEncontradoEquipe) {
      return (
        <main className={styles.restrito}>
          <h1>Acesso restrito</h1>
          <p>Você não tem permissão para acessar esta página.</p>
        </main>
      );
    }
    throw erro;
  }

  const [elegiveis, membros] = await Promise.all([
    listarElegiveisComoGestor(),
    buscarMembros(equipe.id),
  ]);
  const gestoresElegiveis = elegiveis
    .filter((elegivel) => elegivel.role === Role.GESTOR)
    .map((elegivel) => ({ id: elegivel.id, nome: elegivel.nome }));

  return (
    <main className={styles.page}>
      <Link href="/equipes" className={styles.backLink}>
        ← Equipes
      </Link>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Editar equipe</h1>
          <p className={styles.subtitle}>Ajuste os dados de {equipe.nome}.</p>
        </div>
      </header>

      <EquipeForm
        modo="editar"
        gestoresElegiveis={gestoresElegiveis}
        equipeInicial={{
          id: equipe.id,
          nome: equipe.nome,
          gestor_id: equipe.gestor_id,
        }}
      />

      <section className={styles.membrosSection}>
        <h2 className={styles.membrosTitle}>Membros da equipe</h2>
        {membros.length === 0 ? (
          <p className={styles.empty}>Nenhum membro vinculado a esta equipe.</p>
        ) : (
          <div className={styles.card}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {membros.map((membro) => (
                  <tr key={membro.email}>
                    <td className={styles.nome}>{membro.nome}</td>
                    <td className={styles.mono}>{membro.email}</td>
                    <td>
                      <span
                        className={`${styles.stamp} ${
                          membro.ativo ? styles.stampAtivo : styles.stampInativo
                        }`}
                      >
                        {membro.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
