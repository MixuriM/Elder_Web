// Importa os ícones utilizados nos perfis
import { Heart, UserRound, UsersRound } from "lucide-react";

// Importa o tipo TipoPerfil
import type { TipoPerfil } from "../../lib/auth";

// Define as propriedades do componente
type TipoPerfilProps = {
  tipoPerfil: TipoPerfil;
  setTipoPerfil: (tipo: TipoPerfil) => void;
};

// Componente responsável pela escolha do perfil
function TipoPerfilCampo({
  tipoPerfil,
  setTipoPerfil,
}: TipoPerfilProps) {
  // Opções disponíveis
  const opcoes = [
    {
      valor: "idoso",
      label: "Idoso",
      icone: Heart,
    },
    {
      valor: "cuidador",
      label: "Cuidador",
      icone: UserRound,
    },
    {
      valor: "familiar",
      label: "Familiar",
      icone: UsersRound,
    },
  ] as const;

  return (
    <fieldset>
      {/* Título */}
      <legend
        className="
          text-lg
          font-semibold
          text-[#071A38]
          dark:text-[#F5F5FA]
        "
      >
        Você é:
      </legend>

      {/* Cards */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        {opcoes.map((opcao) => {
          // Verifica qual opção está selecionada
          const selecionado = tipoPerfil === opcao.valor;

          // Ícone da opção
          const Icone = opcao.icone;

          return (
            <label
              key={opcao.valor}
              className={`
                flex
                cursor-pointer
                flex-col
                items-center
                justify-center
                rounded-xl
                border-2
                px-3
                py-4
                transition-all
                duration-300

                ${
                  selecionado
                    ? `
                      border-[#6C63FF]
                      bg-[#6C63FF]
                      shadow-md
                    `
                    : `
                      border-[#E5E0F5]
                      bg-white
                      hover:border-[#8B82FF]
                      hover:bg-[#F8F7FF]

                      dark:border-[#343445]
                      dark:bg-[#181824]
                      dark:hover:border-[#6C63FF]
                      dark:hover:bg-[#20202E]
                    `
                }
              `}
            >
              {/* Radio escondido */}
              <input
                type="radio"
                name="tipo_perfil"
                value={opcao.valor}
                checked={selecionado}
                onChange={() => setTipoPerfil(opcao.valor)}
                className="sr-only"
              />

              {/* Fundo do ícone */}
              <div
                className={`
                  flex
                  h-11
                  w-11
                  items-center
                  justify-center
                  rounded-xl
                  transition-all
                  duration-300

                  ${
                    selecionado
                      ? "bg-[#817AFF]"
                      : "bg-[#F0EDFF] dark:bg-[#29243F]"
                  }
                `}
              >
                {/* Ícone */}
                <Icone
                  size={23}
                  strokeWidth={2.2}
                  className={
                    selecionado
                      ? "text-white"
                      : "text-[#6C63FF] dark:text-[#A89FFF]"
                  }
                />
              </div>

              {/* Nome do perfil */}
              <span
                className={`
                  mt-2
                  text-base
                  font-bold
                  transition-colors
                  duration-300

                  ${
                    selecionado
                      ? "text-white"
                      : "text-[#071A38] dark:text-[#F5F5FA]"
                  }
                `}
              >
                {opcao.label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default TipoPerfilCampo;