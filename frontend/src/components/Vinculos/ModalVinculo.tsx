import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

import { useFocoModal } from "../../hooks/useFocoModal";

type ModalVinculoProps = {
  aberto: boolean;
  titulo: string;
  onFechar: () => void;
  children: ReactNode;
};

// Contêiner dos formulários de vínculo. Não fecha ao clicar fora: quem digita devagar não perde o que escreveu.
export default function ModalVinculo({ aberto, titulo, onFechar, children }: ModalVinculoProps) {
  const idTitulo = useId();
  const dialogoRef = useRef<HTMLElement>(null);

  useFocoModal(dialogoRef, aberto);

  useEffect(() => {
    if (!aberto) return;

    function fecharComEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onFechar();
    }

    document.addEventListener("keydown", fecharComEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", fecharComEscape);
      document.body.style.overflow = "";
    };
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5">
      <section
        ref={dialogoRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[#E5E2F5] bg-white shadow-2xl focus:!outline-none dark:border-[#393947] dark:bg-[#171721]"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#EEEAF8] px-5 py-5 sm:px-7 dark:border-[#393947]">
          <h2 id={idTitulo} className="text-2xl font-bold text-[#071A38] dark:text-[#F5F5FA]">
            {titulo}
          </h2>

          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#D9D7E8] bg-white text-[#56657D] transition hover:bg-[#F3F0FF] hover:text-[#554CD8] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#5F56EC] dark:border-[#393947] dark:bg-[#20202A] dark:text-[#C7C7D1] dark:hover:bg-[#292933]"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-6 sm:px-7 dark:[color-scheme:dark]">{children}</div>
      </section>
    </div>
  );
}
