import OpenAI from "openai";
import type { Role } from "@/lib/generated/prisma/client";
import { registrar } from "@/lib/services/logService";

/**
 * Gera `resumo_ia` via OpenAI `gpt-4o-mini` para o aprovador da etapa
 * (APR-13, APR-14, APR-15).
 *
 * - Sucesso com conteudo nao-vazio → string trimada.
 * - Qualquer falha (chave ausente, erro de API, timeout, conteudo vazio) →
 *   grava `Log` tipo `ERRO` (`acao: FALHA_IA`) e retorna `null`.
 * - Nunca lanca para o chamador por falha da OpenAI: IA nunca trava o fluxo
 *   (CLAUDE.md).
 */
export async function gerarResumoSolicitacao(input: {
  solicitacaoId: string;
  tipoFluxoNome: string;
  dados: Record<string, unknown>;
  etapa: Role;
}): Promise<string | null> {
  const { solicitacaoId, tipoFluxoNome, dados, etapa } = input;

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      await registrarFalhaIa(solicitacaoId, {
        motivo: "OPENAI_API_KEY ausente",
      });
      return null;
    }

    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Voce e um assistente de RH. Gere um resumo conciso em portugues " +
            "para o aprovador decidir rapidamente, destacando contexto, " +
            "urgencia e dados-chave da solicitacao.",
        },
        {
          role: "user",
          content: [
            `Tipo de fluxo: ${tipoFluxoNome}`,
            `Etapa do aprovador: ${etapa}`,
            "Dados da solicitacao:",
            JSON.stringify(dados),
          ].join("\n"),
        },
      ],
    });

    const content = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!content) {
      await registrarFalhaIa(solicitacaoId, {
        motivo: "conteudo vazio da OpenAI",
      });
      return null;
    }

    return content;
  } catch (error) {
    await registrarFalhaIa(solicitacaoId, {
      motivo: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** Grava `Log ERRO` de falha de IA sem propagar erro ao chamador. */
async function registrarFalhaIa(
  solicitacaoId: string,
  detalhes: { motivo: string },
): Promise<void> {
  await registrar({
    tipo: "ERRO",
    entidade: "Aprovacao",
    entidade_id: solicitacaoId,
    acao: "FALHA_IA",
    detalhes,
  });
}
