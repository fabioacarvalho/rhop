/**
 * scripts/migrate-equipes.ts
 *
 * T13 de `.specs/features/gestao-equipes/tasks.md`.
 *
 * Script one-off que migra a hierarquia legada de gestor/subordinado
 * (`User.gestor_id`) para o modelo de `Equipe`: para cada `User` com
 * `role GESTOR` que tenha ao menos um subordinado
 * (`User.gestor_id === gestor.id`), cria (ou reusa) 1 `Equipe` com
 * `nome: "Equipe de ${gestor.nome}"` e migra os subordinados para o
 * `equipe_id` dessa `Equipe`.
 *
 * Uso:
 *   npx tsx scripts/migrate-equipes.ts
 *
 * ATENCAO: este script grava dados REAIS no banco configurado em
 * `DATABASE_URL` (`.env`) — mesmo projeto Supabase usado por
 * `scripts/seed-users.ts`. NAO rodar sem confirmacao explicita de qual
 * banco esta configurado (ver task T14).
 *
 * Idempotencia:
 * - Antes de criar uma `Equipe`, verifica se ja existe uma com o mesmo
 *   `nome` (`prisma.equipe.findUnique({ where: { nome } })`) e reusa essa
 *   equipe em vez de tentar criar de novo. `nome` e `@unique` no schema —
 *   uma segunda execucao que apenas tentasse `create` de novo cairia num
 *   erro de unique constraint (`P2002`). Preferimos a checagem explicita
 *   porque "reusar numa reexecucao" e um caminho esperado do script (nao
 *   uma condicao de erro), e fica mais legivel do que decidir esse fluxo
 *   normal inspecionando o codigo de erro do Prisma.
 * - `updateMany` em `User.equipe_id` e idempotente por natureza — reatribuir
 *   o mesmo valor a um `User` que ja esta na equipe correta nao tem efeito
 *   colateral.
 *
 * Inconsistencias:
 * - Antes do loop principal, identifica `User` `role SOLICITANTE` com
 *   `gestor_id` preenchido apontando para outro `User` que EXISTE mas NAO
 *   tem `role GESTOR` (hierarquia legada corrompida). Cada um grava `Log`
 *   tipo `ERRO` (`acao: 'GESTOR_ID_INCONSISTENTE'`) e fica de fora da
 *   migracao automatica de `equipe_id`.
 *
 * IMPORTANTE — so `SOLICITANTE` migra `equipe_id`:
 * - No modelo antigo, `gestor_id` existia em qualquer `User` (inclusive
 *   `GESTOR` reportando para outro `GESTOR`/`RH_ADMIN` — hierarquia de
 *   pessoal, nao de aprovacao). No modelo novo, `equipe_id` e exclusivo de
 *   `SOLICITANTE` (`GESTOR`/`RH_ADMIN` nunca tem equipe_id — EQP-13). Por
 *   isso `migrarGestor`/`identificarInconsistencias` filtram
 *   `role: 'SOLICITANTE'` explicitamente em vez de migrar qualquer `User`
 *   cujo `gestor_id` bate — sem esse filtro, um `GESTOR` que reportava a
 *   outro `GESTOR` no modelo antigo ganharia `equipe_id` por engano,
 *   violando a invariante do modelo novo (confirmado contra dados reais
 *   desta sessao: "Gestor de Equipe" tinha "Marina Costa", role GESTOR,
 *   como um dos seus antigos subordinados via `gestor_id`).
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { Role, type User } from "@/lib/generated/prisma/client";
import { registrar } from "@/lib/services/logService";

// ---------------------------------------------------------------------------
// Passo 0: inconsistencias de hierarquia legada
// ---------------------------------------------------------------------------

export interface InconsistenciaGestorId {
  usuarioId: string;
  gestorId: string;
}

/**
 * Identifica `User` `role SOLICITANTE` cujo `gestor_id` aponta para outro
 * `User` existente que NAO tem `role GESTOR`. Para cada um: grava `Log`
 * tipo `ERRO` (`acao: 'GESTOR_ID_INCONSISTENTE'`, `detalhes: { gestor_id }`)
 * e loga no console. Retorna a lista de inconsistencias encontradas (usada
 * apenas para o resumo final).
 *
 * Restrito a `SOLICITANTE` (ver nota no topo do arquivo) — um `GESTOR`
 * cujo `gestor_id` antigo apontava pra outro `GESTOR`/`RH_ADMIN` (hierarquia
 * de pessoal do modelo antigo) NAO e uma inconsistencia, e nunca vai ganhar
 * `equipe_id` de qualquer forma.
 *
 * Nao cobre `gestor_id` orfao (apontando para um `id` que nao existe mais)
 * — esse e um caso diferente do descrito na task (que fala especificamente
 * de gestor que existe mas nao tem role GESTOR), fora de escopo aqui.
 */
