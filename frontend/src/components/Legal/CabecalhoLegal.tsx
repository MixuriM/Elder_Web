
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

import BotaoTema from '../layout/BotaoTema'

export default function CabecalhoLegal() {
  return (
    <header className="relative z-10 border-b border-gray-200 dark:border-white/10">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="
            inline-flex min-h-11 items-center gap-2
            rounded-xl border border-gray-200
            bg-white/70 px-4 text-sm font-semibold
            text-[#071A38] transition-colors
            hover:bg-[#F3F0FF]
            focus-visible:outline focus-visible:outline-4
            focus-visible:outline-offset-2
            focus-visible:outline-[#5F56EC]
            dark:border-white/10 dark:bg-white/5
            dark:text-[#F5F5FA] dark:hover:bg-white/10
          "
        >
          <ArrowLeft size={19} aria-hidden="true" />
          Página inicial
        </Link>

        <BotaoTema compacto />
      </div>
    </header>
  )
}
