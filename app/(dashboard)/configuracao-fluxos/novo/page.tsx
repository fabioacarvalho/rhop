import { redirect } from "next/navigation";
import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import { Role } from "@/lib/generated/prisma/client";
import TipoFluxoForm from "../_components/TipoFluxoForm";

/**
 * Tela de criação de `TipoFluxo` (CONF-01, CONF-07) — Server Component.
 *
 * Mesmo padrão de gate de acesso de `auditoria-logs/page.tsx` e da listagem
 * (`configuracao-fluxos/page.tsx`): a checagem roda no backend, antes de
 * renderizar qualquer coisa — quem não é `RH_ADMIN` nunca chega a ver o
 * `TipoFluxoForm`.
 *
 * - Sem sessão (`ErroNaoAutenticado`) -> `redirect('/login')`.
 * - Sessão válida, papel diferente de `RH_ADMIN` (`ErroNaoAutorizado`) ->
 *   mensagem "Acesso restrito", sem renderizar o formulário.
 *
 * Sem dados pré-existentes (é criação) -> `TipoFluxoForm` em `modo="criar"`,
 * sem `tipoFluxoId`/`initialData`.
 */
export default async function Page() {
  try {
    await requireUser([Role.RH_ADMIN]);
  } catch (erro) {
    if (erro instanceof ErroNaoAutenticado) {
      redirect("/login");
    }

    if (erro instanceof ErroNaoAutorizado) {
      return (
        <main style={{ padding: "2rem" }}>
          <h1>Acesso restrito</h1>
          <p>Você não tem permissão para acessar esta página.</p>
        </main>
      );
    }

    throw erro;
  }

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Novo tipo de fluxo</h1>
      <TipoFluxoForm modo="criar" />
    </main>
  );
}
