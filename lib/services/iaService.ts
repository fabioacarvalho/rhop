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

/**
 * Gera `resumo_ia_solicitante` para a visao do proprio solicitante (RIA-01),
 * opcionalmente mencionando conflito de agenda com outro membro da equipe.
 *
 * Mesmo contrato "nunca lanca" de `gerarResumoSolicitacao`: qualquer falha
 * (chave ausente, erro de API, timeout, conteudo vazio) grava `Log ERRO`
 * (`entidade: "Solicitacao"`, `acao: "FALHA_IA"`) e retorna `null` (RIA-04).
 */
export async function gerarResumoSolicitante(input: {
  solicitacaoId: string;
  tipoFluxoNome: string;
  dados: Record<string, unknown>;
  conflito: { periodoDescricao: string } | null;
}): Promise<string | null> {
  const { solicitacaoId, tipoFluxoNome, dados, conflito } = input;

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      await registrarFalhaIaSolicitante(solicitacaoId, {
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
            "para o proprio solicitante, confirmando o que foi solicitado. " +
            (conflito
              ? "Mencione, de forma generica e sem citar nomes, que ha " +
                "sobreposicao de agenda com outro membro da equipe no " +
                `periodo ${conflito.periodoDescricao}.`
              : "Nao mencione conflitos de agenda."),
        },
        {
          role: "user",
          content: [
            `Tipo de fluxo: ${tipoFluxoNome}`,
            "Dados da solicitacao:",
            JSON.stringify(dados),
            ...(conflito
              ? [`Conflito de agenda no periodo: ${conflito.periodoDescricao}`]
              : []),
          ].join("\n"),
        },
      ],
    });

    const content = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!content) {
      await registrarFalhaIaSolicitante(solicitacaoId, {
        motivo: "conteudo vazio da OpenAI",
      });
      return null;
    }

    return content;
  } catch (error) {
    await registrarFalhaIaSolicitante(solicitacaoId, {
      motivo: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** Grava `Log ERRO` de falha de IA do resumo do solicitante, sem propagar. */
async function registrarFalhaIaSolicitante(
  solicitacaoId: string,
  detalhes: { motivo: string },
): Promise<void> {
  await registrar({
    tipo: "ERRO",
    entidade: "Solicitacao",
    entidade_id: solicitacaoId,
    acao: "FALHA_IA",
    detalhes,
  });
}

/**
 * Gera o resumo em linguagem natural do Painel de Insights (INSIGHT-06,
 * INSIGHT-08) via OpenAI `gpt-4o-mini`, a partir **exclusivamente** do
 * payload numérico já agregado em Postgres — nunca recebe linhas brutas de
 * `Solicitacao` (INSIGHT-02, INSIGHT-06).
 *
 * Mesmo contrato "nunca lança" de `gerarResumoSolicitacao`: qualquer falha
 * (chave ausente, erro de API, timeout, conteúdo vazio) grava `Log ERRO`
 * (`entidade: "Insight"`, `acao: "FALHA_IA"`) e retorna `null` — o painel
 * mantém o gráfico visível sem o resumo (CLAUDE.md).
 */
export async function gerarResumoInsights(input: {
  tipoFluxoNome: string;
  periodo: string;
  dimensao: string;
  itens: { chave: string; quantidade: number }[];
  total: number;
}): Promise<string | null> {
  const { tipoFluxoNome, periodo, dimensao, itens, total } = input;
  const entidadeId = `${tipoFluxoNome}:${periodo}:${dimensao}`;

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      await registrarFalhaIaInsight(entidadeId, {
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
            "Voce e um assistente de RH. Narre em portugues o padrao " +
            "principal presente nos numeros agregados abaixo, de forma " +
            "concisa. Baseie-se exclusivamente nesses numeros, nunca " +
            "invente dados. Se o total de registros for pequeno (ex.: 2 " +
            "ou menos), evite afirmar tendencias fortes ou conclusivas — " +
            "a amostra e insuficiente para isso.",
        },
        {
          role: "user",
          content: [
            `Tipo de fluxo: ${tipoFluxoNome}`,
            `Periodo: ${periodo}`,
            `Dimensao de agregacao: ${dimensao}`,
            `Total de solicitacoes: ${total}`,
            "Itens agregados (chave, quantidade):",
            JSON.stringify(itens),
          ].join("\n"),
        },
      ],
    });

    const content = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!content) {
      await registrarFalhaIaInsight(entidadeId, {
        motivo: "conteudo vazio da OpenAI",
      });
      return null;
    }

    return content;
  } catch (error) {
    await registrarFalhaIaInsight(entidadeId, {
      motivo: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** Grava `Log ERRO` de falha de IA do Painel de Insights, sem propagar. */
async function registrarFalhaIaInsight(
  entidadeId: string,
  detalhes: { motivo: string },
): Promise<void> {
  await registrar({
    tipo: "ERRO",
    entidade: "Insight",
    entidade_id: entidadeId,
    acao: "FALHA_IA",
    detalhes,
  });
}

/**
 * Gera a justificativa textual de por que um candidato ficou naquela posição
 * do ranking do Banco de Talentos (TAL-14), via OpenAI `gpt-4o-mini`.
 *
 * Mesmo contrato "nunca lança" de `gerarResumoSolicitacao`: qualquer falha
 * (chave ausente, erro de API, timeout, conteúdo vazio) grava `Log ERRO`
 * (`entidade: "Candidato"`, `acao: "FALHA_IA"`) e retorna `null` — o item do
 * ranking fica sem justificativa, o restante da busca segue intacto
 * (`talentoSearchService`, TAL-17).
 */
export async function gerarJustificativaRanking(input: {
  candidatoId: string;
  nome: string;
  curriculoTexto: string;
  transcricaoTexto: string;
  queryTexto: string;
}): Promise<string | null> {
  const { candidatoId, nome, curriculoTexto, transcricaoTexto, queryTexto } =
    input;

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      await registrarFalhaIaCandidato(candidatoId, {
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
            "Voce e um assistente de recrutamento. Gere uma justificativa " +
            "concisa em portugues explicando por que este candidato e " +
            "relevante para o perfil buscado, com base no curriculo e na " +
            "transcricao da entrevista.",
        },
        {
          role: "user",
          content: [
            `Perfil buscado: ${queryTexto}`,
            `Candidato: ${nome}`,
            `Curriculo: ${curriculoTexto}`,
            `Transcricao: ${transcricaoTexto}`,
          ].join("\n"),
        },
      ],
    });

    const content = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!content) {
      await registrarFalhaIaCandidato(candidatoId, {
        motivo: "conteudo vazio da OpenAI",
      });
      return null;
    }

    return content;
  } catch (error) {
    await registrarFalhaIaCandidato(candidatoId, {
      motivo: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** Grava `Log ERRO` de falha de IA do Banco de Talentos, sem propagar. */
async function registrarFalhaIaCandidato(
  candidatoId: string,
  detalhes: { motivo: string },
): Promise<void> {
  await registrar({
    tipo: "ERRO",
    entidade: "Candidato",
    entidade_id: candidatoId,
    acao: "FALHA_IA",
    detalhes,
  });
}
