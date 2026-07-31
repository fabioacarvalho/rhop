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

/**
 * Filtros de consulta de `Log` (AUD-06 a AUD-09, AUD-11).
 *
 * Todos os campos são opcionais e combinados com AND lógico em `listar`:
 * apenas os filtros informados entram no `where` (ausência de um filtro não
 * restringe por ele). `data_inicio`/`data_fim` podem vir independentemente
 * (um sem o outro) e delimitam `criado_em` via `gte`/`lte`.
 */
export interface LogFiltro {
  tipo?: "AUDITORIA" | "ERRO";
  entidade?: string;
  usuario_id?: string;
  data_inicio?: Date;
  data_fim?: Date;
  page?: number;
  pageSize?: number;
}

const PAGE_SIZE_PADRAO = 20;

/** Registro de `Log` com o `usuario` (nome/e-mail) já incluído via join. */
export type LogComUsuario = Prisma.LogGetPayload<{
  include: { usuario: { select: { nome: true; email: true } } };
}>;

/**
 * Consulta paginada de `Log` (AUD-06 a AUD-09, AUD-11).
 *
 * - Combina `tipo`, `entidade`, `usuario_id` e período (`data_inicio`/
 *   `data_fim`) com AND lógico — interseção, não união.
 * - `orderBy criado_em desc`, preservado entre páginas.
 * - `include usuario: { nome, email }` — `usuario` vem `null` quando
 *   `usuario_id` é nulo (log de sistema).
 * - `total` é a contagem com o MESMO `where`, sem paginação (para a UI
 *   calcular o número de páginas).
 */
export async function listar(
  filtros: LogFiltro = {}
): Promise<{ logs: LogComUsuario[]; total: number }> {
  const page = filtros.page ?? 1;
  const pageSize = filtros.pageSize ?? PAGE_SIZE_PADRAO;

  const where: Prisma.LogWhereInput = {
    ...(filtros.tipo !== undefined && { tipo: filtros.tipo }),
    ...(filtros.entidade !== undefined && { entidade: filtros.entidade }),
    ...(filtros.usuario_id !== undefined && {
      usuario_id: filtros.usuario_id,
    }),
    ...((filtros.data_inicio !== undefined ||
      filtros.data_fim !== undefined) && {
      criado_em: {
        ...(filtros.data_inicio !== undefined && { gte: filtros.data_inicio }),
        ...(filtros.data_fim !== undefined && { lte: filtros.data_fim }),
      },
    }),
  };

  const [logs, total] = await Promise.all([
    prisma.log.findMany({
      where,
      include: { usuario: { select: { nome: true, email: true } } },
      orderBy: { criado_em: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.log.count({ where }),
  ]);

  return { logs, total };
}
