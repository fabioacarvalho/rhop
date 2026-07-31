import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/services/authService';
import { notificacaoService } from '@/lib/services/notificacaoService';

export async function GET(req: NextRequest) {
  try {
    const user = await authService.requireUser();
    
    // Suporta flag ?contagem=true
    const url = new URL(req.url);
    if (url.searchParams.get('contagem') === 'true') {
      const count = await notificacaoService.obterContagemNaoLidas(user.id);
      return NextResponse.json({ contagem: count });
    }

    const notificacoes = await notificacaoService.listarNotificacoes(user.id);
    return NextResponse.json({ notificacoes });
  } catch (error: any) {
    // requireUser lança erro se não autorizado (que o middleware normalmente já pegaria)
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}
