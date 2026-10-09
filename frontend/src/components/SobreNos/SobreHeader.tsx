import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

import BotaoTema from '../layout/BotaoTema'

function SobreHeader() {
  return (
    <header
      className="
        sticky
        top-0
        z-40
        border-b
        border-[#E7E4F5]
        bg-white/90
        backdrop-blur-md

        dark:border-white/10
        dark:bg-[#11141D]/90
      "
    >
      <div
        className="
          mx-auto
          flex
          min-h-[76px]
          w-full
          max-w-6xl
          items-center
          justify-between
          gap-3
          px-5

          sm:px-8
          lg:px-10
        "
      >
        <Link
          to="/"
          className="
            inline-flex
            min-h-[44px]
            items-center
            gap-2
            rounded-xl
            px-3
            font-semibold
            text-[#071A38]
            transition-colors

            hover:bg-[#F3F0FF]
            hover:text-[#6C63FF]

            focus-visible:outline
            focus-visible:outline-4
            focus-visible:outline-offset-2
            focus-visible:outline-[#6C63FF]

            dark:text-[#F5F5FA]
            dark:hover:bg-white/10
            dark:hover:text-[#A18BFF]
          "
        >
          <ArrowLeft size={22} />

          <span className="hidden sm:inline">
            Página inicial
          </span>

          <span className="sm:hidden">
            Voltar
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <BotaoTema compacto />

          <Link
            to="/welcome"
            className="
              inline-flex
              min-h-[44px]
              items-center
              justify-center
              rounded-xl
              bg-[#5F56EC]
              px-5
              font-bold
              text-white
              transition-all

              hover:bg-[#554CD8]
              hover:shadow-md

              focus-visible:outline
              focus-visible:outline-4
              focus-visible:outline-offset-2
              focus-visible:outline-[#6C63FF]
            "
          >
            <span className="hidden sm:inline">
              Entrar ou criar conta
            </span>

            <span className="sm:hidden">
              Entrar
            </span>
          </Link>
        </div>
      </div>
    </header>
  )
}

export default SobreHeader