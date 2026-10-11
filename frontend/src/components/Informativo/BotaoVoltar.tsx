import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

type BotaoVoltarProps = {
  tipo: "landing" | "cadastro" | "login";
};

// Botão do canto superior esquerdo das telas com o LadoInformativo. Fica fora do bloco informativo para que,
// no celular, venha antes do formulário (no topo da página) mesmo com o bloco informativo depois dele.
function BotaoVoltar({ tipo }: BotaoVoltarProps) {
  const navigate = useNavigate();

  const handleVoltar = () => {
    if (tipo === "landing") {
      navigate("/");
      return;
    }

    navigate("/welcome");
  };

  return (
    <button
      type="button"
      onClick={handleVoltar}
      aria-label={
        tipo === "landing"
          ? "Voltar para a página inicial"
          : "Voltar para a tela de boas-vindas"
      }
      className="
        absolute
        left-4
        top-4
        z-50

        flex
        h-11
        items-center
        justify-center
        gap-2

        rounded-xl

        border
        border-[#D8D4F0]

        bg-white/70

        px-3

        text-sm
        font-semibold
        text-[#071A38]

        shadow-sm
        backdrop-blur-sm

        transition-all
        duration-200

        hover:border-[#6C63FF]
        hover:bg-white
        hover:text-[#554CD8]

        sm:left-5
        sm:top-5
        sm:h-11
        sm:px-4

        lg:left-6
        lg:top-6

        dark:border-[#343447]
        dark:bg-[#1D1D2B]/80
        dark:text-[#F5F5FA]

        dark:hover:border-[#A89FFF]
        dark:hover:bg-[#252536]
        dark:hover:text-[#A89FFF]
      "
    >
      <ArrowLeft
        size={18}
        strokeWidth={2.2}
      />

      <span className="hidden sm:inline">
        {tipo === "landing"
          ? "Página inicial"
          : "Voltar"}
      </span>
    </button>
  );
}

export default BotaoVoltar;
