import { createServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { registrar } from "@/lib/services/logService";
import { Role } from "@/lib/generated/prisma/client";

/**
 * Identidade de negocio resolvida a partir da sessao Supabase + `User` do
 * Prisma (AUTH-06, AUTH-18 — inclui `gestor_id` para as regras de
 * visibilidade/autorizacao consumidas por outras features).
 */
export interface AuthenticatedUser {
  id: string;
  nome: string;
  email: string;
  role: Role;
  gestor_id: string | null;
}

/**
 * Sinaliza "sem sessao Supabase" ou "sessao sem `User` correspondente" —
 * quem chama `requireUser` deve converter isso em `401`.
 */
export class ErroNaoAutenticado extends Error {
  constructor(message = "Usuario nao autenticado.") {
    super(message);
    this.name = "ErroNaoAutenticado";
  }
}

/**
 * Sinaliza sessao/`User` validos, mas `role` fora da lista permitida pela
 * rota — quem chama `requireUser` deve converter isso em `403`.
 */
export class ErroNaoAutorizado extends Error {
  constructor(message = "Usuario nao tem permissao para esta operacao.") {
    super(message);
    this.name = "ErroNaoAutorizado";
  }
}

/**
 * Resolve o `User` (Prisma) correspondente a sessao Supabase atual.
 *
 * - Sem sessao Supabase valida -> `null` (AUTH-06), sem tocar `logService`.
 * - Sessao valida mas sem `User` correspondente no Prisma -> `null` (AUTH-06),
 *   e grava `Log` tipo `ERRO` via `logService.registrar` antes de retornar
 *   (AUTH-07). A falha nunca trava o fluxo do chamador: `logService.registrar`
 *   ja contem qualquer erro de persistencia internamente.
 * - Sessao valida + `User` existente -> `{ id, nome, email, role, gestor_id }`.
 */
export async function getSessionUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  const sessaoUser = data.user;

  const user = await prisma.user.findUnique({
    where: { id: sessaoUser.id },
  });

  if (!user) {
    await registrar({
      tipo: "ERRO",
      entidade: "User",
      entidade_id: sessaoUser.id,
      acao: "SESSAO_SEM_USUARIO",
      usuario_id: null,
      detalhes: {
        supabase_user_id: sessaoUser.id,
        email: sessaoUser.email ?? null,
      },
    });
    return null;
  }

  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    role: user.role,
    gestor_id: user.gestor_id,
  };
}

/**
 * Usado por route handlers para exigir autenticacao (e, opcionalmente, um
 * papel especifico) antes de executar a logica de negocio da rota.
 *
 * - Sem sessao/`User` (`getSessionUser()` retornou `null`) -> lanca
 *   `ErroNaoAutenticado` (rota converte em `401`).
 * - `roles` informado e `role` do usuario fora da lista -> lanca
 *   `ErroNaoAutorizado` (rota converte em `403`).
 * - Passou nas duas checagens -> retorna o `AuthenticatedUser`.
 */
export async function requireUser(
  roles?: Role[],
): Promise<AuthenticatedUser> {
  const user = await getSessionUser();

  if (!user) {
    throw new ErroNaoAutenticado();
  }

  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    throw new ErroNaoAutorizado();
  }

  return user;
}
