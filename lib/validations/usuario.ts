import { z } from "zod";
import { Role } from "@/lib/generated/prisma/client";

/**
 * Payload de `POST /api/usuarios` (USR-05). A regra "Gestor so pode mandar
 * role: SOLICITANTE / gestor_id: proprio id" e de autorizacao por ator, nao
 * de formato — fica em `userService.assertEscopoGestao`, nao aqui.
 */
export const cadastrarUsuarioInputSchema = z.object({
  nome: z.string().trim().min(1, "nome e obrigatorio."),
  email: z.string().email("email invalido."),
  role: z.nativeEnum(Role),
  gestor_id: z.string().uuid().nullable().optional(),
});

export type CadastrarUsuarioInput = z.infer<typeof cadastrarUsuarioInputSchema>;

/**
 * Payload de `PUT /api/usuarios/[id]` (USR-16 a USR-18) — mesmos campos de
 * `cadastrarUsuarioInputSchema`, todos opcionais, exigindo ao menos 1
 * presente (`.refine`).
 */
export const editarUsuarioInputSchema = cadastrarUsuarioInputSchema
  .partial()
  .refine((dados) => Object.keys(dados).length > 0, {
    message: "informe ao menos 1 campo para editar.",
  });

export type EditarUsuarioInput = z.infer<typeof editarUsuarioInputSchema>;

/** Payload de `PATCH /api/usuarios/[id]/status` (USR-21, USR-24). */
export const definirStatusInputSchema = z.object({
  ativo: z.boolean(),
});

export type DefinirStatusInput = z.infer<typeof definirStatusInputSchema>;
