// Importa de `enums` (nao `client`) porque este modulo e usado por
// Client Components (Sidebar/Topbar) — `client.ts` traz o runtime do
// Prisma inteiro e quebra o bundle de browser.
import { Role } from "@/lib/generated/prisma/enums";

export interface NavItem {
  label: string;
  href: string;
  roles: Role[];
}

export interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
}

/**
 * Fonte unica de verdade da navegacao (NAV-01..NAV-05, NAV-16/17).
 * Rotas conforme design.md — confirmadas nos tasks.md de `solicitacoes`,
 * `dashboard-visao-geral` e `painel-insights`; `banco-de-talentos` ainda
 * sem design/tasks proprios, rota `/banco-de-talentos` proposta aqui.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    key: "meu-trabalho",
    label: "Meu trabalho",
    items: [
      {
        label: "Minhas Solicitações",
        href: "/solicitacoes",
        roles: [Role.SOLICITANTE, Role.GESTOR, Role.RH_ADMIN],
      },
      {
        label: "Minha jornada",
        href: "/minha-jornada",
        roles: [Role.SOLICITANTE, Role.GESTOR, Role.RH_ADMIN],
      },
      {
        label: "Aprovações Pendentes",
        href: "/aprovacoes",
        roles: [Role.GESTOR, Role.RH_ADMIN],
      },
    ],
  },
  {
    key: "visao-geral",
    label: "Visão geral",
    items: [
      {
        label: "Dashboard",
        href: "/",
        roles: [Role.GESTOR, Role.RH_ADMIN],
      },
      {
        label: "Painel de Insights",
        href: "/insights",
        roles: [Role.GESTOR, Role.RH_ADMIN],
      },
      {
        label: "Pipeline",
        href: "/pipeline",
        roles: [Role.GESTOR, Role.RH_ADMIN],
      },
    ],
  },
  {
    key: "recrutamento",
    label: "Recrutamento",
    items: [
      {
        label: "Banco de Talentos",
        href: "/banco-de-talentos",
        roles: [Role.GESTOR, Role.RH_ADMIN],
      },
    ],
  },
  {
    key: "administracao",
    label: "Administração",
    items: [
      {
        label: "Configuração de Fluxos",
        href: "/configuracao-fluxos",
        roles: [Role.RH_ADMIN],
      },
      {
        label: "Auditoria & Logs",
        href: "/auditoria-logs",
        roles: [Role.RH_ADMIN],
      },
      {
        label: "Usuários",
        href: "/usuarios",
        roles: [Role.GESTOR, Role.RH_ADMIN],
      },
      {
        label: "Equipes",
        href: "/equipes",
        roles: [Role.RH_ADMIN],
      },
    ],
  },
];

/**
 * Filtra grupos/itens pelo papel autenticado. Grupo sem nenhum item visivel
 * nao aparece no array retornado (NAV-05).
 */
export function getVisibleGroups(role: Role): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}

const FALLBACK_TITLE = { eyebrow: "OP Conecta", titulo: "Tela" };

/**
 * Resolve eyebrow/titulo da tela atual a partir do item cujo `href` e o
 * prefixo mais longo que casa com `pathname` (NAV-10). Sem match, cai no
 * fallback generico.
 */
export function resolveScreenTitle(pathname: string): {
  eyebrow: string;
  titulo: string;
} {
  let melhorGrupo: NavGroup | null = null;
  let melhorItem: NavItem | null = null;
  let melhorTamanho = -1;

  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      const casa =
        item.href === "/"
          ? pathname === "/"
          : pathname === item.href || pathname.startsWith(`${item.href}/`);

      if (casa && item.href.length > melhorTamanho) {
        melhorGrupo = group;
        melhorItem = item;
        melhorTamanho = item.href.length;
      }
    }
  }

  if (!melhorGrupo || !melhorItem) {
    return FALLBACK_TITLE;
  }

  return { eyebrow: melhorGrupo.label, titulo: melhorItem.label };
}
