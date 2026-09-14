import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import LadoInformativo from "../components/Informativo/LadoInformativo";
import LandingWelcome from "../components/Welcome/LandingWelcome";
import BotaoTema from "../components/layout/BotaoTema";

function Welcome() {
  const location = useLocation();
  const navigate = useNavigate();

  const [mostrarSucesso, setMostrarSucesso] = useState(
    Boolean((location.state as { cadastroSucesso?: boolean } | null)?.cadastroSucesso)
  );

  // Remove o state da entrada do histórico assim que a página monta, pra
  // F5 ou voltar/avançar no navegador não reexibirem a mensagem.
  useEffect(() => {
    if (location.state) {
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mostrarSucesso) return;

    const timer = setTimeout(() => setMostrarSucesso(false), 5000);
    return () => clearTimeout(timer);
  }, [mostrarSucesso]);

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

      {/* Mensagem de cadastro concluído */}
      {mostrarSucesso && (
        <p
          role="alert"
          className="
            fixed
            left-1/2
            top-6
            z-50

            -translate-x-1/2

            rounded-xl

            bg-green-50

            px-6
            py-3

            text-lg
            text-green-700

            shadow-md

            dark:bg-green-950/40
            dark:text-green-300
          "
        >
          Cadastro realizado com sucesso!
        </p>
      )}

      {/* Lado esquerdo com apresentação do Elder */}
      <LadoInformativo tipo="landing" />

      {/* Lado direito com boas-vindas e botões */}
      <LandingWelcome />
    </main>
  );
}

export default Welcome;