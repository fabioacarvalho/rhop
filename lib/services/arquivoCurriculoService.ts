import pdfParse from "pdf-parse-new";
import mammoth from "mammoth";
import { createAdminClient } from "@/lib/supabase/admin";

/** Teto de tamanho de arquivo de currículo aceito no upload (TAL-46). */
export const TALENTO_CURRICULO_TAMANHO_MAXIMO_MB = 5;

const TAMANHO_MAXIMO_BYTES =
  TALENTO_CURRICULO_TAMANHO_MAXIMO_MB * 1024 * 1024;

export interface ArquivoCurriculo {
  buffer: Buffer;
  nomeOriginal: string;
  tipoMime: string;
}

export type ResultadoExtracao = { texto: string } | { erro: string };

function extensao(nomeOriginal: string): string {
  const partes = nomeOriginal.toLowerCase().split(".");
  return partes.length > 1 ? `.${partes[partes.length - 1]}` : "";
}

/**
 * Extrai texto de um currículo em PDF, Word (`.docx`) ou Markdown (`.md`)
 * (TAL-43, TAL-45, TAL-46). Roteia pela extensão do nome do arquivo — o
 * `tipoMime` enviado pelo browser nem sempre é confiável (ex: `.md` costuma
 * chegar como `text/plain` ou vazio), então a extensão é a fonte primária.
 *
 * Extensão não suportada ou arquivo maior que o teto -> `{ erro }` antes de
 * tentar processar. Falha de parsing (PDF escaneado, `.docx` corrompido) ->
 * `{ erro }`. Nunca lança.
 */
export async function extrairTexto(
  arquivo: ArquivoCurriculo,
): Promise<ResultadoExtracao> {
  if (arquivo.buffer.byteLength > TAMANHO_MAXIMO_BYTES) {
    return {
      erro: `Arquivo maior que o limite de ${TALENTO_CURRICULO_TAMANHO_MAXIMO_MB}MB.`,
    };
  }

  const ext = extensao(arquivo.nomeOriginal);

  try {
    if (ext === ".pdf") {
      try {
        const resultado = await pdfParse(arquivo.buffer);
        const texto = resultado.text.trim();
        if (!texto) {
          return { erro: "O arquivo PDF foi lido, mas não contém texto extraível." };
        }
        return { texto };
      } catch (err: any) {
        console.error("ERRO PARSE PDF:", err);
        return { erro: "Erro ao processar PDF: " + (err?.message || String(err)) };
      }
    }

    if (ext === ".docx") {
      const resultado = await mammoth.extractRawText({
        buffer: arquivo.buffer,
      });
      const texto = resultado.value.trim();
      if (!texto) {
        return { erro: "Nao foi possivel extrair texto deste arquivo." };
      }
      return { texto };
    }

    if (ext === ".md" || ext === ".markdown") {
      const texto = arquivo.buffer.toString("utf-8").trim();
      if (!texto) {
        return { erro: "Nao foi possivel extrair texto deste arquivo." };
      }
      return { texto };
    }

    return {
      erro: "Formato nao suportado. Envie PDF, Word (.docx) ou Markdown (.md).",
    };
  } catch (err: any) {
    console.error("ERRO EXTRAIR TEXTO:", err);
    return { erro: "Erro pdf: " + (err?.message || String(err)) };
  }
}

/**
 * Armazena o arquivo original de currículo no Supabase Storage, bucket
 * `curriculos` (TAL-47). Retorna a URL pública do arquivo.
 */
export async function armazenarArquivo(
  candidatoIdOuTemp: string,
  arquivo: { buffer: Buffer; nomeOriginal: string; tipoMime: string },
): Promise<string> {
  const supabase = createAdminClient();
  const caminho = `${candidatoIdOuTemp}-${arquivo.nomeOriginal}`;

  const { error } = await supabase.storage
    .from("curriculos")
    .upload(caminho, arquivo.buffer, { 
      upsert: true,
      contentType: arquivo.tipoMime 
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from("curriculos").getPublicUrl(caminho);
  return data.publicUrl;
}
