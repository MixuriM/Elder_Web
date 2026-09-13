import { useEffect, useState } from "react";

function BotaoTema() {
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
      className="
        flex
        min-h-14
        items-center
        justify-center
        gap-3

        rounded-xl
        border
        border-gray-300

        bg-white
        px-5

        text-lg
        font-semibold
        text-gray-800

        shadow-sm

        transition-colors
        duration-200

        hover:bg-gray-100

        focus:outline-none
        focus-visible:ring-2
        focus-visible:ring-[#6C63FF]/40

        dark:border-[#5F6075]
        dark:bg-[#2B2C3B]
        dark:text-white
        dark:hover:bg-[#373849]
      "
    >
      <span
        className="text-2xl"
        aria-hidden="true"
      >
        {escuro ? "☀" : "☾"}
      </span>

      <span>
        {escuro ? "Modo claro" : "Modo escuro"}
      </span>
    </button>
  );
}

export default BotaoTema;