import { prisma } from "@/lib/prisma";
import {
  Role,
  StatusSolicitacao,
  TipoNotificacao,
  type Solicitacao,
} from "@/lib/generated/prisma/client";
import { registrar } from "@/lib/services/logService";
import { notificacaoService } from "@/lib/services/notificacaoService";

const THROTTLE_COBRANCA_MS = 24 * 60 * 60 * 1000;

/** Resumo de uma execucao de `verificarSla` (SLA-07). */
export interface SlaCheckResumo {
  verificadas: number;
  marcadas_atrasadas: number;
  cobrancas_disparadas: number;
  erros: number;
}

type SolicitacaoCandidata = Solicitacao & {
  solicitante: { gestor_id: string | null };
};

/**
 * Resolve os destinatarios da cobranca para a etapa atual (SLA-04).
 *
 * - `GESTOR` -> `[gestor_id]` do solicitante, ou `[]` se ausente.
 * - `RH_ADMIN` -> id de todos os `User` com `role = RH_ADMIN` (fan-out: um
 *   admin aleatorio nao pode ser o unico avisado), ou `[]` se nenhum existir.
 * - Qualquer outra etapa -> `[]` (nao ha aprovador elegivel para cobranca).
 */
export async function resolveAprovadores(
  solicitacao: Pick<SolicitacaoCandidata, "etapa_atual" | "solicitante">,
): Promise<string[]> {
  if (solicitacao.etapa_atual === Role.GESTOR) {
    return solicitacao.solicitante.gestor_id
      ? [solicitacao.solicitante.gestor_id]
      : [];
  }

  if (solicitacao.etapa_atual === Role.RH_ADMIN) {
    const admins = await prisma.user.findMany({
      where: { role: Role.RH_ADMIN },
      select: { id: true },
    });
    return admins.map((a) => a.id);
  }

  return [];
}

/**
 * Varredura completa de SLA (SLA-01 a SLA-05, SLA-07).
 *
 * Cada solicitacao candidata e processada em isolamento: uma falha nao
 * aborta o job nem impede o processamento das demais (SLA-05). Marcacao de
 * atraso e idempotente (update condicional); cobranca e limitada a 1x/dia
 * por solicitacao via `ultima_cobranca_em`.
 */
export async function verificarSla(
  now: Date = new Date(),
): Promise<SlaCheckResumo> {
  const resumo: SlaCheckResumo = {
    verificadas: 0,
    marcadas_atrasadas: 0,
    cobrancas_disparadas: 0,
    erros: 0,
  };

  const candidatas = await prisma.solicitacao.findMany({
    where: {
      status: StatusSolicitacao.PENDENTE,
      prazo_sla: { lt: now },
    },
    include: {
      solicitante: { select: { gestor_id: true } },
    },
  });

  for (const candidata of candidatas as SolicitacaoCandidata[]) {
    resumo.verificadas += 1;

    try {
      await processarCandidata(candidata, now, resumo);
    } catch (erro) {
      resumo.erros += 1;
      await registrar({
        tipo: "ERRO",
        entidade: "Solicitacao",
        entidade_id: candidata.id,
        acao: "ERRO_PROCESSAMENTO_SLA",
        usuario_id: null,
        detalhes: { erro: erro instanceof Error ? erro.message : erro },
      });
    }
  }

  await registrar({
    tipo: "AUDITORIA",
    entidade: "SlaCheck",
    entidade_id: "sla-check",
    acao: "SLA_CHECK_RESUMO",
    usuario_id: null,
    detalhes: resumo,
  });

  return resumo;
}

async function processarCandidata(
  candidata: SolicitacaoCandidata,
  now: Date,
  resumo: SlaCheckResumo,
): Promise<void> {
  const marcacao = await prisma.solicitacao.updateMany({
    where: { id: candidata.id, status: StatusSolicitacao.PENDENTE, atrasada_em: null },
    data: { atrasada_em: now },
  });

  if (marcacao.count === 1) {
    resumo.marcadas_atrasadas += 1;
    await registrar({
      tipo: "AUDITORIA",
      entidade: "Solicitacao",
      entidade_id: candidata.id,
      acao: "MARCACAO_ATRASO",
      usuario_id: null,
      detalhes: { etapa_atual: candidata.etapa_atual, prazo_sla: candidata.prazo_sla },
    });
  }

  const fresh = await prisma.solicitacao.findUnique({
    where: { id: candidata.id },
    include: { solicitante: { select: { gestor_id: true } } },
  });

  if (!fresh || fresh.status !== StatusSolicitacao.PENDENTE) {
    // Decidida entre a leitura inicial e o processamento — nao cobra.
    return;
  }

  const podeCobrar =
    fresh.ultima_cobranca_em == null ||
    now.getTime() - fresh.ultima_cobranca_em.getTime() >= THROTTLE_COBRANCA_MS;

  if (!podeCobrar) {
    return;
  }

  const aprovadores = await resolveAprovadores(fresh as SolicitacaoCandidata);

  if (aprovadores.length === 0) {
    resumo.erros += 1;
    await registrar({
      tipo: "ERRO",
      entidade: "Solicitacao",
      entidade_id: candidata.id,
      acao: "DESTINATARIO_SLA",
      usuario_id: null,
      detalhes: { etapa_atual: fresh.etapa_atual },
    });
    return;
  }

  let disparouAlguma = false;

  for (const aprovadorId of aprovadores) {
    try {
      await notificacaoService.notificarEvento({
        usuario_id: aprovadorId,
        solicitacao_id: candidata.id,
        tipo: TipoNotificacao.COBRANCA_SLA,
        mensagem: `Cobrança SLA: solicitação ${candidata.id} na etapa ${fresh.etapa_atual}`,
        link: "/aprovacoes",
      });
      disparouAlguma = true;
      resumo.cobrancas_disparadas += 1;
    } catch (erro) {
      resumo.erros += 1;
      await registrar({
        tipo: "ERRO",
        entidade: "Solicitacao",
        entidade_id: candidata.id,
        acao: "FALHA_COBRANCA_SLA",
        usuario_id: aprovadorId,
        detalhes: { erro: erro instanceof Error ? erro.message : erro },
      });
    }
  }

  if (disparouAlguma) {
    await prisma.solicitacao.update({
      where: { id: candidata.id },
      data: { ultima_cobranca_em: now },
    });
  }
}
