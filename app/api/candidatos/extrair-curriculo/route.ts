import {
  requireUser,
  ErroNaoAutenticado,
  ErroNaoAutorizado,
} from "@/lib/services/authService";
import {
  armazenarArquivo,
  extrairTexto,
} from "@/lib/services/arquivoCurriculoService";
import { Role } from "@/lib/generated/prisma/client";

/**
 * `POST /api/candidatos/extrair-curriculo` (TAL-43, TAL-45, TAL-46, TAL-47).
 *
 * Multipart/form-data com um campo `arquivo`. Extrai o texto do currículo
 * (PDF/Word/Markdown) para conferência ANTES do cadastro em si
 * (`POST /api/candidatos`, TAL-44) — o usuário ainda pode editar o texto
 * retornado antes de submeter o formulário.
 *
 * - Sem sessao/papel SOLICITANTE -> 401/403.
 * - Sem campo `arquivo` -> 400.
 * - Formato nao suportado ou falha de extracao -> 422, arquivo NAO e
 *   armazenado (so armazena apos extracao bem-sucedida).
 * - Sucesso -> 200 `{ texto, arquivo_url }`.
 */
export async function POST(request: Request) {
  try {
    await requireUser([Role.GESTOR, Role.RH_ADMIN]);

    const formData = await request.formData();
    const arquivo = formData.get("arquivo");

    if (!(arquivo instanceof File)) {
      return Response.json(
        { error: "Campo 'arquivo' e obrigatorio." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await arquivo.arrayBuffer());
    const resultado = await extrairTexto({
      buffer,
      nomeOriginal: arquivo.name,
      tipoMime: arquivo.type,
    });

    if ("erro" in resultado) {
      return Response.json({ error: resultado.erro }, { status: 422 });
    }

    const arquivoUrl = await armazenarArquivo(`temp-${Date.now()}`, {
      buffer,
      nomeOriginal: arquivo.name,
    });

    return Response.json(
      { texto: resultado.texto, arquivo_url: arquivoUrl },
      { status: 200 },
    );
  } catch (erro) {
    if (erro instanceof ErroNaoAutenticado) {
      return Response.json({ error: erro.message }, { status: 401 });
    }
    if (erro instanceof ErroNaoAutorizado) {
      return Response.json({ error: erro.message }, { status: 403 });
    }
    throw erro;
  }
}
