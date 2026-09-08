//tema escuro

//HÁ COMANDOS EM COMENTÁRIO; ESTES PRECISAM DE ALTERAÇÃO SIGNIFICATIVA

import {
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  FileText,
  HeartPulse,
  Home as HomeIcon,
  KeyRound,
  LifeBuoy,
  LogOut,
  Menu,
  Pill,
  Search,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";

type MenuItem = {
  label: string;
  icon: React.ElementType;
};

const menuItems: MenuItem[] = [
  { label: "Início", icon: HomeIcon },
  { label: "Meu Perfil", icon: Users },
  { label: "Saúde", icon: HeartPulse },
  { label: "Medicamentos", icon: Pill },
  { label: "Remédios", icon: KeyRound },
  { label: "Agenda", icon: CalendarDays },
  { label: "Relatórios", icon: FileText },
  { label: "Família", icon: Users },
  { label: "Orientações", icon: LifeBuoy },
];

type ActionCardProps = {
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
};

// const [nome, setNome] = useState("");

function ActionCard({
  title,
  description,
  icon: Icon,
  color,
}: ActionCardProps) {
  return (
    <button
      className={`group relative flex min-h-[145px] flex-1 flex-col justify-between overflow-hidden rounded-xl p-5 text-left shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${color}`}
    >
      <div className="absolute -right-7 -top-7 h-24 w-24 rounded-full bg-white/5 transition-transform duration-300 group-hover:scale-150" />

      <Icon
        size={38}
        strokeWidth={1.8}
        className="relative text-white/90"
      />

      <div className="relative">
        <h3 className="text-[16px] font-bold text-white">{title}</h3>
        <p className="mt-1 max-w-[170px] text-[12px] leading-4 text-white/80">
          {description}
        </p>
      </div>

      <span className="absolute bottom-4 right-4 flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-800 transition-transform group-hover:translate-x-1">
        <ChevronRight size={17} />
      </span>
    </button>
  );
}

function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState("Início");

  return (
    <main className="min-h-screen bg-[#06142d] text-white">
      <div className="flex min-h-screen">

        {sidebarOpen && (
          <button
            aria-label="Fechar menu"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          />
        )}

        {/* sidebar */}
        <aside
          className={`
            fixed left-0 top-0 z-40 flex h-screen w-[225px]
            flex-col border-r border-white/5
            bg-[#081a3a] transition-transform duration-300
            lg:static lg:translate-x-0
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          `}
        >
          {/* logo */}
          <div className="flex h-[68px] items-center border-b border-white/5 px-6">
            <div className="mr-3 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-indigo-600">
              <ShieldCheck size={22} />
            </div>

            <div>
              <h1 className="text-[17px] font-bold tracking-tight">
                Elder<span className="text-violet-400">Web</span>
              </h1>
              <p className="text-[9px] text-slate-400">
                Cuidado e bem-estar
              </p>
            </div>

            <button
              onClick={() => setSidebarOpen(false)}
              className="ml-auto lg:hidden"
            >
              <X size={20} />
            </button>
          </div>

          {/* menu */}
          <nav className="flex-1 px-3 py-5">
            <p className="mb-3 px-3 text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Menu principal
            </p>

            <div className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const active = activeMenu === item.label;

                return (
                  <button
                    key={item.label}
                    onClick={() => {
                      setActiveMenu(item.label);
                      setSidebarOpen(false);
                    }}
                    className={`
                      flex w-full items-center gap-3 rounded-lg px-3 py-2.5
                      text-left text-[12px] transition-all
                      ${
                        active
                          ? "bg-gradient-to-r from-indigo-600 to-violet-600 font-semibold text-white shadow-lg shadow-indigo-900/30"
                          : "text-slate-400 hover:bg-white/5 hover:text-white"
                      }
                    `}
                  >
                    <Icon size={17} strokeWidth={active ? 2.3 : 1.8} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* configurações */}
          <div className="border-t border-white/5 px-3 py-3">
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] text-slate-400 hover:bg-white/5 hover:text-white">
              <Settings size={17} />
              Configurações
            </button>

            <button className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] text-slate-400 hover:bg-red-500/10 hover:text-red-300">
              <LogOut size={17} />
              Sair
            </button>
          </div>
        </aside>

        {/* conteúdo */}
        <section className="min-w-0 flex-1">

          {/* cabeçalho */}
          <header className="flex h-[68px] items-center justify-between border-b border-white/5 bg-[#071832] px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-lg p-2 text-slate-300 hover:bg-white/5 lg:hidden"
              >
                <Menu size={22} />
              </button>

              {/* busca */}
              <div className="relative hidden sm:block">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-300"
                />

                <input
                  type="text"
                  placeholder="Buscar no sistema..."
                  className="
                    h-9 w-[250px] rounded-md border border-indigo-400/20
                    bg-[#0b2044] pl-9 pr-4 text-xs text-white
                    outline-none placeholder:text-slate-500
                    focus:border-indigo-400/50
                  "
                />
              </div>
            </div>

            <div className="flex items-center gap-4">

              {/* notificação */}
              <button className="relative rounded-full p-2 text-slate-300 hover:bg-white/5">
                <Bell size={20} />
              
                {/* <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold">
                  x
                </span> */}
              </button>

              {/* tema */}
              <button className="hidden h-8 w-14 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300 sm:flex">
                ☀️
              </button>

              {/* interface do perfil */}
              <button className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-bold">
                  iniciais do nome
                </div>

                {/* <div className="hidden text-left sm:block">
                  <p className="text-[11px] font-semibold">Maria Silva</p>
                  <p className="text-[9px] text-slate-500">Idosa</p>
                </div> */}

                <ChevronDown
                  size={15}
                  className="hidden text-slate-500 sm:block"
                />
              </button>
            </div>
          </header>

          <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">

            {/* nome e descrição */}
            <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>

                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Olá, 
                  {/* {nome}! */}
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Que bom ver você por aqui!
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <CalendarDays size={16} className="text-indigo-400" />
                
              </div>
            </div>

            {/* card */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

              <ActionCard
                title="Minha Saúde"
                description="Acompanhe seus registros de saúde."
                icon={HeartPulse}
                color="bg-gradient-to-br from-emerald-600 to-teal-700"
              />

              <ActionCard
                title="Meus Medicamentos"
                description="Veja seus remédios e horários."
                icon={Pill}
                color="bg-gradient-to-br from-indigo-700 to-violet-800"
              />

              <ActionCard
                title="Minha Agenda"
                description="Consulte seus compromissos."
                icon={CalendarDays}
                color="bg-gradient-to-br from-blue-600 to-blue-800"
              />

              <ActionCard
                title="Meus Relatórios"
                description="Visualize seus registros e históricos."
                icon={FileText}
                color="bg-gradient-to-br from-orange-500 to-orange-700"
              />

            </div>


            <div className="mt-4 grid gap-4 lg:grid-cols-[1.7fr_0.9fr]">

              {/* banner */}
              <section className="relative min-h-[150px] overflow-hidden rounded-xl border border-indigo-400/10 bg-gradient-to-r from-[#101e59] to-[#151d58] p-6">

                {/* pra decoração */}
                <div className="absolute -right-4 bottom-[-45px] h-36 w-36 rotate-12 border-l-[25px] border-indigo-400/40" />

                <div className="relative flex h-full items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/20">
                    <FileText size={24} />
                  </div>

                  <div>
                    <p className="text-lg font-bold">
                      Pequenas ações hoje,
                      <br />
                      grandes resultados amanhã!
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Cuide da sua saúde. Você importa!
                    </p>
                  </div>
                </div>
              </section>

              {/* ajuda */}
              <section className="rounded-xl border border-white/5 bg-[#0b1d40] p-5">

                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600">
                    <LifeBuoy size={20} />
                  </div>

                  <div>
                    <h3 className="text-sm font-bold">
                      Precisa de ajuda?
                    </h3>

                    <p className="mt-1 text-[11px] leading-4 text-slate-400">
                      Veja nossas orientações
                      <br />
                      ou fale com sua família.
                    </p>
                  </div>
                </div>

                <button className="mt-4 flex h-9 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-indigo-500 to-violet-600 text-xs font-semibold transition hover:brightness-110">
                  Ver orientações
                  <ChevronRight size={15} />
                </button>
              </section>
            </div>

            {/* resumo */}
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-semibold text-slate-300">
                Resumo do seu dia
              </h3>

              <div className="grid gap-3 sm:grid-cols-3">

                <div className="rounded-xl border border-white/5 bg-[#0b1d40] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      Medicamentos hoje
                    </span>

                    <Pill size={17} className="text-violet-400" />
                  </div>

                  <p className="mt-2 text-2xl font-bold"></p>
                  <p className="text-[10px] text-emerald-400">
                    
                  </p>
                </div>

                <div className="rounded-xl border border-white/5 bg-[#0b1d40] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      Compromissos
                    </span>

                    <CalendarDays size={17} className="text-blue-400" />
                  </div>

                  <p className="mt-2 text-2xl font-bold"></p>
                  <p className="text-[10px] text-slate-500">
                   
                  </p>
                </div>

                <div className="rounded-xl border border-white/5 bg-[#0b1d40] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      Saúde
                    </span>

                    <HeartPulse size={17} className="text-emerald-400" />
                  </div>

                  <p className="mt-2 text-2xl font-bold"> </p>
                  <p className="text-[10px] text-emerald-400">
                    
                  </p>
                </div>

              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default Home;