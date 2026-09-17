import {
  Accessibility,
  HeartPulse,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

type ItemResumo = {
  Icone: LucideIcon;
  titulo: string;
  descricao: string;
};

const itens: ItemResumo[] = [
  {
    Icone: HeartPulse,
    titulo: "Saúde organizada",
    descricao:
      "Informações importantes em um só lugar.",
  },
  {
    Icone: Users,
    titulo: "Cuidado conectado",
    descricao:
      "Mais proximidade entre quem cuida.",
  },
  {
    Icone: ShieldCheck,
    titulo: "Mais tranquilidade",
    descricao:
      "Rotina e cuidados mais organizados.",
  },
  {
    Icone: Accessibility,
    titulo: "Simples e acessível",
    descricao:
      "Uma experiência pensada para facilitar.",
  },
];

function ResumoSection() {
  return (
    <section
      className="
        border-y
        border-gray-100

        bg-white

        px-6
        py-8

        transition-colors
        duration-300

        dark:border-white/5
        dark:bg-[#10101A]
      "
    >
      <div
        className="
          mx-auto
          grid
          max-w-7xl

          gap-6

          sm:grid-cols-2
          xl:grid-cols-4
          xl:gap-0
        "
      >
        {itens.map(
          ({
            Icone,
            titulo,
            descricao,
          }, index) => (
            <div
              key={titulo}
              className={`
                flex
                items-center
                gap-4

                xl:px-7

                ${
                  index !== 0
                    ? "xl:border-l xl:border-gray-200 dark:xl:border-white/10"
                    : ""
                }
              `}
            >
              {/* Ícone */}
              <div
                className="
                  flex
                  h-11
                  w-11
                  shrink-0
                  items-center
                  justify-center

                  rounded-xl

                  bg-[#F0EEFF]
                  text-[#6C63FF]

                  dark:bg-[#292740]
                  dark:text-[#A7A2FF]
                "
              >
                <Icone size={21} />
              </div>

              {/* Texto */}
              <div>
                <h3
                  className="
                    text-sm
                    font-bold
                    text-[#101828]

                    dark:text-white
                  "
                >
                  {titulo}
                </h3>

                <p
                  className="
                    mt-1
                    text-xs
                    leading-5
                    text-gray-500

                    dark:text-gray-400
                  "
                >
                  {descricao}
                </p>
              </div>
            </div>
          )
        )}
      </div>
    </section>
  );
}

export default ResumoSection;