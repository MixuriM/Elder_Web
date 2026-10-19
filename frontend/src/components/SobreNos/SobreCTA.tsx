
import { ArrowRight, HeartHandshake } from 'lucide-react'
import { Link } from 'react-router-dom'

function SobreCTA() {
  return (
    <section
      aria-labelledby="sobre-cta-titulo"
      className="
        relative mt-12 overflow-hidden
        rounded-3xl
        bg-[#554BD0]
        px-6 py-12
        text-center text-white
        sm:px-10 sm:py-14
        dark:bg-[#4940AD]
      "
    >
      {/* DETALHES DECORATIVOS */}
      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute -right-16 -top-20
          h-56 w-56 rounded-full
          border-[35px] border-white/10
        "
      />

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute -bottom-24 -left-16
          h-56 w-56 rounded-full
          border-[35px] border-white/10
        "
      />

      {/* CONTEÚDO */}
      <div
        className="
          relative z-10 mx-auto
          flex max-w-2xl
          flex-col items-center
        "
      >
        {/* ÍCONE */}
        <div
          aria-hidden="true"
          className="
            mb-6 flex h-14 w-14
            items-center justify-center
            rounded-2xl bg-white/15
          "
        >
          <HeartHandshake
            size={30}
            strokeWidth={1.8}
          />
        </div>

        {/* TÍTULO */}
        <h2
          id="sobre-cta-titulo"
          className="
            text-2xl font-extrabold
            leading-tight
            sm:text-3xl
          "
        >
          Cuidar também pode ser mais simples.
        </h2>

        {/* DESCRIÇÃO */}
        <p
          className="
            mt-5 max-w-xl
            text-base leading-8
            text-white/95
          "
        >
          Conheça o Elder Web e descubra como
          a tecnologia pode ajudar a organizar
          a rotina, acompanhar informações
          importantes e aproximar quem cuida
          de quem precisa de cuidado.
        </p>

        {/* BOTÃO */}
        <Link
          to="/welcome"
          className="
            mt-8 inline-flex
            min-h-12 items-center
            justify-center gap-3
            rounded-xl bg-white
            px-7 py-3
            text-base font-bold
            text-[#453BA9]
            focus-visible:outline
            focus-visible:outline-2
            focus-visible:outline-offset-4
            focus-visible:outline-white
          "
        >
          Conhecer o Elder

          <ArrowRight
            size={20}
            aria-hidden="true"
          />
        </Link>
      </div>
    </section>
  )
}

export default SobreCTA
