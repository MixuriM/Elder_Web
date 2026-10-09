import { Link } from 'react-router-dom'

function SobreCTA() {
  return (
    <section
      className="
        mt-14
        overflow-hidden
        rounded-3xl
        bg-[#5F56EC]
        px-6
        py-10
        text-center
        text-white

        sm:px-10
        sm:py-12
      "
    >
      <h2 className="text-3xl font-bold">
        Cuidar também pode ser mais simples.
      </h2>

      <p
        className="
          mx-auto
          mt-4
          max-w-2xl
          text-lg
          leading-8
          text-white
        "
      >
        O Elder reúne informações importantes em um só lugar
        para ajudar idosos, familiares e cuidadores no dia a dia.
      </p>

      <Link
        to="/welcome"
        className="
          mt-7
          inline-flex
          min-h-[48px]
          items-center
          justify-center
          rounded-xl
          bg-white
          px-6
          font-bold
          text-[#5F56EC]
          transition-all

          hover:scale-[1.02]
          hover:shadow-lg

          focus-visible:outline
          focus-visible:outline-4
          focus-visible:outline-offset-2
          focus-visible:outline-white
        "
      >
        Conhecer o Elder
      </Link>
    </section>
  )
}

export default SobreCTA