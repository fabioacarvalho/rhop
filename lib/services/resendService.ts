import { Resend } from 'resend';
import { registrar } from './logService';

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export type EmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  entidade_id?: string; // para log
};

export const resendService = {
  async enviarEmail(input: EmailInput): Promise<boolean> {
    if (!resend) {
      console.warn('RESEND_API_KEY não configurada. Simulando envio de e-mail.', input);
      return true;
    }

    try {
      const { error } = await resend.emails.send({
        from: 'RHOP Notificações <onboarding@resend.dev>', // Usando domínio de teste do Resend MVP
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html || input.text,
      });

      if (error) {
        await registrar({
          tipo: 'ERRO',
          entidade: 'Email',
          entidade_id: input.entidade_id || 'N/A',
          acao: 'FALHA_ENVIO_EMAIL',
          usuario_id: null,
          detalhes: { error, to: input.to }
        });
        return false;
      }

      return true;
    } catch (e: any) {
      await registrar({
        tipo: 'ERRO',
        entidade: 'Email',
        entidade_id: input.entidade_id || 'N/A',
        acao: 'EXCEPTION_ENVIO_EMAIL',
        usuario_id: null,
        detalhes: { error: e.message || 'Erro desconhecido', to: input.to }
      });
      return false;
    }
  }
};
