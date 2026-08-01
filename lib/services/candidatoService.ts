import { prisma } from "@/lib/prisma";
import { Prisma, type Candidato } from "@/lib/generated/prisma/client";
import { registrar } from "@/lib/services/logService";
import * as embeddingService from "@/lib/services/embeddingService";
import type { CandidatoInput } from "@/lib/validations/candidato";

/** E-mail já cadastrado (`@@unique`, `P2002`) — rota mapeia para 409 (TAL-28). */
export class ErroEmailDuplicado extends Error {
  constructor(message = "Ja existe candidato com este e-mail.") {
    super(message);
    this.name = "ErroEmailDuplicado";
  }
}

/** `id` de `Candidato` sem registro correspondente — rota mapeia para 404. */
export class ErroNaoEncontrado extends Error {
  constructor(message = "Candidato nao encontrado.") {
    super(message);
    this.name = "ErroNaoEncontrado";
  }
}

/**
 * Reprocessamento pedido para candidato cujo `status_embedding` não é
 * `falhou` — rota mapeia para 409 (TAL-29).
 */
export class ErroReprocessamentoNaoPermitido extends Error {
  constructor(
    message = "Reprocessamento so e permitido para candidatos com status 'falhou'.",
  ) {
    super(message);
    this.name = "ErroReprocessamentoNaoPermitido";
  }
}

/** Item de `listar()` — nunca inclui `embedding` (coluna `Unsupported`). */
export type CandidatoResumo = Pick<
  Candidato,
  "id" | "nome" | "email" | "status_embedding" | "criado_em"
>;

/**
 * Cadastra um candidato (TAL-01, TAL-06, TAL-28).
 *
 * `email` duplicado (`P2002`) é traduzido para `ErroEmailDuplicado` antes de
 * qualquer geração de embedding. Em sucesso, o embedding é gerado de forma
 * síncrona dentro da própria chamada (TAL-03) — falha não impede o cadastro,
 * apenas deixa `status_embedding = 'falhou'` (TAL-05). `Log AUDITORIA`
 * (`acao: 'CRIACAO'`) é gravado ao final, independente do resultado do
 * embedding, e uma falha ao gravar o log nunca derruba o cadastro.
 */
export async function cadastrar(
  dados: CandidatoInput,
  usuarioId: string,
): Promise<Candidato> {
  let candidato: Candidato;

  try {
    candidato = await prisma.candidato.create({
      data: {
        nome: dados.nome,
        email: dados.email,
        telefone: dados.telefone,
        curriculo_texto: dados.curriculo_texto,
        transcricao_texto: dados.transcricao_texto,
        solicitacao_id: dados.solicitacao_id ?? null,
        status_embedding: "pendente",
        criado_por: usuarioId,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ErroEmailDuplicado(
        `Ja existe candidato com o e-mail "${dados.email}".`,
      );
    }
    throw error;
  }

  await processarEmbedding(
    candidato.id,
    dados.curriculo_texto,
    dados.transcricao_texto,
  );

  await registrarSemFalhar({
    tipo: "AUDITORIA",
    entidade: "Candidato",
    entidade_id: candidato.id,
    acao: "CRIACAO",
    usuario_id: usuarioId,
  });

  return candidato;
}

/**
 * Lista todos os candidatos cadastrados (TAL-08, TAL-09) — visibilidade
 * colaborativa entre GESTOR/RH_ADMIN, sem filtro por `criado_por`. Nunca
 * seleciona `embedding` (coluna `Unsupported`, nem exposta pelo client).
 */
export async function listar(): Promise<CandidatoResumo[]> {
  return prisma.candidato.findMany({
    select: {
      id: true,
      nome: true,
      email: true,
      status_embedding: true,
      criado_em: true,
    },
    orderBy: { criado_em: "desc" },
  });
}

/**
 * Reprocessa o embedding de um candidato cujo `status_embedding` é `falhou`
 * (TAL-29). `id` inexistente → `ErroNaoEncontrado`; status diferente de
 * `falhou` → `ErroReprocessamentoNaoPermitido`. Repete o mesmo fluxo síncrono
 * de geração de embedding de `cadastrar`.
 */
export async function reprocessarEmbedding(
  id: string,
  usuarioId: string,
): Promise<Candidato> {
  const candidato = await prisma.candidato.findUnique({ where: { id } });

  if (!candidato) {
    throw new ErroNaoEncontrado();
  }

  if (candidato.status_embedding !== "falhou") {
    throw new ErroReprocessamentoNaoPermitido();
  }

  await processarEmbedding(
    candidato.id,
    candidato.curriculo_texto,
    candidato.transcricao_texto,
  );

  await registrarSemFalhar({
    tipo: "AUDITORIA",
    entidade: "Candidato",
    entidade_id: candidato.id,
    acao: "REPROCESSAMENTO",
    usuario_id: usuarioId,
  });

  const atualizado = await prisma.candidato.findUnique({ where: { id } });
  return atualizado as Candidato;
}

/**
 * Gera o embedding a partir do texto combinado (currículo + transcrição) e
 * persiste o resultado — sucesso grava o vetor via `$executeRaw` e marca
 * `processado`; falha marca `falhou`. Nunca lança.
 */
async function processarEmbedding(
  candidatoId: string,
  curriculoTexto: string,
  transcricaoTexto: string,
): Promise<void> {
  const vetor = await embeddingService.gerar(
    `${curriculoTexto}\n${transcricaoTexto}`,
  );

  if (vetor) {
    await embeddingService.persistirEmbedding(candidatoId, vetor);
  } else {
    await embeddingService.marcarFalha(candidatoId);
  }
}

/**
 * Grava `Log` sem nunca deixar uma falha de persistência do log derrubar o
 * fluxo de negócio chamador — mesma garantia que `logService.registrar` já
 * documenta ter internamente, reforçada aqui como defesa extra.
 */
async function registrarSemFalhar(
  evento: Parameters<typeof registrar>[0],
): Promise<void> {
  try {
    await registrar(evento);
  } catch {
    // Nunca propaga: falha de log nao pode impedir cadastro/reprocessamento.
  }
}
