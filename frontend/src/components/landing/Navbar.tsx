import { useNavigate } from "react-router-dom";
// Logo exibido com 60 px: versão de 120 px (2x para tela retina), 7,7 kB no lugar dos 46 kB do original de 480 px.
import logoElder from "../../Img/Elder_logo_120.webp";
import BotaoTema from "../layout/BotaoTema";
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
  hover:text-[#554CD8]
  dark:text-gray-300
  dark:hover:text-[#A7A2FF]
`;

function Navbar({ onEntrar }: NavbarProps) {
  const navigate = useNavigate();

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
            gap-4

            lg:flex
            xl:gap-8
            [html[class*=texto-]_&]:max-xl:gap-2
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

          {/* 3 - Para quem é */}
          <button
            type="button"
            onClick={() => irParaSecao("publico")}
            className={estiloLink}
          >
            Para quem é
          </button>

          {/* 4 - Acessibilidade */}
          <button
            type="button"
            onClick={() => irParaSecao("acessibilidade")}
            className={estiloLink}
          >
            Acessibilidade
          </button>

          {/* 5 - Orientações */}
          <button
            type="button"
            onClick={() => navigate("/orientacoes")}
            className={estiloLink}
          >
            Orientações
          </button>
        </div>

        {/* CANTO DIREITO */}
        <div className="flex items-center gap-4">
          {/* Sobre */}
          <button
            type="button"
            onClick={() => navigate("/sobre-nos")}
            className={`hidden lg:block [html[class*=texto-]_&]:lg:max-xl:hidden ${estiloLink}`}
          >
            Sobre
          </button>

          {/* Tema */}
          {/* De lg a xl só o ícone, para caber ao lado do Sobre; de xl em diante, com rótulo.
              Com texto grande ou muito grande, o rótulo só a partir de 2xl e o Sobre some entre lg e xl (o Footer cobre). */}
          <div className="hidden lg:flex xl:[html:not([class*=texto-])_&]:hidden 2xl:hidden">
            <BotaoTema compacto />
          </div>
          <div className="hidden sm:flex lg:hidden xl:flex [html[class*=texto-]_&]:xl:max-2xl:hidden">
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
              text-[#5F56EC]

              transition
              duration-300

              hover:bg-[#554CD8]
              hover:text-white

              dark:border-[#8B84FF]
              dark:text-[#A7A2FF]

              dark:hover:bg-[#554CD8]
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