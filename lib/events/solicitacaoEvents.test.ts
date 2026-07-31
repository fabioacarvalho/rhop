import { describe, expect, it } from "vitest";
import { emitirAvancoEtapa } from "./solicitacaoEvents";

describe("emitirAvancoEtapa", () => {
  it("resolve without throw", async () => {
    await expect(
      emitirAvancoEtapa({
        solicitacao_id: "sol-1",
        etapa_atual: "GESTOR",
      }),
    ).resolves.toBeUndefined();
  });
});
