import { prisma } from '../prisma';
import { registrar } from './logService';
import { resendService } from './resendService';
import { TipoNotificacao } from '../generated/prisma/client';

export type NotificacaoInput = {
  usuario_id: string; // Destinatário
  solicitacao_id: string;
  tipo: TipoNotificacao;
  mensagem: string;
  link: string;
};

export const notificacaoService = {
  async notificarEvento(input: NotificacaoInput): Promise<void> {
    if (!input.usuario_id) {
      await registrar({
        tipo: 'ERRO',
        entidade: 'Notificacao',
        entidade_id: input.solicitacao_id,
        acao: 'DESTINATARIO_NULO',
        usuario_id: null,
        detalhes: { input }
      });
      return;
    }

    try {
      // 1. Regra de Throttle: Se for COBRANCA_SLA, max 1x/dia para a mesma solicitacao_id e usuario_id
      if (input.tipo === 'COBRANCA_SLA') {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const jaEnviada = await prisma.notificacao.findFirst({
          where: {
            solicitacao_id: input.solicitacao_id,
            usuario_id: input.usuario_id,
            tipo: 'COBRANCA_SLA',
            criado_em: {
              gte: hoje
            }
          }
        });

        if (jaEnviada) {
          // Já houve cobrança hoje, throttle ativado
          return;
        }
      }

      // 2. Cria notificação in-app
      const notificacao = await prisma.notificacao.create({
        data: {
          usuario_id: input.usuario_id,
          solicitacao_id: input.solicitacao_id,
          tipo: input.tipo,
          mensagem: input.mensagem,
          link: input.link,
          lida: false
        },
        include: {
          usuario: true,
          solicitacao: {
            include: { tipoFluxo: true }
          }
        }
      });

      // 3. Valida se usuário possui e-mail
      if (!notificacao.usuario.email) {
        await registrar({
          tipo: 'ERRO',
          entidade: 'User',
          entidade_id: input.usuario_id,
          acao: 'USUARIO_SEM_EMAIL',
          usuario_id: input.usuario_id,
          detalhes: { notificacao_id: notificacao.id }
        });
        return;
      }

      // 4. Envia E-mail Assincronamente/Fire and Forget (com await para Vercel não dropar se não tiver waitUntil configurado)
      // Definimos o assunto baseado no tipo
      let subject = `RHOP: Nova atualização na solicitação ${notificacao.solicitacao.tipoFluxo.nome}`;
      switch (input.tipo) {
        case 'CRIACAO': subject = 'RHOP: Nova solicitação criada'; break;
        case 'AVANCO_ETAPA': subject = 'RHOP: Solicitação aguardando sua aprovação'; break;
        case 'APROVACAO_FINAL': subject = 'RHOP: Solicitação aprovada!'; break;
        case 'REJEICAO': subject = 'RHOP: Solicitação rejeitada'; break;
        case 'COBRANCA_SLA': subject = 'RHOP: URGENTE - Solicitação atrasada na sua etapa'; break;
      }

      const textoEmail = `${input.mensagem}\n\nAcesse o link abaixo para visualizar:\n${input.link}`;

      await resendService.enviarEmail({
        to: notificacao.usuario.email,
        subject,
        text: textoEmail,
        entidade_id: notificacao.id
      });

    } catch (e: any) {
      // Falha ao criar a notificação in-app (banco fora, etc.)
      await registrar({
        tipo: 'ERRO',
        entidade: 'Notificacao',
        entidade_id: input.solicitacao_id,
        acao: 'ERRO_CRIACAO_NOTIFICACAO',
        usuario_id: input.usuario_id,
        detalhes: { erro: e.message || e }
      }).catch(() => {}); // catch extra caso logService falhe também
    }
  },

  async listarNotificacoes(usuario_id: string) {
    return await prisma.notificacao.findMany({
      where: { usuario_id },
      orderBy: { criado_em: 'desc' },
      take: 50 // Limite razoável para a central
    });
  },

  async obterContagemNaoLidas(usuario_id: string) {
    return await prisma.notificacao.count({
      where: {
        usuario_id,
        lida: false
      }
    });
  },

  async marcarComoLida(notificacao_id: string, usuario_id: string) {
    // Validar a posse (somente o dono pode marcar como lida)
    const notificacao = await prisma.notificacao.findUnique({ where: { id: notificacao_id }});
    
    if (!notificacao) return false;
    if (notificacao.usuario_id !== usuario_id) throw new Error('Acesso negado');

    await prisma.notificacao.update({
      where: { id: notificacao_id },
      data: { lida: true }
    });

    return true;
  }
};
