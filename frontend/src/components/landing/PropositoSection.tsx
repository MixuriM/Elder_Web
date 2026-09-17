import {
  BarChart3,
  Target,
} from "lucide-react";

function PropositoSection() {
  return (
    <section
      id="sobre"
      className="
        bg-[#F6F4FF]
        px-6
        py-20
        transition-colors
        duration-300

        dark:bg-[#141420]
      "
    >
      <div
        className="
          mx-auto
          grid
          max-w-7xl
          gap-12

          lg:grid-cols-2
          lg:items-center
        "
      >
        {/* Texto principal */}
        <div>
          <span
            className="
              inline-block
              rounded-full
              bg-[#E9E5FF]
              px-5
              py-2

              text-sm
              font-bold
              uppercase
              tracking-wider
              text-[#554DDB]

              dark:bg-[#292740]
              dark:text-[#A7A2FF]
            "
          >
            Por que existe?
          </span>

          <h2
            className="
              mt-6
              max-w-xl
              text-4xl
              font-bold
              leading-tight
              text-[#101828]

              dark:text-white
            "
          >
            Cuidar também é planejar o{" "}
            <span className="text-[#6C63FF]">
              futuro.
            </span>
          </h2>

          <p
            className="
              mt-6
              max-w-xl
              text-lg
              leading-8
              text-gray-600

              dark:text-gray-300
            "
          >
            O Elder Web nasceu para tornar o cuidado
            com a pessoa idosa mais simples, organizado
            e acolhedor, usando a tecnologia para
            aproximar todas as pessoas envolvidas nessa
            jornada.
          </p>
        </div>

        {/* Cards */}
        <div className="space-y-5">

          {/* Propósito */}
          <article
            className="
              flex
              gap-5
              rounded-3xl
              border
              border-[#E5E3FF]
              bg-white
              p-7

              dark:border-white/10
              dark:bg-[#1A1A27]
            "
          >
            <div
              className="
                flex
                h-14
                w-14
                shrink-0
                items-center
                justify-center
                rounded-2xl

                bg-[#ECE9FF]
                text-[#6C63FF]

                dark:bg-[#292740]
                dark:text-[#A7A2FF]
              "
            >
              <Target size={28} />
            </div>

            <div>
              <h3
                className="
                  text-xl
                  font-bold
                  text-[#101828]

                  dark:text-white
                "
              >
                Nosso propósito
              </h3>

              <p
                className="
                  mt-2
                  leading-7
                  text-gray-600

                  dark:text-gray-300
                "
              >
                Facilitar o cuidado e contribuir para
                mais autonomia, organização e qualidade
                de vida.
              </p>
            </div>
          </article>

          {/* Missão */}
          <article
            className="
              flex
              gap-5
              rounded-3xl
              border
              border-[#E5E3FF]
              bg-white
              p-7

              dark:border-white/10
              dark:bg-[#1A1A27]
            "
          >
            <div
              className="
                flex
                h-14
                w-14
                shrink-0
                items-center
                justify-center
                rounded-2xl

                bg-[#ECE9FF]
                text-[#6C63FF]

                dark:bg-[#292740]
                dark:text-[#A7A2FF]
              "
            >
              <BarChart3 size={28} />
            </div>

            <div>
              <h3
                className="
                  text-xl
                  font-bold
                  text-[#101828]

                  dark:text-white
                "
              >
                Nossa missão
              </h3>

              <p
                className="
                  mt-2
                  leading-7
                  text-gray-600

                  dark:text-gray-300
                "
              >
                Conectar pessoas e informações para
                tornar o cuidado mais eficiente,
                próximo e humanizado.
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

export default PropositoSection;