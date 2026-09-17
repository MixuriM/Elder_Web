import {
  HeartHandshake,
  House,
  Stethoscope,
} from "lucide-react";

const publicos = [
  {
    titulo: "Pessoa idosa",
    descricao:
      "Mais autonomia, segurança e organização para o dia a dia.",
    Icone: House,
  },
  {
    titulo: "Familiar / Responsável",
    descricao:
      "Acompanhe de perto informações e cuidados de quem você ama.",
    Icone: HeartHandshake,
  },
  {
    titulo: "Cuidador / Profissional",
    descricao:
      "Organize informações e acompanhe os cuidados de forma mais eficiente.",
    Icone: Stethoscope,
  },
];

function PublicoSection() {
  return (
    <section
      id="publico"
      className="
        bg-white
        px-6
        py-20

        transition-colors
        duration-300

        dark:bg-[#10101A]
      "
    >
      <div className="mx-auto max-w-7xl">

        {/* Título */}
        <div className="mb-12">
          <span
            className="
              text-sm
              font-bold
              uppercase
              tracking-[0.2em]
              text-[#6C63FF]

              dark:text-[#9B95FF]
            "
          >
            Para todos que cuidam
          </span>

          <h2
            className="
              mt-3
              text-3xl
              font-bold
              text-[#101828]

              md:text-4xl

              dark:text-white
            "
          >
            Para quem é o Elder Web?
          </h2>

          <p
            className="
              mt-4
              max-w-3xl
              text-lg
              text-gray-600

              dark:text-gray-300
            "
          >
            Uma solução pensada para diferentes
            pessoas, unidas pelo mesmo propósito:
            cuidado e qualidade de vida.
          </p>
        </div>

        {/* Cards */}
        <div
          className="
            grid
            gap-6

            md:grid-cols-3
          "
        >
          {publicos.map(
            ({ titulo, descricao, Icone }) => (
              <article
                key={titulo}
                className="
                  flex
                  gap-5
                  rounded-3xl

                  border
                  border-[#E5E3FF]

                  bg-[#FAF9FF]
                  p-7

                  transition
                  duration-300

                  hover:-translate-y-1
                  hover:shadow-lg

                  dark:border-white/10
                  dark:bg-[#181824]
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
                  <Icone size={28} />
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
                    {titulo}
                  </h3>

                  <p
                    className="
                      mt-2
                      leading-7
                      text-gray-600

                      dark:text-gray-400
                    "
                  >
                    {descricao}
                  </p>
                </div>
              </article>
            )
          )}
        </div>
      </div>
    </section>
  );
}

export default PublicoSection;