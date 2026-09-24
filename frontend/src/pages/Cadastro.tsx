import {
  useState,
  type FormEvent,
} from "react";

import { useNavigate } from "react-router-dom";

import {
  registerUser,
  loginWithGoogle,
  syncUser,
  sendEmailVerification,
  mensagemErroCadastro,
  type TipoPerfil,
} from "../lib/auth";

import LadoInformativo from "../components/Informativo/LadoInformativo";
import FormularioCadastro from "../components/cadastro/FormularioCadastro";
import BotaoTema from "../components/layout/BotaoTema";

const MENSAGEM_ESCOLHA_PERFIL =
  "Escolha se você é idoso, cuidador ou familiar.";

function Cadastro() {
  // =========================================================
  // ESTADOS
  // =========================================================

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");

  const [
    emailConviteFamiliar,
    setEmailConviteFamiliar,
  ] = useState("");

  const [senha, setSenha] = useState("");

  const [
    confirmacaoSenha,
    setConfirmacaoSenha,
  ] = useState("");

  const [tipoPerfil, setTipoPerfil] =
    useState<TipoPerfil | null>(null);

  const [erro, setErro] =
    useState<string | null>(null);

  const [carregando, setCarregando] =
    useState(false);

  const navigate = useNavigate();

  // =========================================================
  // CADASTRO COM E-MAIL E SENHA
  // =========================================================

  async function handleSubmit(
    e: FormEvent
  ) {
    e.preventDefault();

    setErro(null);

    if (!tipoPerfil) {
      setErro(MENSAGEM_ESCOLHA_PERFIL);
      return;
    }

    if (senha !== confirmacaoSenha) {
      setErro(
        "As senhas não são iguais. Digite a mesma senha nos dois campos."
      );

      return;
    }

    setCarregando(true);

    try {
      // Registra o usuário
      await registerUser(
        email,
        senha
      );

      let emailEnviado = false;

      // Envia confirmação de e-mail
      if (
        tipoPerfil === "familiar" ||
        tipoPerfil === "idoso"
      ) {
        emailEnviado =
          await sendEmailVerification();
      }

      // Sincroniza os dados adicionais
      await syncUser({
        tipoPerfil,
        nome,

        emailConviteFamiliar:
          tipoPerfil === "idoso"
            ? emailConviteFamiliar
            : undefined,
      });

      // Vai para a Welcome
      navigate("/welcome", {
        state: {
          cadastroSucesso: true,
          confirmarEmail: emailEnviado,
        },
      });
    } catch (err) {
      console.error(
        "Falha no cadastro (e-mail/senha):",
        err
      );

      setErro(
        mensagemErroCadastro(err)
      );
    } finally {
      setCarregando(false);
    }
  }

  // =========================================================
  // CADASTRO COM GOOGLE
  // =========================================================

  async function handleGoogleCadastro() {
    setErro(null);

    if (!tipoPerfil) {
      setErro(MENSAGEM_ESCOLHA_PERFIL);
      return;
    }

    setCarregando(true);

    try {
      // Login/cadastro com Google
      await loginWithGoogle();

      // Confirmação de e-mail
      if (
        tipoPerfil === "familiar" ||
        tipoPerfil === "idoso"
      ) {
        await sendEmailVerification();
      }

      // Sincroniza o perfil escolhido
      await syncUser({
        tipoPerfil,

        emailConviteFamiliar:
          tipoPerfil === "idoso"
            ? emailConviteFamiliar
            : undefined,
      });

      // Vai para a Welcome
      navigate("/welcome", {
        state: {
          cadastroSucesso: true,
        },
      });
    } catch (err) {
      console.error(
        "Falha no cadastro (Google):",
        err
      );

      setErro(
        mensagemErroCadastro(err)
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      {/* =====================================================
          BOTÃO DE TEMA - MOBILE / TABLET

          IMPORTANTE:
          Está FORA do <main>.

          Assim ele não pertence ao conteúdo da página
          que está sendo rolado.
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
          fixed
          right-6
          top-6
          z-[99999]

          hidden
          lg:block
        "
        style={{
          position: "fixed",
          zIndex: 99999,
        }}
      >
        <BotaoTema />
      </div>

      {/* =====================================================
          PÁGINA
      ====================================================== */}

      <main
        className="
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
        {/* ===================================================
            ESTRUTURA PRINCIPAL

            MOBILE:
            LadoInformativo
            ↓
            Formulário

            DESKTOP:
            LadoInformativo | Formulário
        ==================================================== */}

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
          {/* =================================================
              LADO INFORMATIVO
          ================================================== */}

          <div
            className="
              w-full
              min-w-0

              lg:h-full
            "
          >
            <LadoInformativo
              tipo="cadastro"
              tipoPerfil={
                tipoPerfil ?? undefined
              }
            />
          </div>

          {/* =================================================
              FORMULÁRIO
          ================================================== */}

          <section
            className="
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
            {/* ===============================================
                CONTAINER DO FORMULÁRIO
            ================================================ */}

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
              <FormularioCadastro
                nome={nome}
                email={email}
                senha={senha}
                confirmacaoSenha={
                  confirmacaoSenha
                }
                emailConviteFamiliar={
                  emailConviteFamiliar
                }
                tipoPerfil={
                  tipoPerfil
                }
                erro={erro}
                carregando={
                  carregando
                }
                setNome={
                  setNome
                }
                setEmail={
                  setEmail
                }
                setSenha={
                  setSenha
                }
                setConfirmacaoSenha={
                  setConfirmacaoSenha
                }
                setEmailConviteFamiliar={
                  setEmailConviteFamiliar
                }
                setTipoPerfil={
                  setTipoPerfil
                }
                onSubmit={
                  handleSubmit
                }
                onGoogleCadastro={
                  handleGoogleCadastro
                }
              />
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

export default Cadastro;