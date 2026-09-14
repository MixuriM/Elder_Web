import {
  Moon,
  Sun,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

type BotaoTemaProps = {
  compacto?: boolean;
};

function BotaoTema({
  compacto = false,
}: BotaoTemaProps) {
  const [escuro, setEscuro] = useState(false);

  useEffect(() => {
    const temaSalvo = localStorage.getItem("tema");
    const temaEscuro = temaSalvo === "escuro";

    setEscuro(temaEscuro);

    document.documentElement.classList.toggle(
      "dark",
      temaEscuro
    );
  }, []);

  function alterarTema() {
    const novoTemaEscuro = !escuro;

    setEscuro(novoTemaEscuro);

    document.documentElement.classList.toggle(
      "dark",
      novoTemaEscuro
    );

    localStorage.setItem(
      "tema",
      novoTemaEscuro ? "escuro" : "claro"
    );
  }

  return (
    <button
      type="button"
      onClick={alterarTema}
      aria-pressed={escuro}
      aria-label={
        escuro
          ? "Ativar modo claro"
          : "Ativar modo escuro"
      }
      className={`
        flex
        items-center
        justify-center

        transition-all
        duration-200

        focus:outline-none
        focus-visible:ring-2
        focus-visible:ring-[#6C63FF]/30

        ${
          compacto
            ? `
              h-10
              w-10

              rounded-full

              bg-transparent

              text-[#6C63FF]

              hover:bg-[#F3F0FF]

              dark:bg-transparent
              dark:text-[#A89FFF]

              dark:hover:bg-[#2B2C3B]
            `
            : `
              h-10

              gap-2

              rounded-xl

              border
              border-gray-300

              bg-white

              px-4

              text-sm
              font-semibold
              text-[#071A38]

              shadow-sm

              hover:border-[#A18BFF]
              hover:bg-[#F3F0FF]
              hover:text-[#6C63FF]

              dark:border-[#454558]
              dark:bg-[#2B2C3B]
              dark:text-[#F5F5FA]

              dark:hover:border-[#66667A]
              dark:hover:bg-[#373849]
              dark:hover:text-[#A89FFF]
            `
        }
      `}
    >
      {escuro ? (
        <Sun
          size={compacto ? 20 : 17}
          strokeWidth={2}
        />
      ) : (
        <Moon
          size={compacto ? 20 : 17}
          strokeWidth={2}
        />
      )}

      {!compacto && (
        <span className="whitespace-nowrap">
          {escuro
            ? "Modo claro"
            : "Modo escuro"}
        </span>
      )}
    </button>
  );
}

export default BotaoTema;