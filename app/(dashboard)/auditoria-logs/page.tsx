import { redirect } from "next/navigation";
import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import { Role } from "@/lib/generated/prisma/client";
import LogFiltros from "./_components/LogFiltros";
import LogTabela from "./_components/LogTabela";
import LogPaginacao from "./_components/LogPaginacao";

/**
 * Tela de Auditoria/Logs (AUD-05) — Server Component.
 *
 * Gate de acesso no backend, antes de montar qualquer componente que leria
 * logs — não é um botão/menu escondido no frontend, é a própria árvore de
 * componentes que nunca chega a existir para quem não é `RH_ADMIN`.
 *
 * - Sem sessão (`requireUser` lança `ErroNaoAutenticado`) -> `redirect('/login')`.
 *   `/login` ainda não existe como rota nesta sessão de execução (é escopo
 *   de outra feature/task), mas o comportamento correto já é redirecionar
 *   para lá — a rota vai existir antes deste código rodar em produção.
 * - Sessão válida, papel diferente de `RH_ADMIN` (`ErroNaoAutorizado`) ->
 *   nenhum dos três componentes (`LogFiltros`/`LogTabela`/`LogPaginacao`) é
 *   renderizado; a página devolve só uma mensagem "Acesso restrito".
 *
 * Decisão sobre `forbidden()`/`notFound()` (`next/navigation`): não usados
 * aqui. Nesta versão instalada do Next (16.2.12, ver
 * `node_modules/next/dist/docs/.../functions/forbidden.md`) `forbidden` e
 * `unauthorized` continuam documentados como **experimentais** e só
 * funcionam com `experimental.authInterrupts: true` em `next.config.ts` —
 * flag que não está habilitada no projeto (`next.config.ts` atual não tem
 * bloco `experimental`) e que está fora do escopo desta task alterar.
 * Chamar `forbidden()` sem o flag habilitado lança em runtime, então usá-lo
 * aqui seria introduzir uma dependência experimental não confirmada como
 * estável — exatamente o que a task pede para evitar. `notFound()` é
 * estável, mas seu contrato semântico é "recurso inexistente" (404), o que
 * não descreve o cenário (a rota existe, o usuário só não tem permissão) e
 * dificultaria diagnóstico caso o comportamento precise ser revisto depois.
 * A alternativa simples e idiomática no App Router estável — renderizar
 * uma mensagem de bloqueio diretamente no corpo da página, sem seguir para
 * o conteúdo protegido — cumpre AUD-05 (bloqueio real de dados, não só de
 * UI) sem depender de nenhuma API experimental.
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
      <h1>Auditoria e Logs</h1>
      <LogFiltros />
      <LogTabela />
      <LogPaginacao />
    </main>
  );
}
