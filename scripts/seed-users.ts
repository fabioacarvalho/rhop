/**
 * scripts/seed-users.ts
 *
 * T13 de `.specs/features/autenticacao-usuarios/tasks.md` (adaptado na
 * T15 de `.specs/features/gestao-equipes/tasks.md` para o modelo de
 * `Equipe`: `SOLICITANTE` agora se vincula a uma `Equipe`, nao mais
 * diretamente a um `GESTOR` via `gestor_id`).
 *
 * Cria usuarios de teste no Supabase Auth (`admin.createUser`, com a
 * service role key) e o `User` correspondente no Prisma via
 * `userService.provisionar`, em 3 fases (ver secoes abaixo):
 *   1. `GESTORES_E_ADMIN` — RH_ADMIN e GESTOR, sem `equipe_id`.
 *   2. `EQUIPES` — cria as `Equipe`s de exemplo, cada uma com `gestor_id`
 *      apontando para um `GESTOR` da fase 1.
 *   3. `SOLICITANTES` — vinculados a uma `Equipe` da fase 2 via `equipe_id`.
 *
 * Uso:
 *   npm run seed
 *
 * Idempotencia:
 * - Se o e-mail ja existir no Supabase Auth, a criacao e' pulada e o `id`
 *   existente e' localizado via `admin.listUsers()` (necessario para
 *   resolver o `gestor_id` da `Equipe` que depende desse usuario).
 * - Se o `User` correspondente ja existir no Prisma (mesmo `id` ou mesmo
 *   `email`), `userService.provisionar` traduz o conflito (`P2002`) em
 *   `ErroValidacaoUsuario`, que este script trata como "ja existe" em vez
 *   de quebrar a execucao.
 * - Se a `Equipe` (mesmo `nome`, que e' `@unique`) ja existir, a criacao e'
 *   pulada e o `id` existente e' reaproveitado via `findUnique`.
 *
 * ATENCAO: este script grava usuarios REAIS no projeto Supabase configurado
 * em `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (`.env`). Nao
 * rodar contra um projeto de producao. As credenciais abaixo sao apenas
 * para ambiente de desenvolvimento/teste — nao sao segredos reais.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { Prisma, Role } from "@/lib/generated/prisma/client";
import { ErroValidacaoUsuario, provisionar } from "@/lib/services/userService";

// ---------------------------------------------------------------------------
// Dados de seed — editar aqui para adicionar/remover usuarios ou equipes.
//
// Regras (ver userService.provisionar / equipeService):
// - Apenas RH_ADMIN pode ficar sem `equipe_id` E sem gerir nenhuma `Equipe`.
// - `GESTOR`/`RH_ADMIN` nunca tem `equipe_id` (so `SOLICITANTE` pertence a
//   uma `Equipe`).
// - Toda `Equipe` em `EQUIPES` precisa referenciar (`gestor_email`) um
//   usuario que aparece em `GESTORES_E_ADMIN` (role GESTOR ou RH_ADMIN).
// - Todo `SOLICITANTE` em `SOLICITANTES` precisa referenciar (`equipe_nome`)
//   uma `Equipe` que aparece em `EQUIPES`.
//
// Senha de teste unica para todos os usuarios (NAO e' credencial de
// producao, apenas seed de dev): "Teste@123"
// ---------------------------------------------------------------------------
const SENHA_TESTE = "Teste@123";

interface UsuarioSeedSemEquipe {
  nome: string;
  email: string;
  senha_temporaria: string;
  role: typeof Role.RH_ADMIN | typeof Role.GESTOR;
}

/** GESTORes e o RH_ADMIN — nenhum dos dois tem `equipe_id`. */
const GESTORES_E_ADMIN: UsuarioSeedSemEquipe[] = [
  {
    nome: "RH Admin",
    email: "rh.admin@01tec.com.br",
    senha_temporaria: SENHA_TESTE,
    role: Role.RH_ADMIN,
  },
  {
    nome: "Gestor de Equipe",
    email: "gestor@01tec.com.br",
    senha_temporaria: SENHA_TESTE,
    role: Role.GESTOR,
  },
];

interface EquipeSeed {
  nome: string;
  /** E-mail do gestor responsavel — precisa aparecer em `GESTORES_E_ADMIN`. */
  gestor_email: string;
}

/** Equipes de exemplo, cada uma gerida por um dos usuarios de `GESTORES_E_ADMIN`. */
const EQUIPES: EquipeSeed[] = [
  {
    nome: "Equipe de Teste",
    gestor_email: "gestor@01tec.com.br",
  },
];

interface UsuarioSeedComEquipe {
  nome: string;
  email: string;
  senha_temporaria: string;
  /** Nome da `Equipe` a qual este SOLICITANTE pertence — precisa aparecer em `EQUIPES`. */
  equipe_nome: string;
}

/** SOLICITANTEs — todos vinculados a uma `Equipe` de `EQUIPES`. */
const SOLICITANTES: UsuarioSeedComEquipe[] = [
  {
    nome: "Solicitante Teste",
    email: "solicitante@01tec.com.br",
    senha_temporaria: SENHA_TESTE,
    equipe_nome: "Equipe de Teste",
  },
];

