import { describe, expect, it } from "vitest";
import { normalizeMarkdownText } from "./FormattedIaSummary";

describe("normalizeMarkdownText", () => {
  it("remove prefixo 'Resumo por IA' redundante do início da string", () => {
    const input = "Resumo por IA**Resumo da Solicitação** - **Funcionário:** João";
    const result = normalizeMarkdownText(input);
    expect(result).not.toContain("Resumo por IA**");
    expect(result).toContain("**Resumo da Solicitação**");
  });

  it("insere quebra de linha antes de marcadores inline sem quebra previa", () => {
    const input = "**Resumo** - **Funcionário:** João - **E-mail:** joao@gmail.com";
    const result = normalizeMarkdownText(input);
    const lines = result.split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines[1]).toContain("- **Funcionário:** João");
    expect(lines[2]).toContain("- **E-mail:** joao@gmail.com");
  });

  it("insere quebra de linha antes de campos em negrito inline sem hífen", () => {
    const input = "Texto inicial **Contexto:** Solicitação de Day Off. **Urgência:** Baixa.";
    const result = normalizeMarkdownText(input);
    const lines = result.split("\n");
    expect(lines.length).toBe(3);
    expect(lines[1]).toBe("**Contexto:** Solicitação de Day Off.");
    expect(lines[2]).toBe("**Urgência:** Baixa.");
  });

  it("preserva texto que ja contem quebras de linha limpas", () => {
    const input = "### Resumo\n\n- **Func:** Maria\n**Contexto:** OK";
    const result = normalizeMarkdownText(input);
    expect(result).toBe("### Resumo\n\n- **Func:** Maria\n**Contexto:** OK");
  });
});
