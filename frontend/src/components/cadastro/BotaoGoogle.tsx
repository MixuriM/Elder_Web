// Importa o ícone do Google
import googleLogo from "../../Img/google.svg";

// Define as propriedades recebidas pelo botão
type BotaoGoogleProps = {

  // Função executada quando o botão for clicado
  onClick: () => void;

  disabled?: boolean;

};

// Componente responsável pelo botão de cadastro com Google
function BotaoGoogle({
  onClick,
  disabled,
}: BotaoGoogleProps) {

  return (
    <button

      // Evita que o botão envie o formulário
      type="button"

      // Executa a função de cadastro com Google
      onClick={onClick}

      disabled={disabled}

      // Estilização do botão
      className="
        flex
        w-full
        items-center
        justify-center
        gap-3
        rounded-xl
        border
        border-gray-300
        bg-white
        px-4
        py-3
        text-lg
        font-semibold
        text-[#071A38]
        transition-colors
        duration-300
        hover:border-[#6C63FF]
        hover:bg-[#F3F0FF]
        focus:outline-none
        focus:ring-2
        focus:ring-[#6C63FF]
        focus:ring-offset-2
        disabled:cursor-not-allowed
        disabled:opacity-60
        dark:border-gray-600
        dark:bg-[#181824]
        dark:text-[#F5F5FA]
        dark:hover:border-[#A89FFF]
        dark:hover:bg-[#20202E]
        dark:focus:ring-[#A89FFF]
        dark:focus:ring-offset-[#101018]
      "
    >

      {/* Ícone do Google */}
      <img
        src={googleLogo}
        alt=""
        className="h-6 w-6"
      />

      {/* Texto do botão */}
      <span>Criar conta com Google</span>

    </button>
  );

}

// Exporta o componente
export default BotaoGoogle;