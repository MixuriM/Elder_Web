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
  Sun,
  Moon,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

type MenuItem = {
  label: string;
  icon: React.ElementType;
};

type Theme = 'light' | 'dark' | 'system';

const getStoredTheme = (): Theme => {
  return (localStorage.getItem('theme') as Theme) || 'system';
};

const setTheme = (theme: Theme): void => {
  const root = document.documentElement;
  let effectiveTheme = theme;

  if (theme === 'system') {
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    effectiveTheme = systemDark ? 'dark' : 'light';
  }

  root.setAttribute('data-theme', effectiveTheme);
  localStorage.setItem('theme', theme);
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
      className={`group relative flex min-h-[158px] flex-1 flex-col justify-between overflow-hidden rounded-2xl p-5 text-left shadow-lg ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-white/70 sm:min-h-[168px] lg:p-6 ${color}`}
    >
      <div className="absolute -right-7 -top-7 h-24 w-24 rounded-full bg-white/5 transition-transform duration-300 group-hover:scale-150" />

      <Icon
        size={40}
        strokeWidth={1.8}
        className="relative text-white/90"
      />

      <div className="relative">
        <h3 className="text-[17px] font-bold text-white sm:text-[18px]">{title}</h3>
        <p className="mt-1 max-w-[230px] text-[12px] leading-4 text-white/80 sm:text-[13px]">
          {description}
        </p>
      </div>

      <span className="absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-800 shadow-md transition-transform group-hover:translate-x-1 sm:bottom-5 sm:right-5">
        <ChevronRight size={17} />
      </span>
    </button>
  );
}

