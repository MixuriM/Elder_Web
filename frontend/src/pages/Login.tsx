// Importa o useState para criar os estados da página
// e FormEvent para definir o tipo do evento do formulário
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

// Importa as funções relacionadas à autenticação
import {
  loginUser,
  loginWithGoogle,
  syncUser,
} from "../lib/auth";

// Importa os componentes principais da página
import LadoInformativo from "../components/Informativo/LadoInformativo";
import FormularioLogin from "../components/login/FormularioLogin";
import ControleTema from "../components/layout/ControleTema";

// Componente principal da página de login
function Login() {
  // Estado responsável por armazenar o e-mail digitado
  const [email, setEmail] = useState("");

  // Estado responsável por armazenar a senha digitada
  const [senha, setSenha] = useState("");

  // Estado responsável por armazenar possíveis mensagens de erro
  const [erro, setErro] = useState<string | null>(null);

  // Estado responsável por indicar se uma requisição está em andamento
  // (evita que o usuário clique de novo enquanto o backend responde)
  const [carregando, setCarregando] = useState(false);

  const navigate = useNavigate();

  // Função executada quando o usuário entra
  // utilizando e-mail e senha
  async function handleSubmit(e: FormEvent) {
    // Impede o recarregamento da página
    e.preventDefault();

    // Remove possíveis mensagens de erro anteriores
    setErro(null);
    setCarregando(true);

    try {
      // Realiza o login
      await loginUser(email, senha);

      // Sincroniza os dados do usuário
      await syncUser();

      navigate("/Home");
    } catch (err) {
      console.error(
        "Falha no login com e-mail e senha:",
        err
      );

      setErro(
        "Não foi possível entrar. Confira seu e-mail e senha."
      );
    } finally {
      setCarregando(false);
    }
  }

  // Função executada quando o usuário
  // entra utilizando Google
  async function handleGoogleLogin() {
    // Remove possíveis mensagens de erro anteriores
    setErro(null);
    setCarregando(true);

    try {
      // Realiza o login com Google
      await loginWithGoogle();

      // Sincroniza os dados do usuário
      await syncUser();

      navigate("/Home");
    } catch (err) {
      console.error(
        "Falha no login com Google:",
        err
      );

      setErro(
        "Não foi possível entrar com o Google."
      );
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
      {/* Estrutura principal da página */}
      <div
        className="
          grid
          min-h-screen
          items-stretch

          lg:grid-cols-2
        "
      >
        {/* Lado esquerdo informativo */}
        <div className="h-full">
          <LadoInformativo tipo="login" />
        </div>

        {/* Lado direito */}
        <section
          className="
            flex
            min-h-screen
            flex-col

            gap-8

            bg-white

            transition-colors
            duration-300

            dark:bg-[#101018]
          "
        >
          {/* Controle de tema */}
          <ControleTema />

          {/* Área do formulário */}
          <div
            className="
              flex
              flex-1
              items-center
              justify-center

              px-6
              pb-10
            "
          >
            <FormularioLogin
              email={email}
              senha={senha}
              erro={erro}
              carregando={carregando}
              setEmail={setEmail}
              setSenha={setSenha}
              onSubmit={handleSubmit}
              onGoogleLogin={handleGoogleLogin}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

// Exporta a página Login
export default Login;