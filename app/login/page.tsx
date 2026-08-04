import LoginForm from "./LoginForm";
import styles from "./login.module.css";

const MENSAGENS_ERRO: Record<string, string> = {
  google: "Nao foi possivel entrar com Google. Tente novamente.",
  dominio: "Use uma conta Google @01tec.com.br.",
};

/**
 * Pagina de login (AUTH-01) — server component so de layout.
 *
 * Layout alinhado a `docs/design-ux-ui/fluxorh-mockup.html` (#screen-login)
 * e `docs/design-ux-ui/fluxorh-ui-layout-specs.md` §4.1: card em 2 colunas
 * (painel visual 1.1fr + formulario 1fr); abaixo de 860px o painel some.
 *
 * Nao acessa Supabase/Prisma aqui: toda a logica de submit vive em `LoginForm`.
 * `middleware.ts` ja exclui `/login` do matcher (unica rota publica).
 *
 * `searchParams.erro` (`?erro=google`/`?erro=dominio`) vem do redirect de
 * `app/auth/callback/route.ts` (GAUTH-01, GAUTH-02, GAUTH-03) e e resolvido
 * aqui para uma mensagem, repassada como `erroInicial` para `LoginForm`.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const erroInicial = erro ? (MENSAGENS_ERRO[erro] ?? null) : null;

  return (
    <main className={styles.screen}>
      <div className={styles.card}>
        <aside className={styles.visual} aria-hidden="true">
          <div>
            <div className={styles.brandmark}>
              <div className={styles.seal}>OP</div>
              <div className={styles.brandWord}>OP Conecta</div>
            </div>
          </div>
          <p className={styles.quote}>
            Cada solicitação chega ao aprovador com o{" "}
            <span className={styles.quoteAccent}>resumo pronto</span>. Decisão
            em segundos, não em dias.
          </p>
          <div className={styles.meta}>
            OBRA PRIMA · PLATAFORMA DE FLUXOS DE APROVAÇÃO DE RH
          </div>
        </aside>

        <div className={styles.formWrap}>
          <div className={styles.eyebrow}>Acessar conta</div>
          <h1 className={styles.title}>Entrar no OP Conecta</h1>
          <LoginForm erroInicial={erroInicial} />
          <p className={styles.foot}>
            Acesso restrito a colaboradores cadastrados pelo RH.
          </p>
        </div>
      </div>
    </main>
  );
}
