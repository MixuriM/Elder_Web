import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'

interface EstadoVazioProps {
  icone: ReactNode
  titulo: string
  texto: string
  // Sem os dois, o cartão não tem botão (quem não pode registrar só lê).
  rotuloBotao?: string
  onClick?: () => void
}

// Lista sem nada ainda: mesmo cartão tracejado da tela de Medicamentos (ícone, título, texto e o botão de adicionar).
export default function EstadoVazio({ icone, titulo, texto, rotuloBotao, onClick }: EstadoVazioProps) {
  return (
    <section
      role="status"
      className="mt-6 rounded-3xl border border-dashed border-[#D9DCE8] bg-white px-6 py-10 text-center shadow-sm transition-colors dark:border-[#393947] dark:bg-[#171721]"
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F3F0FF] text-[#5F56EC] dark:bg-[#29243F] dark:text-[#A89FFF]">
        {icone}
      </div>

      <h3 className="mt-5 text-xl font-bold text-[#071A38] dark:text-[#F5F5FA]">{titulo}</h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#56657D] dark:text-[#C7C7D1]">{texto}</p>

      {rotuloBotao && onClick && (
        <button
          type="button"
          onClick={onClick}
          className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#5F56EC] px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-[#5A52E8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF]/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#171721]"
        >
          <Plus size={19} aria-hidden="true" />
          {rotuloBotao}
        </button>
      )}
    </section>
  )
}
