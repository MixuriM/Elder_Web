// Importa o useState para controlar os estados da página
// e FormEvent para definir o tipo do evento do formulário
import { useState, type FormEvent } from "react";

// Importa a função responsável pela recuperação de senha
import { resetPassword } from "../lib/auth";

// Importa os componentes utilizados na página
import FormularioEsqueciSenha
  from "../components/EsqueciSenha/FormularioEsqueciSenha";

import LadoInformativo
  from "../components/Informativo/LadoInformativo";

import ControleTema
  from "../components/layout/ControleTema";

// Componente principal da página de recuperação de senha
function EsqueciSenha() {

  // Estado responsável por armazenar o e-mail digitado
  const [email, setEmail] = useState("");

  // Estado responsável por armazenar possíveis mensagens de erro
  const [erro, setErro] = useState<string | null>(null);

  // Controla se a solicitação de recuperação já foi enviada
  const [enviado, setEnviado] = useState(false);

  // Função executada quando o formulário é enviado
  async function handleSubmit(e: FormEvent) {

    // Impede o recarregamento da página
    e.preventDefault();

    // Limpa erros anteriores
    setErro(null);

    try {

      // Solicita o envio do e-mail de recuperação
      await resetPassword(email);

      // Exibe a mensagem de sucesso
      setEnviado(true);

    } catch (err) {

      // Exibe o erro no console para facilitar o desenvolvimento
      console.error(
        "Falha ao solicitar redefinição de senha:",
        err
      );

      // Obtém o código de erro retornado
      const codigo = (err as { code?: string }).code;

      // Não revela se determinado e-mail existe
      if (codigo === "auth/user-not-found") {

        setEnviado(true);

      } else if (codigo === "auth/invalid-email") {

        setErro("Digite um e-mail válido.");

      } else if (codigo === "auth/too-many-requests") {

        setErro(
          "Muitas tentativas. Aguarde um pouco e tente novamente."
        );

      } else {

        setErro(
          "Não foi possível enviar o e-mail agora. " +
          "Verifique sua conexão e tente novamente."
        );
      }
    }
  }

  return (
    <main
      className="
        grid
        min-h-screen
        bg-white
        lg:grid-cols-2
        dark:bg-gray-900
      "
    >

      {/* Lado informativo utilizado pelo Elder */}
      <LadoInformativo tipo="login" />

      {/* Lado direito da página */}
      <section
        className="
          relative
          flex
          items-center
          justify-center
          px-6
          py-12
          sm:px-10
          lg:px-16
        "
      >

        {/* Botão de alteração de tema */}
        <div className="absolute right-6 top-6">
          <ControleTema />
        </div>

        {/* Formulário de recuperação de senha */}
        <FormularioEsqueciSenha
          email={email}
          erro={erro}
          enviado={enviado}
          setEmail={setEmail}
          onSubmit={handleSubmit}
        />

      </section>

    </main>
  );
}

export default EsqueciSenha;