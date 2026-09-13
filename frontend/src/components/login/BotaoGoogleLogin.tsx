type BotaoGoogleLoginProps = {
  onClick: () => void
}

function BotaoGoogleLogin({
  onClick,
}: BotaoGoogleLoginProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        w-full
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
      Entrar com Google
    </button>
  )
}

export default BotaoGoogleLogin