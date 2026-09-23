import {
  Bell,
  ChevronDown,
  Menu,
  Search,
} from "lucide-react";
import { useEffect, useState } from "react";

import BotaoTema from "../layout/BotaoTema";
import { useAuthUser } from "../../hooks/useAuthUser";
import { buscarPerfil } from "../../services/perfilService";

type HeaderProps = {
  abrirSidebar: () => void;
};

function obterIniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);

  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();

  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
}

function Header({ abrirSidebar }: HeaderProps) {
  const { usuario } = useAuthUser();
  const [nome, setNome] = useState("");

  useEffect(() => {
    let ativo = true;

    if (!usuario) {
      setNome("");
      return () => {
        ativo = false;
      };
    }

    setNome(usuario.displayName ?? usuario.email ?? "");

    buscarPerfil()
      .then((perfil) => {
        if (ativo) setNome(perfil.nome);
      })
      .catch(() => {});

    return () => {
      ativo = false;
    };
  }, [usuario]);

  return (
    <header
      className="
        sticky
        top-0
        z-20

        flex
        min-h-[68px]
        items-center
        justify-between

        border-b
        border-[#EDE7FF]

        bg-white/95

        px-3

        backdrop-blur-md

        transition-colors
        duration-300

        dark:border-[#454558]
        dark:bg-[#181824]/95

        sm:px-5
        lg:px-8
      "
    >
      {/* Lado esquerdo */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {/* Botão do menu no celular */}
        <button
          type="button"
          onClick={abrirSidebar}
          aria-label="Abrir menu"
          className="
            rounded-xl
            p-2.5

            text-slate-600

            transition-colors
            duration-300

            hover:bg-[#F3F0FF]
            hover:text-[#6C63FF]

            dark:text-[#C7C7D1]
            dark:hover:bg-[#2B2C3B]
            dark:hover:text-[#A89FFF]

            lg:hidden
          "
        >
          <Menu size={22} />
        </button>

        {/* Campo de busca */}
        <div className="relative hidden min-w-0 sm:block">
          <Search
            size={15}
            className="
              absolute
              left-3
              top-1/2
              -translate-y-1/2

              text-[#6C63FF]

              dark:text-[#A89FFF]
            "
          />

          <input
            type="text"
            placeholder="Buscar no sistema..."
            className="
              h-10
              w-[clamp(180px,28vw,320px)]

              rounded-xl

              border
              border-[#DDD7FF]

              bg-[#F8F7FF]

              pl-9
              pr-4

              text-xs
              text-[#071A38]

              outline-none

              transition-all
              duration-300

              placeholder:text-slate-400

              hover:border-[#A18BFF]

              focus:border-[#6C63FF]
              focus:ring-2
              focus:ring-[#6C63FF]/20

              dark:border-[#454558]
              dark:bg-[#181824]
              dark:text-[#F5F5FA]
              dark:placeholder:text-[#858594]

              dark:hover:border-[#66667A]

              dark:focus:border-[#A89FFF]
              dark:focus:ring-[#A89FFF]/20
            "
          />
        </div>
      </div>

      {/* Lado direito */}
      <div className="flex shrink-0 items-center gap-2">
        {/* Notificações */}
        <button
          type="button"
          aria-label="Notificações"
          className="
            relative

            rounded-xl

            p-2.5

            text-slate-600

            transition-colors
            duration-300

            hover:bg-[#F3F0FF]
            hover:text-[#6C63FF]

            dark:text-[#C7C7D1]
            dark:hover:bg-[#2B2C3B]
            dark:hover:text-[#A89FFF]
          "
        >
          <Bell size={20} />
        </button>

        {/* Mesmo estilo de tema do Cadastro */}
        <BotaoTema compacto />

        {/* Perfil */}
        <button
          type="button"
          aria-label="Abrir perfil"
          className="
            flex
            items-center
            gap-1.5

            rounded-xl

            p-1

            transition-colors
            duration-300

            hover:bg-[#F3F0FF]

            dark:hover:bg-[#2B2C3B]
          "
        >
          <div
            className="
              flex
              h-9
              w-9
              items-center
              justify-center

              rounded-full

              bg-gradient-to-br
              from-[#A18BFF]
              to-[#6C63FF]

              text-[10px]
              font-bold
              text-white

              sm:h-10
              sm:w-10
            "
          >
            {obterIniciais(nome)}
          </div>

          <ChevronDown
            size={15}
            className="
              hidden

              text-slate-500

              transition-colors
              duration-300

              dark:text-[#858594]

              sm:block
            "
          />
        </button>
      </div>
    </header>
  );
}

export default Header;