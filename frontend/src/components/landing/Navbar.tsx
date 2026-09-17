import logoElder from "../../Img/Elder_logo.svg";
import ControleTema from "../layout/ControleTema";

type NavbarProps = {
  onEntrar: () => void;
};

// Estilo padrão dos links da Navbar
const estiloLink = `
  whitespace-nowrap
  text-sm
  font-medium
  text-gray-600
  transition-colors
  duration-200
  hover:text-[#6C63FF]
  dark:text-gray-300
  dark:hover:text-[#A7A2FF]
`;

function Navbar({ onEntrar }: NavbarProps) {
  // Faz a rolagem suave até uma seção
  function irParaSecao(id: string) {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  // Volta para o início
  function irParaInicio() {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  return (
    <nav
      className="
        sticky
        top-0
        z-50
        w-full

        border-b
        border-gray-100

        bg-white/95
        backdrop-blur-md

        transition-colors
        duration-300

        dark:border-white/5
        dark:bg-[#10101A]/95
      "
    >
      <div
        className="
          relative
          flex
          h-[82px]
          w-full
          items-center
          justify-between

          px-6
          lg:px-10
        "
      >
        {/* LOGO */}
        <button
          type="button"
          onClick={irParaInicio}
          aria-label="Voltar ao início"
          className="flex items-center justify-start"
        >
          <img
            src={logoElder}
            alt="Elder Web"
            className="
              h-[60px]
              w-auto
              object-contain
            "
          />
        </button>

        {/* LINKS CENTRAIS */}
        <div
          className="
            absolute
            left-1/2
            hidden
            -translate-x-1/2
            items-center
            gap-8

            lg:flex
          "
        >
          {/* 1 - Início */}
          <button
            type="button"
            onClick={irParaInicio}
            className={estiloLink}
          >
            Início
          </button>

          {/* 2 - Funcionalidades */}
          <button
            type="button"
            onClick={() => irParaSecao("funcionalidades")}
            className={estiloLink}
          >
            Funcionalidades
          </button>

          {/* 3 - Sobre */}
          <button
            type="button"
            onClick={() => irParaSecao("sobre")}
            className={estiloLink}
          >
            Sobre
          </button>

          {/* 4 - Para quem é */}
          <button
            type="button"
            onClick={() => irParaSecao("publico")}
            className={estiloLink}
          >
            Para quem é
          </button>

          {/* 5 - Acessibilidade */}
          <button
            type="button"
            onClick={() => irParaSecao("acessibilidade")}
            className={estiloLink}
          >
            Acessibilidade
          </button>
        </div>

        {/* CANTO DIREITO */}
        <div className="flex items-center gap-4">
          {/* Tema */}
          <div className="hidden sm:flex">
            <ControleTema />
          </div>

          {/* Entrar */}
          <button
            type="button"
            onClick={onEntrar}
            className="
              flex
              h-11
              items-center
              justify-center

              rounded-xl

              border
              border-[#6C63FF]

              px-6

              text-sm
              font-bold
              text-[#6C63FF]

              transition
              duration-300

              hover:bg-[#6C63FF]
              hover:text-white

              dark:border-[#8B84FF]
              dark:text-[#A7A2FF]

              dark:hover:bg-[#8B84FF]
              dark:hover:text-white
            "
          >
            Entrar
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;