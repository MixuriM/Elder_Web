import { Eye, EyeOff } from "lucide-react";

type BotaoMostrarSenhaProps = {
  mostrar: boolean;
  onToggle: () => void;
  campo: string; // nome do campo, usado no rótulo acessível ("senha")
};

// Botão de mostrar/ocultar senha, posicionado dentro do campo (wrapper `relative`).
function BotaoMostrarSenha({ mostrar, onToggle, campo }: BotaoMostrarSenhaProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`${mostrar ? "Ocultar" : "Mostrar"} ${campo}`}
      aria-pressed={mostrar}
      className="
        absolute
        right-2
        top-1/2
        -translate-y-1/2
        mt-0.5
        rounded-lg
        p-2
        text-[#4B5563]
        hover:text-[#6C63FF]
        focus:outline-none
        focus:ring-2
        focus:ring-[#6C63FF]/40
        dark:text-[#B9B9C5]
        dark:hover:text-[#A89FFF]
      "
    >
      {mostrar ? <EyeOff size={22} aria-hidden="true" /> : <Eye size={22} aria-hidden="true" />}
    </button>
  );
}

export default BotaoMostrarSenha;
