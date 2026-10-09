import {
  Bell,
  ChevronDown,
  Menu,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import BotaoTema from "../layout/BotaoTema";
import { useAuthUser } from "../../hooks/useAuthUser";
import { useFotoPerfil } from "../../contexts/useFotoPerfil";
import { useAcesso } from "../../contexts/useAcesso";
import { useAvisos } from "../../contexts/useAvisos";

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
  const navigate = useNavigate();
  const { usuario } = useAuthUser();
  const { fotoPerfilUrl, carregandoFoto } = useFotoPerfil();
  // Perfil buscado uma vez pelo AcessoProvider; até ele chegar, o nome da sessão do Firebase.
  const nome = useAcesso().nome || usuario?.displayName || usuario?.email || "";
  const totalAvisos = useAvisos().avisos.length;

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
            inline-flex
            min-h-11
            min-w-11
            items-center
            justify-center
            rounded-xl
            p-2.5

            text-slate-600

            transition-colors
            duration-300

            hover:bg-[#F3F0FF]
            hover:text-[#554CD8]

            dark:text-[#C7C7D1]
            dark:hover:bg-[#2B2C3B]
            dark:hover:text-[#A89FFF]

            lg:hidden
          "
        >
          <Menu size={22} />
        </button>
      </div>

      {/* Lado direito */}
      <div className="flex shrink-0 items-center gap-2">
        {/* Avisos: a contagem vai no nome acessível; o número visível é só reforço. */}
        <Link
          to="/avisos"
          aria-label={totalAvisos > 0 ? `Avisos (${totalAvisos})` : "Avisos"}
          className="
            relative
            inline-flex
            min-h-11
            min-w-11
            items-center
            justify-center

            rounded-xl

            p-2.5

            text-slate-600

            transition-colors
            duration-300

            hover:bg-[#F3F0FF]
            hover:text-[#554CD8]

            dark:text-[#C7C7D1]
            dark:hover:bg-[#2B2C3B]
            dark:hover:text-[#A89FFF]
          "
        >
          <Bell size={20} aria-hidden="true" />
          {totalAvisos > 0 && (
            <span
              aria-hidden="true"
              className="
                absolute
                -right-0.5
                -top-0.5

                flex
                h-[22px]
                min-w-[22px]
                items-center
                justify-center

                rounded-full

                bg-[#B42318]
                px-1

                text-sm
                font-bold
                leading-none
                text-white
              "
            >
              {totalAvisos > 99 ? "99+" : totalAvisos}
            </span>
          )}
        </Link>

        {/* Mesmo estilo de tema do Cadastro */}
        <BotaoTema compacto />

        {/* Perfil */}
        <button
          type="button"
          aria-label="Abrir perfil"
          onClick={() => navigate("/perfil")}
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
              from-[#5F56EC]
              to-[#554CD8]

              text-sm
              font-bold
              text-white

              overflow-hidden

              sm:h-10
              sm:w-10
            "
          >
            {fotoPerfilUrl ? (
              <img
                src={fotoPerfilUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : carregandoFoto ? null : (
              obterIniciais(nome)
            )}
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