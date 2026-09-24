// Importa o componente responsável por alterar o tema
import BotaoTema from "./BotaoTema";

type ControleTemaProps = {
  responsivo?: boolean;
};

// Componente responsável por exibir o botão de tema
function ControleTema({ responsivo = false }: ControleTemaProps) {
  return (
    <>
      <BotaoTema responsivo={responsivo} />
    </>
  );
}

export default ControleTema;