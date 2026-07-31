/**
 * scripts/seed-users.ts
 *
 * T13 de `.specs/features/autenticacao-usuarios/tasks.md`.
 *
 * Cria usuarios de teste no Supabase Auth (`admin.createUser`, com a
 * service role key) e o `User` correspondente no Prisma via
 * `userService.provisionar`, na ordem certa para resolver a hierarquia
 * (quem nao tem `gestor_email` primeiro — ver `USUARIOS` abaixo).
 *
 * Uso:
 *   npm run seed
 *
 * Idempotencia:
 * - Se o e-mail ja existir no Supabase Auth, a criacao e' pulada e o `id`
 *   existente e' localizado via `admin.listUsers()` (necessario para
 *   resolver o `gestor_id` de quem depende desse usuario).
 * - Se o `User` correspondente ja existir no Prisma (mesmo `id` ou mesmo
 *   `email`), `userService.provisionar` traduz o conflito (`P2002`) em
 *   `ErroValidacaoUsuario`, que este script trata como "ja existe" em vez
 *   de quebrar a execucao.
 *
 * ATENCAO: este script grava usuarios REAIS no projeto Supabase configurado
 * em `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (`.env`). Nao
 * rodar contra um projeto de producao. As credenciais abaixo sao apenas
 * para ambiente de desenvolvimento/teste — nao sao segredos reais.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { Role } from "@/lib/generated/prisma/client";
import { ErroValidacaoUsuario, provisionar } from "@/lib/services/userService";

// ---------------------------------------------------------------------------
// Lista de usuarios de seed — editar aqui para adicionar/remover usuarios.
//
// Regras (ver userService.provisionar):
// - Apenas RH_ADMIN pode ficar sem `gestor_email`.
// - `gestor_email` precisa apontar para um usuario que aparece ANTES na
//   lista (o script resolve `gestor_email -> gestor_id` na ordem de
//   execucao, sem consultar o banco).
//
// Senha de teste unica para todos os usuarios (NAO e' credencial de
// producao, apenas seed de dev): "Teste@123"
// ---------------------------------------------------------------------------
const SENHA_TESTE = "Teste@123";

interface UsuarioSeed {
  nome: string;
  email: string;
  senha_temporaria: string;
  role: Role;
  /** E-mail do gestor, deve aparecer antes deste item na lista. Ausente = sem gestor (só RH_ADMIN). */
  gestor_email?: string;
}

const USUARIOS: UsuarioSeed[] = [
  {
    nome: "RH Admin",
    email: "rh.admin@rhop.test",
    senha_temporaria: SENHA_TESTE,
    role: Role.RH_ADMIN,
  },
  {
    nome: "Gestor de Equipe",
    email: "gestor@rhop.test",
    senha_temporaria: SENHA_TESTE,
    role: Role.GESTOR,
    gestor_email: "rh.admin@rhop.test",
  },
  {
    nome: "Solicitante Teste",
    email: "solicitante@rhop.test",
    senha_temporaria: SENHA_TESTE,
    role: Role.SOLICITANTE,
    gestor_email: "gestor@rhop.test",
  },
];

// ---------------------------------------------------------------------------

interface Resumo {
  criadosAuth: number;
  jaExistentesAuth: number;
  provisionados: number;
  jaExistentesUser: number;
  erros: number;
}

/**
 * Erros da API do Supabase Auth para e-mail duplicado carregam
 * `code: "email_exists"` (ver @supabase/auth-js/src/lib/error-codes.ts).
 * Alguns ambientes/versoes mais antigas do GoTrue nao preenchem `code` —
 * a mensagem "already been registered" cobre esse caso como fallback.
 */
