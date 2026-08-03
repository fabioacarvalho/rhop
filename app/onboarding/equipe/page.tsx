import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSupabaseUser } from "@/lib/services/authService";
import * as equipeService from "@/lib/services/equipeService";
import EquipeOnboardingForm from "./EquipeOnboardingForm";
import styles from "./equipe-onboarding.module.css";

/**
 * Onboarding obrigatorio de `Equipe` no primeiro login Google sem `User`
 * previo (GAUTH-10) — `getSupabaseUser()` (nao `requireUser()`) porque essa
 * tela roda exatamente no intervalo em que ha sessao Supabase mas ainda nao
 * ha `User` no Prisma.
 */
export default async function EquipeOnboardingPage() {
  const sessao = await getSupabaseUser();

  if (!sessao) {
    redirect("/login");
  }

  const usuarioExistente = await prisma.user.findUnique({
    where: { id: sessao.id },
  });

  if (usuarioExistente) {
    redirect("/");
  }

  const equipes = await equipeService.listarAtivasParaSelecao();

  return (
    <main className={styles.screen}>
      <div className={styles.card}>
        <div className={styles.eyebrow}>Primeiro acesso</div>
        <h1 className={styles.title}>Selecione sua equipe</h1>
        <p className={styles.subtitle}>
          Para concluir seu cadastro no OP Conecta, escolha a equipe à qual
          você pertence.
        </p>
        <EquipeOnboardingForm equipes={equipes} />
      </div>
    </main>
  );
}
