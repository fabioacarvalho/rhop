import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import { buscarPorId, ErroNaoEncontrado } from "@/lib/services/tipoFluxoService";
import { Role } from "@/lib/generated/prisma/client";
import type {
  CampoFormularioDefinicao,
  PapelAprovador,
  TipoFluxoInput,
} from "@/lib/validations/tipoFluxo";
import TipoFluxoForm from "../../_components/TipoFluxoForm";
import styles from "../../configuracao-fluxos.module.css";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Tela de edição de `TipoFluxo` (CONF-01, CONF-07) — Server Component.
 *
 * Mesmo padrão de gate de acesso das demais telas desta feature: a checagem
 * roda no backend, antes de qualquer leitura de `TipoFluxo` — quem não é
 * `RH_ADMIN` nunca chega a disparar `tipoFluxoService.buscarPorId()`.
 *
 * - Sem sessão (`ErroNaoAutenticado`) -> `redirect('/login')`.
 * - Sessão válida, papel diferente de `RH_ADMIN` (`ErroNaoAutorizado`) ->
 *   mensagem "Acesso restrito", sem tocar o service.
 *
 * `tipoFluxoService.buscarPorId(id)` é chamado direto aqui (Server
 * Component), sem round-trip por `GET /api/tipos-fluxo/[id]`, para
 * pré-carregar os dados que alimentam `initialData` do `TipoFluxoForm` —
 * mesma decisão de acesso direto ao service já usada na listagem (T5).
 *
 * `id` sem `TipoFluxo` correspondente (`ErroNaoEncontrado`) -> `notFound()`
 * (404 nativo do Next), diferente do gate de papel: aqui a rota realmente
 * não tem o que exibir, então o contrato semântico de "recurso inexistente"
 * se aplica (ao contrário do bloqueio por papel, que é "acesso restrito").
 *
 * `campos_formulario`/`etapas` vêm do Prisma como `Json` — convertidos aqui
 * para `CampoFormularioDefinicao[]`/`PapelAprovador[]` (tipos já validados
 * na escrita por `tipoFluxoInputSchema`, nunca gravados fora do formato) para
 * montar o `TipoFluxoInput` completo esperado por `initialData`.
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

  let tipoFluxo;
  try {
    tipoFluxo = await buscarPorId(id);
  } catch (erro) {
    if (erro instanceof ErroNaoEncontrado) {
      notFound();
    }
    throw erro;
  }

  const initialData: TipoFluxoInput = {
    nome: tipoFluxo.nome,
    campos_formulario: tipoFluxo.campos_formulario as CampoFormularioDefinicao[],
    etapas: tipoFluxo.etapas as PapelAprovador[],
  };

  return (
    <main className={styles.page}>
      <Link href="/configuracao-fluxos" className={styles.backLink}>
        ← Configuração de Fluxos
      </Link>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Editar tipo de fluxo</h1>
          <p className={styles.subtitle}>
            Ajuste o nome, as etapas de aprovação e os campos do formulário de{" "}
            {tipoFluxo.nome}.
          </p>
        </div>
      </header>

      <TipoFluxoForm modo="editar" tipoFluxoId={id} initialData={initialData} />
    </main>
  );
}
