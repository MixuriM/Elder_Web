// Importa o ícone do Google
import googleLogo from "../../Img/google.svg";

// Define as propriedades recebidas pelo botão
type BotaoGoogleLoginProps = {
  onClick: () => void;
};

// Componente responsável pelo botão de login com Google
function BotaoGoogleLogin({
  onClick,
}: BotaoGoogleLoginProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        flex
        w-full
        items-center
        justify-center
        gap-3
        rounded-2xl
        border
        border-gray-300
        bg-white
        px-6
        py-4
        text-lg
        font-semibold
        text-gray-900
        transition
        hover:bg-gray-50
      "
    >
      {/* Ícone do Google */}
      <img
        src={googleLogo}
        alt=""
        className="h-6 w-6"
      />

      {/* Texto do botão */}
      <span>Entrar com Google</span>
    </button>
  );
}

export default BotaoGoogleLogin;