import { redirect } from "next/navigation";
import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import { listarPendentes } from "@/lib/services/aprovacaoService";
import { Role } from "@/lib/generated/prisma/client";
import { AprovacaoCard } from "./_components/AprovacaoCard";
import styles from "./aprovacoes.module.css";

/**
 * Tela Aprovações Pendentes (APR-01, APR-05, APR-14, APR-17).
 * Visual alinhado a `docs/fluxorh-mockup.html` (#screen-aprovacoes).
 */
export default async function Page() {
  let usuario;
  try {
    usuario = await requireUser([Role.GESTOR, Role.RH_ADMIN]);
  } catch (erro) {
    if (erro instanceof Error && erro.name === "ErroNaoAutenticado") {
      redirect("/login");
    }
    if (erro instanceof Error && erro.name === "ErroNaoAutorizado") {
      return (
        <main className={styles.restrito}>
          <h1>Acesso restrito</h1>
          <p>Apenas gestores e RH podem acessar aprovações pendentes.</p>
        </main>
      );
    }
    throw erro;
  }

  const pendentes = await listarPendentes(usuario);
  const pendentesSerializados = JSON.parse(JSON.stringify(pendentes));
  const contagem = pendentesSerializados.length;
  const subtitulo =
    contagem === 0
      ? "Nada aguardando sua decisão no momento."
      : contagem === 1
        ? "1 solicitação aguardando sua decisão."
        : `${contagem} solicitações aguardando sua decisão.`;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.subtitle}>{subtitulo}</p>
        </div>
      </header>

      {pendentesSerializados.length === 0 ? (
        <p className={styles.empty}>Nenhuma aprovação pendente</p>
      ) : (
        <div className={styles.stack}>
          {pendentesSerializados.map((card: any) => (
            <AprovacaoCard key={card.solicitacao_id} card={card} />
          ))}
        </div>
      )}
    </main>
  );
}
