// Importa os hooks utilizados pela página
import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

// Importa as funções responsáveis pela comunicação com a API
import {
  buscarPerfil,
  salvarPerfil,
} from "../services/perfilService";

// Importa o formulário do perfil
import FormularioPerfil from "../components/perfil/FormularioPerfil";

// Importa o layout da página de perfil
import LayoutPerfil from "../components/perfil/LayoutPerfil";

function Perfil() {
  // Dados do usuário
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");

  // Foto de perfil
  // Por enquanto guarda apenas a URL temporária da imagem selecionada
  const [foto, setFoto] = useState<string | null>(null);

  // Controla o carregamento inicial da página
  const [carregando, setCarregando] = useState(true);

  // Armazena possíveis mensagens de erro
  const [erro, setErro] = useState<string | null>(null);

  // Controla a mensagem de sucesso
  const [sucesso, setSucesso] = useState(false);

  // Busca os dados do usuário quando a página é aberta
  useEffect(() => {
    buscarPerfil()
      .then((dados) => {
        // Preenche os campos com os dados retornados pela API
        setNome(dados.nome);
        setEmail(dados.email ?? "");
        setTelefone(dados.telefone ?? "");
      })
      .catch((err) => {
        console.error(
          "Falha ao carregar perfil:",
          err
        );

        setErro(
          "Não foi possível carregar seus dados agora. Tente novamente."
        );
      })
      .finally(() => {
        // Finaliza o carregamento mesmo se ocorrer algum erro
        setCarregando(false);
      });
  }, []);

  // Função executada quando o usuário salva as alterações
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    // Limpa mensagens anteriores
    setErro(null);
    setSucesso(false);

    try {
      // Envia os dados atualizados para a API
      await salvarPerfil({
        nome,
        email,
        telefone,
      });

      // Exibe mensagem de sucesso
      setSucesso(true);
    } catch (err) {
      console.error(
        "Falha ao salvar perfil:",
        err
      );

      setErro(
        err instanceof Error
          ? err.message
          : "Não foi possível salvar. Tente novamente."
      );
    }
  }

  // Exibe o carregamento enquanto busca os dados
  if (carregando) {
    return (
      <LayoutPerfil>
        <div
          className="
            flex
            items-center
            justify-center
            py-10
          "
        >
          <p
            className="
              text-lg
              text-gray-700
              dark:text-gray-200
            "
          >
            Carregando...
          </p>
        </div>
      </LayoutPerfil>
    );
  }

  // Página principal
  return (
    <LayoutPerfil>
      <FormularioPerfil
        // Dados
        nome={nome}
        email={email}
        telefone={telefone}
        foto={foto}

        // Mensagens
        erro={erro}
        sucesso={sucesso}

        // Atualização dos dados
        setNome={setNome}
        setEmail={setEmail}
        setTelefone={setTelefone}
        setFoto={setFoto}

        // Envio do formulário
        onSubmit={handleSubmit}
      />
    </LayoutPerfil>
  );
}

export default Perfil;