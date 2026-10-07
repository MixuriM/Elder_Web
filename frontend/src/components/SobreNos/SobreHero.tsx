function SobreHero() {
  return (
    <section className="mx-auto max-w-3xl text-center">
      <span
        className="
          inline-flex
          rounded-full
          bg-[#ECE9FF]
          px-5
          py-2
          text-sm
          font-bold
          text-[#5F56EC]

          dark:bg-[#6C63FF]/15
          dark:text-[#B8B3FF]
        "
      >
        Conheça o Elder
      </span>

      <h1
        className="
          mt-5
          text-4xl
          font-bold
          tracking-tight
          text-[#071A38]

          sm:text-5xl
          lg:text-6xl

          dark:text-[#F5F5FA]
        "
      >
        Sobre o{' '}
        <span className="text-[#6C63FF] dark:text-[#A18BFF]">
          Elder Web
        </span>
      </h1>

      <p
        className="
          mx-auto
          mt-6
          max-w-2xl
          text-lg
          leading-8
          text-[#56657D]

          sm:text-xl

          dark:text-[#C7C7D1]
        "
      >
        Tecnologia pensada para facilitar o cuidado,
        aproximar pessoas e tornar a rotina mais simples,
        segura e organizada.
      </p>
    </section>
  )
}

export default SobreHero