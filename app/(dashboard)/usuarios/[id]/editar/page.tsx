import Link from "next/link";
import { redirect } from "next/navigation";
import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import {
  buscarPorId,
  ErroNaoEncontradoUsuario,
} from "@/lib/services/userService";
import { listarAtivasParaSelecao } from "@/lib/services/equipeService";
import { Role } from "@/lib/generated/prisma/client";
import UsuarioForm from "../../_components/UsuarioForm";
import styles from "../../usuarios.module.css";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Tela de edição de `User` (USR-01, USR-16, USR-17, USR-18) — Server
 * Component.
 *
 * `id` inexistente ou fora do escopo do Gestor (`ErroNaoEncontradoUsuario`)
 * -> mesma tela "Acesso restrito" do gate de papel (não `notFound()`) — evita
 * vazar se o `id` existe ou não pra quem não tem permissão sobre ele, mesma
 * postura de `design.md`.
 */
export default async function Page({ params }: PageProps) {
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

  const { id } = await params;

  let alvo;
  try {
    alvo = await buscarPorId(id, usuario);
  } catch (erro) {
    if (erro instanceof ErroNaoEncontradoUsuario) {
      return (
        <main className={styles.restrito}>
          <h1>Acesso restrito</h1>
          <p>Você não tem permissão para acessar esta página.</p>
        </main>
      );
    }
    throw erro;
  }

  const ehRhAdmin = usuario.role === Role.RH_ADMIN;
  const equipesDisponiveis = ehRhAdmin
    ? await listarAtivasParaSelecao()
    : undefined;

  return (
    <main className={styles.page}>
      <Link href="/usuarios" className={styles.backLink}>
        ← {ehRhAdmin ? "Usuários" : "Minha equipe"}
      </Link>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Editar usuário</h1>
          <p className={styles.subtitle}>Ajuste os dados de {alvo.nome}.</p>
        </div>
      </header>

      <UsuarioForm
        modo="editar"
        atorRole={usuario.role}
        equipesDisponiveis={equipesDisponiveis}
        usuarioInicial={{
          id: alvo.id,
          nome: alvo.nome,
          email: alvo.email,
          role: alvo.role,
          equipe_id: alvo.equipe_id,
        }}
      />
    </main>
  );
}
