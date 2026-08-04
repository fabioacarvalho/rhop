import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Prisma, Role, type User } from "@/lib/generated/prisma/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrar } from "@/lib/services/logService";
import { resendService } from "@/lib/services/resendService";
import * as equipeService from "@/lib/services/equipeService";
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
 * Troca de `role` deixaria equipe(s) sem gestor capaz de gerir (EQP,
 * substitui a antiga contagem de subordinados diretos por `gestor_id`) —
 * rota converte em 409.
 */
export class ErroEdicaoBloqueadaUsuario extends Error {
  constructor(quantidade: number) {
    super(
      `Nao e possivel alterar o papel: ${quantidade} equipe(s) ficariam sem gestor.`,
    );
    this.name = "ErroEdicaoBloqueadaUsuario";
  }
}

const ROLES_VALIDOS = Object.values(Role) as string[];

/**
 * Entrada de `provisionar` — `id` e o mesmo id do usuario no Supabase Auth
 * (auth.users.id), sem `@default` no schema (decisao travada em
 * `design.md`). `equipe_id` ausente e tratado como `null` (so `SOLICITANTE`
 * pertence a uma `Equipe` — EQP-13).
 */
export interface ProvisionarInput {
  id: string;
  nome: string;
  email: string;
  role: Role | string;
  equipe_id?: string | null;
}

/**
 * Validacao de vinculo com `Equipe` compartilhada por `provisionar` (create)
 * e `editar` (update) — extraida para nao duplicar a mesma arvore de
 * decisao (EQP-10 a EQP-14):
 * 1. `role` precisa estar em `{ SOLICITANTE, GESTOR, RH_ADMIN }`.
 * 2. `equipe_id` e obrigatorio quando `role === 'SOLICITANTE'`.
 * 3. `equipe_id` e proibido para qualquer outro `role` (`GESTOR`/`RH_ADMIN`
 *    nao pertencem ao modelo de equipes como membros — decisao travada em
 *    `context.md`).
 * 4. `equipe_id` informado precisa referenciar uma `Equipe` existente e
 *    `ativo = true`.
 */
async function validarVinculoEquipe(
  role: Role | string,
  equipe_id: string | null,
): Promise<Role> {
  if (!ROLES_VALIDOS.includes(role as string)) {
    throw new ErroValidacaoUsuario(
      `role invalido "${String(role)}". Esperado um dos valores: ${ROLES_VALIDOS.join(", ")}.`,
    );
  }

  const roleValidado = role as Role;

  if (roleValidado !== Role.SOLICITANTE) {
    if (equipe_id) {
      throw new ErroValidacaoUsuario(
        `equipe_id nao e permitido para role "${roleValidado}" — apenas SOLICITANTE pertence a uma equipe.`,
      );
    }
    return roleValidado;
  }

  if (!equipe_id) {
    throw new ErroValidacaoUsuario(
      `equipe_id e obrigatorio para role "${roleValidado}".`,
    );
  }

  const equipe = await prisma.equipe.findUnique({ where: { id: equipe_id } });
  if (!equipe) {
    throw new ErroValidacaoUsuario(
      `equipe_id "${equipe_id}" nao corresponde a nenhuma equipe existente.`,
    );
  }
  if (!equipe.ativo) {
    throw new ErroValidacaoUsuario(
      `equipe_id "${equipe_id}" corresponde a uma equipe inativa.`,
    );
  }

  return roleValidado;
}

/**
 * Unico ponto de escrita de `User` via provisionamento direto (AUTH-05,
 * AUTH-08, AUTH-15, AUTH-16, AUTH-17) — usado pelo seed e reusado por
 * `cadastrar` (USR-01).
 */
