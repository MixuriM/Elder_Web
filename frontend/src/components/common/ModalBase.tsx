import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

import { useFocoModal } from '../../hooks/useFocoModal'

interface ModalBaseProps {
  aberto: boolean
  onFechar: () => void
  icone: ReactNode
  sobretitulo: string
  titulo: string
  descricao: string
  children: ReactNode
  // alertdialog para confirmações; dialog para formulários.
  papel?: 'dialog' | 'alertdialog'
  // Só para quem já tem um id de título fixo (testes e CSS); sem ele, useId.
  idTitulo?: string
  // Confirmação cabe em painel estreito.
  estreito?: boolean
}

// Painel centralizado, fundo escurecido, Escape, clique no fundo, rolagem travada e foco preso (useFocoModal).
// O painel inteiro rola, com o cabeçalho junto: com o teclado aberto, um cabeçalho fixo deixava só uma fresta
// para os campos.
function ModalBase({
  aberto,
  onFechar,
  icone,
  sobretitulo,
  titulo,
  descricao,
  children,
  papel = 'dialog',
  idTitulo,
  estreito = false,
}: ModalBaseProps) {
  const idGerado = useId()
  const idDoTitulo = idTitulo ?? `titulo-modal-${idGerado}`
  const dialogoRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!aberto) return

    function fecharComEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onFechar()
    }

    document.addEventListener('keydown', fecharComEscape)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', fecharComEscape)
      document.body.style.overflow = ''
    }
  }, [aberto, onFechar])

  useFocoModal(dialogoRef, aberto)

  if (!aberto) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onFechar()
      }}
    >
      <section
        ref={dialogoRef}
        tabIndex={-1}
        role={papel}
        aria-modal="true"
        aria-labelledby={idDoTitulo}
        className={`focus:!outline-none flex max-h-full w-full min-w-0 ${
          estreito ? 'max-w-md' : 'max-w-2xl'
        } flex-col overflow-y-auto rounded-3xl border border-[#E5E2F5] bg-white shadow-2xl dark:border-[#393947] dark:bg-[#171721]`}
      >
        {/* div, não header: dentro de um dialog o header contaria como um segundo banner da página (axe). */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#EEEAF8] px-5 py-5 sm:px-7 dark:border-[#393947]">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F3F0FF] text-[#5F56EC] dark:bg-[#29243F] dark:text-[#A89FFF]">
              {icone}
            </div>

            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#5F56EC] dark:text-[#A89FFF]">{sobretitulo}</p>

              <h2 id={idDoTitulo} className="mt-0.5 text-xl font-bold text-[#071A38] sm:text-2xl dark:text-[#F5F5FA]">
                {titulo}
              </h2>

              <p className="mt-1 text-sm text-[#56657D] dark:text-[#C7C7D1]">{descricao}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#D9D7E8] bg-white text-[#56657D] transition hover:border-[#A18BFF] hover:bg-[#F3F0FF] hover:text-[#554CD8] dark:border-[#393947] dark:bg-[#20202A] dark:text-[#C7C7D1] dark:hover:border-[#555565] dark:hover:bg-[#292933] dark:hover:text-[#A89FFF]"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 py-6 sm:px-7 dark:[color-scheme:dark]">{children}</div>
      </section>
    </div>
  )
}

export default ModalBase
