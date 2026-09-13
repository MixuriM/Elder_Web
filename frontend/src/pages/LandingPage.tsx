import React from 'react';

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
  <header className="hero-section">
    <h1>{headline}</h1>
    <p>{subheadline}</p>
    <button onClick={onCtaClick} type="button">
      {ctaText}
    </button>
  </header>
);

// Componente Principal da Landing Page
export const LandingPage: React.FC<LandingPageProps> = ({ children }) => {
  const handlePrimaryAction = () => {
    // Lógica da conversão / scroll / redirecionamento
  };

  return (
    <div className="landing-page-container">
      {/* 1. Header / Navegação */}
      <nav className="navbar">
        <div className="logo">SuaMarca</div>
        <button onClick={handlePrimaryAction}>Começar Agora</button>
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