export async function provisionar(input: ProvisionarInput): Promise<User> {
  const { id, nome, email, role, equipe_id } = input;
  const roleValidado = await validarVinculoEquipe(role, equipe_id ?? null);

  try {
    return await prisma.user.create({
      data: {
        id,
        nome,
        email,
        role: roleValidado,
        equipe_id: equipe_id ?? null,
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
  equipe_id: string | null;
}

/**
 * `RH_ADMIN` sempre pode agir; `GESTOR` so sobre `SOLICITANTE` de uma
 * `Equipe` que ele mesmo gerencia (EQP-11, EQP-16 a EQP-19 — 1 Gestor pode
 * gerenciar N `Equipe`s); qualquer outro papel nunca esta no escopo
 * (bloqueado antes, em `requireUser`).
 */
async function estaNoEscopo(
  ator: AuthenticatedUser,
  alvo: AlvoEscopo,
): Promise<boolean> {
  if (ator.role === Role.RH_ADMIN) {
    return true;
  }
  if (ator.role === Role.GESTOR) {
    if (alvo.role !== Role.SOLICITANTE || !alvo.equipe_id) {
      return false;
    }
    const equipesGeridas = await equipeService.listarGeridasPor(ator.id);
    return equipesGeridas.some((equipe) => equipe.id === alvo.equipe_id);
  }
  return false;
}

/**
 * Barreira unica entre "Gestor gerencia as propria equipes" e "Gestor
 * gerencia a base inteira" (EQP-11, EQP-16 a EQP-19, edicao/desativacao) —
 * usada por `editar`/`definirStatus` (alvo ja existe). Autoacao e bloqueada
 * para qualquer papel, antes mesmo da checagem de escopo.
 */
async function assertEscopoGestao(
  ator: AuthenticatedUser,
  alvo: AlvoEscopo,
): Promise<void> {
  if (alvo.id !== undefined && alvo.id === ator.id) {
    throw new ErroPermissaoUsuario(
      "Voce nao pode realizar esta acao sobre a propria conta.",
    );
  }
  if (!(await estaNoEscopo(ator, alvo))) {
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
  let equipeId: string | null;

  if (criador.role === Role.GESTOR) {
    // Alvo ainda nao existe: a checagem roda sobre o role/equipe_id
    // submetidos — a equipe precisa ser uma das que o proprio Gestor
    // gerencia (EQP-11); nao ha "forcar" um unico valor porque 1 Gestor
    // pode gerenciar N Equipes, diferente do antigo gestor_id 1:1.
    await assertEscopoGestao(criador, {
      role: dados.role,
      equipe_id: dados.equipe_id ?? null,
    });
    role = Role.SOLICITANTE;
    equipeId = dados.equipe_id ?? null;
  } else if (criador.role === Role.RH_ADMIN) {
    role = dados.role;
    equipeId = dados.equipe_id ?? null;
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
      equipe_id: equipeId,
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
 * Edita `nome`/`role`/`equipe_id` de um `User` (EQP-10 a EQP-14): valida
 * escopo do `editor` -> Gestor nunca pode mandar `role`/`equipe_id` (so
 * `nome`, mesma postura de `cadastro-usuarios`) -> bloqueio por equipe(s)
 * dependente(s) -> limpa `equipe_id` se o novo `role` nao for `SOLICITANTE`
 * -> revalida vinculo com `Equipe` se `role`/`equipe_id` mudarem -> grava
 * `AUDITORIA`.
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

  await assertEscopoGestao(editor, {
    id: alvo.id,
    role: alvo.role,
    equipe_id: alvo.equipe_id,
  });

  if (
    editor.role === Role.GESTOR &&
    (dados.role !== undefined || dados.equipe_id !== undefined)
  ) {
    throw new ErroPermissaoUsuario(
      "Gestor nao pode alterar role ou equipe_id de um usuario.",
    );
  }

  // Trocar o role de quem ainda gerencia Equipe(s) ativa(s) pra um papel
  // sem capacidade de gerir equipe deixaria essas Equipes sem gestor (EQP,
  // substitui a antiga contagem de subordinados diretos via gestor_id).
  if (
    dados.role !== undefined &&
    dados.role !== Role.GESTOR &&
    dados.role !== Role.RH_ADMIN
  ) {
    const equipesGeridas = await equipeService.contarGeridasAtivasPor(id);
    if (equipesGeridas > 0) {
      throw new ErroEdicaoBloqueadaUsuario(equipesGeridas);
    }
  }

  const novoRole = dados.role ?? alvo.role;
  // Role novo != SOLICITANTE nunca tem equipe_id (EQP-13/EQP-14) — limpa
  // automaticamente mesmo que dados.equipe_id nao tenha sido enviado.
  const novoEquipeId =
    novoRole !== Role.SOLICITANTE
      ? null
      : dados.equipe_id !== undefined
        ? dados.equipe_id
        : alvo.equipe_id;

  if (dados.role !== undefined || dados.equipe_id !== undefined) {
    await validarVinculoEquipe(novoRole, novoEquipeId);
  }

  const usuario = await prisma.user.update({
    where: { id },
    data: {
      ...(dados.nome !== undefined && { nome: dados.nome }),
      ...(dados.role !== undefined && { role: novoRole }),
      ...((dados.role !== undefined || dados.equipe_id !== undefined) && {
        equipe_id: novoEquipeId,
      }),
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

  await assertEscopoGestao(ator, {
    id: alvo.id,
    role: alvo.role,
    equipe_id: alvo.equipe_id,
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

/** Item de `listar()` — inclui o nome da equipe ja resolvido (EQP-17). */
export interface UsuarioResumo {
  id: string;
  nome: string;
  email: string;
  role: Role;
  equipe_id: string | null;
  equipe_nome: string | null;
  ativo: boolean;
}

/**
 * Lista usuarios visiveis ao `ator` (EQP-17): `RH_ADMIN` ve todos; `GESTOR`
 * ve so `SOLICITANTE` cuja `equipe_id` pertence a alguma `Equipe` que ele
 * gerencia (1 Gestor pode gerenciar N Equipes — diferente do antigo
 * `gestor_id` 1:1).
 */
export async function listar(ator: AuthenticatedUser): Promise<UsuarioResumo[]> {
  let where: Prisma.UserWhereInput;

  if (ator.role === Role.RH_ADMIN) {
    where = {};
  } else {
    const equipesGeridas = await equipeService.listarGeridasPor(ator.id);
    where = {
      role: Role.SOLICITANTE,
      equipe_id: { in: equipesGeridas.map((equipe) => equipe.id) },
    };
  }

  const usuarios = await prisma.user.findMany({
    where,
    include: { equipe: { select: { nome: true } } },
    orderBy: { nome: "asc" },
  });

  return usuarios.map((usuario) => ({
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    role: usuario.role,
    equipe_id: usuario.equipe_id,
    equipe_nome: usuario.equipe?.nome ?? null,
    ativo: usuario.ativo,
  }));
}

/** Item de `listarElegiveisComoGestor()` — usado para popular o `<select>` de gestor responsavel de uma `Equipe`. */
export interface UsuarioElegivelGestor {
  id: string;
  nome: string;
  role: Role;
}

/** Usuarios `GESTOR`/`RH_ADMIN` ativos, elegiveis para gerir uma `Equipe`. */
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
 * Entrada de `provisionarViaGoogle` — `equipe_id` ja escolhido pelo proprio
 * usuario no onboarding obrigatorio (GAUTH-10), nunca inferido.
 */
export interface ProvisionarViaGoogleInput {
  id: string;
  nome: string;
  email: string;
  equipe_id: string;
}

/**
 * Auto-provisiona um `User` (`role = SOLICITANTE`) a partir do primeiro
 * login Google sem cadastro previo (GAUTH-07 revisado, GAUTH-08): reusa
 * `provisionar` (mesma validacao de `equipe_id`), idempotente para reenvio
 * duplicado/corrida entre abas, e grava `Log AUDITORIA` so na criacao nova.
 */
export async function provisionarViaGoogle(
  input: ProvisionarViaGoogleInput,
): Promise<User> {
  const existente = await prisma.user.findUnique({
    where: { id: input.id },
  });
  if (existente) {
    return existente;
  }

  let usuario: User;
  try {
    usuario = await provisionar({
      id: input.id,
      nome: input.nome,
      email: input.email,
      role: Role.SOLICITANTE,
      equipe_id: input.equipe_id,
    });
  } catch (erro) {
    if (erro instanceof ErroValidacaoUsuario) {
      // Corrida entre duas requisicoes simultaneas: a outra pode ter
      // vencido e criado o `User` entre o `findUnique` acima e este
      // `create`. Re-checa por `id` antes de repropagar.
      const criadoPelaOutraRequisicao = await prisma.user.findUnique({
        where: { id: input.id },
      });
      if (criadoPelaOutraRequisicao) {
        return criadoPelaOutraRequisicao;
      }
    }
    throw erro;
  }

  await registrar({
    tipo: "AUDITORIA",
    entidade: "User",
    entidade_id: usuario.id,
    acao: "CRIACAO_AUTO_GOOGLE",
    usuario_id: null,
    detalhes: { email: usuario.email, equipe_id: input.equipe_id, origem: "google" },
  });

  return usuario;
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
    !(await estaNoEscopo(ator, {
      role: usuario.role,
      equipe_id: usuario.equipe_id,
    }))
  ) {
    throw new ErroNaoEncontradoUsuario();
  }

  return usuario;
}
