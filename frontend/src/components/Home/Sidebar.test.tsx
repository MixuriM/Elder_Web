import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Sidebar from "./Sidebar";

jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(),
  GoogleAuthProvider: jest.fn(),
  signOut: jest.fn(),
}));
jest.mock("../../lib/firebase", () => ({ app: {} }));

const mockLogoutUser = jest.fn();
jest.mock("../../lib/auth", () => {
  const actual = jest.requireActual("../../lib/auth");
  return {
    ...actual,
    logoutUser: (...args: unknown[]) => mockLogoutUser(...args),
  };
});

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

function renderSidebar() {
  return render(
    <MemoryRouter>
      <Sidebar aberto={true} setAberto={jest.fn()} />
    </MemoryRouter>
  );
}

describe("Sidebar — logout", () => {
  beforeEach(() => {
    mockLogoutUser.mockReset();
    mockNavigate.mockReset();
  });

  it("clicar em 'Sair' desloga e navega pra /login substituindo o histórico", async () => {
    mockLogoutUser.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: /sair/i }));

    expect(mockLogoutUser).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
  });

  it("itens do menu são links reais (abrem em nova aba) e fecham o menu ao clicar", async () => {
    const setAberto = jest.fn();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Sidebar aberto={true} setAberto={setAberto} />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Meu Perfil" })).toHaveAttribute("href", "/perfil");
    expect(screen.getByRole("link", { name: "Família" })).toHaveAttribute("href", "/familia");
    expect(screen.getByRole("link", { name: "Cuidadores" })).toHaveAttribute("href", "/cuidadores");

    await user.click(screen.getByRole("link", { name: "Meu Perfil" }));
    expect(setAberto).toHaveBeenCalledWith(false);
  });

  it("item do menu tem alvo mínimo de 44px", () => {
    renderSidebar();
    expect(screen.getByRole("link", { name: "Agenda" })).toHaveClass("min-h-11");
  });
});
