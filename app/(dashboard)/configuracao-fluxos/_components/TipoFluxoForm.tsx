"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  CampoFormularioDefinicao,
  PapelAprovador,
  TipoFluxoInput,
} from "@/lib/validations/tipoFluxo";
import EtapasEditor from "./EtapasEditor";
import CampoFormularioEditor from "./CampoFormularioEditor";
import styles from "../configuracao-fluxos.module.css";

interface TipoFluxoFormProps {
  modo: "criar" | "editar";
  /** Obrigatório quando `modo === 'editar'` (usado para montar o PUT). */
  tipoFluxoId?: string;
  /** Pré-preenche o formulário em modo editar; vazio/undefined em modo criar. */
  initialData?: TipoFluxoInput;
}

interface RespostaErro {
  error?: string;
}

/**
 * Formulário de criação/edição de `TipoFluxo` (CONF-02, CONF-03, CONF-04) —
 * Client Component que compõe `nome` + `EtapasEditor` + `CampoFormularioEditor`,
 * mantendo o estado completo de `TipoFluxoInput` (`design.md`, "Data Models")
 * neste componente pai, conforme decisão de granularidade da task T6.
 *
 * Validação client-side é só UX (bloqueia submit óbvio sem chamar a API);
 * a validação de verdade acontece no backend via `tipoFluxoInputSchema`
 * (reaproveitada aqui só como tipo, via `import type`, não reimplementada).
 *
 * `modo === 'criar'` -> `POST /api/tipos-fluxo`.
 * `modo === 'editar'` -> `PUT /api/tipos-fluxo/${tipoFluxoId}` (exige
 * `tipoFluxoId`).
 *
 * Erros do backend (400 Zod, 409 nome duplicado, 409 edição bloqueada) são
 * exibidos a partir de `error.message` do corpo JSON da resposta — sem crash,
 * sem tentar decodificar `detalhes` do Zod em algo mais elaborado (fora do
 * escopo desta task).
 */
export default function TipoFluxoForm({
  modo,
  tipoFluxoId,
  initialData,
}: TipoFluxoFormProps) {
  const router = useRouter();

  const [nome, setNome] = useState(initialData?.nome ?? "");
  const [etapas, setEtapas] = useState<PapelAprovador[]>(
    initialData?.etapas ?? []
  );
  const [camposFormulario, setCamposFormulario] = useState<
    CampoFormularioDefinicao[]
  >(initialData?.campos_formulario ?? []);

  const [erroValidacao, setErroValidacao] = useState<string | null>(null);
  const [erroSubmissao, setErroSubmissao] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    // Bloqueio local (Done when da T6): nome vazio, etapas vazio ou
    // campos_formulario vazio nunca chegam a disparar fetch.
    if (nome.trim().length === 0) {
      setErroValidacao("Informe o nome do tipo de fluxo.");
      return;
    }
    if (etapas.length === 0) {
      setErroValidacao("Adicione ao menos uma etapa de aprovação.");
      return;
    }
    if (camposFormulario.length === 0) {
      setErroValidacao("Adicione ao menos um campo de formulário.");
      return;
    }

    setErroValidacao(null);
    setErroSubmissao(null);
    setEnviando(true);

    const dados: TipoFluxoInput = {
      nome,
      campos_formulario: camposFormulario,
      etapas,
    };

    try {
      const url =
        modo === "criar" ? "/api/tipos-fluxo" : `/api/tipos-fluxo/${tipoFluxoId}`;
      const method = modo === "criar" ? "POST" : "PUT";

      const resposta = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      });

      if (!resposta.ok) {
        const corpo: RespostaErro = await resposta.json().catch(() => ({}));
        setErroSubmissao(
          corpo.error ?? `Falha ao salvar tipo de fluxo (status ${resposta.status}).`
        );
        setEnviando(false);
        return;
      }

      router.push("/configuracao-fluxos");
      router.refresh();
    } catch {
      setErroSubmissao("Não foi possível salvar o tipo de fluxo. Tente novamente.");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${styles.card} ${styles.ruled}`}>
      <div className={styles.field}>
        <label htmlFor="nome" className={styles.fieldLabel}>
          Nome do tipo de fluxo
        </label>
        <input
          id="nome"
          type="text"
          className={styles.input}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="ex: Solicitação de Férias"
        />
      </div>

      <div className={styles.sectionDivider}>
        <span>Etapas de aprovação</span>
      </div>
      <EtapasEditor value={etapas} onChange={setEtapas} />

      <div className={styles.sectionDivider}>
        <span>Campos do formulário</span>
      </div>
      <CampoFormularioEditor
        value={camposFormulario}
        onChange={setCamposFormulario}
      />

      <div className={styles.formFooter}>
        {(erroValidacao || erroSubmissao) && (
          <p role="alert" className={styles.formError}>
            {erroValidacao ?? erroSubmissao}
          </p>
        )}
        <Link
          href="/configuracao-fluxos"
          className={`${styles.btn} ${styles.btnLg} ${styles.btnGhost}`}
        >
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
              ? "Criar tipo de fluxo"
              : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}
