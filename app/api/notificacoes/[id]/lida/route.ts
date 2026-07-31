import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/services/authService';
import { notificacaoService } from '@/lib/services/notificacaoService';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await authService.requireUser();
    const id = params.id;

    if (!id) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const sucesso = await notificacaoService.marcarComoLida(id, user.id);
    if (!sucesso) {
      return NextResponse.json({ error: 'Notificação não encontrada' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Acesso negado') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}
