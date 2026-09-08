// Importa apenas o tipo TipoPerfil definido no arquivo de autenticação
import type { TipoPerfil } from "../../lib/auth";

// Define as propriedades que o componente deve receber
type TipoPerfilProps = {
  // Perfil atualmente selecionado
  tipoPerfil: TipoPerfil;

  // Função utilizada para alterar o perfil selecionado
  setTipoPerfil: (tipo: TipoPerfil) => void;
};

// Componente responsável pela escolha do tipo de perfil
function TipoPerfilCampo({
  tipoPerfil,
  setTipoPerfil,
}: TipoPerfilProps) {

  // Lista com os tipos de perfil disponíveis no cadastro
  const opcoes = [
    { valor: "idoso", label: "Idoso" },
    { valor: "cuidador", label: "Cuidador" },
    { valor: "familiar", label: "Familiar" },
  ] as const;

  return (
    <fieldset>
      {/* Título do grupo de opções */}
      <legend className="text-lg font-medium text-gray-900">
        Eu sou
      </legend>

      {/* Container das opções de perfil */}
      <div className="mt-1 space-y-2">

        {/* Percorre a lista de perfis e cria uma opção para cada um */}
        {opcoes.map((opcao) => (
          <label
            key={opcao.valor}
            className="flex items-center gap-2 text-lg text-gray-900"
          >
            <input
              type="radio"
              name="tipo_perfil"
              value={opcao.valor}

              // Verifica se esta opção é a atualmente selecionada
              checked={tipoPerfil === opcao.valor}

              // Altera o tipo de perfil quando o usuário seleciona a opção
              onChange={() => setTipoPerfil(opcao.valor)}
            />

            {/* Exibe Idoso, Cuidador ou Familiar */}
            {opcao.label}
          </label>
        ))}

      </div>
    </fieldset>
  );
}

// Exporta o componente
export default TipoPerfilCampo;