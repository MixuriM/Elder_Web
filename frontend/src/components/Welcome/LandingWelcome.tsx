import WelcomeBotoes from "./WelcomeBotoes";
import BotaoTema from "../layout/BotaoTema";

function LandingWelcome() {
  return (
    <section
      className="
        relative

        flex
        w-full

        items-center
        justify-center

        bg-white

        px-4
        py-10

        transition-colors
        duration-300

        sm:px-6
        sm:py-12

        md:min-h-screen
        md:px-6

        lg:px-10

        xl:px-14

        2xl:px-20

        dark:bg-[#101018]
      "
    >
      {/* =====================================================
          BOTÃO DE TEMA - TABLET / DESKTOP

          No celular o botão compacto fica no Welcome.tsx.
      ====================================================== */}

      <div
        className="
          absolute
          right-5
          top-5
          z-50

          hidden
          md:block

          lg:right-6
          lg:top-6
        "
      >
        <BotaoTema />
      </div>

      {/* =====================================================
          CARD PRINCIPAL
      ====================================================== */}

      <div
        className="
          w-full
          max-w-[590px]

          rounded-[20px]

          border
          border-[#DDE1E8]

          bg-white

          px-5
          py-8

          text-center

          shadow-[0_10px_35px_rgba(30,40,80,0.05)]

          transition-colors
          duration-300

          min-[375px]:px-6

          sm:rounded-[24px]
          sm:px-7
          sm:py-10

          md:px-7

          lg:rounded-[28px]
          lg:px-9
          lg:py-11

          xl:px-10
          xl:py-12

          2xl:px-12

          dark:border-[#343445]
          dark:bg-[#181824]
          dark:shadow-[0_10px_35px_rgba(0,0,0,0.25)]
        "
      >
        {/* ===================================================
            TEXTO SUPERIOR
        ==================================================== */}

        <p
          className="
            text-xs
            font-bold
            uppercase

            tracking-[0.18em]

            text-[#6C63FF]

            min-[375px]:text-sm
            min-[375px]:tracking-[0.22em]

            lg:text-base
            lg:tracking-[0.25em]

            dark:text-[#A89FFF]
          "
        >
          Bem-vindo(a) ao
        </p>

        {/* ===================================================
            NOME
        ==================================================== */}

        <h2
          className="
            mt-2

            text-3xl
            font-bold

            text-[#071A38]

            min-[375px]:text-4xl

            lg:text-5xl

            dark:text-[#F5F5FA]
          "
        >
          Elder
        </h2>

        {/* ===================================================
            SLOGAN
        ==================================================== */}

        <p
          className="
            mt-3

            text-lg
            font-medium

            text-[#40506A]

            min-[375px]:text-xl

            sm:mt-4

            lg:text-2xl

            dark:text-[#D6D6DF]
          "
        >
          Cuidado que conecta
        </p>

        {/* ===================================================
            DESCRIÇÃO
        ==================================================== */}

        <p
          className="
            mx-auto

            mt-4
            max-w-md

            text-sm
            leading-6

            text-[#56657D]

            min-[375px]:text-base
            min-[375px]:leading-7

            sm:mt-5

            lg:mt-6
            lg:text-lg
            lg:leading-8

            dark:text-[#B9B9C5]
          "
        >
          Acompanhe informações de saúde, medicamentos e cuidados
          da pessoa idosa de forma simples e organizada.
        </p>

        {/* ===================================================
            BOTÕES
        ==================================================== */}

        <WelcomeBotoes />
      </div>
    </section>
  );
}

export default LandingWelcome;