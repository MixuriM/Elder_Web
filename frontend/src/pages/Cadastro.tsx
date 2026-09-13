// Importa o useState para criar os estados da página
// e FormEvent para definir o tipo do evento do formulário
import { useState, type FormEvent } from "react";

// Importa as funções relacionadas à autenticação
import {
  registerUser,
  loginWithGoogle,
  syncUser,
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

  // Estado responsável por armazenar a senha digitada
  const [senha, setSenha] = useState("");

  // Estado responsável por armazenar o tipo de perfil selecionado
  // O perfil "idoso" é selecionado inicialmente
  const [tipoPerfil, setTipoPerfil] =
    useState<TipoPerfil>("idoso");

  // Estado responsável por armazenar possíveis mensagens de erro
  const [erro, setErro] =
    useState<string | null>(null);

  // Função executada quando o usuário cadastra
  // utilizando e-mail e senha
  async function handleSubmit(e: FormEvent) {
    // Impede o recarregamento da página
    e.preventDefault();

    // Remove possíveis mensagens de erro anteriores
    setErro(null);

    try {
      // Registra o usuário
      await registerUser(email, senha);

      // Sincroniza os dados adicionais do usuário
      await syncUser({
        tipoPerfil,
        nome,
      });
    } catch (err) {
      console.error(
        "Falha no cadastro (e-mail/senha):",
        err
      );

      setErro(
        "Não foi possível criar a conta. Confira os dados e tente novamente."
      );
    }
  }

  // Função executada quando o usuário
  // cadastra utilizando Google
  async function handleGoogleCadastro() {
    // Remove possíveis mensagens de erro anteriores
    setErro(null);

    try {
      // Realiza autenticação com Google
      await loginWithGoogle();

      // Sincroniza o perfil escolhido
      await syncUser({
        tipoPerfil,
      });
    } catch (err) {
      console.error(
        "Falha no cadastro (Google):",
        err
      );

      setErro(
        "Não foi possível criar a conta com o Google."
      );
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
          <LadoInformativo
            tipo="cadastro"
            tipoPerfil={tipoPerfil}
          />
        </div>

        {/* Lado direito */}
        <section
          className="
            flex
            min-h-screen
            flex-col

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
            <FormularioCadastro
              nome={nome}
              email={email}
              senha={senha}
              tipoPerfil={tipoPerfil}
              erro={erro}
              setNome={setNome}
              setEmail={setEmail}
              setSenha={setSenha}
              setTipoPerfil={setTipoPerfil}
              onSubmit={handleSubmit}
              onGoogleCadastro={handleGoogleCadastro}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

// Exporta a página Cadastro
export default Cadastro;