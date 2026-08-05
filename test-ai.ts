import { openai } from "@ai-sdk/openai";
import { streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import dotenv from "dotenv";
dotenv.config();

async function test() {
  const result = streamText({
    model: openai("gpt-4o-mini"),
    messages: [{ role: "user", content: [{ type: "text", text: "Como estão as minhas pendências de hoje?" }] }],
    stopWhen: stepCountIs(5),
    tools: {
      get_solicitacoes_pendentes: tool({
        description: "Lista pendências.",
        parameters: z.object({}),
        execute: async () => {
          return [{ id: 1, tipo: "Férias", status: "PENDENTE" }];
        },
      }),
    },
  });

  const reader = result.toUIMessageStreamResponse().body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    console.log(decoder.decode(value));
  }
}

test().catch(console.error);
