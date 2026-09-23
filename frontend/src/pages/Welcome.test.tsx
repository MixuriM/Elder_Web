import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Welcome from "./Welcome";

jest.mock("../components/Informativo/LadoInformativo", () => () => null);
jest.mock("../components/Welcome/LandingWelcome", () => () => null);
jest.mock("../components/layout/BotaoTema", () => () => null);

function renderWelcome(state?: object) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/welcome", state }]}>
      <Welcome />
    </MemoryRouter>
  );
}

describe("Welcome — pós-cadastro", () => {
  it("cadastro com e-mail de confirmação enviado: mostra sucesso e o aviso para confirmar o e-mail", () => {
    renderWelcome({ cadastroSucesso: true, confirmarEmail: true });

    expect(screen.getByText(/cadastro realizado com sucesso/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/e-mail de confirmação/i);
  });

  it("cadastro sem confirmação necessária (cuidador ou Google): sem o aviso", () => {
    renderWelcome({ cadastroSucesso: true, confirmarEmail: false });

    expect(screen.getByText(/cadastro realizado com sucesso/i)).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("acesso direto a /welcome: nenhum aviso", () => {
    renderWelcome();

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText(/cadastro realizado/i)).not.toBeInTheDocument();
  });
});
