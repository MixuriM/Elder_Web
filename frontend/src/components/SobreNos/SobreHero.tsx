
import logoElder from '../../img/Elder_logo.webp'

function SobreHero() {
  return (
    <section
      aria-labelledby="sobre-elder-titulo"
      className="
        relative mx-auto
        flex max-w-4xl
        flex-col items-center
        px-2 pb-6 pt-4
        text-center
        sm:pb-10 sm:pt-8
      "
    >
      {/* LOGO DO ELDER WEB */}
      <div
        aria-hidden="true"
        className="
          mb-6 flex
          items-center justify-center
        "
      >
        <img
          src={logoElder}
          alt=""
          width={112}
          height={112}
          className="
            h-24 w-24
            object-contain
            sm:h-28 sm:w-28
          "
        />
      </div>

      {/* IDENTIFICAÇÃO DA PÁGINA */}
      <span
        className="
          mb-4 inline-flex
          items-center justify-center
          rounded-full
          border border-[#DCD6FF]
          bg-[#F1EEFF]
          px-5 py-2
          text-sm font-bold
          uppercase tracking-[0.16em]
          text-[#5147B5]
          dark:border-[#49446F]
          dark:bg-[#25243B]
          dark:text-[#C5C0FF]
        "
      >
        Conheça o Elder
      </span>

      {/* TÍTULO PRINCIPAL */}
      <h1
        id="sobre-elder-titulo"
        className="
          max-w-3xl
          text-4xl font-extrabold
          leading-tight tracking-tight
          text-[#071A38]
          sm:text-5xl
          lg:text-6xl
          dark:text-[#F5F5FA]
        "
      >
        Sobre o{' '}
        <span
          className="
            text-[#6258E8]
            dark:text-[#B9B3FF]
          "
        >
          Elder Web
        </span>
      </h1>

      {/* DESCRIÇÃO PRINCIPAL */}
      <p
        className="
          mt-6 max-w-2xl
          text-base leading-8
          text-[#46536B]
          sm:text-lg
          dark:text-[#C7C7D1]
        "
      >
        Tecnologia pensada para facilitar o cuidado,
        aproximar pessoas e tornar a rotina mais simples,
        segura e organizada.
      </p>

      {/* DETALHE DECORATIVO */}
      <div
        aria-hidden="true"
        className="
          mt-8 h-1 w-20
          rounded-full
          bg-[#6C63FF]
          dark:bg-[#A18BFF]
        "
      />
    </section>
  )
}

export default SobreHero
