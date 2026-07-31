import LoginForm from "./LoginForm";

/**
 * Pagina de login (AUTH-01) — server component so de layout.
 *
 * Nao acessa Supabase/Prisma aqui: toda a logica de submit (chamada a
 * `signInWithPassword`, tratamento de erro, redirect) vive em `LoginForm`
 * (client component), conforme T10 de `.specs/features/autenticacao-usuarios/tasks.md`.
 *
 * `middleware.ts` ja exclui `/login` do matcher, entao esta pagina renderiza
 * mesmo sem sessao (é a unica rota publica do app).
 */
export default function LoginPage() {
  return (
    <main
      style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: "360px" }}>
        <h1 style={{ marginBottom: "1.5rem", textAlign: "center" }}>
          RHOP — Entrar
        </h1>
        <LoginForm />
      </div>
    </main>
  );
}
