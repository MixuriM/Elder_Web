import {
  Bell,
  CalendarDays,
  FileText,
  HeartPulse,
  Pill,
  Users,
  type LucideIcon,
} from "lucide-react";

// Define o formato de cada funcionalidade
type Funcionalidade = {
  titulo: string;
  descricao: string;
  Icone: LucideIcon;
};

// Lista das funcionalidades do Elder
const funcionalidades: Funcionalidade[] = [
  {
    titulo: "Medicamentos",
    descricao:
      "Acompanhe horários, doses e lembretes de medicamentos.",
    Icone: Pill,
  },
  {
    titulo: "Rotina",
    descricao:
      "Organize atividades, consultas e compromissos.",
    Icone: CalendarDays,
  },
  {
    titulo: "Saúde",
    descricao:
      "Mantenha informações importantes de saúde organizadas.",
    Icone: HeartPulse,
  },
  {
    titulo: "Alertas",
    descricao:
      "Receba lembretes sobre medicamentos, consultas e eventos.",
    Icone: Bell,
  },
  {
    titulo: "Rede de cuidado",
    descricao:
      "Aproxime familiares, cuidadores e profissionais.",
    Icone: Users,
  },
  {
    titulo: "Histórico",
    descricao:
      "Tenha informações importantes sempre disponíveis.",
    Icone: FileText,
  },
];

function FuncionalidadesSection() {
  return (
    <section
      id="funcionalidades"
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

        {/* Título da seção */}
        <div className="mb-12 text-center">
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
            Funcionalidades
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
            Como o Elder Web ajuda?
          </h2>

          <p
            className="
              mx-auto
              mt-4
              max-w-2xl
              text-lg
              text-gray-600

              dark:text-gray-300
            "
          >
            Tudo o que você precisa em um só lugar,
            de forma simples e acessível.
          </p>
        </div>

        {/* Cards */}
        <div
          className="
            grid
            gap-5

            sm:grid-cols-2
            lg:grid-cols-3
          "
        >
          {funcionalidades.map(
            ({ titulo, descricao, Icone }) => (
              <article
                key={titulo}
                className="
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
                {/* Ícone */}
                <div
                  className="
                    mb-5
                    flex
                    h-14
                    w-14
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

export default FuncionalidadesSection;