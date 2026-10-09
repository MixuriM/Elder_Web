import {
  LogOut,
  Settings,
  X,
} from "lucide-react";

import { NavLink, useNavigate } from "react-router-dom";

import { menuItems } from "../../data/menuItems";
import { logoutUser } from "../../lib/auth";

type SidebarProps = {
  aberto: boolean;
  setAberto: (aberto: boolean) => void;
};

function Sidebar({
  aberto,
  setAberto,
}: SidebarProps) {
  const navigate = useNavigate();

  async function handleLogout() {
    await logoutUser();
    navigate("/login", { replace: true });
  }

  return (
    <>
      {/* Fundo escuro ao abrir o menu no celular */}
      {aberto && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setAberto(false)}
          className="
            fixed
            inset-0
            z-30
            bg-black/60
            backdrop-blur-[2px]
            lg:hidden
          "
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed
          left-0
          top-0
          z-40

          flex
          h-[100dvh]
          w-[min(86vw,320px)]
          flex-col

          border-r
          border-[#E5E1FF]

          bg-[#F3F0FF]
          text-[#071A38]

          shadow-2xl
          shadow-black/10

          transition-transform
          duration-[220ms]
          ease-[cubic-bezier(.32,.72,0,1)]

          dark:border-[#454558]
          dark:bg-[#20202D]
          dark:text-[#F5F5FA]
          dark:shadow-black/30

          lg:sticky
          lg:top-0
          lg:h-screen
          lg:w-[240px]
          lg:shrink-0
          lg:translate-x-0
          lg:shadow-none

          ${aberto ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Cabeçalho / Logo */}
        <div
          className="
            flex
            h-[68px]
            shrink-0
            items-center

            border-b
            border-[#DDD7FF]

            px-5

            transition-colors
            duration-300

            dark:border-[#454558]

            sm:px-6
          "
        >
          {/* Ícone da logo */}
          <div
            className="
              mr-2

              flex
              h-10
              w-10
              items-center
              justify-center

              rounded-full

              bg-gradient-to-br
              from-[#A18BFF]
              to-[#6C63FF]
            "
          >
            <img
              src="/elder-favicon.ico"
              alt="Logo ElderWeb"
              className="h-full w-full rounded-full object-cover"
            />
          </div>

          {/* Nome da plataforma */}
          <div>
            <p
              className="
                text-[17px]
                font-bold
                tracking-tight

                text-[#071A38]

                transition-colors
                duration-300

                dark:text-[#F5F5FA]
              "
            >
              Elder
              <span
                className="
                  text-[#5F56EC]
                  dark:text-[#A89FFF]
                "
              >
                Web
              </span>
            </p>

            <p
              className="
                text-sm
                text-slate-600

                transition-colors
                duration-300

                dark:text-[#8A8A99]
              "
            >
              Cuidado e bem-estar
            </p>
          </div>

          {/* Fechar menu no celular */}
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setAberto(false)}
            className="
              ml-auto

              flex
              min-h-11
              min-w-11
              items-center
              justify-center

              rounded-lg

              text-slate-600

              transition-colors
              duration-300

              hover:bg-[#E7E1FF]
              hover:text-[#554CD8]

              dark:text-[#C7C7D1]
              dark:hover:bg-[#2B2C3B]
              dark:hover:text-[#A89FFF]

              lg:hidden
            "
          >
            <X size={20} />
          </button>
        </div>

        {/* Menu principal */}
        <nav
          aria-labelledby="menu-principal-titulo"
          className="
            min-h-0
            flex-1
            overflow-y-auto

            px-3
            py-5
          "
        >
          <p
            id="menu-principal-titulo"
            className="
              mb-3

              px-3

              text-sm
              font-semibold
              uppercase
              tracking-[0.15em]

              text-slate-600

              transition-colors
              duration-300

              dark:text-[#8A8A99]
            "
          >
            Menu principal
          </p>

          <div className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.label}
                  to={item.to}
                  onClick={() => setAberto(false)}
                  className={({ isActive }) => `
                    flex
                    min-h-11
                    w-full
                    items-center

                    gap-3

                    rounded-xl

                    px-3
                    py-2.5

                    text-left
                    text-sm

                    transition-all
                    duration-200

                    ${
                      isActive
                        ? `
                          bg-[#5F56EC]

                          font-semibold
                          text-white

                          shadow-sm
                          shadow-[#6C63FF]/25
                        `
                        : `
                          text-slate-600

                          hover:bg-[#E7E1FF]
                          hover:text-[#554CD8]

                          dark:text-[#C7C7D1]
                          dark:hover:bg-[#2B2C3B]
                          dark:hover:text-[#A89FFF]
                        `
                    }
                  `}
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        size={17}
                        strokeWidth={isActive ? 2.3 : 1.8}
                        aria-hidden="true"
                      />

                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>

        {/* Rodapé */}
        <div
          className="
            border-t
            border-[#DDD7FF]

            px-3
            py-3

            pb-[max(0.75rem,env(safe-area-inset-bottom))]

            transition-colors
            duration-300

            dark:border-[#454558]
          "
        >
          {/* Configurações */}
          <button
            type="button"
            className="
              flex
              w-full
              min-h-11
              items-center

              gap-3

              rounded-xl

              px-3
              py-2.5

              text-sm
              text-slate-600

              transition-colors
              duration-300

              hover:bg-[#E7E1FF]
              hover:text-[#554CD8]

              dark:text-[#C7C7D1]
              dark:hover:bg-[#2B2C3B]
              dark:hover:text-[#A89FFF]
            "
          >
            <Settings size={17} />

            <span>Configurações</span>
          </button>

          {/* Sair */}
          <button
            type="button"
            onClick={handleLogout}
            className="
              mt-1

              flex
              min-h-11
              w-full
              items-center

              gap-3

              rounded-xl

              px-3
              py-2.5

              text-sm
              text-slate-600

              transition-colors
              duration-300

              hover:bg-red-50
              hover:text-red-500

              dark:text-[#C7C7D1]
              dark:hover:bg-red-500/10
              dark:hover:text-red-300
            "
          >
            <LogOut size={17} />

            <span>Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;