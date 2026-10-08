import { useEffect } from 'react'

// Título da aba por tela (WCAG 2.4.2): "<Tela> | Elder Web".
export function useTitulo(titulo: string) {
  useEffect(() => {
    document.title = `${titulo} | Elder Web`
  }, [titulo])
}
