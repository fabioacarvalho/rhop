/** Erro de infraestrutura ao chamar a REST API do GitHub — nunca deve travar o fluxo do usuário (ver `feedbackService`). */
export class ErroGithubApi extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErroGithubApi";
  }
}

export interface CriarIssueInput {
  title: string;
  body: string;
}

export interface CriarIssueResultado {
  url: string;
  numero: number;
}

/**
 * Cria uma issue via `POST /repos/{owner}/{repo}/issues` (V2 do PRD, seção 9).
 * Usa um token de bot (`GITHUB_TOKEN`) restrito a `issues: write` no
 * repositório configurado em `GITHUB_REPO` — nunca lê/derruba dados de
 * `Solicitacao`, só recebe título/corpo já montados.
 */
export async function criarIssue(
  input: CriarIssueInput,
): Promise<CriarIssueResultado> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;

  if (!token || !repo) {
    throw new ErroGithubApi(
      "GITHUB_TOKEN ou GITHUB_REPO não configurados no servidor.",
    );
  }

  const resposta = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: input.title, body: input.body }),
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => "");
    throw new ErroGithubApi(
      `GitHub API respondeu ${resposta.status}: ${detalhe}`,
    );
  }

  const dados = await resposta.json();
  return { url: dados.html_url, numero: dados.number };
}
