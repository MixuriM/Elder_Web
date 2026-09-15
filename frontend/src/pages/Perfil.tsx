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

// Importa o formulário
import FormularioPerfil from "../components/perfil/FormularioPerfil";

// Importa o layout da página de perfil
import LayoutPerfil from "../components/perfil/LayoutPerfil";

function Perfil() {
  // Dados do usuário
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");

  // Estados da página
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  // Busca os dados do usuário quando a página é aberta
  useEffect(() => {
    buscarPerfil()
      .then((dados) => {
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
        setCarregando(false);
      });
  }, []);

  // Salva as alterações do perfil
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    setErro(null);
    setSucesso(false);

    try {
      await salvarPerfil({
        nome,
        email,
        telefone,
      });

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

  // Tela exibida enquanto os dados são carregados
  if (carregando) {
    return (
      <LayoutPerfil>
        <p
          className="
            text-center
            text-lg
            text-gray-900
            dark:text-white
          "
        >
          Carregando...
        </p>
      </LayoutPerfil>
    );
  }

  return (
    <LayoutPerfil>
      <FormularioPerfil
        nome={nome}
        email={email}
        telefone={telefone}
        erro={erro}
        sucesso={sucesso}
        setNome={setNome}
        setEmail={setEmail}
        setTelefone={setTelefone}
        onSubmit={handleSubmit}
      />
    </LayoutPerfil>
  );
}

export default Perfil;