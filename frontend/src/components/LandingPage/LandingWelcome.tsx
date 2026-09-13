import LandingBotoes from "./LandingBotoes";
import BotaoTema from "../layout/BotaoTema";

function LandingWelcome() {
  return (
    <section
      className="
        relative
        flex
        min-h-screen
        items-center
        justify-center
        bg-white
        dark:bg-[#101018]
        px-8
        py-10
        transition-colors
        duration-300
        lg:px-14
        xl:px-20
      "
    >
      {/* Botão para alterar o tema */}
      <div
        className="
          absolute
          top-6
          right-6
          z-50
        "
      >
        <BotaoTema />
      </div>

      {/* Card principal */}
      <div
        className="
          w-full
          max-w-[590px]
          rounded-[28px]
          border
          border-[#DDE1E8]
          bg-white
          dark:border-[#343445]
          dark:bg-[#181824]
          px-10
          py-12
          text-center
          shadow-[0_10px_35px_rgba(30,40,80,0.05)]
          dark:shadow-[0_10px_35px_rgba(0,0,0,0.25)]
          transition-colors
          duration-300
          sm:px-12
        "
      >
        {/* Texto superior */}
        <p
          className="
            text-base
            font-bold
            uppercase
            tracking-[0.25em]
            text-[#6C63FF]
            dark:text-[#A89FFF]
          "
        >
          Bem-vindo(a) ao
        </p>

        {/* Nome */}
        <h2
          className="
            mt-2
            text-5xl
            font-bold
            text-[#071A38]
            dark:text-[#F5F5FA]
          "
        >
          Elder
        </h2>

        {/* Slogan */}
        <p
          className="
            mt-4
            text-2xl
            font-medium
            text-[#40506A]
            dark:text-[#D6D6DF]
          "
        >
          Cuidado que conecta
        </p>

        {/* Texto explicativo */}
        <p
          className="
            mx-auto
            mt-6
            max-w-md
            text-lg
            leading-8
            text-[#56657D]
            dark:text-[#B9B9C5]
          "
        >
          Acompanhe informações de saúde, medicamentos e cuidados
          da pessoa idosa de forma simples e organizada.
        </p>

        {/* Botões */}
        <LandingBotoes />
      </div>
    </section>
  );
}

export default LandingWelcome;