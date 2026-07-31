import Link from "next/link";
import { redirect } from "next/navigation";
import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import { listar } from "@/lib/services/tipoFluxoService";
import { Role } from "@/lib/generated/prisma/client";

/**
 * Tela de Configuração de Fluxos (CONF-01, CONF-06) — Server Component.
 *
 * Mesmo padrão de gate de acesso de `auditoria-logs/page.tsx`: a checagem
 * roda no backend, antes de qualquer leitura de `TipoFluxo` — quem não é
 * `RH_ADMIN` nunca chega a disparar `tipoFluxoService.listar()`.
 *
 * - Sem sessão (`ErroNaoAutenticado`) -> `redirect('/login')`.
 * - Sessão válida, papel diferente de `RH_ADMIN` (`ErroNaoAutorizado`) ->
 *   mensagem "Acesso restrito", sem renderizar a lista.
 *
 * Diferente de `auditoria-logs`, esta tela não tem filtro/paginação, então
 * `tipoFluxoService.listar()` é chamado direto aqui (Server Component), sem
 * round-trip por `GET /api/tipos-fluxo` e sem Client Component de listagem.
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

  const tiposFluxo = await listar();

  return (
    <main style={{ padding: "2rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <h1>Configuração de Fluxos</h1>
        <Link href="/configuracao-fluxos/novo">Novo tipo de fluxo</Link>
      </div>

      {tiposFluxo.length === 0 ? (
        <p>Nenhum tipo de fluxo cadastrado ainda.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {tiposFluxo.map((tipoFluxo) => (
            <li
              key={tipoFluxo.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.75rem 0",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <span>{tipoFluxo.nome}</span>
              <Link href={`/configuracao-fluxos/${tipoFluxo.id}/editar`}>
                Editar
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
