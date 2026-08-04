import { z } from "zod";

/**
 * Tipos semânticos de campo de formulário dinâmico (CONF-03), conforme
 * `design.md` (seção "Data Models"). Cada valor tem uma renderização/validação
 * própria em `solicitacoes` — não é um único tipo genérico.
 */
export const TIPOS_CAMPO = ["texto", "numero", "data", "selecao"] as const;
export type TipoCampo = (typeof TIPOS_CAMPO)[number];

/**
 * Papéis que podem ser aprovador de uma etapa (CONF-04). Subconjunto de
 * `Role` (Prisma) — `SOLICITANTE` nunca é um aprovador válido, por isso não é
 * reaproveitado o enum `Role` completo aqui.
 */
export const PAPEIS_APROVADOR = ["GESTOR", "RH_ADMIN"] as const;
export type PapelAprovador = (typeof PAPEIS_APROVADOR)[number];

/**
 * Categorias de `TipoFluxo` usadas para detecção de conflito de agenda entre
 * membros da mesma equipe (RIA-11). `PADRAO` nunca dispara checagem de
 * conflito.
 */
export const CATEGORIAS_TIPO_FLUXO = ["PADRAO", "FERIAS", "DAYOFF"] as const;
export type CategoriaTipoFluxo = (typeof CATEGORIAS_TIPO_FLUXO)[number];

/**
 * Valida um item de `TipoFluxo.campos_formulario` (`CampoFormularioDefinicao`
 * em `design.md`).
 *
 * - `opcoes` é obrigatório (e não pode ser vazio) quando `tipo === 'selecao'`;
 *   nos demais tipos é ignorado se vier preenchido (não rejeitado).
 * - `min`/`max` só são semanticamente relevantes em `texto`/`numero`, mas o
 *   design explicitamente diz "ignorados" (não "rejeitados") em `data`/
 *   `selecao` — por isso não há `refine` bloqueando a presença deles ali.
 */
export const campoFormularioSchema = z
  .object({
    chave: z.string().min(1, "chave é obrigatória."),
    rotulo: z.string().min(1, "rotulo é obrigatório."),
    tipo: z.enum(TIPOS_CAMPO),
    obrigatorio: z.boolean(),
    opcoes: z.array(z.string()).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
  })
  .superRefine((campo, ctx) => {
    if (campo.tipo === "selecao" && (!campo.opcoes || campo.opcoes.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "opcoes é obrigatório e não pode ser vazio quando tipo é 'selecao'.",
        path: ["opcoes"],
      });
    }
  });

export type CampoFormularioDefinicao = z.infer<typeof campoFormularioSchema>;

/**
 * Valida o payload de criação/edição de `TipoFluxo` (`TipoFluxoInput` em
 * `design.md`). `nome` usa `.trim()` para que uma string só com espaços seja
 * rejeitada pelo `.min(1)` (CONF-02); `campos_formulario` e `etapas` exigem
 * ao menos 1 item (decisão registrada em `design.md`, "Tech Decisions").
 */
export const tipoFluxoInputSchema = z.object({
  nome: z.string().trim().min(1, "nome é obrigatório."),
  campos_formulario: z
    .array(campoFormularioSchema)
    .min(1, "campos_formulario deve ter ao menos 1 item."),
  etapas: z.array(z.enum(PAPEIS_APROVADOR)).min(1, "etapas deve ter ao menos 1 item."),
  categoria: z.enum(CATEGORIAS_TIPO_FLUXO).default("PADRAO"),
  habilitado_solicitante: z.boolean().default(true),
});

export type TipoFluxoInput = z.infer<typeof tipoFluxoInputSchema>;
