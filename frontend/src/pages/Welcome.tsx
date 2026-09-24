import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import LadoInformativo from "../components/Informativo/LadoInformativo";
import LandingWelcome from "../components/Welcome/LandingWelcome";
import WelcomeBotoes from "../components/Welcome/WelcomeBotoes";
import BotaoTema from "../components/layout/BotaoTema";

function Welcome() {
  const location = useLocation();
  const navigate = useNavigate();

  // =========================================================
  // ESTADO RECEBIDO PELA NAVEGAÇÃO
  // =========================================================

  const estado = location.state as {
    cadastroSucesso?: boolean;
    confirmarEmail?: boolean;
  } | null;

  const [mostrarSucesso, setMostrarSucesso] = useState(
    Boolean(estado?.cadastroSucesso)
  );

  const [avisoConfirmarEmail] = useState(
    Boolean(estado?.confirmarEmail)
  );

  // =========================================================
  // REMOVE O STATE DO HISTÓRICO
  // =========================================================

  useEffect(() => {
    if (location.state) {
      navigate(location.pathname, {
        replace: true,
        state: null,
      });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =========================================================
  // ESCONDE A MENSAGEM DE SUCESSO APÓS 5 SEGUNDOS
  // =========================================================

  useEffect(() => {
    if (!mostrarSucesso) return;

    const timer = setTimeout(() => {
      setMostrarSucesso(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, [mostrarSucesso]);

  return (
    <main
      className="
        relative
        min-h-screen
        w-full
        overflow-x-hidden

        bg-white

        font-['Atkinson_Hyperlegible']

        transition-colors
        duration-300

        md:grid
        md:grid-cols-2

        dark:bg-[#101018]
      "
    >
      {/* =====================================================
          BOTÃO DE TEMA - SOMENTE MOBILE
      ====================================================== */}

      <div
        className="
          absolute
          right-4
          top-4
          z-50

          sm:right-5
          sm:top-5

          md:hidden
        "
      >
        <BotaoTema compacto />
      </div>

      {/* =====================================================
          MENSAGEM DE CADASTRO REALIZADO
      ====================================================== */}

      {mostrarSucesso && (
        <p
          role="alert"
          className="
            fixed
            left-1/2
            top-16
            z-[60]

            w-[calc(100%-2rem)]
            max-w-md

            -translate-x-1/2

            rounded-xl
            bg-green-50

            px-4
            py-3

            text-center
            text-sm
            leading-6
            text-green-700

            shadow-md

            sm:top-6
            sm:px-6
            sm:text-base

            md:text-lg

            dark:bg-green-950/40
            dark:text-green-300
          "
        >
          Cadastro realizado com sucesso!
        </p>
      )}

      {/* =====================================================
          AVISO DE CONFIRMAÇÃO DE E-MAIL
      ====================================================== */}

      {avisoConfirmarEmail && (
        <p
          role="status"
          className="
            fixed
            left-1/2
            top-32
            z-[60]

            w-[calc(100%-2rem)]
            max-w-xl

            -translate-x-1/2

            rounded-xl
            bg-[#EDE7FF]

            px-4
            py-3

            text-center
            text-sm
            leading-6
            text-[#3A355C]

            shadow-md

            sm:top-24
            sm:px-6
            sm:py-4
            sm:text-base

            md:text-lg

            dark:bg-[#3A355C]
            dark:text-[#F5F5FA]
          "
        >
          Enviamos um e-mail de confirmação para você. Abra a
          mensagem e clique no link para concluir o cadastro e
          ativar seus vínculos.
        </p>
      )}

      {/* =====================================================
          LADO INFORMATIVO
      ====================================================== */}

      <section
        className="
          min-w-0
          w-full

          bg-[#F3F0FF]

          md:min-h-screen

          dark:bg-[#151522]
        "
      >
        <LadoInformativo tipo="landing" />

        {/* ===================================================
            WELCOME MOBILE

            Continuação visual do LadoInformativo.
            Sem card separado.
        ==================================================== */}

        <div
          className="
            relative
            z-20

            mx-auto
            w-full
            max-w-xl

            px-5
            pb-10
            pt-4

            sm:px-8
            sm:pb-12
            sm:pt-6

            md:hidden
          "
        >
          {/* DIVISOR SUAVE */}

          <div
            className="
              mx-auto
              mb-7

              h-1
              w-12

              rounded-full

              bg-[#6C63FF]/25

              dark:bg-[#A89FFF]/25
            "
          />

          {/* TEXTO SUPERIOR */}

          <p
            className="
              text-center
              text-sm
              font-bold
              uppercase
              tracking-[0.22em]

              text-[#6C63FF]

              dark:text-[#A89FFF]
            "
          >
            Bem-vindo(a) ao
          </p>

          {/* NOME ELDER */}

          <h2
            className="
              mt-2

              text-center
              text-4xl
              font-bold

              text-[#071A38]

              sm:text-5xl

              dark:text-[#F5F5FA]
            "
          >
            Elder
          </h2>

          {/* SLOGAN */}

          <p
            className="
              mt-3

              text-center
              text-xl
              font-medium

              text-[#40506A]

              sm:mt-4
              sm:text-2xl

              dark:text-[#D6D6DF]
            "
          >
            Cuidado que conecta
          </p>

          {/* TEXTO EXPLICATIVO */}

          <p
            className="
              mx-auto
              mt-5
              max-w-md

              text-center
              text-base
              leading-7

              text-[#56657D]

              sm:mt-6
              sm:text-lg
              sm:leading-8

              dark:text-[#B9B9C5]
            "
          >
            Acompanhe informações de saúde, medicamentos e cuidados
            da pessoa idosa de forma simples e organizada.
          </p>

          {/* =================================================
              BOTÕES
          ================================================== */}

          <div
            className="
              mx-auto
              mt-7
              w-full
              max-w-md

              sm:mt-8
            "
          >
            <WelcomeBotoes />
          </div>
        </div>
      </section>

      {/* =====================================================
          LANDING WELCOME - TABLET / COMPUTADOR
      ====================================================== */}

      <section
        className="
          hidden
          min-h-screen
          min-w-0
          w-full

          md:block
        "
      >
        <LandingWelcome />
      </section>
    </main>
  );
}

export default Welcome;