import {
  Bell,
  CalendarDays,
  HeartPulse,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

export type HeroProps = {
  headline: string;
  subheadline: string;
  ctaText: string;
  onCtaClick?: () => void;
};

// Cards apresentados no lado direito
const recursos = [
  {
    Icone: CalendarDays,
    titulo: "Rotina organizada",
    descricao: "Medicamentos, consultas e cuidados em um só lugar.",
  },
  {
    Icone: HeartPulse,
    titulo: "Saúde acessível",
    descricao: "Informações importantes sempre organizadas.",
  },
  {
    Icone: Users,
    titulo: "Cuidado conectado",
    descricao: "Familiares, cuidadores e profissionais mais próximos.",
  },
  {
    Icone: Bell,
    titulo: "Alertas importantes",
    descricao: "Lembretes para ajudar na organização do dia a dia.",
  },
];

function HeroSection({
  headline,
  subheadline,
  ctaText,
  onCtaClick,
}: HeroProps) {
  return (
    <section
      className="
        relative
        overflow-hidden

        bg-[#F7F5FF]

        px-6
        py-20

        transition-colors
        duration-300

        md:px-10

        dark:bg-[#141420]
      "
    >
      {/* Decoração suave */}
      <div
        className="
          pointer-events-none
          absolute
          -left-32
          top-10

          h-96
          w-96

          rounded-full

          bg-[#6C63FF]/10
          blur-3xl

          dark:bg-[#6C63FF]/5
        "
      />

      <div
        className="
          pointer-events-none
          absolute
          -right-32
          bottom-0

          h-96
          w-96

          rounded-full

          bg-[#AFA9FF]/20
          blur-3xl

          dark:bg-[#6C63FF]/10
        "
      />

      <div
        className="
          relative
          z-10

          mx-auto
          grid
          max-w-7xl

          items-center
          gap-16

          lg:grid-cols-[1fr_0.9fr]
        "
      >
        {/* Lado esquerdo */}
        <div
          className="
            text-center

            lg:text-left
          "
        >
          {/* Destaque */}
          <div
            className="
              inline-flex
              items-center
              gap-2

              rounded-full

              border
              border-[#DCD8FF]

              bg-white/70

              px-4
              py-2

              text-sm
              font-bold
              text-[#6C63FF]

              dark:border-white/10
              dark:bg-white/5
              dark:text-[#A7A2FF]
            "
          >
            <HeartPulse size={17} />
            Tecnologia a favor do cuidado
          </div>

          {/* Título */}
          <h1
            className="
              mx-auto
              mt-6
              max-w-2xl

              text-4xl
              font-bold
              leading-[1.15]

              text-[#101828]

              md:text-5xl
              lg:mx-0
              lg:text-6xl

              dark:text-white
            "
          >
            {headline}
          </h1>

          {/* Descrição */}
          <p
            className="
              mx-auto
              mt-6
              max-w-xl

              text-lg
              leading-8

              text-gray-600

              lg:mx-0

              dark:text-gray-300
            "
          >
            {subheadline}
          </p>

          {/* Botões */}
          <div
            className="
              mt-8
              flex
              flex-col
              items-center
              gap-3

              sm:flex-row
              sm:justify-center

              lg:justify-start
            "
          >
            <button
              type="button"
              onClick={onCtaClick}
              className="
                rounded-xl

                bg-[#6C63FF]

                px-7
                py-3.5

                text-base
                font-bold
                text-white

                shadow-lg
                shadow-[#6C63FF]/20

                transition
                duration-300

                hover:-translate-y-0.5
                hover:bg-[#5C54E8]

                dark:bg-[#817AFF]
                dark:hover:bg-[#6C63FF]
              "
            >
              {ctaText}
            </button>

            <button
              type="button"
              onClick={() =>
                document.getElementById("como-funciona")?.scrollIntoView({
                  behavior: "smooth",
                })
              }
              className="
                rounded-xl

                border
                border-gray-300

                bg-white/60

                px-7
                py-3.5

                text-base
                font-bold
                text-gray-700

                transition
                duration-300

                hover:border-[#6C63FF]
                hover:text-[#6C63FF]

                dark:border-white/15
                dark:bg-white/5
                dark:text-gray-200

                dark:hover:border-[#8B84FF]
                dark:hover:text-[#A7A2FF]
              "
            >
              Como funciona
            </button>
          </div>

          {/* Pequenas informações */}
          <div
            className="
              mt-8
              flex
              flex-wrap
              justify-center
              gap-x-6
              gap-y-2

              text-sm
              text-gray-500

              lg:justify-start

              dark:text-gray-400
            "
          >
            <span>✓ Simples de usar</span>
            <span>✓ Cuidado organizado</span>
            <span>✓ Mais proximidade</span>
          </div>
        </div>

        {/* Lado direito */}
        <div
          className="
            grid
            gap-4

            sm:grid-cols-2
          "
        >
          {recursos.map(({ Icone, titulo, descricao }) => (
            <CardRecurso
              key={titulo}
              Icone={Icone}
              titulo={titulo}
              descricao={descricao}
            />
          ))}

          {/* Pequeno destaque inferior */}
          <div
            className="
              flex
              items-center
              gap-4

              rounded-2xl

              border
              border-[#DDD9FF]

              bg-white/70

              p-5

              sm:col-span-2

              dark:border-white/10
              dark:bg-white/5
            "
          >
            <div
              className="
                flex
                h-11
                w-11
                shrink-0
                items-center
                justify-center

                rounded-xl

                bg-[#ECE9FF]
                text-[#6C63FF]

                dark:bg-[#292740]
                dark:text-[#A7A2FF]
              "
            >
              <ShieldCheck size={22} />
            </div>

            <div>
              <p
                className="
                  font-bold
                  text-[#101828]

                  dark:text-white
                "
              >
                Informação para cuidar melhor
              </p>

              <p
                className="
                  mt-1
                  text-sm
                  text-gray-500

                  dark:text-gray-400
                "
              >
                Organização e acompanhamento para tornar a rotina mais
                tranquila.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

type CardRecursoProps = {
  Icone: LucideIcon;
  titulo: string;
  descricao: string;
};

function CardRecurso({ Icone, titulo, descricao }: CardRecursoProps) {
  return (
    <article
      className="
        min-h-[180px]

        rounded-2xl

        border
        border-[#DDD9FF]

        bg-white/80

        p-6

        shadow-sm

        backdrop-blur-sm

        transition
        duration-300

        hover:-translate-y-1
        hover:shadow-md

        dark:border-white/10
        dark:bg-[#1A1A27]/90
      "
    >
      <div
        className="
          flex
          h-12
          w-12
          items-center
          justify-center

          rounded-xl

          bg-[#ECE9FF]
          text-[#6C63FF]

          dark:bg-[#292740]
          dark:text-[#A7A2FF]
        "
      >
        <Icone size={24} />
      </div>

      <h3
        className="
          mt-5

          text-lg
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

          text-sm
          leading-6

          text-gray-500

          dark:text-gray-400
        "
      >
        {descricao}
      </p>
    </article>
  );
}

export default HeroSection;
