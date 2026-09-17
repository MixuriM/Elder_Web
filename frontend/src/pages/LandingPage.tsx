import { useNavigate } from "react-router-dom";

// Componentes da Landing Page
import Navbar from "../components/landing/Navbar";
import HeroSection from "../components/landing/HeroSection";
import ResumoSection from "../components/landing/ResumoSection";
import FuncionalidadesSection from "../components/landing/FuncionalidadesSection";
import ComoFuncionaSection from "../components/landing/ComoFuncionaSection";
import PropositoSection from "../components/landing/PropositoSection";
import PublicoSection from "../components/landing/PublicoSection";
import AcessibilidadeSection from "../components/landing/AcessibilidadeSection";
import CTASection from "../components/landing/CTASection";
import Footer from "../components/landing/Footer";

function LandingPage() {
  // Hook utilizado para navegar entre páginas
  const navigate = useNavigate();

  // Navega para a página de cadastro
  function handleCadastro() {
    navigate("/cadastro");
  }

  // Navega para a página de entrar
  function handleLogin() {
    navigate("/welcome");
  }

  // Faz a rolagem suave até uma seção
  function irParaSecao(id: string) {
    const secao = document.getElementById(id);

    if (secao) {
      secao.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }

  return (
    <div
      className="
        min-h-screen
        bg-white
        text-[#101828]
        transition-colors
        duration-300

        dark:bg-[#10101A]
        dark:text-white
      "
    >
      {/* Barra de navegação */}
      <Navbar onEntrar={handleLogin} />

      {/* Conteúdo principal */}
      <main>
        {/* Apresentação do Elder */}
        <HeroSection
          headline="Mais autonomia para um amanhã melhor."
          subheadline="
            O Elder Web conecta pessoas idosas,
            familiares, cuidadores e profissionais,
            tornando o cuidado mais simples,
            organizado e próximo.
          "
          ctaText="Conheça o Elder"
          onCtaClick={() =>
            irParaSecao("funcionalidades")
          }
        />

        {/* Resumo dos principais benefícios */}
        <ResumoSection />

        {/* Funcionalidades */}
        <FuncionalidadesSection />

        {/* Como funciona */}
        <ComoFuncionaSection />

        {/* Sobre o Elder / Propósito */}
        <PropositoSection />

        {/* Para quem é o Elder */}
        <PublicoSection />

        {/* Acessibilidade */}
        <AcessibilidadeSection />

        {/* Chamada final para cadastro */}
        <CTASection
          onCriarConta={handleCadastro}
        />
      </main>

      {/* Rodapé */}
      <Footer />
    </div>
  );
}

export default LandingPage;