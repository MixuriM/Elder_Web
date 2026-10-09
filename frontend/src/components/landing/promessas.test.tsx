import "@testing-library/jest-dom";
import { render } from "@testing-library/react";

import FuncionalidadesSection from "./FuncionalidadesSection";
import HeroSection from "./HeroSection";

// A landing só promete o que o produto entrega: avisos dentro do site, sem alertas, lembretes, e-mail, celular
// nem botão de ajuda (o medicamento não tem horário estruturado e o botão de emergência ainda não existe).
describe("Landing: promessas", () => {
  it.each([
    ["HeroSection", <HeroSection key="h" headline="Título" subheadline="Sub" ctaText="Começar" />],
    ["FuncionalidadesSection", <FuncionalidadesSection key="f" />],
  ])("%s fala em avisos dentro do site e não promete o que não existe", (_, secao) => {
    const { container } = render(secao);
    expect(container).toHaveTextContent(/avisos dentro do site/i);
    expect(container).not.toHaveTextContent(/alerta|lembrete|e-mail|celular|botão de ajuda|horário/i);
  });
});
