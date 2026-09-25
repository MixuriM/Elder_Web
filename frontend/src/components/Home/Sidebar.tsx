import {
  LogOut,
  Settings,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { menuItems } from "../../data/menuItems";
import { logoutUser } from "../../lib/auth";

type SidebarProps = {
  aberto: boolean;
  menuAtivo: string;
  setAberto: (aberto: boolean) => void;
  setMenuAtivo: (menu: string) => void;
};

function Sidebar({
  aberto,
  menuAtivo,
  setAberto,
  setMenuAtivo,
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

          transition-all
          duration-300
          ease-out

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
            <img src="elder-favicon.ico"></img>
          </div>

          {/* Nome da plataforma */}
          <div>
            <h1
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
                  text-[#6C63FF]
                  dark:text-[#A89FFF]
                "
              >
                Web
              </span>
            </h1>

            <p
              className="
                text-[9px]
                text-slate-500

                transition-colors
                duration-300

                dark:text-[#858594]
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

              rounded-lg

              p-2

              text-slate-600

              transition-colors
              duration-300

              hover:bg-[#E7E1FF]
              hover:text-[#6C63FF]

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
          className="
            min-h-0
            flex-1
            overflow-y-auto

            px-3
            py-5
          "
        >
          <p
            className="
              mb-3

              px-3

              text-[9px]
              font-semibold
              uppercase
              tracking-[0.15em]

              text-slate-500

              transition-colors
              duration-300

              dark:text-[#858594]
            "
          >
            Menu principal
          </p>

          <div className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = menuAtivo === item.label;

              return (
                <button
                  type="button"
                  key={item.label}
                  onClick={() => {
                    setMenuAtivo(item.label);
                    setAberto(false);
                    if (item.label === "Meu Perfil") navigate("/perfil");
                  }}
                  className={`
                    flex
                    w-full
                    items-center

                    gap-3

                    rounded-xl

                    px-3
                    py-2.5

                    text-left
                    text-[12px]

                    transition-all
                    duration-200

                    ${
                      active
                        ? `
                          bg-[#6C63FF]

                          font-semibold
                          text-white

                          shadow-sm
                          shadow-[#6C63FF]/25
                        `
                        : `
                          text-slate-600

                          hover:bg-[#E7E1FF]
                          hover:text-[#6C63FF]

                          dark:text-[#C7C7D1]
                          dark:hover:bg-[#2B2C3B]
                          dark:hover:text-[#A89FFF]
                        `
                    }
                  `}
                >
                  <Icon
                    size={17}
                    strokeWidth={active ? 2.3 : 1.8}
                  />

                  <span>{item.label}</span>
                </button>
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
              items-center

              gap-3

              rounded-xl

              px-3
              py-2.5

              text-[12px]
              text-slate-600

              transition-colors
              duration-300

              hover:bg-[#E7E1FF]
              hover:text-[#6C63FF]

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
              w-full
              items-center

              gap-3

              rounded-xl

              px-3
              py-2.5

              text-[12px]
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