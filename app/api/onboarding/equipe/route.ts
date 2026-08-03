import {
  emailDominioValido,
  getSupabaseUser,
} from "@/lib/services/authService";
import {
  ErroValidacaoUsuario,
  provisionarViaGoogle,
} from "@/lib/services/userService";
import { onboardingEquipeInputSchema } from "@/lib/validations/onboarding";

/**
 * `POST /api/onboarding/equipe` (GAUTH-10) — unico ponto que efetivamente
 * cria o `User` a partir da escolha de equipe no onboarding obrigatorio.
 *
 * - Sem sessao Supabase -> 401, sem tocar Zod nem `userService`.
 * - Defesa em profundidade (`!emailDominioValido`) -> 403.
 * - Corpo invalido (`equipe_id` ausente) -> 400, `provisionarViaGoogle` nunca
 *   e chamado.
 * - `equipe_id` invalido/inativo (`ErroValidacaoUsuario`) -> 400.
 * - Corpo valido -> `provisionarViaGoogle` -> 201 com `{ usuario }`.
 */
export async function POST(request: Request) {
  const sessao = await getSupabaseUser();

  if (!sessao) {
    return Response.json({ error: "Nao autenticado." }, { status: 401 });
  }

  if (!emailDominioValido(sessao.email)) {
    return Response.json(
      { error: "Dominio de e-mail nao permitido." },
      { status: 403 },
    );
  }

  const corpo = await request.json();
  const resultado = onboardingEquipeInputSchema.safeParse(corpo);

  if (!resultado.success) {
    return Response.json(
      { error: "Dados invalidos.", detalhes: resultado.error.issues },
      { status: 400 },
    );
  }

  try {
    const usuario = await provisionarViaGoogle({
      id: sessao.id,
      nome: sessao.nome,
      email: sessao.email,
      equipe_id: resultado.data.equipe_id,
    });

    return Response.json({ usuario }, { status: 201 });
  } catch (erro) {
    if (erro instanceof ErroValidacaoUsuario) {
      return Response.json({ error: erro.message }, { status: 400 });
    }
    throw erro;
  }
}
