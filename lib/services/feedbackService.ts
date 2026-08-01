import { prisma } from "@/lib/prisma";
import { registrar } from "@/lib/services/logService";
import { criarIssue } from "@/lib/services/githubService";
import { montarIssuePayload, type TipoRelato } from "@/lib/helpers/githubIssue";
import { Role, TipoRelato as TipoRelatoPrisma } from "@/lib/generated/prisma/enums";

const LIMITE_DIARIO = 5;

const TIPO_PRISMA: Record<TipoRelato, TipoRelatoPrisma> = {
  Bug: TipoRelatoPrisma.BUG,
  Melhoria: TipoRelatoPrisma.MELHORIA,
  "Dúvida": TipoRelatoPrisma.DUVIDA,
};

export interface EnviarFeedbackInput {
  usuarioId: string;
  papel: Role;
  tipo: TipoRelato;
  titulo: string;
  descricao: string;
  telaContexto: string;
}

export type EnviarFeedbackResultado =
  | { ok: true; url: string; numero: number }
  | { ok: false; motivo: "LIMITE_DIARIO" | "ERRO_API"; mensagem: string };

async function contarFeedbacksHoje(usuarioId: string): Promise<number> {
  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);

  return prisma.feedback.count({
    where: { usuario_id: usuarioId, criado_em: { gte: inicioDoDia } },
  });
}

/**
 * Cria a issue no GitHub direto via API (V2 do PRD, seção 9) e grava o
 * registro em `Feedback`. Nunca lança para o chamador — qualquer falha
 * (limite diário ou erro da API do GitHub) volta como `{ ok: false,
 * mensagem }`, igual ao contrato de `iaService`/`resendService` (CLAUDE.md:
 * uma falha auxiliar nunca trava o fluxo do usuário).
 */
export async function enviarFeedback(
  input: EnviarFeedbackInput,
): Promise<EnviarFeedbackResultado> {
  const totalHoje = await contarFeedbacksHoje(input.usuarioId);
  if (totalHoje >= LIMITE_DIARIO) {
    return {
      ok: false,
      motivo: "LIMITE_DIARIO",
      mensagem: `Você atingiu o limite de ${LIMITE_DIARIO} relatos por dia. Tente novamente amanhã.`,
    };
  }

  const payload = montarIssuePayload({
    tipo: input.tipo,
    tela: input.telaContexto,
    papel: input.papel,
    titulo: input.titulo,
    descricao: input.descricao,
  });

  const dadosBase = {
    usuario_id: input.usuarioId,
    tipo: TIPO_PRISMA[input.tipo],
    titulo: input.titulo,
    descricao: input.descricao,
    tela_contexto: input.telaContexto,
  };

  try {
    const { url, numero } = await criarIssue(payload);

    await prisma.feedback.create({
      data: {
        ...dadosBase,
        github_issue_url: url,
        github_issue_numero: numero,
        status: "ENVIADO",
      },
    });

    return { ok: true, url, numero };
  } catch (erro) {
    const feedback = await prisma.feedback.create({
      data: { ...dadosBase, status: "ERRO" },
    });

    await registrar({
      tipo: "ERRO",
      entidade: "Feedback",
      entidade_id: feedback.id,
      acao: "FALHA_CRIAR_ISSUE_GITHUB",
      usuario_id: input.usuarioId,
      detalhes: { motivo: erro instanceof Error ? erro.message : String(erro) },
    });

    return {
      ok: false,
      motivo: "ERRO_API",
      mensagem: "Não foi possível criar a issue agora. Tente novamente em instantes.",
    };
  }
}
