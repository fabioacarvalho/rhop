import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/services/authService';
import { notificacaoService } from '@/lib/services/notificacaoService';

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    
    // Suporta flag ?contagem=true
    const url = new URL(req.url);
    if (url.searchParams.get('contagem') === 'true') {
      const count = await notificacaoService.obterContagemNaoLidas(user.id);
      return NextResponse.json({ contagem: count });
    }

    const notificacoes = await notificacaoService.listarNotificacoes(user.id);
    return NextResponse.json({ notificacoes });
  } catch (error: any) {
    if (error.name === "ErroNaoAutenticado" || error.name === "ErroNaoAutorizado") {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("Erro interno em /api/notificacoes:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