function isEmailJaExistente(error: { code?: string | null; message?: string }): boolean {
  if (error.code === "email_exists" || error.code === "user_already_exists") {
    return true;
  }
  return /already.*registered/i.test(error.message ?? "");
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar definidos (.env) para rodar o seed.",
    );
  }

  // Cliente administrativo direto (service role) — sem cookies/sessão,
  // por isso `@supabase/supabase-js` puro em vez de `@supabase/ssr`.
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  /**
   * Localiza o id de um usuario existente no Supabase Auth por e-mail.
   * `admin.listUsers()` nao aceita filtro por e-mail nesta versao do SDK —
   * paginamos até achar o usuario ou esgotar as páginas. Fecha sobre
   * `supabase` (em vez de recebe-lo por parametro) para nao precisar
   * escrever a assinatura de tipo do client — os generics default de
   * `SupabaseClient` variam entre `typeof createClient` e a instancia real.
   */
  async function buscarUsuarioAuthPorEmail(email: string): Promise<{ id: string } | null> {
    let page = 1;
    const perPage = 200;

    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
      if (error) {
        console.error(`  Falha ao listar usuarios do Supabase Auth: ${error.message}`);
        return null;
      }

      const encontrado = data.users.find(
        (usuarioAuth) => usuarioAuth.email?.toLowerCase() === email.toLowerCase(),
      );
      if (encontrado) {
        return { id: encontrado.id };
      }

      if (data.users.length === 0 || !data.nextPage) {
        return null;
      }
      page = data.nextPage;
    }
  }

  const idPorEmail = new Map<string, string>();
  const resumo: Resumo = {
    criadosAuth: 0,
    jaExistentesAuth: 0,
    provisionados: 0,
    jaExistentesUser: 0,
    erros: 0,
  };

  console.log(`Iniciando seed de ${USUARIOS.length} usuario(s)...\n`);

  for (const usuario of USUARIOS) {
    console.log(`- ${usuario.email} (${usuario.role})`);

    let authUserId: string;

    const { data, error } = await supabase.auth.admin.createUser({
      email: usuario.email,
      password: usuario.senha_temporaria,
      email_confirm: true,
    });

    if (error) {
      if (!isEmailJaExistente(error)) {
        console.error(`  Falha ao criar no Supabase Auth: ${error.message}`);
        resumo.erros += 1;
        continue;
      }

      console.log("  Ja existe no Supabase Auth, pulando criacao...");
      resumo.jaExistentesAuth += 1;

      const existente = await buscarUsuarioAuthPorEmail(usuario.email);
      if (!existente) {
        console.error(
          `  Nao foi possivel localizar o id existente de "${usuario.email}" via listUsers() — pulando usuario.`,
        );
        resumo.erros += 1;
        continue;
      }
      authUserId = existente.id;
    } else if (data.user) {
      authUserId = data.user.id;
      console.log(`  Criado no Supabase Auth (id: ${authUserId}).`);
      resumo.criadosAuth += 1;
    } else {
      console.error(`  createUser nao retornou usuario nem erro para "${usuario.email}" — pulando.`);
      resumo.erros += 1;
      continue;
    }

    idPorEmail.set(usuario.email, authUserId);

    let gestorId: string | null = null;
    if (usuario.gestor_email) {
      const gestorEncontrado = idPorEmail.get(usuario.gestor_email);
      if (!gestorEncontrado) {
        console.error(
          `  gestor_email "${usuario.gestor_email}" ainda nao foi processado nesta execucao — verifique a ordem da lista USUARIOS. Pulando provisionamento do User.`,
        );
        resumo.erros += 1;
        continue;
      }
      gestorId = gestorEncontrado;
    }

    try {
      await provisionar({
        id: authUserId,
        nome: usuario.nome,
        email: usuario.email,
        role: usuario.role,
        gestor_id: gestorId,
      });
      console.log("  User provisionado no banco (Prisma).");
      resumo.provisionados += 1;
    } catch (err) {
      if (err instanceof ErroValidacaoUsuario) {
        console.log(`  User ja existia no banco (Prisma), pulando: ${err.message}`);
        resumo.jaExistentesUser += 1;
      } else {
        console.error(`  Falha ao provisionar User no banco: ${(err as Error).message}`);
        resumo.erros += 1;
      }
    }
  }

  console.log("\nResumo do seed:");
  console.log(`  Criados no Supabase Auth:        ${resumo.criadosAuth}`);
  console.log(`  Ja existentes no Auth (reaproveitados): ${resumo.jaExistentesAuth}`);
  console.log(`  Provisionados no banco (Prisma):  ${resumo.provisionados}`);
  console.log(`  Ja existentes no banco (pulados): ${resumo.jaExistentesUser}`);
  console.log(`  Erros:                            ${resumo.erros}`);

  if (resumo.erros > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error("Erro fatal no seed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
