import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";

/**
 * Evento de auditoria/erro a ser persistido em `Log`.
 *
 * `tipo` é fechado em 'AUDITORIA' | 'ERRO' (LogTipo do schema) — qualquer
 * outro valor é erro de contrato do chamador e deve lançar em dev/teste,
 * nunca falhar silenciosamente.
 */
export interface LogEvento {
  tipo: "AUDITORIA" | "ERRO";
  entidade: string;
  entidade_id: string;
  acao: string;
  usuario_id?: string | null;
  detalhes?: unknown;
}

const TIPOS_VALIDOS = ["AUDITORIA", "ERRO"] as const;

/**
 * Ponto único de gravação de `Log` (AUD-01, AUD-03, AUD-04).
 *
 * - Lança erro síncrono se `tipo` não for exatamente 'AUDITORIA' ou 'ERRO':
 *   isso é bug de contrato do chamador, não falha de infraestrutura, e deve
 *   estourar antes de qualquer tentativa de persistência (AUD-04).
 * - Falha de persistência (DB indisponível, timeout etc.) é capturada
 *   internamente e NUNCA propagada ao chamador — o fluxo de negócio que
 *   chamou `registrar` sempre continua normalmente (AUD-03). Nunca tenta
 *   gravar um novo log para essa própria falha (evitaria recursão infinita).
 */
export async function registrar(evento: LogEvento): Promise<void> {
  if (!TIPOS_VALIDOS.includes(evento.tipo)) {
    throw new Error(
      `logService.registrar: tipo invalido "${String(evento.tipo)}". Esperado 'AUDITORIA' ou 'ERRO'.`
    );
  }

  try {
    const data: Prisma.LogUncheckedCreateInput = {
      tipo: evento.tipo,
      entidade: evento.entidade,
      entidade_id: evento.entidade_id,
      acao: evento.acao,
      usuario_id: evento.usuario_id ?? null,
      detalhes:
        evento.detalhes === undefined
          ? undefined
          : (evento.detalhes as Prisma.InputJsonValue),
    };
    await prisma.log.create({ data });
  } catch {
    // Falha de persistência é intencionalmente engolida: IA/log nunca pode
    // travar o fluxo chamador (CLAUDE.md), e não tentamos logar a própria
    // falha de log para evitar recursão infinita.
  }
}