// ---------------------------------------------------------------------------

interface Resumo {
  criadosAuth: number;
  jaExistentesAuth: number;
  provisionados: number;
  jaExistentesUser: number;
  equipesCriadas: number;
  equipesJaExistentes: number;
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
  const idEquipePorNome = new Map<string, string>();
  const resumo: Resumo = {
    criadosAuth: 0,
    jaExistentesAuth: 0,
    provisionados: 0,
    jaExistentesUser: 0,
    equipesCriadas: 0,
    equipesJaExistentes: 0,
    erros: 0,
  };

  /**
   * Cria (ou reaproveita) um usuario no Supabase Auth e provisiona o `User`
   * correspondente no Prisma. Compartilhado pelas fases 1 (`GESTORES_E_ADMIN`,
   * sem `equipe_id`) e 3 (`SOLICITANTES`, com `equipe_id` resolvido).
   */
  async function provisionarUsuarioSeed(
    usuario: { nome: string; email: string; senha_temporaria: string },
    role: Role,
    equipeId: string | null,
  ): Promise<void> {
    console.log(`- ${usuario.email} (${role})`);

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
        return;
      }

      console.log("  Ja existe no Supabase Auth, pulando criacao...");
      resumo.jaExistentesAuth += 1;

      const existente = await buscarUsuarioAuthPorEmail(usuario.email);
      if (!existente) {
        console.error(
          `  Nao foi possivel localizar o id existente de "${usuario.email}" via listUsers() — pulando usuario.`,
        );
        resumo.erros += 1;
        return;
      }
      authUserId = existente.id;
    } else if (data.user) {
      authUserId = data.user.id;
      console.log(`  Criado no Supabase Auth (id: ${authUserId}).`);
      resumo.criadosAuth += 1;
    } else {
      console.error(`  createUser nao retornou usuario nem erro para "${usuario.email}" — pulando.`);
      resumo.erros += 1;
      return;
    }

    idPorEmail.set(usuario.email, authUserId);

    try {
      await provisionar({
        id: authUserId,
        nome: usuario.nome,
        email: usuario.email,
        role,
        equipe_id: equipeId,
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

  console.log(`Fase 1/3: provisionando ${GESTORES_E_ADMIN.length} GESTOR(es)/RH_ADMIN...\n`);
  for (const usuario of GESTORES_E_ADMIN) {
    await provisionarUsuarioSeed(usuario, usuario.role, null);
  }

  console.log(`\nFase 2/3: criando ${EQUIPES.length} equipe(s)...\n`);
  for (const equipe of EQUIPES) {
    console.log(`- ${equipe.nome} (gestor: ${equipe.gestor_email})`);

    const gestorId = idPorEmail.get(equipe.gestor_email);
    if (!gestorId) {
      console.error(
        `  gestor_email "${equipe.gestor_email}" ainda nao foi processado na Fase 1 — verifique GESTORES_E_ADMIN. Pulando equipe.`,
      );
      resumo.erros += 1;
      continue;
    }

    try {
      const criada = await prisma.equipe.create({
        data: { nome: equipe.nome, gestor_id: gestorId },
      });
      idEquipePorNome.set(equipe.nome, criada.id);
      console.log(`  Equipe criada (id: ${criada.id}).`);
      resumo.equipesCriadas += 1;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const existente = await prisma.equipe.findUnique({
          where: { nome: equipe.nome },
        });
        if (existente) {
          idEquipePorNome.set(equipe.nome, existente.id);
          console.log(`  Equipe ja existia (id: ${existente.id}), reaproveitando.`);
          resumo.equipesJaExistentes += 1;
        } else {
          console.error(`  Conflito ao criar equipe "${equipe.nome}", mas nao foi possivel localiza-la.`);
          resumo.erros += 1;
        }
      } else {
        console.error(`  Falha ao criar equipe "${equipe.nome}": ${(err as Error).message}`);
        resumo.erros += 1;
      }
    }
  }

  console.log(`\nFase 3/3: provisionando ${SOLICITANTES.length} SOLICITANTE(s)...\n`);
  for (const usuario of SOLICITANTES) {
    const equipeId = idEquipePorNome.get(usuario.equipe_nome);
    if (!equipeId) {
      console.error(
        `  equipe_nome "${usuario.equipe_nome}" ainda nao foi criada na Fase 2 — verifique EQUIPES. Pulando provisionamento de "${usuario.email}".`,
      );
      resumo.erros += 1;
      continue;
    }
    await provisionarUsuarioSeed(usuario, Role.SOLICITANTE, equipeId);
  }

  console.log("\nResumo do seed:");
  console.log(`  Criados no Supabase Auth:        ${resumo.criadosAuth}`);
  console.log(`  Ja existentes no Auth (reaproveitados): ${resumo.jaExistentesAuth}`);
  console.log(`  Provisionados no banco (Prisma):  ${resumo.provisionados}`);
  console.log(`  Ja existentes no banco (pulados): ${resumo.jaExistentesUser}`);
  console.log(`  Equipes criadas:                  ${resumo.equipesCriadas}`);
  console.log(`  Equipes ja existentes (reaproveitadas): ${resumo.equipesJaExistentes}`);
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
