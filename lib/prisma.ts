import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Singleton do Prisma Client via globalThis, para evitar múltiplas conexões
// durante hot-reload do Next.js em modo dev.
// https://pris.ly/d/help/next-js-best-practices

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  // Em dev, a rede deste ambiente intercepta TLS com um certificado
  // self-signed (proxy corporativo/antivírus) — o driver `pg` rejeita a
  // cadeia por padrão. Em produção (Vercel) essa interceptação não existe,
  // então mantemos a validação padrão de certificado.
  ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
