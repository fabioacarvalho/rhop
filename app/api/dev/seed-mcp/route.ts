import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as crypto from "crypto";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Only in dev" }, { status: 403 });
  }

  const token = `rhop_${crypto.randomBytes(24).toString('hex')}`;
  
  const apiKey = await prisma.apiKey.create({
    data: {
      key: token,
      nome: "Admin API Key",
      ativo: true,
    }
  });

  return NextResponse.json({
    message: "API Key gerada com sucesso",
    key: apiKey.key,
    instrucao: "Use esta chave no header: Authorization: Bearer <Key>"
  });
}
