"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import styles from "./equipe-onboarding.module.css";

interface EquipeOption {
  id: string;
  nome: string;
}

interface EquipeOnboardingFormProps {
  equipes: EquipeOption[];
}

/**
 * Formulario obrigatorio de selecao de `Equipe` no primeiro login Google sem
 * `User` previo (GAUTH-10) — sem opcao de pular: quem nao selecionar equipe
 * nao tem `User` criado e nao acessa a aplicacao. "Sair" e a unica saida da
 * tela para quem quiser abandonar o onboarding.
 */
export default function EquipeOnboardingForm({
  equipes,
}: EquipeOnboardingFormProps) {
  const router = useRouter();

  const [equipeId, setEquipeId] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (!equipeId) {
      setErro("Selecione uma equipe.");
      return;
    }

    setErro(null);
    setCarregando(true);

    try {
      const response = await fetch("/api/onboarding/equipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipe_id: equipeId }),
      });

      if (!response.ok) {
        const corpo = await response.json().catch(() => ({}));
        setErro(corpo.error ?? "Nao foi possivel concluir o cadastro.");
        setCarregando(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setErro("Nao foi possivel conectar. Tente novamente.");
      setCarregando(false);
    }
  }

  async function handleSair() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Formulário de seleção de equipe">
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="onboarding-equipe">
          Equipe
        </label>
        <select
          id="onboarding-equipe"
          className={styles.select}
          required
          value={equipeId}
          onChange={(e) => setEquipeId(e.target.value)}
          disabled={carregando}
        >
          <option value="" disabled>
            Selecione sua equipe
          </option>
          {equipes.map((equipe) => (
            <option key={equipe.id} value={equipe.id}>
              {equipe.nome}
            </option>
          ))}
        </select>
      </div>

      {erro && (
        <p className={styles.error} role="alert">
          {erro}
        </p>
      )}

      <button type="submit" className={styles.submit} disabled={carregando}>
        {carregando ? "Confirmando..." : "Confirmar"}
      </button>

      <button
        type="button"
        className={styles.sair}
        onClick={handleSair}
        disabled={carregando}
      >
        Sair
      </button>
    </form>
  );
}
