import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Header from "./Header";
import { FotoPerfilContext } from "../../contexts/FotoPerfilContext";

const mockBuscarPerfil = jest.fn();
jest.mock("../../services/perfilService", () => ({
  buscarPerfil: (...args: unknown[]) => mockBuscarPerfil(...args),
}));
jest.mock("../../hooks/useAuthUser", () => ({
  useAuthUser: () => ({ usuario: { displayName: "Marcos Castelli", email: "m@m.com" }, carregando: false }),
}));

beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

function renderHeader(fotoPerfilUrl: string | null) {
  return render(
    <MemoryRouter>
      <FotoPerfilContext.Provider value={{ fotoPerfilUrl, definirFotoPerfil: () => {} }}>
        <Header abrirSidebar={() => {}} />
      </FotoPerfilContext.Provider>
    </MemoryRouter>
  );
}

describe("Header — avatar", () => {
  beforeEach(() => {
    mockBuscarPerfil.mockReset().mockResolvedValue({ nome: "Marcos Castelli" });
  });

  it("sem foto: mostra as iniciais", async () => {
    renderHeader(null);
    expect(await screen.findByText("MC")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /abrir perfil/i }).querySelector("img")).toBeNull();
  });

  it("com foto: mostra a imagem e não as iniciais", async () => {
    const foto = "data:image/png;base64,QUJD";
    renderHeader(foto);
    const botao = screen.getByRole("button", { name: /abrir perfil/i });
    expect(botao.querySelector("img")).toHaveAttribute("src", foto);
    expect(screen.queryByText("MC")).not.toBeInTheDocument();
  });
});
