import {
  Bell,
  CalendarDays,
  HeartPulse,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

import folhasDecorativas from "../../Img/folha_inicioE.png";
import folhasDecorativa from "../../Img/folha_inicioD.png";

export type HeroProps = {
  headline: string;
  subheadline: string;
  ctaText: string;
  onCtaClick?: () => void;
};

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
        w-full
        overflow-hidden
        bg-[#F7F5FF]
        px-4
        py-10
        transition-colors
        duration-300

        sm:px-6
        sm:py-12

        md:px-8
        md:py-14

        lg:px-10
        lg:py-20

        dark:bg-[#141420]
      "
    >
      {/* ==================================================
          FOLHAS DECORATIVAS
          Escondidas no celular para não atrapalhar o conteúdo
      ================================================== */}

      {/* Folha esquerda */}
      <img
        src={folhasDecorativas}
        alt=""
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          left-0
          top-1/2
          z-[1]
          hidden
          w-[220px]
          -translate-x-[30%]
          -translate-y-1/2
          opacity-25

          lg:block

          xl:w-[280px]

          dark:opacity-35
        "
      />

      {/* Folha direita */}
      <img
        src={folhasDecorativa}
        alt=""
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          bottom-[-40px]
          right-0
          z-[1]
          hidden
          w-[220px]
          translate-x-[35%]
          opacity-20

          lg:block

          xl:w-[280px]

          dark:opacity-30
        "
      />

      {/* ==================================================
          LUZES DECORATIVAS
      ================================================== */}

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          -left-24
          top-10
          h-64
          w-64
          rounded-full
          bg-[#6C63FF]/10
          blur-3xl

          sm:h-80
          sm:w-80

          lg:-left-32
          lg:h-96
          lg:w-96

          dark:bg-[#6C63FF]/5
        "
      />

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          -right-24
          bottom-0
          h-64
          w-64
          rounded-full
          bg-[#AFA9FF]/20
          blur-3xl

          sm:h-80
          sm:w-80

          lg:-right-32
          lg:h-96
          lg:w-96

          dark:bg-[#6C63FF]/10
        "
      />

      {/* ==================================================
          CONTEÚDO PRINCIPAL
      ================================================== */}

      <div
        className="
          relative
          z-10
          mx-auto
          grid
          w-full
          max-w-7xl
          grid-cols-1
          items-center
          gap-10

          md:gap-12

          lg:grid-cols-[1fr_0.9fr]
          lg:gap-14

          xl:gap-16
        "
      >
        {/* ==================================================
            LADO ESQUERDO
        ================================================== */}

        <div
          className="
            min-w-0
            text-center

            lg:text-left
          "
        >
          {/* Etiqueta */}
          <div
            className="
              inline-flex
              max-w-full
              items-center
              justify-center
              gap-2
              rounded-full
              border
              border-[#DCD8FF]
              bg-white/70
              px-3
              py-2
              text-xs
              font-bold
              text-[#6C63FF]

              sm:px-4
              sm:text-sm

              dark:border-white/10
              dark:bg-white/5
              dark:text-[#A7A2FF]
            "
          >
            <HeartPulse
              size={16}
              className="shrink-0"
            />

            <span>
              Tecnologia a favor do cuidado
            </span>
          </div>

          {/* ==================================================
              TÍTULO
          ================================================== */}

          <h1
            className="
              mx-auto
              mt-5
              max-w-2xl
              break-words
              text-[2.15rem]
              font-bold
              leading-[1.08]
              tracking-[-0.02em]
              text-[#101828]

              sm:mt-6
              sm:text-4xl

              md:text-5xl

              lg:mx-0
              lg:text-5xl

              xl:text-6xl

              dark:text-white
            "
          >
            {headline}
          </h1>

          {/* ==================================================
              DESCRIÇÃO
          ================================================== */}

          <p
            className="
              mx-auto
              mt-5
              max-w-xl
              text-[15px]
              leading-7
              text-gray-600

              sm:mt-6
              sm:text-base

              md:text-lg
              md:leading-8

              lg:mx-0

              dark:text-gray-300
            "
          >
            {subheadline}
          </p>

          {/* ==================================================
              BOTÕES
          ================================================== */}

          <div
            className="
              mx-auto
              mt-7
              flex
              w-full
              max-w-md
              flex-col
              gap-3

              sm:mt-8
              sm:max-w-none
              sm:flex-row
              sm:justify-center

              lg:mx-0
              lg:justify-start
            "
          >
            {/* Botão principal */}
            <button
              type="button"
              onClick={onCtaClick}
              className="
                w-full
                rounded-xl
                bg-[#6C63FF]
                px-6
                py-3.5
                text-sm
                font-bold
                text-white
                shadow-lg
                shadow-[#6C63FF]/20
                transition
                duration-300

                active:scale-[0.98]

                sm:w-auto
                sm:px-7
                sm:text-base

                hover:-translate-y-0.5
                hover:bg-[#5C54E8]

                dark:bg-[#817AFF]
                dark:hover:bg-[#6C63FF]
              "
            >
              {ctaText}
            </button>

            {/* Botão secundário */}
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("como-funciona")
                  ?.scrollIntoView({
                    behavior: "smooth",
                  })
              }
              className="
                w-full
                rounded-xl
                border
                border-gray-300
                bg-white/60
                px-6
                py-3.5
                text-sm
                font-bold
                text-gray-700
                transition
                duration-300

                active:scale-[0.98]

                sm:w-auto
                sm:px-7
                sm:text-base

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

          {/* ==================================================
              BENEFÍCIOS
          ================================================== */}

          <div
            className="
              mx-auto
              mt-7
              flex
              max-w-lg
              flex-wrap
              justify-center
              gap-x-4
              gap-y-2
              text-xs
              text-gray-500

              sm:mt-8
              sm:gap-x-6
              sm:text-sm

              lg:mx-0
              lg:justify-start

              dark:text-gray-400
            "
          >
            <span className="whitespace-nowrap">
              ✓ Simples de usar
            </span>

            <span className="whitespace-nowrap">
              ✓ Cuidado organizado
            </span>

            <span className="whitespace-nowrap">
              ✓ Mais proximidade
            </span>
          </div>
        </div>

        {/* ==================================================
            LADO DIREITO / CARDS
        ================================================== */}

        <div
          className="
            grid
            min-w-0
            grid-cols-1
            gap-3

            sm:grid-cols-2
            sm:gap-4
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

          {/* ==================================================
              DESTAQUE INFERIOR
          ================================================== */}

          <div
            className="
              flex
              min-w-0
              items-start
              gap-3
              rounded-2xl
              border
              border-[#DDD9FF]
              bg-white/70
              p-4

              sm:col-span-2
              sm:items-center
              sm:gap-4
              sm:p-5

              dark:border-white/10
              dark:bg-white/5
            "
          >
            {/* Ícone */}
            <div
              className="
                flex
                h-10
                w-10
                shrink-0
                items-center
                justify-center
                rounded-xl
                bg-[#ECE9FF]
                text-[#6C63FF]

                sm:h-11
                sm:w-11

                dark:bg-[#292740]
                dark:text-[#A7A2FF]
              "
            >
              <ShieldCheck size={21} />
            </div>

            {/* Texto */}
            <div className="min-w-0">
              <p
                className="
                  text-sm
                  font-bold
                  leading-5
                  text-[#101828]

                  sm:text-base

                  dark:text-white
                "
              >
                Informação para cuidar melhor
              </p>

              <p
                className="
                  mt-1
                  text-xs
                  leading-5
                  text-gray-500

                  sm:text-sm
                  sm:leading-6

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

/* ==================================================
   CARD
================================================== */

type CardRecursoProps = {
  Icone: LucideIcon;
  titulo: string;
  descricao: string;
};

function CardRecurso({
  Icone,
  titulo,
  descricao,
}: CardRecursoProps) {
  return (
    <article
      className="
        min-w-0
        rounded-2xl
        border
        border-[#DDD9FF]
        bg-white/80
        p-5
        shadow-sm
        backdrop-blur-sm
        transition
        duration-300

        sm:min-h-[170px]
        sm:p-6

        lg:min-h-[180px]

        hover:-translate-y-1
        hover:shadow-md

        dark:border-white/10
        dark:bg-[#1A1A27]/90
      "
    >
      {/* Ícone */}
      <div
        className="
          flex
          h-10
          w-10
          items-center
          justify-center
          rounded-xl
          bg-[#ECE9FF]
          text-[#6C63FF]

          sm:h-12
          sm:w-12

          dark:bg-[#292740]
          dark:text-[#A7A2FF]
        "
      >
        <Icone
          size={22}
          className="sm:h-6 sm:w-6"
        />
      </div>

      {/* Título */}
      <h3
        className="
          mt-4
          break-words
          text-base
          font-bold
          text-[#101828]

          sm:mt-5
          sm:text-lg

          dark:text-white
        "
      >
        {titulo}
      </h3>

      {/* Descrição */}
      <p
        className="
          mt-2
          break-words
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