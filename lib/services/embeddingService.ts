import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { registrar } from "@/lib/services/logService";

/**
 * Gera o vetor de embedding (1536 dimensões, `text-embedding-3-small`) do
 * texto informado (TAL-03) — usado tanto para o texto do candidato
 * (currículo + transcrição) quanto para a query de busca.
 *
 * Mesmo contrato "nunca lança" de `iaService`: qualquer falha (chave
 * ausente, erro de API, timeout, resposta vazia) grava `Log ERRO`
 * (`entidade: "Candidato"`, `acao: "FALHA_IA"`) e retorna `null`.
 */
export async function gerar(texto: string): Promise<number[] | null> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      await registrarFalha({ motivo: "OPENAI_API_KEY ausente" });
      return null;
    }

    const client = new OpenAI({ apiKey });
    const resposta = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: texto,
    });

    const vetor = resposta.data[0]?.embedding;
    if (!vetor || vetor.length === 0) {
      await registrarFalha({ motivo: "embedding vazio da OpenAI" });
      return null;
    }

    return vetor;
  } catch (error) {
    await registrarFalha({
      motivo: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Formata um vetor como literal `pgvector` (`[v1,v2,...]`) para uso em
 * `$executeRaw`/`$queryRaw` com cast `::vector` — reaproveitado por
 * `talentoSearchService` para a query de similaridade.
 */
export function formatarVetorLiteral(vetor: number[]): string {
  return `[${vetor.join(",")}]`;
}

/**
 * Persiste o vetor gerado na coluna `embedding` (`Unsupported("vector(1536)")`)
 * e marca `status_embedding = 'processado'` (TAL-04).
 *
 * A coluna `embedding` não é exposta pela API padrão do Prisma Client — todo
 * acesso passa por `$executeRaw`, com o vetor formatado como literal
 * `[v1,v2,...]` e cast explícito `::vector` (`design.md`).
 */
export async function persistirEmbedding(
  candidatoId: string,
  vetor: number[],
): Promise<void> {
  const vetorLiteral = formatarVetorLiteral(vetor);

  await prisma.$executeRaw`
    UPDATE candidatos
    SET embedding = ${vetorLiteral}::vector, status_embedding = 'processado'
    WHERE id = ${candidatoId}
  `;
}

/** Marca o candidato como `falhou` (TAL-05) — coluna normal, via Prisma Client. */
export async function marcarFalha(candidatoId: string): Promise<void> {
  await prisma.candidato.update({
    where: { id: candidatoId },
    data: { status_embedding: "falhou" },
  });
}

async function registrarFalha(detalhes: { motivo: string }): Promise<void> {
  await registrar({
    tipo: "ERRO",
    entidade: "Candidato",
    entidade_id: "embedding",
    acao: "FALHA_IA",
    detalhes,
  });
}
