"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import styles from "./login.module.css";

interface LoginFormProps {
  erroInicial?: string | null;
}

/**
 * Formulario de login (AUTH-01, AUTH-02, AUTH-03, AUTH-04) + botao "Entrar
 * com Google" (GAUTH-01, GAUTH-04).
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
 * - "Entrar com Google" navega o browser inteiro via `signInWithOAuth` — o
 *   tratamento de erro relevante (dominio errado, falha na troca de codigo)
 *   acontece no servidor (`app/auth/callback/route.ts`) e volta como
 *   `?erro=` na URL de `/login` (ver `erroInicial`).
 *
 * Visual: campos e CTA alinhados ao mockup (#screen-login).
 */
export default function LoginForm({ erroInicial = null }: LoginFormProps) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [manterConectado, setManterConectado] = useState(true);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(erroInicial);
  const [dicaSenha, setDicaSenha] = useState(false);

  function handleEntrarComGoogle() {
    const supabase = createBrowserClient();
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          hd: "01tec.com.br",
          prompt: "select_account",
        },
      },
    });
  }

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

      <div className={styles.divider} role="separator">
        <span>ou</span>
      </div>

      <button
        type="button"
        className={styles.googleButton}
        onClick={handleEntrarComGoogle}
        disabled={carregando}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          aria-hidden="true"
          focusable="false"
        >
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.09-1.8 2.73v2.27h2.91c1.7-1.57 2.69-3.88 2.69-6.64z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.27c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.34C2.44 15.98 5.48 18 9 18z"
          />
          <path
            fill="#FBBC05"
            d="M3.96 10.7c-.18-.54-.29-1.11-.29-1.7s.11-1.16.29-1.7V4.96H.96C.35 6.17 0 7.55 0 9s.35 2.83.96 4.04l3-2.34z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l3 2.34C4.67 5.16 6.66 3.58 9 3.58z"
          />
        </svg>
        Entrar com Google
      </button>
    </form>
  );
}
