import { useEffect, useId, useRef, type ReactNode } from "react";

import { BOTAO_PERIGO, BOTAO_PRIMARIO, BOTAO_SECUNDARIO } from "./estilosVinculo";

type ConfirmacaoInlineProps = {
  titulo: string;
  texto: string;
  rotuloConfirmar: string;
  rotuloCancelar?: string;
  onConfirmar: () => void;
  onCancelar: () => void;
  enviando?: boolean;
  // Ações que tiram acesso (recusar, contestar) usam o botão vermelho.
  perigo?: boolean;
  // Campo extra da confirmação (por exemplo, o motivo opcional de um pedido).
  children?: ReactNode;
};

// Confirmação em linguagem clara, no lugar do botão que foi clicado. Recebe o foco ao aparecer (o leitor de tela
// lê título e texto), Escape cancela e nada é enviado sem o clique em confirmar.
export default function ConfirmacaoInline({
  titulo,
  texto,
  rotuloConfirmar,
  rotuloCancelar = "Não, voltar",
  onConfirmar,
  onCancelar,
  enviando = false,
  perigo = false,
  children,
}: ConfirmacaoInlineProps) {
  const idTitulo = useId();
  const idTexto = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alertdialog"
      aria-labelledby={idTitulo}
      aria-describedby={idTexto}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !enviando) {
          e.stopPropagation();
          onCancelar();
        }
      }}
      className="space-y-4 rounded-xl border-2 border-[#B54708] bg-[#FFFAEB] p-4 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#5F56EC] dark:border-[#FEC84B] dark:bg-[#2B2417]"
    >
      <p id={idTitulo} className="text-lg font-bold text-[#71350B] dark:text-[#FEDF89]">
        {titulo}
      </p>
      <p id={idTexto} className="text-lg text-[#071A38] dark:text-white">
        {texto}
      </p>
      {children}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onConfirmar}
          disabled={enviando}
          aria-busy={enviando}
          className={perigo ? BOTAO_PERIGO : BOTAO_PRIMARIO}
        >
          {enviando ? "Enviando..." : rotuloConfirmar}
        </button>
        <button type="button" onClick={onCancelar} disabled={enviando} className={BOTAO_SECUNDARIO}>
          {rotuloCancelar}
        </button>
      </div>
    </div>
  );
}
