// Importa o useState para criar os estados da página
// e FormEvent para definir o tipo do evento do formulário
import {
  useState,
  type FormEvent,
} from "react";

import { useNavigate } from "react-router-dom";

// Importa as funções relacionadas à autenticação
import {
  registerUser,
  loginWithGoogle,
  syncUser,
  sendEmailVerification,
  mensagemErroCadastro,
  type TipoPerfil,
} from "../lib/auth";

// Importa os componentes principais da página
import LadoInformativo from "../components/Informativo/LadoInformativo";
import FormularioCadastro from "../components/cadastro/FormularioCadastro";
import ControleTema from "../components/layout/ControleTema";

// Componente principal da página de cadastro
function Cadastro() {
  // Estado responsável por armazenar o nome digitado
  const [nome, setNome] = useState("");

  // Estado responsável por armazenar o e-mail digitado
  const [email, setEmail] = useState("");

  // E-mail do familiar convidado
  const [
    emailConviteFamiliar,
    setEmailConviteFamiliar,
  ] = useState("");

  // Estado responsável por armazenar a senha
  const [senha, setSenha] = useState("");

  // Perfil selecionado
  const [tipoPerfil, setTipoPerfil] =
    useState<TipoPerfil>("idoso");

  // Mensagem de erro
  const [erro, setErro] =
    useState<string | null>(null);

  // Indica se uma requisição está em andamento
  const [carregando, setCarregando] =
    useState(false);

  // Responsável pela navegação
  const navigate = useNavigate();

  // Cadastro utilizando e-mail e senha
  async function handleSubmit(
    e: FormEvent
  ) {
    e.preventDefault();

    setErro(null);
    setCarregando(true);

    try {
      // Registra o usuário
      await registerUser(email, senha);

      // Envia confirmação de e-mail para familiar e idoso (RF-025 e RF-030 extensão/3.3
      // dependem de email_verified para o vínculo/anexo automático)
      if (tipoPerfil === "familiar" || tipoPerfil === "idoso") {
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

      // Navega para a página de boas-vindas
      navigate("/welcome", {
        state: {
          cadastroSucesso: true,
        },
      });
    } catch (err) {
      console.error(
        "Falha no cadastro (e-mail/senha):",
        err
      );

      setErro(mensagemErroCadastro(err));
    } finally {
      setCarregando(false);
    }
  }

  // Cadastro utilizando Google
  async function handleGoogleCadastro() {
    setErro(null);
    setCarregando(true);

    try {
      // Autenticação com Google
      await loginWithGoogle();

      // Confirmação do e-mail para familiar e idoso (RF-025 e RF-030 extensão/3.3
      // dependem de email_verified para o vínculo/anexo automático)
      if (tipoPerfil === "familiar" || tipoPerfil === "idoso") {
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

      // Navega para a página de boas-vindas
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

      setErro(mensagemErroCadastro(err));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main
      className="
        min-h-screen
        bg-white
        font-['Atkinson_Hyperlegible']

        transition-colors
        duration-300

        dark:bg-[#101018]
      "
    >
      {/* Estrutura principal */}
      <div
        className="
          grid
          min-h-screen
          items-stretch

          lg:grid-cols-2
        "
      >
        {/* LADO ESQUERDO */}
        <div className="h-full">
          <LadoInformativo
            tipo="cadastro"
            tipoPerfil={tipoPerfil}
          />
        </div>

        {/* LADO DIREITO */}
        <section
          className="
            relative

            flex
            min-h-screen
            items-center
            justify-center

            bg-white

            px-6
            py-20

            transition-colors
            duration-300

            dark:bg-[#101018]
          "
        >
          {/* CONTROLE DE TEMA */}
          <div
            className="
              absolute
              right-6
              top-5
              z-20

              sm:right-8
              sm:top-6
            "
          >
            <ControleTema />
          </div>

          {/* FORMULÁRIO */}
          <div
            className="
              flex
              w-full
              items-center
              justify-center
            "
          >
            <FormularioCadastro
              nome={nome}
              email={email}
              senha={senha}
              emailConviteFamiliar={
                emailConviteFamiliar
              }
              tipoPerfil={tipoPerfil}
              erro={erro}
              carregando={carregando}
              setNome={setNome}
              setEmail={setEmail}
              setSenha={setSenha}
              setEmailConviteFamiliar={
                setEmailConviteFamiliar
              }
              setTipoPerfil={setTipoPerfil}
              onSubmit={handleSubmit}
              onGoogleCadastro={
                handleGoogleCadastro
              }
            />
          </div>
        </section>
      </div>
    </main>
  );
}

// Exporta a página Cadastro
export default Cadastro;