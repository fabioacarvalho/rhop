import "dotenv/config";
import { prisma } from "../lib/prisma.js";

async function main() {
  const logs = await prisma.log.findMany({
    where: { tipo: "ERRO" },
    orderBy: { criado_em: "desc" },
    take: 5,
  });
  console.log(JSON.stringify(logs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
