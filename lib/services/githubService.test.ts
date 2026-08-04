import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErroGithubApi, criarIssue } from "./githubService";

const originalToken = process.env.GITHUB_TOKEN;
const originalRepo = process.env.GITHUB_REPO;

beforeEach(() => {
  process.env.GITHUB_TOKEN = "test-token";
  process.env.GITHUB_REPO = "fabioacarvalho/rhop";
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
  else process.env.GITHUB_TOKEN = originalToken;
  if (originalRepo === undefined) delete process.env.GITHUB_REPO;
  else process.env.GITHUB_REPO = originalRepo;
});

describe("githubService.criarIssue", () => {
  it("sucesso -> retorna url e numero, chama a API correta", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        html_url: "https://github.com/fabioacarvalho/rhop/issues/42",
        number: 42,
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const resultado = await criarIssue({
      title: "[Bug] teste",
      body: "corpo da issue",
    });

    expect(resultado).toEqual({
      url: "https://github.com/fabioacarvalho/rhop/issues/42",
      numero: 42,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/fabioacarvalho/rhop/issues",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
        body: JSON.stringify({ title: "[Bug] teste", body: "corpo da issue" }),
      }),
    );
  });

  it("envia labels quando informadas", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        html_url: "https://github.com/fabioacarvalho/rhop/issues/42",
        number: 42,
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await criarIssue({
      title: "[Bug] teste",
      body: "corpo da issue",
      labels: ["bug"],
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/fabioacarvalho/rhop/issues",
      expect.objectContaining({
        body: JSON.stringify({
          title: "[Bug] teste",
          body: "corpo da issue",
          labels: ["bug"],
        }),
      }),
    );
  });

  it("GITHUB_TOKEN ausente -> lança ErroGithubApi sem chamar fetch", async () => {
    delete process.env.GITHUB_TOKEN;
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    await expect(
      criarIssue({ title: "x", body: "y" }),
    ).rejects.toThrow(ErroGithubApi);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("GITHUB_REPO ausente -> lança ErroGithubApi sem chamar fetch", async () => {
    delete process.env.GITHUB_REPO;
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    await expect(
      criarIssue({ title: "x", body: "y" }),
    ).rejects.toThrow(ErroGithubApi);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("resposta nao-ok da API -> lança ErroGithubApi com status", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Bad credentials",
    });
    vi.stubGlobal("fetch", mockFetch);

    await expect(
      criarIssue({ title: "x", body: "y" }),
    ).rejects.toThrow(/401/);
  });
});
