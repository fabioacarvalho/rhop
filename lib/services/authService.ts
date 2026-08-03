import { createServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { registrar } from "@/lib/services/logService";
import { Role } from "@/lib/generated/prisma/client";

/**
 * Identidade de negocio resolvida a partir da sessao Supabase + `User` do
 * Prisma (AUTH-06, AUTH-18).
 */
export interface AuthenticatedUser {
  id: string;
  nome: string;
  email: string;
  role: Role;
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
 * - Sessao valida + `User` existente -> `{ id, nome, email, role }`.
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

  if (user.ativo === false) {
    await registrar({
      tipo: "ERRO",
      entidade: "User",
      entidade_id: user.id,
      acao: "USUARIO_INATIVO",
      usuario_id: null,
      detalhes: { id: user.id, email: user.email },
    });
    return null;
  }

  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    role: user.role,
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

const DOMINIO_GOOGLE_PERMITIDO = "@01tec.com.br";

/** Checa se `email` termina em `@01tec.com.br` (case-insensitive, GAUTH-02). */
export function emailDominioValido(email: string | null | undefined): boolean {
  return Boolean(email?.toLowerCase().endsWith(DOMINIO_GOOGLE_PERMITIDO));
}

/** Sessao Supabase resolvida sem exigir `User` no Prisma — ver `getSupabaseUser`. */
export interface SupabaseSessionUser {
  id: string;
  email: string;
  nome: string;
}

/**
 * Resolve a sessao Supabase atual sem tocar Prisma — usado por
 * `/onboarding/equipe` (page e route), o unico trecho da aplicacao que
 * precisa lidar com "sessao Supabase valida, mas ainda sem `User`" (por
 * definicao, `getSessionUser()`/`requireUser()` nao servem para esse caso).
 *
 * `nome` usa `user_metadata.full_name ?? user_metadata.name ?? email` como
 * fallback, para o caso do provedor OAuth nao popular nome nenhum.
 */
export async function getSupabaseUser(): Promise<SupabaseSessionUser | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  const sessaoUser = data.user;
  const metadata = sessaoUser.user_metadata ?? {};
  const nome =
    (metadata.full_name as string | undefined) ??
    (metadata.name as string | undefined) ??
    sessaoUser.email ??
    "";

  return {
    id: sessaoUser.id,
    email: sessaoUser.email ?? "",
    nome,
  };
}

/** Resultado de `autenticarComGoogle` — decide o redirect do callback OAuth. */
export type ResultadoAuthGoogle =
  | { status: "permitido" }
  | { status: "onboarding_equipe" }
  | { status: "negado" };

/**
 * Decide o destino de uma sessao Google recem-criada (GAUTH-01, GAUTH-02):
 *
 * 1. `email` ausente, e-mail nao confirmado/verificado, ou fora do dominio
 *    `@01tec.com.br` -> `"negado"`, sem consultar o Prisma (short-circuit).
 * 2. `User` ja existe para esse `id` -> `"permitido"` (vinculo ja garantido
 *    pelo automatic identity linking do Supabase, ver `design.md`).
 * 3. `User` nao existe -> `"onboarding_equipe"` (precisa escolher `Equipe`
 *    antes de qualquer `User` ser criado).
 */
export async function autenticarComGoogle(supabaseUser: {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  user_metadata: Record<string, unknown>;
}): Promise<ResultadoAuthGoogle> {
  const emailVerificado =
    Boolean(supabaseUser.email_confirmed_at) &&
    supabaseUser.user_metadata.email_verified !== false;

  if (!emailVerificado || !emailDominioValido(supabaseUser.email)) {
    return { status: "negado" };
  }

  const user = await prisma.user.findUnique({
    where: { id: supabaseUser.id },
  });

  if (user) {
    return { status: "permitido" };
  }

  return { status: "onboarding_equipe" };
}
