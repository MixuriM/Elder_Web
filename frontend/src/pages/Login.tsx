// =========================================================
// IMPORTS
// =========================================================

import {
  useState,
  type FormEvent,
} from "react";

import { useNavigate } from "react-router-dom";

// Funções relacionadas à autenticação
import {
  loginUser,
  loginWithGoogle,
  syncUser,
  logoutUser,
  mensagemErroLogin,
  erroSemContaNoLogin,
} from "../lib/auth";

// Componentes
import LadoInformativo from "../components/Informativo/LadoInformativo";
import FormularioLogin from "../components/login/FormularioLogin";
import BotaoTema from "../components/layout/BotaoTema";

function Login() {
  // =========================================================
  // ESTADOS
  // =========================================================

  const [email, setEmail] = useState("");

  const [senha, setSenha] = useState("");

  const [erro, setErro] =
    useState<string | null>(null);

  const [
    sugerirCadastro,
    setSugerirCadastro,
  ] = useState(false);

  const [carregando, setCarregando] =
    useState(false);

  const navigate = useNavigate();

  // =========================================================
  // LOGIN COM E-MAIL E SENHA
  // =========================================================

  async function handleSubmit(
    e: FormEvent
  ) {
    e.preventDefault();

    setErro(null);
    setSugerirCadastro(false);
    setCarregando(true);

    try {
      // Realiza o login
      await loginUser(
        email,
        senha
      );

      // Sincroniza os dados do usuário
      await syncUser();

      // Navega para a Home
      navigate("/Home");
    } catch (err) {
      console.error(
        "Falha no login com e-mail e senha:",
        err
      );

      await tratarErroLogin(err);
    } finally {
      setCarregando(false);
    }
  }

  // =========================================================
  // TRATAMENTO DE ERRO
  // =========================================================

  async function tratarErroLogin(
    err: unknown
  ) {
    setErro(
      mensagemErroLogin(err)
    );

    const semConta =
      erroSemContaNoLogin(err);

    setSugerirCadastro(
      semConta
    );

    // Evita que a RotaProtegida permita acesso
    // caso exista sessão no Firebase,
    // mas não exista usuário sincronizado no Elder.
    if (semConta) {
      await logoutUser().catch(
        () => undefined
      );
    }
  }

  // =========================================================
  // LOGIN COM GOOGLE
  // =========================================================

  async function handleGoogleLogin() {
    setErro(null);
    setSugerirCadastro(false);
    setCarregando(true);

    try {
      // Login com Google
      await loginWithGoogle();

      // Sincroniza os dados
      await syncUser();

      // Navega para a Home
      navigate("/Home");
    } catch (err) {
      console.error(
        "Falha no login com Google:",
        err
      );

      await tratarErroLogin(err);
    } finally {
      setCarregando(false);
    }
  }

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

        dark:bg-[#101018]
      "
    >
      {/* =====================================================
          BOTÃO DE TEMA - MOBILE / TABLET

          Usa ABSOLUTE.
          Portanto, fica no topo da página e NÃO acompanha
          a rolagem.
      ====================================================== */}

      <div
        className="
          absolute
          right-4
          top-4
          z-50

          sm:right-5
          sm:top-5

          lg:hidden
        "
      >
        <BotaoTema compacto />
      </div>

      {/* =====================================================
          BOTÃO DE TEMA - DESKTOP
      ====================================================== */}

      <div
        className="
          absolute
          right-6
          top-6
          z-50

          hidden
          lg:block
        "
      >
        <BotaoTema />
      </div>

      {/* =====================================================
          ESTRUTURA PRINCIPAL

          MOBILE / TABLET:
          LadoInformativo
          Formulário

          DESKTOP:
          LadoInformativo | Formulário
      ====================================================== */}

      <div
        className="
          flex
          w-full
          flex-col

          lg:grid
          lg:min-h-screen
          lg:grid-cols-2
          lg:items-stretch
        "
      >
        {/* ===================================================
            LADO INFORMATIVO
        ==================================================== */}

        <div
          className="
            relative
            w-full
            min-w-0

            lg:h-full
          "
        >
          <LadoInformativo
            tipo="login"
          />
        </div>

        {/* ===================================================
            ÁREA DO LOGIN
        ==================================================== */}

        <section
          className="
            relative

            flex
            w-full
            min-w-0
            flex-1

            items-start
            justify-center

            bg-white

            px-4
            pb-10
            pt-8

            transition-colors
            duration-300

            min-[375px]:px-5

            sm:px-6
            sm:pb-12
            sm:pt-10

            md:px-8
            md:pb-14
            md:pt-12

            lg:h-full
            lg:items-center
            lg:px-8
            lg:py-12

            xl:px-12
            xl:py-14

            dark:bg-[#101018]
          "
        >
          {/* =================================================
              CONTAINER DO FORMULÁRIO
          ================================================== */}

          <div
            className="
              mx-auto

              flex
              w-full
              min-w-0
              max-w-xl

              items-center
              justify-center
            "
          >
            <FormularioLogin
              email={email}
              senha={senha}
              erro={erro}
              sugerirCadastro={
                sugerirCadastro
              }
              carregando={
                carregando
              }
              setEmail={
                setEmail
              }
              setSenha={
                setSenha
              }
              onSubmit={
                handleSubmit
              }
              onGoogleLogin={
                handleGoogleLogin
              }
            />
          </div>
        </section>
      </div>
    </main>
  );
}

// =========================================================
// EXPORT
// =========================================================

export default Login;