// Define as propriedades recebidas pelo botão
type BotaoGoogleProps = {

  // Função que será executada quando o botão for clicado
  onClick: () => void;
};

// Componente responsável pelo botão de cadastro com Google
function BotaoGoogle({
  onClick,
}: BotaoGoogleProps) {
  return (
    <button
      // Evita que o botão envie o formulário tradicional
      type="button"

      // Executa a função de cadastro com Google
      onClick={onClick}

      // Estilização utilizando Tailwind CSS
      className="w-full rounded border border-gray-400 p-3 text-lg font-semibold text-gray-900"
    >
      Criar conta com Google
    </button>
  );
}

// Exporta o componente
export default BotaoGoogle;