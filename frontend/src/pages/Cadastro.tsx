import {
  useState,
  type FormEvent,
} from "react";

import { useNavigate } from "react-router-dom";

import {
  registerUser,
  MINIMO_SENHA,
  loginWithGoogle,
  syncUser,
  sendEmailVerification,
  mensagemErroCadastro,
  type TipoPerfil,
} from "../lib/auth";

import BotaoVoltar from "../components/Informativo/BotaoVoltar";
import LadoInformativo from "../components/Informativo/LadoInformativo";
import FormularioCadastro from "../components/cadastro/FormularioCadastro";
import BotaoTema from "../components/layout/BotaoTema";
import { useTitulo } from "../hooks/useTitulo";
import { MENSAGEM_ACEITE, VERSAO_DOCUMENTOS } from "../lib/documentosLegais";
import {
  ID_ACEITE_TERMOS,
  ID_CONSENTIMENTO_SAUDE,
} from "../components/cadastro/AceiteCadastro";

const MENSAGEM_ESCOLHA_PERFIL =
  "Escolha se você é idoso, cuidador ou familiar.";

function Cadastro() {
  useTitulo("Criar conta");
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

  // Aceite obrigatório para criar conta; vai ao servidor com a versão dos documentos (D9, 2026-10-14).
  const [aceitaTermos, setAceitaTermos] = useState(false);
  const [consenteSaude, setConsenteSaude] = useState(false);

  const navigate = useNavigate();

  // =========================================================
  // CADASTRO COM E-MAIL E SENHA
  // =========================================================

  // Pede o e-mail de confirmação. Se falhar, o cadastro segue e a Welcome avisa (sem logar o erro, que
  // pode trazer o e-mail). Cuidador e familiar podem pedir de novo em Meu Perfil.
  async function pedirConfirmacao(perfil: TipoPerfil) {
    try {
      return { enviado: await sendEmailVerification(), falha: {} };
    } catch {
      return {
        enviado: false,
        falha: { confirmacaoFalhou: true, reenviarNoPerfil: perfil !== "idoso" },
      };
    }
  }

  // Sem as duas caixas: mostra o erro e leva o foco à primeira caixa desmarcada.
  function faltaAceite() {
    const faltando = !aceitaTermos
      ? ID_ACEITE_TERMOS
      : !consenteSaude
        ? ID_CONSENTIMENTO_SAUDE
        : null;
    if (!faltando) return false;
    setErro(MENSAGEM_ACEITE);
    document.getElementById(faltando)?.focus();
    return true;
  }

  async function handleSubmit(
    e: FormEvent
  ) {
    e.preventDefault();

    setErro(null);

    if (!tipoPerfil) {
      setErro(MENSAGEM_ESCOLHA_PERFIL);
      return;
    }

    if (faltaAceite()) return;

    if (senha.length < MINIMO_SENHA) {
      setErro(`A senha precisa ter pelo menos ${MINIMO_SENHA} caracteres.`);
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

      // Confirmação de e-mail para os 3 perfis (o aviso de emergência só vai para e-mail confirmado)
      const confirmacao = await pedirConfirmacao(tipoPerfil);

      // Sincroniza os dados adicionais
      await syncUser({
        tipoPerfil,
        nome,

        emailConviteFamiliar:
          tipoPerfil === "idoso"
            ? emailConviteFamiliar
            : undefined,

        aceiteDocumentos: VERSAO_DOCUMENTOS,
      });

      // Vai para a Welcome
      navigate("/welcome", {
        state: {
          cadastroSucesso: true,
          confirmarEmail: confirmacao.enviado,
          ...confirmacao.falha,
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

    // Antes de abrir a janela do Google.
    if (faltaAceite()) return;

    setCarregando(true);

    try {
      // Login/cadastro com Google
      await loginWithGoogle();

      // Confirmação de e-mail (conta Google já chega confirmada: vira no-op)
      const confirmacao = await pedirConfirmacao(tipoPerfil);

      // Sincroniza o perfil escolhido
      await syncUser({
        tipoPerfil,

        emailConviteFamiliar:
          tipoPerfil === "idoso"
            ? emailConviteFamiliar
            : undefined,

        aceiteDocumentos: VERSAO_DOCUMENTOS,
      });

      // Vai para a Welcome
      navigate("/welcome", {
        state: {
          cadastroSucesso: true,
          ...confirmacao.falha,
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
      {/* Voltar: primeiro no DOM e no canto superior esquerdo em todas as larguras. */}
      <BotaoVoltar tipo="cadastro" />

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
          min-h-dvh
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
            Formulário
            ↓
            LadoInformativo (depois, no DOM e na tela)

            DESKTOP:
            LadoInformativo | Formulário
        ==================================================== */}

        <div
          className="
            flex
            w-full
            flex-col

            lg:grid
            lg:min-h-dvh
            lg:grid-cols-2
            lg:items-stretch
          "
        >
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
              pt-20

              transition-colors
              duration-300

              min-[375px]:px-5

              sm:px-6
              sm:pb-12
              sm:pt-24

              md:px-8
              md:pb-14

              lg:col-start-2
              lg:row-start-1
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
                erroAceite={erro === MENSAGEM_ACEITE}
                carregando={
                  carregando
                }
                aceitaTermos={aceitaTermos}
                consenteSaude={consenteSaude}
                setAceitaTermos={setAceitaTermos}
                setConsenteSaude={setConsenteSaude}
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

          {/* =================================================
              LADO INFORMATIVO
          ================================================== */}

          <div
            className="
              w-full
              min-w-0

              lg:col-start-1
              lg:row-start-1
              lg:h-full
            "
          >
            <LadoInformativo
              tipo="cadastro"
              tipoPerfil={
                tipoPerfil ?? undefined
              }
              comBotaoVoltar={false}
            />
          </div>
        </div>
      </main>
    </>
  );
}

export default Cadastro;