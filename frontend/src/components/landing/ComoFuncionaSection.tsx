import {
  UserPlus,
  Settings2,
  HeartHandshake,
} from "lucide-react";

const etapas = [
  {
    numero: "01",
    Icone: UserPlus,
    titulo: "Crie seu perfil",
    descricao:
      "Escolha o perfil que representa você e crie sua conta no Elder.",
  },
  {
    numero: "02",
    Icone: Settings2,
    titulo: "Organize as informações",
    descricao:
      "Cadastre informações importantes de saúde, medicamentos e rotina.",
  },
  {
    numero: "03",
    Icone: HeartHandshake,
    titulo: "Acompanhe o cuidado",
    descricao:
      "Mantenha as informações organizadas e facilite o acompanhamento no dia a dia.",
  },
];

function ComoFuncionaSection() {
  return (
    <section
      id="como-funciona"
      className="
        bg-white
        px-6
        py-24

        dark:bg-[#10101A]
      "
    >
      <div className="mx-auto max-w-7xl">

        <div className="mx-auto mb-16 max-w-2xl text-center">
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
            Simples desde o começo
          </span>

          <h2
            className="
              mt-4
              text-3xl
              font-bold
              text-[#101828]

              md:text-4xl

              dark:text-white
            "
          >
            Como funciona?
          </h2>

          <p
            className="
              mt-4
              text-lg
              text-gray-600

              dark:text-gray-300
            "
          >
            Começar a usar o Elder é simples.
            Em poucos passos, as informações
            importantes ficam mais organizadas.
          </p>
        </div>

        <div
          className="
            relative
            grid
            gap-8

            md:grid-cols-3
          "
        >
          {etapas.map(
            ({ numero, Icone, titulo, descricao }) => (
              <article
                key={numero}
                className="
                  relative
                  rounded-3xl

                  border
                  border-[#E5E3FF]

                  bg-[#FAF9FF]

                  p-8
                  text-center

                  dark:border-white/10
                  dark:bg-[#181824]
                "
              >
                <span
                  className="
                    absolute
                    right-6
                    top-5

                    text-4xl
                    font-black

                    text-[#6C63FF]/10

                    dark:text-white/5
                  "
                >
                  {numero}
                </span>

                <div
                  className="
                    mx-auto

                    flex
                    h-16
                    w-16
                    items-center
                    justify-center

                    rounded-2xl

                    bg-[#ECE9FF]
                    text-[#6C63FF]

                    dark:bg-[#292740]
                    dark:text-[#A7A2FF]
                  "
                >
                  <Icone size={30} />
                </div>

                <h3
                  className="
                    mt-6
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
                    mt-3
                    leading-7
                    text-gray-600

                    dark:text-gray-400
                  "
                >
                  {descricao}
                </p>
              </article>
            )
          )}
        </div>
      </div>
    </section>
  );
}

export default ComoFuncionaSection;