import LadoInformativo from "../components/Informativo/LadoInformativo";
import LandingWelcome from "../components/Welcome/LandingWelcome";
import BotaoTema from "../components/layout/BotaoTema";

function Welcome() {
  return (
    <main
      className="
        relative
        min-h-screen

        bg-white
        dark:bg-[#101018]

        font-['Atkinson_Hyperlegible']

        transition-colors
        duration-300

        lg:grid
        lg:grid-cols-2
      "
    >
      {/* Botão para alternar entre tema claro e escuro */}
      <div
        className="
          absolute
          right-6
          top-6
          z-50
        "
      >
        <BotaoTema />
      </div>

      {/* Lado esquerdo com apresentação do Elder */}
      <LadoInformativo tipo="landing" />

      {/* Lado direito com boas-vindas e botões */}
      <LandingWelcome />
    </main>
  );
}

export default Welcome;