function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState("Início");
  const [theme, setThemeState] = useState<Theme>(getStoredTheme());

  useEffect(() => {
    setTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    setThemeState(theme === "dark" ? "light" : "dark");
  };

  return (
    <main className="min-h-screen bg-[#0B1026] text-white antialiased">
      <style>{`
        :root {
          --app-bg: #0B1026;
          --surface: #2D255F;
          --surface-2: #151B35;
          --header: #0B1026;
          --border: rgba(255,255,255,.07);
          --text: #FFFFFF;
          --muted: #94a3b8;
        }
        [data-theme="light"] {
          --app-bg: #FFFFFF;
          --surface: #FFFFFF;
          --surface-2: #FFFFFF;
          --header: rgba(255,255,255,.94);
          --border: #EDE7FF;
          --text: #1F2937;
          --muted: #4B5563;
        }
        [data-theme="light"] main { background: var(--app-bg) !important; color: var(--text) !important; }
        [data-theme="light"] .app-sidebar,
        [data-theme="light"] .app-header { background: var(--surface) !important; }
        [data-theme="light"] .app-header { background: var(--header) !important; }
        [data-theme="light"] .search-input { background: #EDE7FF !important; color: #1F2937 !important; border-color: #A18BFF !important; }
        [data-theme="light"] .search-input::placeholder { color: #94a3b8 !important; }
        [data-theme="light"] .surface-card { background: var(--surface-2) !important; border-color: var(--border) !important; }
        [data-theme="light"] .theme-muted { color: #4B5563 !important; }
        [data-theme="light"] .theme-heading { color: #1F2937 !important; }
        [data-theme="light"] .theme-hover:hover { background: #EDE7FF !important; }
        .safe-area-bottom { padding-bottom: max(1rem, env(safe-area-inset-bottom)); }
        @media (max-width: 639px) {
          .mobile-sidebar { width: min(86vw, 320px); }
        }
      `}</style>
      <div className="flex min-h-screen">

        {sidebarOpen && (
          <button
            aria-label="Fechar menu"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-[2px] lg:hidden"
          />
        )}

        {/* sidebar */}
        <aside
          className={`
            mobile-sidebar app-sidebar fixed left-0 top-0 z-40 flex h-[100dvh]
            flex-col border-r border-white/5 bg-[#2D255F]
            shadow-2xl shadow-black/20 transition-transform duration-300 ease-out
            lg:sticky lg:top-0 lg:h-screen lg:w-[240px] lg:shrink-0 lg:shadow-none
            lg:translate-x-0
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          `}
        >
          {/* logo */}
          <div className="flex h-[68px] shrink-0 items-center border-b border-white/5 px-5 sm:px-6">
            <div className="mr-3 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#A18BFF] to-[#6C63FF]">
              <ShieldCheck size={22} />
            </div>

            <div>
              <h1 className="text-[17px] font-bold tracking-tight">
                Elder<span className="text-[#A18BFF]">Web</span>
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
          <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
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
                          ? "bg-gradient-to-r from-[#6C63FF] to-[#A18BFF] font-semibold text-white shadow-lg shadow-indigo-900/30"
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
          <div className="safe-area-bottom border-t border-white/5 px-3 py-3">
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
          <header className="app-header sticky top-0 z-20 flex min-h-[68px] items-center justify-between border-b border-white/5 bg-[#0B1026]/95 px-3 backdrop-blur-md sm:px-5 lg:px-8">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-xl p-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white lg:hidden"
              >
                <Menu size={22} />
              </button>

              {/* busca */}
              <div className="relative hidden min-w-0 sm:block">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A18BFF]"
                />

                <input
                  type="text"
                  placeholder="Buscar no sistema..."
                  className="search-input h-10 w-[clamp(180px,28vw,320px)] rounded-xl border border-[#A18BFF]/20 bg-[#2D255F] pl-9 pr-4 text-xs text-white shadow-inner outline-none transition focus:border-[#A18BFF]/60 focus:ring-2 focus:ring-[#A18BFF]/10 placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1 sm:gap-2">

              {/* notificação */}
              <button className="relative rounded-xl p-2.5 text-slate-300 transition hover:bg-white/5 hover:text-white">
                <Bell size={20} />
              
                {/* <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold">
                  x
                </span> */}
              </button>

              {/* tema */}
              <button
                onClick={toggleTheme}
                aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
                title={theme === "dark" ? "Modo claro" : "Modo escuro"}
                className="flex h-9 w-11 items-center justify-center rounded-full bg-[#6C63FF]/20 text-[#A18BFF] transition hover:bg-[#6C63FF]/30 focus:outline-none focus:ring-2 focus:ring-[#A18BFF]/40 sm:w-14"
              >
                {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
              </button>

              {/* interface do perfil */}
              <button className="flex items-center gap-1.5 rounded-xl p-1 transition hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#A18BFF]/30">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#A18BFF] to-[#6C63FF] text-[10px] font-bold text-white shadow-md sm:h-10 sm:w-10">
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

          <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">

            {/* nome e descrição */}
            <div className="mb-5 flex flex-col justify-between gap-4 sm:mb-7 sm:flex-row sm:items-end">
              <div>

                <h2 className="theme-heading text-2xl font-bold tracking-tight sm:text-3xl lg:text-[34px]">
                  Olá, 
                  {/* {nome}! */}
                </h2>

                <p className="theme-muted mt-1 text-sm text-slate-400 sm:text-[15px]">
                  Que bom ver você por aqui!
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <CalendarDays size={16} className="text-[#6C63FF]" />
                
              </div>
            </div>

            {/* card */}
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">

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
                color="bg-gradient-to-br from-[#6C63FF] to-[#2D255F]"
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


            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,.85fr)]">

              {/* banner */}
              <section className="theme-preserve-dark relative min-h-[170px] overflow-hidden rounded-2xl border border-[#A18BFF]/10 bg-gradient-to-r from-[#2D255F] to-[#151B35] p-5 shadow-lg shadow-black/10 sm:p-6">

                {/* pra decoração */}
                <div className="absolute -right-4 bottom-[-45px] h-36 w-36 rotate-12 border-l-[25px] border-[#A18BFF]/40" />

                <div className="relative flex h-full items-center gap-4 sm:gap-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#6C63FF] shadow-lg shadow-indigo-500/20 sm:h-14 sm:w-14">
                    <FileText size={24} />
                  </div>

                  <div>
                    <p className="max-w-[560px] text-lg font-bold leading-snug text-white sm:text-xl lg:text-[22px]">
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
              <section className="theme-preserve-dark rounded-2xl border border-white/5 bg-[#151B35] p-5 shadow-lg shadow-black/10 sm:p-6">

                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#6C63FF]">
                    <LifeBuoy size={20} />
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Precisa de ajuda?
                    </h3>

                    <p className="mt-1 text-[11px] leading-4 text-slate-400">
                      Veja nossas orientações
                      <br />
                      ou fale com sua família.
                    </p>
                  </div>
                </div>

                <button className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#A18BFF] text-xs font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:-translate-y-0.5 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#A18BFF]/50">
                  Ver orientações
                  <ChevronRight size={15} />
                </button>
              </section>
            </div>

            {/* resumo */}
            <div className="mt-6 sm:mt-8">
              <h3 className="theme-muted mb-3 text-sm font-semibold text-slate-300">
                Resumo do seu dia
              </h3>

              <div className="grid gap-3 sm:grid-cols-3">

                <div className="surface-card rounded-2xl border border-white/5 bg-[#151B35] p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      Medicamentos hoje
                    </span>

                    <Pill size={17} className="text-[#A18BFF]" />
                  </div>

                  <p className="mt-2 text-2xl font-bold"></p>
                  <p className="text-[10px] text-emerald-400">
                    
                  </p>
                </div>

                <div className="surface-card rounded-2xl border border-white/5 bg-[#151B35] p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5">
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

                <div className="surface-card rounded-2xl border border-white/5 bg-[#151B35] p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5">
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