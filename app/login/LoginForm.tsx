"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import styles from "./login.module.css";

/**
 * Formulario de login (AUTH-01, AUTH-02, AUTH-03, AUTH-04).
 *
 * Regras desta task (T10):
 * - Campos `required` no HTML bloqueiam o submit nativamente quando algum
 *   esta vazio — o browser nem dispara `onSubmit`, entao `signInWithPassword`
 *   nunca e chamado nesse caso. Ainda assim, mantemos uma checagem explicita
 *   no handler como segunda linha de defesa.
 * - Erro de credencial invalida -> mensagem FIXA e generica. Nunca expor
 *   `error.message` bruto do Supabase na tela.
 * - Erro de rede/indisponibilidade -> mensagem de retry, formulario
 *   reabilitado (nunca trava em loading).
 * - Sucesso -> `router.push('/')` + `router.refresh()`.
 *
 * Visual: campos e CTA alinhados ao mockup (#screen-login).
 */
export default function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [manterConectado, setManterConectado] = useState(true);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [dicaSenha, setDicaSenha] = useState(false);

  async function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (!email.trim() || !senha) {
      setErro("Preencha e-mail e senha.");
      return;
    }

    setErro(null);
    setDicaSenha(false);
    setCarregando(true);

    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });

      if (error) {
        setErro("E-mail ou senha inválidos.");
        setCarregando(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setErro("Não foi possível conectar. Tente novamente.");
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Formulário de login">
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="login-email">
          E-mail corporativo
        </label>
        <input
          id="login-email"
          className={styles.input}
          type="email"
          name="email"
          autoComplete="email"
          placeholder="voce@empresa.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={carregando}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="login-senha">
          Senha
        </label>
        <input
          id="login-senha"
          className={styles.input}
          type="password"
          name="senha"
          autoComplete="current-password"
          placeholder="••••••••"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          disabled={carregando}
        />
      </div>

      <div className={styles.rowBetween}>
        <label className={styles.remember}>
          <input
            type="checkbox"
            checked={manterConectado}
            onChange={(e) => setManterConectado(e.target.checked)}
            disabled={carregando}
          />
          Manter conectado
        </label>
        <button
          type="button"
          className={styles.forgot}
          onClick={() => {
            setErro(null);
            setDicaSenha(true);
          }}
          disabled={carregando}
        >
          Esqueci a senha
        </button>
      </div>

      {erro && (
        <p className={styles.error} role="alert">
          {erro}
        </p>
      )}

      {dicaSenha && !erro && (
        <p className={styles.hint} role="status">
          Peça ao RH para redefinir sua senha.
        </p>
      )}

      <button
        type="submit"
        className={styles.submit}
        disabled={carregando}
      >
        {carregando ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
