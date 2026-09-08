// Importa o useState para criar os estados da página
// e FormEvent para definir o tipo do evento do formulário
import { useState, type FormEvent } from "react";

// Importa as funções relacionadas à autenticação
import {
  registerUser,     // Registra o usuário no Firebase Authentication
  loginWithGoogle,  // Realiza a autenticação utilizando Google
  syncUser,         // Sincroniza os dados do usuário com o Firestore
  type TipoPerfil,  // Define os tipos de perfil permitidos
} from "../lib/auth";

// Importa os componentes principais da página
import LadoInformativo from "../components/cadastro/LadoInformativo";
import FormularioCadastro from "../components/cadastro/FormularioCadastro";

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

  // Estado utilizado para armazenar possíveis mensagens de erro
  // null significa que não existe erro no momento
  const [erro, setErro] =
    useState<string | null>(null);


  // Função executada quando o usuário envia
  // o formulário de cadastro com e-mail e senha
  async function handleSubmit(e: FormEvent) {

    // Impede que o navegador recarregue a página
    // ao enviar o formulário
    e.preventDefault();

    // Remove possíveis mensagens de erro anteriores
    setErro(null);

    try {

      // Registra o usuário utilizando o e-mail e a senha
      await registerUser(email, senha);

      // Sincroniza as informações adicionais
      // do usuário com o banco de dados
      await syncUser({
        tipoPerfil,
        nome,
      });

    } catch {

      // Caso alguma etapa apresente erro,
      // uma mensagem é armazenada no estado erro
      setErro(
        "Não foi possível criar a conta. Confira os dados e tente novamente."
      );

    }
  }


  // Função executada quando o usuário escolhe
  // realizar o cadastro utilizando Google
  async function handleGoogleCadastro() {

    // Remove possíveis mensagens de erro anteriores
    setErro(null);

    try {

      // Realiza a autenticação através da conta Google
      await loginWithGoogle();

      // Sincroniza o perfil escolhido com o banco de dados
      await syncUser({
        tipoPerfil,
      });

    } catch {

      // Exibe uma mensagem caso o cadastro com Google falhe
      setErro(
        "Não foi possível criar a conta com o Google."
      );

    }
  }


  // Renderiza a página de cadastro
  return (
    <main className="min-h-screen bg-white">

      {/* Divide a página em duas colunas em telas maiores */}
      <div className="grid min-h-screen lg:grid-cols-2">

        {/* Exibe as informações sobre o Elder Web */}
        <LadoInformativo />

        {/* 
          Envia os estados e funções para o formulário
          através das props
        */}
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

    </main>
  );
}

// Exporta a página Cadastro
export default Cadastro;