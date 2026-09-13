import { useEffect, useState } from "react";

function BotaoTema() {
  const [escuro, setEscuro] = useState(false);

  useEffect(() => {
    const temaSalvo = localStorage.getItem("tema");
    const temaEscuro = temaSalvo === "escuro";

    setEscuro(temaEscuro);
    document.documentElement.classList.toggle("dark", temaEscuro);
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
      aria-label={escuro ? "Ativar modo claro" : "Ativar modo escuro"}
      className="
        relative
        h-12
        w-24
        rounded-full
        border
        border-[#5F6075]
        bg-[#2B2C3B]
        p-1
        transition-all
        duration-300
        hover:border-[#8B82FF]
        focus:outline-none
        focus:ring-2
        focus:ring-[#6C63FF]/40
      "
    >
      <span
        className={`
          absolute
          top-1
          flex
          h-10
          w-10
          items-center
          justify-center
          rounded-full
          bg-[#55566D]
          text-2xl
          text-white
          shadow-md
          transition-all
          duration-300

          ${escuro ? "left-[50px]" : "left-1"}
        `}
      >
        {escuro ? "☾" : "☀"}
      </span>
    </button>
  );
}

export default BotaoTema;