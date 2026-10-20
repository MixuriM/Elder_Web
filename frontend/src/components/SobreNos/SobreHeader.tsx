
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuthUser } from '../../hooks/useAuthUser'
import BotaoTema from '../layout/BotaoTema'

function SobreHeader() {
  // Enquanto a sessão carrega, mostra a versão do visitante (sem piscar no cabeçalho).
  const { usuario } = useAuthUser()

  return (
    <header
      className="
        relative z-20
        w-full
        border-b border-[#E6E2F5]
        bg-white/80
        dark:border-[#303149]
        dark:bg-[#11141D]/90
      "
    >
      <div
        className="
          mx-auto flex min-h-[76px]
          w-full max-w-6xl
          flex-wrap items-center
          justify-between gap-3
          px-5 py-3
          sm:px-8 lg:px-10
        "
      >
        {/* VOLTAR PARA O INÍCIO */}
        <Link
          to={usuario ? '/Home' : '/'}
          className="
            inline-flex min-h-11
            items-center gap-2
            rounded-lg
            px-2 py-2
            text-sm font-semibold
            text-[#5147B5]
            dark:text-[#B9B3FF]
            focus-visible:outline
            focus-visible:outline-2
            focus-visible:outline-offset-2
            focus-visible:outline-[#6C63FF]
          "
        >
          <ArrowLeft
            size={20}
            aria-hidden="true"
          />

          <span>Voltar ao início</span>
        </Link>

        {/* AÇÕES DO CABEÇALHO */}
        <div
          className="
            flex items-center
            gap-3 sm:gap-4
          "
        >
          {/* ALTERNAR TEMA */}
          <BotaoTema compacto />

          {/* ENTRAR OU CRIAR CONTA (só para visitante) */}
          {!usuario && (
            <Link
              to="/welcome"
              className="
                inline-flex min-h-11
                items-center justify-center
                rounded-xl
                bg-[#6258E8]
                px-4 py-2
                text-center text-sm
                font-semibold text-white
                sm:px-5
                focus-visible:outline
                focus-visible:outline-2
                focus-visible:outline-offset-2
                focus-visible:outline-[#A18BFF]
              "
            >
              Entrar ou criar conta
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

export default SobreHeader
