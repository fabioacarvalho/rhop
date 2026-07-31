"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

/**
 * Formulario de login (AUTH-01, AUTH-02, AUTH-03, AUTH-04).
 *
 * Regras desta task (T10):
 * - Campos `required` no HTML bloqueiam o submit nativamente quando algum
 *   esta vazio — o browser nem dispara `onSubmit`, entao `signInWithPassword`
 *   nunca e chamado nesse caso (verificado manualmente: ver relatorio da
 *   task). Ainda assim, mantemos uma checagem explicita no handler como
 *   segunda linha de defesa (ex.: autofill estranho, `noValidate` acidental
 *   em algum wrapper futuro) — nunca confiar so na validacao do browser para
 *   uma decisao de seguranca, mesmo que aqui o custo de "falhar aberto" seja
 *   so mais uma chamada evitavel à API.
 * - Erro de credencial invalida (Supabase responde com erro de auth, ex.:
 *   "Invalid login credentials") -> mensagem FIXA e generica. Nunca expor
 *   `error.message` bruto do Supabase na tela: o objetivo e nao permitir que
 *   alguem descubra se um e-mail existe ou nao so pela mensagem de erro.
 * - Erro de rede/indisponibilidade (a propria chamada lanca excecao, nao um
 *   erro de credencial normal) -> mensagem de retry, formulario reabilitado
 *   (nunca trava em loading).
 * - Sucesso -> `router.push('/')` + `router.refresh()` (refresh forca o
 *   middleware/RSC a re-render com a sessao nova).
 */
export default function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    // Segunda linha de defesa alem do `required` nativo (ver comentario
    // acima) — nunca chama o Supabase com campo vazio.
    if (!email.trim() || !senha) {
      setErro("Preencha e-mail e senha.");
      return;
    }

    setErro(null);
    setCarregando(true);

    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });

      if (error) {
        // Erro de auth "normal" (credenciais invalidas, usuario inexistente,
        // etc.) — mensagem fixa e generica, nunca o `error.message` bruto.
        setErro("E-mail ou senha inválidos.");
        setCarregando(false);
        return;
      }

      // Sucesso: nao reabilita o formulario (a navegacao a seguir substitui
      // a tela), mas mantemos `carregando` true so pra o botao nao piscar
      // reabilitado durante o push/refresh.
      router.push("/");
      router.refresh();
    } catch {
      // Excecao na propria chamada (rede indisponivel, URL do Supabase
      // invalida, timeout) — distinto de um erro de credencial: aqui o
      // formulario precisa reabilitar pra permitir retry.
      setErro("Não foi possível conectar. Tente novamente.");
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Formulário de login">
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          E-mail
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={carregando}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          Senha
          <input
            type="password"
            name="senha"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            disabled={carregando}
          />
        </label>

        {erro && (
          <p role="alert" style={{ color: "#b91c1c" }}>
            {erro}
          </p>
        )}

        <button type="submit" disabled={carregando}>
          {carregando ? "Entrando..." : "Entrar"}
        </button>
      </div>
    </form>
  );
}
