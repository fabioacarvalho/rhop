import { Role } from "@/lib/generated/prisma/enums";

export type TipoRelato = "Bug" | "Melhoria" | "Dúvida";

export interface BuildGithubIssueUrlInput {
  repo: string;
  tipo: TipoRelato;
  tela: string;
  papel: Role;
  titulo: string;
  descricao: string;
}

const ROLE_LABELS: Record<Role, string> = {
  [Role.SOLICITANTE]: "Solicitante",
  [Role.GESTOR]: "Gestor",
  [Role.RH_ADMIN]: "RH_Admin",
};

/**
 * Monta a URL de nova issue do GitHub com titulo/corpo pre-preenchidos
 * (HELP-04). So recebe tipo/tela/papel/descricao — nunca e-mail ou nome —
 * tornando estruturalmente impossivel vazar dado sensivel por aqui (HELP-08).
 */
export function buildGithubIssueUrl({
  repo,
  tipo,
  tela,
  papel,
  titulo,
  descricao,
}: BuildGithubIssueUrlInput): string {
  const tituloFinal = titulo.trim() || "(sem título)";
  const corpo = [
    `**Tipo:** ${tipo}`,
    `**Tela:** ${tela}`,
    `**Papel:** ${ROLE_LABELS[papel]}`,
    "",
    descricao.trim(),
  ].join("\n");

  const params = new URLSearchParams({
    title: `[${tipo}] ${tituloFinal}`,
    body: corpo,
  });

  return `https://github.com/${repo}/issues/new?${params.toString()}`;
}
