import { Role } from "@/lib/generated/prisma/enums";

export type TipoRelato = "Bug" | "Melhoria" | "Dúvida";

export interface MontarIssuePayloadInput {
  tipo: TipoRelato;
  tela: string;
  papel: Role;
  titulo: string;
  descricao: string;
  screenshotUrl?: string;
}

const ROLE_LABELS: Record<Role, string> = {
  [Role.SOLICITANTE]: "Solicitante",
  [Role.GESTOR]: "Gestor",
  [Role.RH_ADMIN]: "RH_Admin",
};

const TIPO_GITHUB_LABEL: Record<TipoRelato, string> = {
  Bug: "bug",
  Melhoria: "enhancement",
  "Dúvida": "question",
};

/**
 * Monta titulo/corpo/labels da issue do GitHub (HELP-04). So recebe tipo/
 * tela/papel/descricao — nunca e-mail ou nome — tornando estruturalmente
 * impossivel vazar dado sensivel por aqui (HELP-08).
 */
export function montarIssuePayload({
  tipo,
  tela,
  papel,
  titulo,
  descricao,
  screenshotUrl,
}: MontarIssuePayloadInput): { title: string; body: string; labels: string[] } {
  const tituloFinal = titulo.trim() || "(sem título)";
  const bodyItems = [
    `**Tipo:** ${tipo}`,
    `**Tela:** ${tela}`,
    `**Papel:** ${ROLE_LABELS[papel]}`,
    "",
    descricao.trim(),
  ];

  if (screenshotUrl) {
    bodyItems.push("", "---", `**Contexto visual:**`, `![Screenshot da tela](${screenshotUrl})`);
  }

  const body = bodyItems.join("\n");

  return {
    title: `[${tipo}] ${tituloFinal}`,
    body,
    labels: [TIPO_GITHUB_LABEL[tipo]],
  };
}
