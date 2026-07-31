import { prisma } from "@/lib/prisma";
import { Prisma, Role, type User } from "@/lib/generated/prisma/client";

/**
 * Sinaliza qualquer violacao das regras de integridade de `User` antes da
 * escrita (AUTH-05, AUTH-08, AUTH-15, AUTH-16, AUTH-17) — nunca deixa o erro
 * bruto do Prisma (ex.: `P2002`) vazar para quem chamou `provisionar`.
 */
export class ErroValidacaoUsuario extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErroValidacaoUsuario";
  }
}

const ROLES_VALIDOS = Object.values(Role) as string[];

/**
 * Entrada de `provisionar` — `id` e o mesmo id do usuario no Supabase Auth
 * (auth.users.id), sem `@default` no schema (decisao travada em
 * `design.md`). `gestor_id` ausente e tratado como `null`.
 */
export interface ProvisionarInput {
  id: string;
  nome: string;
  email: string;
  role: Role | string;
  gestor_id?: string | null;
}

/**
 * Unico ponto de escrita de `User` (AUTH-05, AUTH-08, AUTH-15, AUTH-16,
 * AUTH-17) — valida a hierarquia por completo antes de qualquer
 * `prisma.user.create`, para nunca persistir um `User` inconsistente.
 *
 * Ordem de validacao (todas antes da escrita):
 * 1. `role` precisa estar em `{ SOLICITANTE, GESTOR, RH_ADMIN }` (AUTH-05).
 * 2. `gestor_id` nulo/ausente so e aceito quando `role === 'RH_ADMIN'`
 *    (AUTH-16); qualquer outro papel exige `gestor_id` (AUTH-15).
 * 3. `gestor_id === id` (auto-referencia) e rejeitado (AUTH-17).
 * 4. `gestor_id` informado precisa referenciar um `User` existente —
 *    checado via `prisma.user.findUnique` ANTES do `create`, sem depender
 *    apenas da FK do banco (AUTH-15).
 * 5. `email` duplicado: deixado para a constraint `@unique` do Prisma, mas
 *    o erro `P2002` e capturado e traduzido para `ErroValidacaoUsuario`
 *    (AUTH-08) — nunca propaga o erro bruto do Prisma.
 */
export async function provisionar(input: ProvisionarInput): Promise<User> {
  const { id, nome, email, role, gestor_id } = input;

  if (!ROLES_VALIDOS.includes(role)) {
    throw new ErroValidacaoUsuario(
      `role invalido "${String(role)}". Esperado um dos valores: ${ROLES_VALIDOS.join(", ")}.`,
    );
  }

  const roleValidado = role as Role;
  const gestorId = gestor_id ?? null;

  if (gestorId === null && roleValidado !== Role.RH_ADMIN) {
    throw new ErroValidacaoUsuario(
      `gestor_id e obrigatorio para role "${roleValidado}" — apenas RH_ADMIN pode ter gestor_id nulo.`,
    );
  }

  if (gestorId !== null) {
    if (gestorId === id) {
      throw new ErroValidacaoUsuario(
        "gestor_id nao pode ser igual ao id do proprio usuario (auto-referencia).",
      );
    }

    const gestor = await prisma.user.findUnique({ where: { id: gestorId } });
    if (!gestor) {
      throw new ErroValidacaoUsuario(
        `gestor_id "${gestorId}" nao corresponde a nenhum usuario existente.`,
      );
    }
  }

  try {
    return await prisma.user.create({
      data: {
        id,
        nome,
        email,
        role: roleValidado,
        gestor_id: gestorId,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ErroValidacaoUsuario(`email "${email}" ja esta cadastrado.`);
    }
    throw error;
  }
}
