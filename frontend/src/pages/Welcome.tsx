import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import LadoInformativo from "../components/Informativo/LadoInformativo";
import LandingWelcome from "../components/Welcome/LandingWelcome";
import BotaoTema from "../components/layout/BotaoTema";

function Welcome() {
  const location = useLocation();
  const navigate = useNavigate();

  const estado = location.state as { cadastroSucesso?: boolean; confirmarEmail?: boolean } | null;

  const [mostrarSucesso, setMostrarSucesso] = useState(Boolean(estado?.cadastroSucesso));

  // Aviso de e-mail de confirmação: fica na tela (não some sozinho), porque o usuário
  // precisa abrir a caixa de entrada e clicar no link.
  const [avisoConfirmarEmail] = useState(Boolean(estado?.confirmarEmail));

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

      {avisoConfirmarEmail && (
        <p
          role="status"
          className="
            fixed
            left-1/2
            top-24
            z-50
            w-[calc(100%-3rem)]
            max-w-xl

            -translate-x-1/2

            rounded-xl

            bg-[#EDE7FF]

            px-6
            py-4

            text-lg
            text-[#3A355C]

            shadow-md

            dark:bg-[#3A355C]
            dark:text-[#F5F5FA]
          "
        >
          Enviamos um e-mail de confirmação para você. Abra a mensagem e clique no link para
          concluir o cadastro e ativar seus vínculos.
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