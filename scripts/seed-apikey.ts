import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local" });

import { prisma } from "../lib/prisma";
import * as crypto from "crypto";

async function main() {
  const token = `rhop_${crypto.randomBytes(24).toString('hex')}`;
  
  const apiKey = await prisma.apiKey.create({
    data: {
      key: token,
      nome: "Admin API Key",
      ativo: true,
    }
  });

  console.log("API Key gerada com sucesso:");
  console.log("----------------------------------------");
  console.log(`Key: ${apiKey.key}`);
  console.log("----------------------------------------");
  console.log("Use esta chave no header: Authorization: Bearer <Key>");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
