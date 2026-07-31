import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// __dirname não existe em ESM; reconstruído via import.meta.url para não
// depender de process.cwd() (que varia conforme o diretório de invocação).
const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    // Resolve manualmente o alias `@/*` do tsconfig.json (ex: `@/lib/prisma`)
    // para a raiz do repo. Alternativa avaliada: plugin `vite-tsconfig-paths`
    // (leria o tsconfig automaticamente) — descartado porque adicionaria uma
    // dependência extra só para resolver um único alias simples; o mapeamento
    // manual abaixo é suficiente e foi validado rodando um teste de verdade.
    alias: {
      "@": rootDir,
    },
  },
  test: {
    // Só services/lógica de backend por enquanto — sem DOM/jsdom.
    environment: "node",
  },
});
