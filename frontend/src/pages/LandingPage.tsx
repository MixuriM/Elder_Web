import React from 'react';
import { useNavigate } from 'react-router-dom';

// Interfaces de tipos para os dados da Landing Page
export interface HeroProps {
  headline: string;
  subheadline: string;
  ctaText: string;
  onCtaClick?: () => void;
}

export interface LandingPageProps {
  title?: string;
  children?: React.ReactNode;
}

// Subcomponente de Hero (Seção Principal)
const HeroSection: React.FC<HeroProps> = ({ headline, subheadline, ctaText, onCtaClick }) => (
  <header className="hero-section flex flex-col items-center gap-6 px-6 py-16 text-center">
    <h1 className="text-4xl font-bold text-gray-900 dark:text-white">{headline}</h1>
    <p className="max-w-xl text-xl text-gray-600 dark:text-gray-300">{subheadline}</p>
    <button
      onClick={onCtaClick}
      type="button"
      className="
        rounded-2xl
        bg-[#6C63FF]
        px-8
        py-4
        text-xl
        font-bold
        text-white
        transition
        duration-300
        hover:bg-[#5C54E8]
        focus:outline-none
        focus-visible:ring-2
        focus-visible:ring-[#6C63FF]/40
        dark:bg-[#7C74FF]
        dark:hover:bg-[#6C63FF]
      "
    >
      {ctaText}
    </button>
  </header>
);

// Componente Principal da Landing Page
export const LandingPage: React.FC<LandingPageProps> = ({ children }) => {
  const navigate = useNavigate();
  const handlePrimaryAction = () => {
    navigate('/welcome');
  };

  return (
    <div className="landing-page-container">
      {/* 1. Header / Navegação */}
      <nav className="navbar flex items-center justify-between px-6 py-4">
        <div className="logo text-2xl font-bold text-gray-900 dark:text-white">SuaMarca</div>
        <button
          onClick={handlePrimaryAction}
          type="button"
          className="
            rounded-2xl
            bg-[#6C63FF]
            px-6
            py-3
            text-lg
            font-bold
            text-white
            transition
            duration-300
            hover:bg-[#5C54E8]
            focus:outline-none
            focus-visible:ring-2
            focus-visible:ring-[#6C63FF]/40
            dark:bg-[#7C74FF]
            dark:hover:bg-[#6C63FF]
          "
        >
          Entrar
        </button>
      </nav>

      {/* 2. Hero Section */}
      <HeroSection
        headline="Transforme seus resultados com a nossa solução"
        subheadline="Uma proposta de valor clara, direta e objetiva para converter seus visitantes em clientes."
        ctaText="Garanta seu acesso"
        onCtaClick={handlePrimaryAction}
      />

      {/* 3. Conteúdo Dinâmico (Benefícios, Prova Social, FAQ, etc.) */}
      <main className="main-content">
        {children || (
          <section className="features-placeholder">
            <h2>Por que nos escolher?</h2>
            {/* Adicione seus cards ou seções aqui */}
          </section>
        )}
      </main>

      {/* 4. Rodapé */}
      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} SuaMarca. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
};

export default LandingPage;