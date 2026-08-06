import { Role } from "@/lib/generated/prisma/client";

/** Le e valida o array `TipoFluxo.etapas` (Json) como lista de `Role`. */
export function lerEtapas(etapasJson: unknown): Role[] {
  if (!Array.isArray(etapasJson)) {
    return [];
  }
  return etapasJson.filter(
    (e): e is Role => e === Role.GESTOR || e === Role.RH_ADMIN,
  );
}

/**
 * Papel efetivo do aprovador de uma etapa planejada.
 *
 * `GESTOR`/`RH_ADMIN` nunca pertencem a uma `Equipe` (CLAUDE.md), entao um
 * solicitante com esses papeis nao tem gestor responsavel — uma etapa
 * planejada como GESTOR sobe automaticamente para RH_ADMIN nesse caso, em
 * vez de travar a solicitacao sem aprovador elegivel.
 */
export function papelEfetivo(
  papelPlanejado: Role,
  solicitanteTemEquipe: boolean,
): Role {
  if (papelPlanejado === Role.GESTOR && !solicitanteTemEquipe) {
    return Role.RH_ADMIN;
  }
  return papelPlanejado;
}
