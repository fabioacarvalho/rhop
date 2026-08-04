import { prisma } from "@/lib/prisma";
import * as embeddingService from "@/lib/services/embeddingService";
import { gerarJustificativaRanking } from "@/lib/services/iaService";

/** `n` fora do intervalo `1..teto` — rota mapeia para 400 (TAL-26, TAL-30). */
export class ErroNInvalido extends Error {
  constructor(teto: number) {
    super(`n deve ser um numero inteiro entre 1 e ${teto}.`);
    this.name = "ErroNInvalido";
  }
}

/** Embedding da query falhou — rota mapeia para 422 (TAL-19). */
export class ErroBuscaIndisponivel extends Error {
  constructor(
    message = "Nao foi possivel processar a busca agora, tente novamente.",
  ) {
    super(message);
    this.name = "ErroBuscaIndisponivel";
  }
}

/** Teto padrão de `n` quando `TALENTO_BUSCA_N_MAXIMO` está ausente/inválida. */
export const N_MAXIMO_PADRAO = 100;

export interface CandidatoRankeado {
  id: string;
  nome: string;
  email: string;
  solicitacao_id: string | null;
  score: number;
  justificativa: string | null;
  tags: { id: string; nome: string }[];
}

export interface ResultadoBusca {
  candidatos: CandidatoRankeado[];
  disponivel: boolean;
}

interface CandidatoBruto {
  id: string;
  nome: string;
  email: string;
  solicitacao_id: string | null;
  curriculo_texto: string;
  parecer_tecnico: string;
  score: number;
}

function lerTetoMaximo(): number {
  const bruto = process.env.TALENTO_BUSCA_N_MAXIMO;
  if (!bruto) {
    return N_MAXIMO_PADRAO;
  }
  const parsed = Number(bruto);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return N_MAXIMO_PADRAO;
  }
  return parsed;
}

/**
 * Busca e ranqueia candidatos por similaridade semântica ao texto informado
 * (TAL-12 a TAL-19, TAL-26, TAL-30).
 *
 * Valida `n` contra o teto configurável ANTES de gerar qualquer embedding.
 * Embedding da própria query falhando (`embeddingService.gerar` retorna
 * `null`, já registrado como `Log ERRO` internamente) vira
 * `ErroBuscaIndisponivel`. Sem nenhum candidato `processado`, retorna
 * `disponivel: false` sem lançar (TAL-16). Cada item do ranking tem sua
 * justificativa gerada isoladamente — falha em um item nunca interrompe os
 * demais (TAL-17).
 */
export async function buscar(
  texto: string,
  n: number,
): Promise<ResultadoBusca> {
  const teto = lerTetoMaximo();

  if (!Number.isInteger(n) || n < 1 || n > teto) {
    throw new ErroNInvalido(teto);
  }

  const vetor = await embeddingService.gerar(texto);
  if (!vetor) {
    throw new ErroBuscaIndisponivel();
  }

  const vetorLiteral = embeddingService.formatarVetorLiteral(vetor);

  const brutos = await prisma.$queryRaw<CandidatoBruto[]>`
    SELECT id, nome, email, solicitacao_id, curriculo_texto, parecer_tecnico,
           1 - (embedding <=> ${vetorLiteral}::vector) AS score
    FROM candidatos
    WHERE status_embedding = 'processado'
    ORDER BY embedding <=> ${vetorLiteral}::vector
    LIMIT ${n}
  `;

  if (brutos.length === 0) {
    return { candidatos: [], disponivel: false };
  }

  const tagsPorCandidato = await buscarTagsPorCandidato(
    brutos.map((bruto) => bruto.id),
  );

  const candidatos: CandidatoRankeado[] = [];

  for (const bruto of brutos) {
    let justificativa: string | null;
    try {
      justificativa = await gerarJustificativaRanking({
        candidatoId: bruto.id,
        nome: bruto.nome,
        curriculoTexto: bruto.curriculo_texto,
        transcricaoTexto: bruto.parecer_tecnico,
        queryTexto: texto,
      });
    } catch {
      justificativa = null;
    }

    candidatos.push({
      id: bruto.id,
      nome: bruto.nome,
      email: bruto.email,
      solicitacao_id: bruto.solicitacao_id,
      score: Number(bruto.score),
      justificativa,
      tags: tagsPorCandidato.get(bruto.id) ?? [],
    });
  }

  return { candidatos, disponivel: true };
}

/**
 * Anexa as Tags de cada candidato do ranking (TAL-35) — feito como uma
 * segunda consulta via Prisma Client normal (não `$queryRaw`), já que a
 * consulta de similaridade acima roda em SQL raw por causa da coluna
 * `embedding` e não pode usar `include`.
 */
async function buscarTagsPorCandidato(
  ids: string[],
): Promise<Map<string, { id: string; nome: string }[]>> {
  const registros = await prisma.candidato.findMany({
    where: { id: { in: ids } },
    select: { id: true, tags: { select: { id: true, nome: true } } },
  });

  return new Map(registros.map((registro) => [registro.id, registro.tags]));
}
