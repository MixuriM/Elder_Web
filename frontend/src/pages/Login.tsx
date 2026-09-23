// Importa o useState para criar os estados da página
// e FormEvent para definir o tipo do evento do formulário
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

// Componentes principais da página
import LadoInformativo from "../components/Informativo/LadoInformativo";
import FormularioLogin from "../components/login/FormularioLogin";
import ControleTema from "../components/layout/ControleTema";

function Login() {
  // E-mail digitado pelo usuário
  const [email, setEmail] = useState("");

  // Senha digitada pelo usuário
  const [senha, setSenha] = useState("");

  // Mensagem de erro
  const [erro, setErro] =
    useState<string | null>(null);

  // Mostra o link para o cadastro dentro do erro (login sem conta no Elder)
  const [sugerirCadastro, setSugerirCadastro] =
    useState(false);

  // Indica se uma requisição está acontecendo
  const [carregando, setCarregando] =
    useState(false);

  // Responsável pela navegação
  const navigate = useNavigate();

  // Login utilizando e-mail e senha
  async function handleSubmit(
    e: FormEvent
  ) {
    e.preventDefault();

    setErro(null);
    setSugerirCadastro(false);
    setCarregando(true);

    try {
      // Realiza o login
      await loginUser(email, senha);

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

  // Mostra o erro e, se a conta não existe no Elder, encerra a sessão do Firebase
  // (senão RotaProtegida deixaria entrar sem linha em Usuario).
  async function tratarErroLogin(err: unknown) {
    setErro(mensagemErroLogin(err));
    const semConta = erroSemContaNoLogin(err);
    setSugerirCadastro(semConta);
    if (semConta) await logoutUser().catch(() => undefined);
  }

  // Login utilizando Google
  async function handleGoogleLogin() {
    setErro(null);
    setSugerirCadastro(false);
    setCarregando(true);

    try {
      // Realiza o login com Google
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
          <LadoInformativo tipo="login" />
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
            <FormularioLogin
              email={email}
              senha={senha}
              erro={erro}
              sugerirCadastro={sugerirCadastro}
              carregando={carregando}
              setEmail={setEmail}
              setSenha={setSenha}
              onSubmit={handleSubmit}
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

// Exporta a página Login
export default Login;