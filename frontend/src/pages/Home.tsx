import { CalendarDays } from "lucide-react";
import { useState } from "react";

import Sidebar from "../components/Home/Sidebar";
import Header from "../components/Home/Header";
import ActionCards from "../components/Home/ActionCards";
import BannerSaude from "../components/Home/BannerSaude";
import CardAjuda from "../components/Home/CardAjuda";
import ResumoDia from "../components/Home/ResumoDia";

function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState("Início");

  return (
    <main
      className="
        min-h-screen

        bg-[#F5F7FF]
        text-[#071A38]

        antialiased

        transition-colors
        duration-300

        dark:bg-[radial-gradient(circle_at_top,_#272A3D_0%,_#1C1E2A_30%,_#11141D_100%)]
        dark:text-[#F5F5FA]
      "
    >
      <div className="flex min-h-screen">
        <Sidebar
          aberto={sidebarOpen}
          menuAtivo={activeMenu}
          setAberto={setSidebarOpen}
          setMenuAtivo={setActiveMenu}
        />

        <section className="min-w-0 flex-1">
          <Header
            abrirSidebar={() => setSidebarOpen(true)}
          />

          <div
            className="
              mx-auto

              w-full
              max-w-[1440px]

              px-4
              py-5

              sm:px-6
              sm:py-7

              lg:px-8
              lg:py-8
            "
          >
            {/* Saudação */}
            <div
              className="
                mb-5

                flex
                flex-col
                justify-between
                gap-4

                sm:mb-7
                sm:flex-row
                sm:items-end
              "
            >
              <div>
                <h2
                  className="
                    text-2xl
                    font-bold
                    tracking-tight

                    text-[#071A38]

                    transition-colors
                    duration-300

                    dark:text-[#F5F5FA]

                    sm:text-3xl
                    lg:text-[34px]
                  "
                >
                  Olá!
                </h2>

                <p
                  className="
                    mt-1

                    text-sm
                    text-slate-600

                    transition-colors
                    duration-300

                    dark:text-[#C7C7D1]

                    sm:text-[15px]
                  "
                >
                  Que bom ver você por aqui!
                </p>
              </div>

              {/* Data */}
              <div
                className="
                  flex
                  items-center
                  gap-2

                  text-xs
                  text-slate-500

                  transition-colors
                  duration-300

                  dark:text-[#C7C7D1]
                "
              >
                <CalendarDays
                  size={16}
                  className="
                    text-[#6C63FF]

                    dark:text-[#A89FFF]
                  "
                />

                <span>Hoje</span>
              </div>
            </div>

            {/* Ações principais */}
            <ActionCards />

            {/* Banner + ajuda */}
            <div
              className="
                mt-4

                grid
                gap-4

                lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,.85fr)]
              "
            >
              <BannerSaude />
              <CardAjuda />
            </div>

            {/* Resumo do dia */}
            <ResumoDia />
          </div>
        </section>
      </div>
    </main>
  );
}

export default Home;