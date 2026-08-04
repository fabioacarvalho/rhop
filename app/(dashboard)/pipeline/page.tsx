import { redirect } from "next/navigation";
import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import { listarBoard } from "@/lib/services/pipelineService";
import * as tipoFluxoService from "@/lib/services/tipoFluxoService";
import { Role } from "@/lib/generated/prisma/client";
import KanbanBoard from "./_components/KanbanBoard";
import layout from "../dashboard.module.css";

/**
 * Tela Pipeline de Aprovações (PIPE-01 a PIPE-14, Screen 5) — Server
 * Component. Visual alinhado a `docs/design-ux-ui/fluxorh-ui-layout-specs.md`
 * (`#screen-pipeline`).
 *
 * Gate de acesso no backend, mesmo padrão de `solicitacoes/page.tsx`: sem
 * sessão -> `redirect('/login')`; papel fora de `[GESTOR, RH_ADMIN]` ->
 * "Acesso restrito" (sem vazar dados de solicitações).
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
        <main className={layout.restrito}>
          <h1>Acesso restrito</h1>
          <p>Você não tem permissão para acessar esta página.</p>
        </main>
      );
    }
    throw erro;
  }

  const [board, tiposFluxo] = await Promise.all([
    listarBoard(usuario, {}),
    tipoFluxoService.listar(),
  ]);

  const boardInicial = JSON.parse(JSON.stringify(board));

  return (
    <main className={layout.page}>
      <header className={layout.header}>
        <div>
          <h1 className={layout.title}>Pipeline de Aprovações</h1>
          <p className={layout.subtitle}>
            Todas as solicitações em andamento, organizadas por status.
          </p>
        </div>
      </header>

      <KanbanBoard
        boardInicial={boardInicial}
        tiposFluxo={tiposFluxo}
        papel={usuario.role as "GESTOR" | "RH_ADMIN"}
      />
    </main>
  );
}
