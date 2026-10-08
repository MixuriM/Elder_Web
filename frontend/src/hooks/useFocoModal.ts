import { useEffect, type RefObject } from 'react'

const FOCAVEIS =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

// Foco do modal (WCAG 2.4.3 e 2.1.2): ao abrir, o foco vai para o container (que precisa de tabIndex={-1});
// Tab e Shift+Tab ficam presos dentro dele; ao fechar, o foco volta ao elemento que abriu.
// O container só existe no DOM quando o modal está aberto: passe `aberto` já combinado com o que o renderiza.
export function useFocoModal(
  ref: RefObject<HTMLElement>,
  aberto: boolean,
) {
  useEffect(() => {
    const container = ref.current

    if (!aberto || !container) return

    const origem = document.activeElement as HTMLElement | null

    container.focus()

    function prenderTab(event: KeyboardEvent) {
      if (event.key !== 'Tab' || !container) return

      const itens = Array.from(
        container.querySelectorAll<HTMLElement>(FOCAVEIS),
      )

      if (itens.length === 0) {
        event.preventDefault()
        return
      }

      const primeiro = itens[0]
      const ultimo = itens[itens.length - 1]
      const atual = document.activeElement

      if (event.shiftKey && (atual === primeiro || atual === container)) {
        event.preventDefault()
        ultimo.focus()
      } else if (!event.shiftKey && atual === ultimo) {
        event.preventDefault()
        primeiro.focus()
      }
    }

    document.addEventListener('keydown', prenderTab)

    return () => {
      document.removeEventListener('keydown', prenderTab)

      if (origem && origem.isConnected) origem.focus()
    }
  }, [ref, aberto])
}
