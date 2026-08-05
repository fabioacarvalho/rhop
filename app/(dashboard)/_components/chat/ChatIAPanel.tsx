"use client";

import { useRef, useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";
import styles from "./chat.module.css";

interface ChatIAPanelProps {
  onClose: () => void;
}

export function ChatIAPanel({ onClose }: ChatIAPanelProps) {
  const { messages, sendMessage, status } = useChat({ api: "/api/chat" });
  const [input, setInput] = useState("");
  const isLoading = status === "streaming" || status === "submitted";

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    // ai@7: sendMessage aceita { text } ou CreateUIMessage (com parts)
    sendMessage({ text });
    setInput("");
  };

  // Em ai@7, UIMessage pode ter `parts` ou `content` dependendo da conversão interna.
  const getMessageText = (m: (typeof messages)[number]): string | null => {
    // console.log para debug
    console.log("Message:", m);
    
    if (m.parts && m.parts.length > 0) {
      const joined = m.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("");
      return joined || null;
    }
    
    if (typeof m.content === "string") {
      return m.content;
    }
    
    return null;
  };

  return (
    <div className={styles.panelWrapper}>
      <div className={styles.panelHead}>
        <div className={styles.panelHeadTitle}>
          <div className={styles.modalSeal}>OP</div> OP Conecta IA
        </div>
        <button className={styles.panelClose} onClick={onClose} title="Fechar chat">
          ×
        </button>
      </div>

      <div className={styles.messageArea}>
        {messages.length === 0 && (
          <div
            className={styles.messageAi}
            style={{ alignSelf: "center", textAlign: "center", marginTop: "20px" }}
          >
            Olá! Sou o assistente de RH do OP Conecta.
            <br />
            Como posso ajudar com seus dados hoje?
          </div>
        )}

        {messages.map((m) => {
          const content = getMessageText(m);
          if (!content) return null;

          return (
            <div
              key={m.id}
              className={m.role === "user" ? styles.messageUser : styles.messageAi}
            >
              {m.role === "assistant" && <strong>✦ OP Conecta IA</strong>}
              {content}
            </div>
          );
        })}

        {isLoading && (
          <div className={styles.messageAi}>
            <strong>✦ OP Conecta IA</strong>
            <span>Consultando dados...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className={styles.inputArea} onSubmit={handleSubmit}>
        <input
          className={styles.inputField}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pergunte sobre seus indicadores..."
          disabled={isLoading}
        />
        <button
          type="submit"
          className={styles.sendBtn}
          disabled={isLoading || input.trim() === ""}
        >
          {isLoading ? "..." : "Enviar"}
        </button>
      </form>
    </div>
  );
}
