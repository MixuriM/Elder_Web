type BotaoGoogleProps = {
  onClick: () => void
}

function BotaoGoogle({
  onClick
}: BotaoGoogleProps) {

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded border border-gray-400 p-3 text-lg font-semibold text-gray-900"
    >
      Criar conta com Google
    </button>
  )
}

export default BotaoGoogle