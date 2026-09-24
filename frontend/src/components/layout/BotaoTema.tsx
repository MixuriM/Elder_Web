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
  responsivo?: boolean;
};

function BotaoTema({
  compacto = false,
  responsivo = false,
}: BotaoTemaProps) {
  const [escuro, setEscuro] = useState(false);

  // Carrega o tema salvo
  useEffect(() => {
    const temaSalvo = localStorage.getItem("tema");

    const temaEscuro =
      temaSalvo === "escuro";

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
      novoTemaEscuro
        ? "escuro"
        : "claro"
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
        inline-flex
        shrink-0
        items-center
        justify-center

        transition-all
        duration-200

        focus:outline-none
        focus-visible:ring-2
        focus-visible:ring-[#6C63FF]/30

        ${compacto || responsivo
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

            ${
              responsivo && !compacto
                ? `
                  lg:h-11
                  lg:w-fit
                  lg:gap-2
                  lg:rounded-xl
                  lg:border
                  lg:border-gray-300
                  lg:bg-white
                  lg:px-4
                  lg:text-sm
                  lg:font-semibold
                  lg:text-[#071A38]
                  lg:shadow-sm

                  lg:hover:border-[#A18BFF]
                  lg:hover:bg-[#F3F0FF]
                  lg:hover:text-[#6C63FF]

                  lg:dark:border-[#454558]
                  lg:dark:bg-[#2B2C3B]
                  lg:dark:text-[#F5F5FA]
                  lg:dark:hover:border-[#66667A]
                  lg:dark:hover:bg-[#373849]
                  lg:dark:hover:text-[#A89FFF]
                `
                : ""
            }
          `
          : `
              h-11
              w-fit

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
          className={`shrink-0 ${responsivo ? "h-5 w-5 lg:h-[17px] lg:w-[17px]" : ""}`}
        />
      ) : (
        <Moon
          size={compacto ? 20 : 17}
          strokeWidth={2}
          className={`shrink-0 ${responsivo ? "h-5 w-5 lg:h-[17px] lg:w-[17px]" : ""}`}
        />
      )}

      {!compacto && (
          <span className={`whitespace-nowrap ${responsivo ? "hidden lg:inline" : ""}`}>
          {escuro
            ? "Modo claro"
            : "Modo escuro"}
        </span>
      )}
    </button>
  );
}

export default BotaoTema;