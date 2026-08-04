import React from "react";
import styles from "./formattedIaSummary.module.css";

interface FormattedIaSummaryProps {
  text: string | null | undefined;
  className?: string;
}

/**
 * Normaliza o texto recebido de resumos legados ou chamadas de IA sem quebras de linha:
 * - Remove prefixo redundante "Resumo por IA" se presente.
 * - Insere quebras de linha antes de marcadores (" - **") e chaves em negrito (" **Chave:**").
 */
export function normalizeMarkdownText(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^Resumo por IA\s*/i, "");

  const lines = cleaned.split("\n");
  const processedLines: string[] = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // Substitui separadores inline " - **", " * **", " • **" por quebra de linha "\n- **"
    line = line.replace(/([^\s])\s+[-•*]\s+\*\*/g, "$1\n- **");

    // Insere quebra de linha antes de pares de chave em negrito " **Chave:**" quando inline
    line = line.replace(/([^-•*\s])\s+(\*\*[\wÀ-ÿ\s\-_]+:\*\*)/gi, "$1\n$2");

    processedLines.push(line);
  }

  return processedLines.join("\n");
}

/**
 * Converte marcação inline de Markdown (`**negrito**`) em nós React <strong>.
 */
function parseInlineMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.*?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    parts.push(<strong key={match.index}>{match[1]}</strong>);
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}

export function FormattedIaSummary({
  text,
  className,
}: FormattedIaSummaryProps) {
  if (!text || !text.trim()) return null;

  const normalized = normalizeMarkdownText(text);
  const rawLines = normalized
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const elements: React.ReactNode[] = [];
  let keyIndex = 0;

  for (const line of rawLines) {
    // 1. Título (###, ##, #)
    if (line.startsWith("#")) {
      const headingText = line.replace(/^#+\s*/, "");
      elements.push(
        <h4 key={keyIndex++} className={styles.heading}>
          {parseInlineMarkdown(headingText)}
        </h4>,
      );
      continue;
    }

    // 2. Verifica se é item de lista
    const isBullet = line.startsWith("- ") || line.startsWith("* ");
    const cleanLine = isBullet ? line.substring(2).trim() : line;

    // 3. Par Chave-Valor em Negrito: "**Chave:** Valor" ou "**Chave**: Valor"
    const kvMatch = cleanLine.match(
      /^(\*\*[^*:]+:\*\*|\*\*[^*:]+\*\*:?)\s*(.*)$/,
    );
    if (kvMatch) {
      const labelText = kvMatch[1]
        .replace(/\*\*/g, "")
        .replace(/:$/, "")
        .trim();
      const valueText = kvMatch[2].trim();

      elements.push(
        <div
          key={keyIndex++}
          className={isBullet ? styles.bulletKvRow : styles.kvRow}
        >
          <span className={styles.kvLabel}>{labelText}:</span>
          {valueText ? (
            <span className={styles.kvValue}>
              {parseInlineMarkdown(valueText)}
            </span>
          ) : null}
        </div>,
      );
      continue;
    }

    // 4. Item de lista simples
    if (isBullet) {
      elements.push(
        <div key={keyIndex++} className={styles.bulletItem}>
          <span className={styles.bulletDot}>•</span>
          <span className={styles.bulletText}>
            {parseInlineMarkdown(cleanLine)}
          </span>
        </div>,
      );
      continue;
    }

    // 5. Parágrafo simples
    elements.push(
      <p key={keyIndex++} className={styles.paragraph}>
        {parseInlineMarkdown(line)}
      </p>,
    );
  }

  return (
    <div className={`${styles.container} ${className ?? ""}`.trim()}>
      {elements}
    </div>
  );
}
