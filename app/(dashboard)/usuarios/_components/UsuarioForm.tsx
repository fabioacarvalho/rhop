"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Role } from "@/lib/generated/prisma/enums";
import styles from "../usuarios.module.css";

const ROTULO_PAPEL: Record<Role, string> = {
  SOLICITANTE: "Solicitante",
  GESTOR: "Gestor",
  RH_ADMIN: "RH_Admin",
};

interface EquipeOpcao {
  id: string;
  nome: string;
}

interface UsuarioInicial {
  id: string;
  nome: string;
  email: string;
  role: Role;
  equipe_id: string | null;
}

interface UsuarioFormProps {
  modo: "criar" | "editar";
  atorRole: Role;
  /**
   * Passada quando `atorRole === RH_ADMIN` (todas as equipes ativas) ou
   * quando `atorRole === GESTOR && modo === 'criar'` (só as equipes que ele
   * gerencia). Não usada quando Gestor edita (só `nome` é editável).
   */
  equipesDisponiveis?: EquipeOpcao[];
  /** Só passado quando `modo === 'editar'`. */
  usuarioInicial?: UsuarioInicial;
}

interface RespostaErro {
  error?: string;
}

/**
 * Formulário de criação/edição de `User` (USR-01, USR-02, USR-03, USR-05,
 * USR-07, USR-16, USR-18) — Client Component compartilhado entre
 * `/usuarios/novo` e `/usuarios/[id]/editar`, adaptando os campos visíveis
 * ao `atorRole`.
 *
 * A regra "Gestor só pode gerenciar SOLICITANTE da própria equipe" é
 * aplicada no backend (`userService.assertEscopoGestao`) — aqui só
 * escondemos os campos que o Gestor não pode preencher, sem tentar
 * reimplementar a autorização no client.
 */
export default function UsuarioForm({
  modo,
  atorRole,
  equipesDisponiveis,
  usuarioInicial,
}: UsuarioFormProps) {
  const router = useRouter();
  const ehRhAdmin = atorRole === Role.RH_ADMIN;

  const [nome, setNome] = useState(usuarioInicial?.nome ?? "");
  const [email, setEmail] = useState(usuarioInicial?.email ?? "");
  const [role, setRole] = useState<Role>(usuarioInicial?.role ?? Role.SOLICITANTE);
  const [equipeId, setEquipeId] = useState<string>(
    usuarioInicial?.equipe_id ??
      (modo === "criar" && !ehRhAdmin && equipesDisponiveis?.length === 1
        ? equipesDisponiveis[0].id
        : "")
  );

  const [erroValidacao, setErroValidacao] = useState<string | null>(null);
  const [erroSubmissao, setErroSubmissao] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (nome.trim().length === 0) {
      setErroValidacao("Informe o nome do usuário.");
      return;
    }
    if (modo === "criar" && email.trim().length === 0) {
      setErroValidacao("Informe o e-mail do usuário.");
      return;
    }
    const roleEfetivo = ehRhAdmin ? role : Role.SOLICITANTE;
    if (roleEfetivo === Role.SOLICITANTE && equipeId.length === 0) {
      setErroValidacao("Selecione uma equipe.");
      return;
    }

    setErroValidacao(null);
    setErroSubmissao(null);
    setEnviando(true);

    try {
      let corpo: Record<string, unknown>;
      let url: string;
      let method: string;

      if (modo === "criar") {
        url = "/api/usuarios";
        method = "POST";
        corpo = ehRhAdmin
          ? {
              nome,
              email,
              role,
              equipe_id: role === Role.SOLICITANTE ? equipeId : null,
            }
          : { nome, email, role: Role.SOLICITANTE, equipe_id: equipeId };
      } else {
        url = `/api/usuarios/${usuarioInicial?.id}`;
        method = "PUT";
        corpo = ehRhAdmin
          ? { nome, role, equipe_id: role === Role.SOLICITANTE ? equipeId : null }
          : { nome };
      }

      const resposta = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });

      if (!resposta.ok) {
        const corpoErro: RespostaErro = await resposta.json().catch(() => ({}));
        setErroSubmissao(
          corpoErro.error ?? `Falha ao salvar usuário (status ${resposta.status}).`
        );
        setEnviando(false);
        return;
      }

      router.push("/usuarios");
      router.refresh();
    } catch {
      setErroSubmissao("Não foi possível salvar o usuário. Tente novamente.");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${styles.card} ${styles.ruled}`} style={{ padding: "22px 24px" }}>
      <div className={styles.field}>
        <label htmlFor="nome" className={styles.fieldLabel}>
          Nome
        </label>
        <input
          id="nome"
          type="text"
          className={styles.input}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="ex: Marina Costa"
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="email" className={styles.fieldLabel}>
          E-mail
        </label>
        <input
          id="email"
          type="email"
          className={styles.input}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ex: marina.costa@empresa.com"
          disabled={modo === "editar"}
        />
        {modo === "editar" && (
          <span className={styles.fieldHint}>E-mail não pode ser alterado.</span>
        )}
      </div>

      {ehRhAdmin && (
        <>
          <div className={styles.field}>
            <label htmlFor="role" className={styles.fieldLabel}>
              Papel
            </label>
            <select
              id="role"
              className={styles.select}
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              {Object.values(Role).map((valor) => (
                <option key={valor} value={valor}>
                  {ROTULO_PAPEL[valor]}
                </option>
              ))}
            </select>
          </div>

          {role === Role.SOLICITANTE && (
            <div className={styles.field}>
              <label htmlFor="equipe" className={styles.fieldLabel}>
                Equipe
              </label>
              <select
                id="equipe"
                className={styles.select}
                value={equipeId}
                onChange={(e) => setEquipeId(e.target.value)}
              >
                <option value="">Selecione uma equipe</option>
                {(equipesDisponiveis ?? []).map((equipe) => (
                  <option key={equipe.id} value={equipe.id}>
                    {equipe.nome}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      {modo === "criar" && !ehRhAdmin && (
        <div className={styles.field}>
          <label htmlFor="equipe" className={styles.fieldLabel}>
            Equipe
          </label>
          <select
            id="equipe"
            className={styles.select}
            value={equipeId}
            onChange={(e) => setEquipeId(e.target.value)}
          >
            <option value="">Selecione uma equipe</option>
            {(equipesDisponiveis ?? []).map((equipe) => (
              <option key={equipe.id} value={equipe.id}>
                {equipe.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className={styles.formFooter}>
        {(erroValidacao || erroSubmissao) && (
          <p role="alert" className={styles.formError}>
            {erroValidacao ?? erroSubmissao}
          </p>
        )}
        <Link href="/usuarios" className={`${styles.btn} ${styles.btnLg} ${styles.btnGhost}`}>
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={enviando}
          className={`${styles.btn} ${styles.btnLg} ${styles.btnPrimary}`}
        >
          {enviando
            ? "Salvando..."
            : modo === "criar"
              ? "Criar usuário"
              : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}