export async function identificarInconsistencias(): Promise<InconsistenciaGestorId[]> {
  const usuarios = await prisma.user.findMany();
  const porId = new Map(usuarios.map((usuario) => [usuario.id, usuario]));

  const inconsistencias: InconsistenciaGestorId[] = [];

  for (const usuario of usuarios) {
    if (usuario.role !== Role.SOLICITANTE || !usuario.gestor_id) continue;

    const gestor = porId.get(usuario.gestor_id);
    if (!gestor || gestor.role === Role.GESTOR) continue;

    inconsistencias.push({ usuarioId: usuario.id, gestorId: usuario.gestor_id });

    await registrar({
      tipo: "ERRO",
      entidade: "User",
      entidade_id: usuario.id,
      acao: "GESTOR_ID_INCONSISTENTE",
      detalhes: { gestor_id: usuario.gestor_id },
    });

    console.log(
      `  Inconsistencia: User ${usuario.id} (${usuario.email}) tem gestor_id "${usuario.gestor_id}" que nao corresponde a um usuario com role GESTOR. Pulando da migracao automatica de equipe.`,
    );
  }

  return inconsistencias;
}

// ---------------------------------------------------------------------------
// Passo 1-4: migracao por gestor
// ---------------------------------------------------------------------------

export interface ResultadoMigracaoGestor {
  equipeId: string;
  equipeNome: string;
  /** `true` se a `Equipe` foi criada agora, `false` se ja existia e foi reusada. */
  criada: boolean;
  usuariosMigrados: number;
}

/**
 * Migra um unico `User` com `role GESTOR` para o modelo de `Equipe`: conta
 * subordinados `role SOLICITANTE` (`gestor_id === gestor.id` — ver nota no
 * topo do arquivo sobre por que so `SOLICITANTE` conta aqui) -> se `0`,
 * pula (retorna `null`, nenhuma `Equipe` vazia e criada) -> senao, cria ou
 * reusa 1 `Equipe` com `nome: "Equipe de ${gestor.nome}"` -> migra os
 * subordinados via `updateMany` -> loga quantos foram migrados.
 */
export async function migrarGestor(
  gestor: User,
): Promise<ResultadoMigracaoGestor | null> {
  const totalSubordinados = await prisma.user.count({
    where: { gestor_id: gestor.id, role: Role.SOLICITANTE },
  });

  if (totalSubordinados === 0) {
    console.log(`- ${gestor.nome} (${gestor.email}): sem subordinados SOLICITANTE, pulando.`);
    return null;
  }

  const nome = `Equipe de ${gestor.nome}`;

  // Idempotencia: ver comentario no topo do arquivo — checa por nome antes
  // de criar, em vez de tratar erro de unique constraint.
  let equipe = await prisma.equipe.findUnique({ where: { nome } });
  let criada = false;
  if (!equipe) {
    equipe = await prisma.equipe.create({ data: { nome, gestor_id: gestor.id } });
    criada = true;
  }

  const { count: usuariosMigrados } = await prisma.user.updateMany({
    where: { gestor_id: gestor.id, role: Role.SOLICITANTE },
    data: { equipe_id: equipe.id },
  });

  console.log(
    `- ${gestor.nome} (${gestor.email}): equipe "${equipe.nome}" ${criada ? "criada" : "reusada"}, ${usuariosMigrados} usuario(s) migrado(s).`,
  );

  return {
    equipeId: equipe.id,
    equipeNome: equipe.nome,
    criada,
    usuariosMigrados,
  };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Iniciando migracao de gestor_id/User para Equipe...\n");

  console.log("Verificando inconsistencias de gestor_id...");
  const inconsistencias = await identificarInconsistencias();
  console.log(`  ${inconsistencias.length} inconsistencia(s) encontrada(s).\n`);

  const gestores = await prisma.user.findMany({ where: { role: Role.GESTOR } });
  console.log(`Processando ${gestores.length} gestor(es)...`);

  let equipesCriadas = 0;
  let equipesReusadas = 0;
  let gestoresPulados = 0;
  let usuariosMigrados = 0;

  for (const gestor of gestores) {
    const resultado = await migrarGestor(gestor);

    if (!resultado) {
      gestoresPulados += 1;
      continue;
    }

    if (resultado.criada) {
      equipesCriadas += 1;
    } else {
      equipesReusadas += 1;
    }
    usuariosMigrados += resultado.usuariosMigrados;
  }

  console.log("\nResumo da migracao:");
  console.log(`  Equipes criadas:                     ${equipesCriadas}`);
  console.log(`  Equipes reusadas (ja existiam):       ${equipesReusadas}`);
  console.log(`  Gestores sem subordinados (pulados):  ${gestoresPulados}`);
  console.log(`  Usuarios migrados:                    ${usuariosMigrados}`);
  console.log(`  Inconsistencias de gestor_id:         ${inconsistencias.length}`);
}

// Guard: Vitest define `process.env.VITEST` automaticamente no processo de
// teste. `scripts/migrate-equipes.test.ts` importa este modulo para testar
// `migrarGestor`/`identificarInconsistencias` isoladamente — sem este guard,
// so importar o arquivo dispararia `main()` de verdade (mesmo com Prisma
// mockado) a cada `npm run test`, o que e efeito colateral indesejado e
// poderia mascarar o exit code da suíte. Fora do Vitest (`npx tsx
// scripts/migrate-equipes.ts`), `VITEST` nao esta definido e o script roda
// normalmente, mesmo padrao de `main().catch(...)` de `scripts/seed-users.ts`.
if (process.env.VITEST === undefined) {
  main()
    .catch((err) => {
      console.error("Erro fatal na migracao de equipes:", err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
