import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Prisma, Role, type User } from "@/lib/generated/prisma/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrar } from "@/lib/services/logService";
import { resendService } from "@/lib/services/resendService";
import type { AuthenticatedUser } from "@/lib/services/authService";
import type {
  CadastrarUsuarioInput,
  EditarUsuarioInput,
} from "@/lib/validations/usuario";

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

/** `id` de `User` sem registro correspondente — rota converte em 404. */
export class ErroNaoEncontradoUsuario extends Error {
  constructor(message = "Usuario nao encontrado.") {
    super(message);
    this.name = "ErroNaoEncontradoUsuario";
  }
}

/**
 * Ator fora do escopo de gestao sobre o alvo, ou tentando agir sobre a
 * propria conta — rota converte em 403.
 */
export class ErroPermissaoUsuario extends Error {
  constructor(message = "Voce nao tem permissao para esta operacao.") {
    super(message);
    this.name = "ErroPermissaoUsuario";
  }
}

/**
 * Troca de `role` deixaria subordinados sem gestor capaz de gerir equipe —
 * rota converte em 409.
 */
export class ErroEdicaoBloqueadaUsuario extends Error {
  constructor(quantidade: number) {
    super(
      `Nao e possivel alterar o papel: ${quantidade} usuario(s) subordinado(s) ficariam sem gestor.`,
    );
    this.name = "ErroEdicaoBloqueadaUsuario";
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
 * Validacao de hierarquia compartilhada por `provisionar` (create) e
 * `editar` (update) — extraida para nao duplicar a mesma arvore de decisao:
 * 1. `role` precisa estar em `{ SOLICITANTE, GESTOR, RH_ADMIN }`.
 * 2. `gestor_id` nulo/ausente so e aceito quando `role === 'RH_ADMIN'`.
 * 3. `gestor_id === id` (auto-referencia) e rejeitado.
 * 4. `gestor_id` informado precisa referenciar um `User` existente.
 */
async function validarHierarquia(input: {
  id: string;
  role: Role | string;
  gestor_id: string | null;
}): Promise<Role> {
  const { id, role, gestor_id } = input;

  if (!ROLES_VALIDOS.includes(role as string)) {
    throw new ErroValidacaoUsuario(
      `role invalido "${String(role)}". Esperado um dos valores: ${ROLES_VALIDOS.join(", ")}.`,
    );
  }

  const roleValidado = role as Role;

  if (gestor_id === null && roleValidado !== Role.RH_ADMIN) {
    throw new ErroValidacaoUsuario(
      `gestor_id e obrigatorio para role "${roleValidado}" — apenas RH_ADMIN pode ter gestor_id nulo.`,
    );
  }

  if (gestor_id !== null) {
    if (gestor_id === id) {
      throw new ErroValidacaoUsuario(
        "gestor_id nao pode ser igual ao id do proprio usuario (auto-referencia).",
      );
    }

    const gestor = await prisma.user.findUnique({ where: { id: gestor_id } });
    if (!gestor) {
      throw new ErroValidacaoUsuario(
        `gestor_id "${gestor_id}" nao corresponde a nenhum usuario existente.`,
      );
    }
  }

  return roleValidado;
}

/**
 * Unico ponto de escrita de `User` via provisionamento direto (AUTH-05,
 * AUTH-08, AUTH-15, AUTH-16, AUTH-17) — usado pelo seed e reusado por
 * `cadastrar` (USR-01).
 */
export async function provisionar(input: ProvisionarInput): Promise<User> {
  const { id, nome, email, role, gestor_id } = input;
  const roleValidado = await validarHierarquia({
    id,
    role,
    gestor_id: gestor_id ?? null,
  });

  try {
    return await prisma.user.create({
      data: {
        id,
        nome,
        email,
        role: roleValidado,
        gestor_id: gestor_id ?? null,
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

interface AlvoEscopo {
  /** Ausente em `cadastrar` — o alvo ainda nao existe. */
  id?: string;
  role: Role;
  gestor_id: string | null;
}

/**
 * `RH_ADMIN` sempre pode agir; `GESTOR` so sobre `SOLICITANTE` da propria
 * equipe (`gestor_id === ator.id`); qualquer outro papel nunca esta no
 * escopo (bloqueado antes, em `requireUser`).
 */
function estaNoEscopo(ator: AuthenticatedUser, alvo: AlvoEscopo): boolean {
  if (ator.role === Role.RH_ADMIN) {
    return true;
  }
  if (ator.role === Role.GESTOR) {
    return alvo.role === Role.SOLICITANTE && alvo.gestor_id === ator.id;
  }
  return false;
}

/**
 * Barreira unica entre "Gestor gerencia a propria equipe" e "Gestor
 * gerencia a base inteira" (USR-06 a USR-09, USR-16 a USR-19, USR-21,
 * USR-22, USR-25) — usada por `editar`/`definirStatus` (alvo ja existe).
 * Autoacao e bloqueada para qualquer papel, antes mesmo da checagem de
 * escopo.
 */
function assertEscopoGestao(ator: AuthenticatedUser, alvo: AlvoEscopo): void {
  if (alvo.id !== undefined && alvo.id === ator.id) {
    throw new ErroPermissaoUsuario(
      "Voce nao pode realizar esta acao sobre a propria conta.",
    );
  }
  if (!estaNoEscopo(ator, alvo)) {
    throw new ErroPermissaoUsuario();
  }
}

/** ~12 caracteres alfanumericos (base64url de 9 bytes) — ver "Nota de incerteza" em `design.md`. */
function gerarSenhaTemporaria(): string {
  return randomBytes(9).toString("base64url");
}

/**
 * Cadastra um `User` (USR-01 a USR-04, USR-06 a USR-12): valida escopo do
 * `criador` -> gera senha temporaria -> `admin.createUser` -> `provisionar`
 * (reuso) -> falha do `provisionar` desfaz a conta Auth ja criada (USR-11)
 * -> envia e-mail (falha nao desfaz nada, USR-12) -> grava `AUDITORIA`.
 */
export async function cadastrar(
  dados: CadastrarUsuarioInput,
  criador: AuthenticatedUser,
): Promise<{ usuario: User; emailEnviado: boolean }> {
  let role: Role;
  let gestorId: string | null;

  if (criador.role === Role.GESTOR) {
    // Alvo ainda nao existe: a checagem roda sobre o role submetido; o
    // gestor_id efetivo e sempre forcado para o proprio criador, ignorando
    // qualquer valor enviado (USR-07, USR-08).
    assertEscopoGestao(criador, { role: dados.role, gestor_id: criador.id });
    role = Role.SOLICITANTE;
    gestorId = criador.id;
  } else if (criador.role === Role.RH_ADMIN) {
    role = dados.role;
    gestorId = dados.gestor_id ?? null;
  } else {
    throw new ErroPermissaoUsuario();
  }

  const senhaTemporaria = gerarSenhaTemporaria();
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email: dados.email,
    password: senhaTemporaria,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(
      `Falha ao criar usuario no Supabase Auth: ${error?.message ?? "resposta sem usuario"}.`,
    );
  }

  const authUserId = data.user.id;

  let usuario: User;
  try {
    usuario = await provisionar({
      id: authUserId,
      nome: dados.nome,
      email: dados.email,
      role,
      gestor_id: gestorId,
    });
  } catch (erro) {
    // Compensacao (USR-11): sem isso, uma conta orfa fica no Supabase Auth.
    await admin.auth.admin.deleteUser(authUserId);
    throw erro;
  }

  const emailEnviado = await resendService.enviarEmail({
    to: usuario.email,
    subject: "Bem-vindo ao FluxoRH — sua senha temporaria",
    text: `Ola ${usuario.nome},\n\nSua conta no FluxoRH foi criada. Senha temporaria: ${senhaTemporaria}\n\nAcesse o sistema e altere sua senha no primeiro login.`,
    entidade_id: usuario.id,
  });

  await registrar({
    tipo: "AUDITORIA",
    entidade: "User",
    entidade_id: usuario.id,
    acao: "CRIACAO",
    usuario_id: criador.id,
  });

  return { usuario, emailEnviado };
}

/**
 * Edita `nome`/`role`/`gestor_id` de um `User` (USR-16 a USR-20): valida
 * escopo do `editor` -> Gestor nunca pode mandar `role`/`gestor_id`
 * (USR-18) -> bloqueio por equipe dependente (USR-20) -> revalida
 * hierarquia se `role`/`gestor_id` mudarem -> grava `AUDITORIA`.
 */
export async function editar(
  id: string,
  dados: EditarUsuarioInput,
  editor: AuthenticatedUser,
): Promise<User> {
  const alvo = await prisma.user.findUnique({ where: { id } });
  if (!alvo) {
    throw new ErroNaoEncontradoUsuario();
  }

  assertEscopoGestao(editor, {
    id: alvo.id,
    role: alvo.role,
    gestor_id: alvo.gestor_id,
  });

  if (
    editor.role === Role.GESTOR &&
    (dados.role !== undefined || dados.gestor_id !== undefined)
  ) {
    throw new ErroPermissaoUsuario(
      "Gestor nao pode alterar role ou gestor_id de um usuario.",
    );
  }

  if (dados.role !== undefined && dados.role === Role.SOLICITANTE) {
    const subordinados = await prisma.user.count({ where: { gestor_id: id } });
    if (subordinados > 0) {
      throw new ErroEdicaoBloqueadaUsuario(subordinados);
    }
  }

  const novoRole = dados.role ?? alvo.role;
  const novoGestorId =
    dados.gestor_id !== undefined ? dados.gestor_id : alvo.gestor_id;

  if (dados.role !== undefined || dados.gestor_id !== undefined) {
    await validarHierarquia({ id, role: novoRole, gestor_id: novoGestorId });
  }

  const usuario = await prisma.user.update({
    where: { id },
    data: {
      ...(dados.nome !== undefined && { nome: dados.nome }),
      ...(dados.role !== undefined && { role: novoRole }),
      ...(dados.gestor_id !== undefined && { gestor_id: novoGestorId }),
    },
  });

  await registrar({
    tipo: "AUDITORIA",
    entidade: "User",
    entidade_id: usuario.id,
    acao: "EDICAO",
    usuario_id: editor.id,
  });

  return usuario;
}

/**
 * Ativa/desativa um `User` (USR-21, USR-22, USR-24, USR-25) — mesma
 * checagem de escopo/autoacao de `editar`.
 */
export async function definirStatus(
  id: string,
  ativo: boolean,
  ator: AuthenticatedUser,
): Promise<User> {
  const alvo = await prisma.user.findUnique({ where: { id } });
  if (!alvo) {
    throw new ErroNaoEncontradoUsuario();
  }

  assertEscopoGestao(ator, {
    id: alvo.id,
    role: alvo.role,
    gestor_id: alvo.gestor_id,
  });

  const usuario = await prisma.user.update({ where: { id }, data: { ativo } });

  await registrar({
    tipo: "AUDITORIA",
    entidade: "User",
    entidade_id: usuario.id,
    acao: ativo ? "REATIVACAO" : "DESATIVACAO",
    usuario_id: ator.id,
  });

  return usuario;
}

/** Item de `listar()` — inclui o nome do gestor ja resolvido (USR-13/14). */
export interface UsuarioResumo {
  id: string;
  nome: string;
  email: string;
  role: Role;
  gestor_id: string | null;
  gestor_nome: string | null;
  ativo: boolean;
}

/**
 * Lista usuarios visiveis ao `ator` (USR-13, USR-14): `RH_ADMIN` ve todos;
 * `GESTOR` ve so `SOLICITANTE` com `gestor_id = ator.id`.
 */
export async function listar(ator: AuthenticatedUser): Promise<UsuarioResumo[]> {
  const where: Prisma.UserWhereInput =
    ator.role === Role.RH_ADMIN
      ? {}
      : { role: Role.SOLICITANTE, gestor_id: ator.id };

  const usuarios = await prisma.user.findMany({
    where,
    include: { gestor: { select: { nome: true } } },
    orderBy: { nome: "asc" },
  });

  return usuarios.map((usuario) => ({
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    role: usuario.role,
    gestor_id: usuario.gestor_id,
    gestor_nome: usuario.gestor?.nome ?? null,
    ativo: usuario.ativo,
  }));
}

/** Item de `listarElegiveisComoGestor()` — usado para popular o `<select>` de `gestor_id`. */
export interface UsuarioElegivelGestor {
  id: string;
  nome: string;
  role: Role;
}

/** Usuarios `GESTOR`/`RH_ADMIN` ativos, elegiveis para receber subordinados. */
export async function listarElegiveisComoGestor(): Promise<
  UsuarioElegivelGestor[]
> {
  return prisma.user.findMany({
    where: { role: { in: [Role.GESTOR, Role.RH_ADMIN] }, ativo: true },
    select: { id: true, nome: true, role: true },
    orderBy: { nome: "asc" },
  });
}

/**
 * Busca um `User` completo por `id`, aplicando o mesmo escopo de `listar`
 * (usado pela pagina de edicao). Fora do escopo do `GESTOR` -> mesmo erro
 * de "nao encontrado" (nao revela existencia do registro).
 */
export async function buscarPorId(
  id: string,
  ator: AuthenticatedUser,
): Promise<User> {
  const usuario = await prisma.user.findUnique({ where: { id } });
  if (!usuario) {
    throw new ErroNaoEncontradoUsuario();
  }

  if (
    !estaNoEscopo(ator, { role: usuario.role, gestor_id: usuario.gestor_id })
  ) {
    throw new ErroNaoEncontradoUsuario();
  }

  return usuario;
}
