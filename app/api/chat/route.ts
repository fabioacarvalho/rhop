import { openai } from "@ai-sdk/openai";
import {
  streamText,
  tool,
  convertToModelMessages,
  type UIMessage,
  isStepCount,
} from "ai";
import { z } from "zod";
import { requireUser } from "@/lib/services/authService";
import { contarPorStatus, listar } from "@/lib/services/dashboardService";
import { getGithubMcpTools } from "@/lib/services/mcpClientManager";

export const maxDuration = 30;

export async function POST(req: Request) {
  let usuario;
  try {
    usuario = await requireUser();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { message?: UIMessage; messages?: UIMessage[] };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  // @ai-sdk/react v4 envia { message: UIMessage }
  const rawMessages = body.messages ?? (body.message ? [body.message] : []);

  try {
    // Busca ferramentas dinâmicas de MCP Client (Github)
    const mcpTools = await getGithubMcpTools();

    // convertToModelMessages é assíncrona no ai@7
    const modelMessages = await convertToModelMessages(rawMessages);

    const result = streamText({
      model: openai("gpt-4o-mini"),
      messages: modelMessages,
      stopWhen: isStepCount(5),
      system: `Você é um assistente interno de RH do sistema OP Conecta.
Você DEVE utilizar as ferramentas (tools) disponíveis para buscar os dados solicitados pelo usuário, pois você só tem permissão para responder com base nesses dados.
Os dados internos retornados pelas ferramentas já estão filtrados para a visão permitida do usuário logado.
Se o usuário perguntar sobre o Github ou ferramentas externas mapeadas via MCP, utilize as ferramentas disponíveis. Para outros assuntos não relacionados, recuse educadamente.
Seja conciso, direto e utilize formatação em markdown para facilitar a leitura.`,
      tools: {
        ...mcpTools,
        get_indicadores_dashboard: tool({
          description:
            "Obtém os totais de solicitações agrupadas por status (pendentes, atrasados, aprovados, etc) permitidos para o usuário.",
          parameters: z.object({}),
          // @ts-expect-error - AI SDK version mismatch type constraint
          execute: async (_args: any) => {
            return await contarPorStatus(usuario);
          },
        }),
        get_solicitacoes_pendentes: tool({
          description:
            "Lista as aprovações e solicitações recentes que estão pendentes ou atrasadas.",
          parameters: z.object({
            apenasAtrasadas: z
              .boolean()
              .optional()
              .describe("Se verdadeiro, retorna apenas as que estão atrasadas."),
          }),
          // @ts-expect-error - AI SDK version mismatch type constraint
          execute: async ({ apenasAtrasadas }: { apenasAtrasadas?: boolean }) => {
            const resultado = await listar(usuario, {
              status: apenasAtrasadas ? "ATRASADO" : "PENDENTE",
              page: 1,
              pageSize: 10,
            });
            return resultado.solicitacoes.map((s) => ({
              id: s.id,
              tipo: s.tipo_fluxo_nome,
              solicitante: s.solicitante_nome,
              status: s.status,
              atrasada: s.atrasada,
              data_criacao: s.criado_em.toISOString(),
            }));
          },
        }),
      },
    });

    // result.toUIMessageStreamResponse() é o método direto no StreamTextResult —
    // internamente converte o stream corretamente sem "Unknown chunk type" errors.
    return result.toUIMessageStreamResponse();
  } catch (erro) {
    console.error("[chat/route] Erro inesperado:", erro);
    return new Response("Internal Server Error", { status: 500 });
  }
}
