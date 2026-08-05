import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetText, mockDestroy, mockPDFParseCtor } = vi.hoisted(() => {
  const mockGetText = vi.fn();
  const mockDestroy = vi.fn();
  const mockPDFParseCtor = vi.fn(function PDFParseMock() {
    return { getText: mockGetText, destroy: mockDestroy };
  });
  return { mockGetText, mockDestroy, mockPDFParseCtor };
});

vi.mock("pdf-parse", () => ({
  PDFParse: mockPDFParseCtor,
}));

vi.mock("mammoth", () => ({
  default: { extractRawText: vi.fn() },
}));

const { mockUpload, mockGetPublicUrl, mockFrom } = vi.hoisted(() => {
  const mockUpload = vi.fn();
  const mockGetPublicUrl = vi.fn();
  const mockFrom = vi.fn(() => ({
    upload: mockUpload,
    getPublicUrl: mockGetPublicUrl,
  }));
  return { mockUpload, mockGetPublicUrl, mockFrom };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    storage: { from: mockFrom },
  })),
}));

import mammoth from "mammoth";
import {
  TALENTO_CURRICULO_TAMANHO_MAXIMO_MB,
  armazenarArquivo,
  extrairTexto,
} from "./arquivoCurriculoService";

const mockExtractRawText = vi.mocked(mammoth.extractRawText);

beforeEach(() => {
  mockPDFParseCtor.mockClear();
  mockGetText.mockReset();
  mockDestroy.mockReset();
  mockExtractRawText.mockReset();
  mockUpload.mockReset();
  mockGetPublicUrl.mockReset();
  mockFrom.mockClear();
});

function arquivo(overrides: Partial<{ buffer: Buffer; nomeOriginal: string; tipoMime: string }> = {}) {
  return {
    buffer: Buffer.from("conteudo"),
    nomeOriginal: "curriculo.pdf",
    tipoMime: "application/pdf",
    ...overrides,
  };
}

describe("arquivoCurriculoService.extrairTexto", () => {
  it("PDF valido -> extrai texto com sucesso e chama destroy()", async () => {
    mockGetText.mockResolvedValueOnce({ text: "Texto do curriculo em PDF." });

    const resultado = await extrairTexto(arquivo());

    expect(resultado).toEqual({ texto: "Texto do curriculo em PDF." });
    expect(mockDestroy).toHaveBeenCalledOnce();
  });

  it("Word (.docx) valido -> extrai texto com sucesso", async () => {
    mockExtractRawText.mockResolvedValueOnce({ value: "Texto do curriculo em Word." } as never);

    const resultado = await extrairTexto(
      arquivo({ nomeOriginal: "curriculo.docx", tipoMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
    );

    expect(resultado).toEqual({ texto: "Texto do curriculo em Word." });
  });

  it("Markdown valido -> le como texto puro, sem lib de parsing", async () => {
    const resultado = await extrairTexto(
      arquivo({
        buffer: Buffer.from("# Curriculo\n\nExperiencia solida."),
        nomeOriginal: "curriculo.md",
        tipoMime: "text/markdown",
      }),
    );

    expect(resultado).toEqual({ texto: "# Curriculo\n\nExperiencia solida." });
    expect(mockPDFParseCtor).not.toHaveBeenCalled();
    expect(mockExtractRawText).not.toHaveBeenCalled();
  });

  it("formato nao suportado (.png) -> erro, sem tentar processar", async () => {
    const resultado = await extrairTexto(
      arquivo({ nomeOriginal: "foto.png", tipoMime: "image/png" }),
    );

    expect(resultado).toEqual({ erro: expect.stringContaining("nao suportado") });
    expect(mockPDFParseCtor).not.toHaveBeenCalled();
    expect(mockExtractRawText).not.toHaveBeenCalled();
  });

  it("PDF escaneado (texto vazio) -> erro, ainda assim chama destroy()", async () => {
    mockGetText.mockResolvedValueOnce({ text: "   " });

    const resultado = await extrairTexto(arquivo());

    expect(resultado).toEqual({ erro: expect.any(String) });
    expect(mockDestroy).toHaveBeenCalledOnce();
  });

  it("PDF corrompido (lanca excecao) -> erro, nunca propaga", async () => {
    mockGetText.mockRejectedValueOnce(new Error("arquivo invalido"));

    const resultado = await extrairTexto(arquivo());

    expect(resultado).toEqual({ erro: expect.any(String) });
    expect(mockDestroy).toHaveBeenCalledOnce();
  });

  it("arquivo maior que o limite -> erro antes de tentar extrair", async () => {
    const bufferGrande = Buffer.alloc(
      TALENTO_CURRICULO_TAMANHO_MAXIMO_MB * 1024 * 1024 + 1,
    );

    const resultado = await extrairTexto(arquivo({ buffer: bufferGrande }));

    expect(resultado).toEqual({ erro: expect.stringContaining("limite") });
    expect(mockPDFParseCtor).not.toHaveBeenCalled();
  });
});

describe("arquivoCurriculoService.armazenarArquivo", () => {
  it("caminho feliz -> retorna URL publica", async () => {
    mockUpload.mockResolvedValueOnce({ data: {}, error: null });
    mockGetPublicUrl.mockReturnValueOnce({
      data: { publicUrl: "https://storage.example/curriculos/cand-1-curriculo.pdf" },
    });

    const url = await armazenarArquivo("cand-1", {
      buffer: Buffer.from("conteudo"),
      nomeOriginal: "curriculo.pdf",
      tipoMime: "application/pdf",
    });

    expect(url).toBe("https://storage.example/curriculos/cand-1-curriculo.pdf");
    expect(mockFrom).toHaveBeenCalledWith("curriculos");
  });

  it("falha no upload -> propaga o erro", async () => {
    mockUpload.mockResolvedValueOnce({
      data: null,
      error: new Error("bucket indisponivel"),
    });

    await expect(
      armazenarArquivo("cand-1", {
        buffer: Buffer.from("conteudo"),
        nomeOriginal: "curriculo.pdf",
        tipoMime: "application/pdf",
      }),
    ).rejects.toThrow("bucket indisponivel");
  });
});
