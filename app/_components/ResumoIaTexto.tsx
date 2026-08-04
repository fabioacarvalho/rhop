import { Fragment, type ReactNode } from "react";

/**
 * A OpenAI devolve o resumo em markdown leve (negrito, listas, paragrafos)
 * sem instrucao de formato explicita. Este componente renderiza essa
 * estrutura em vez de despejar a string crua num <div>, que colapsa
 * quebras de linha e esmaga tudo numa unica linha.
 */
type Props = {
  texto: string;
};

function renderInline(texto: string): ReactNode[] {
  return texto
    .split(/(\*\*[^*]+\*\*)/g)
    .filter((parte) => parte !== "")
    .map((parte, i) =>
      parte.startsWith("**") && parte.endsWith("**") ? (
        <strong key={i}>{parte.slice(2, -2)}</strong>
      ) : (
        <Fragment key={i}>{parte}</Fragment>
      ),
    );
}

export function ResumoIaTexto({ texto }: Props) {
  const blocos = texto.trim().split(/\n{2,}/);

  return (
    <>
      {blocos.map((bloco, i) => {
        const linhas = bloco
          .split("\n")
          .map((linha) => linha.trim())
          .filter((linha) => linha !== "");

        const ehLista = linhas.length > 0 && linhas.every((linha) => /^[-*]\s+/.test(linha));

        if (ehLista) {
          return (
            <ul key={i}>
              {linhas.map((linha, j) => (
                <li key={j}>{renderInline(linha.replace(/^[-*]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }

        return <p key={i}>{renderInline(linhas.join(" "))}</p>;
      })}
    </>
  );
}
