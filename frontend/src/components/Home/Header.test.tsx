import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Header from "./Header";
import { FotoPerfilContext } from "../../contexts/useFotoPerfil";
import { AcessoProvider } from "../../contexts/AcessoContext";

const mockBuscarPerfil = jest.fn();
jest.mock("../../services/perfilService", () => ({
  buscarPerfil: (...args: unknown[]) => mockBuscarPerfil(...args),
}));
jest.mock("../../lib/chamarApi", () => ({ chamarApi: jest.fn() }));
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

function renderHeader(fotoPerfilUrl: string | null, carregandoFoto = false) {
  return render(
    <MemoryRouter>
      <FotoPerfilContext.Provider value={{ fotoPerfilUrl, carregandoFoto, definirFotoPerfil: () => {} }}>
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

  it("carregando a foto: não mostra iniciais nem imagem (evita o flash no F5)", async () => {
    renderHeader(null, true);
    const botao = screen.getByRole("button", { name: /abrir perfil/i });
    expect(screen.queryByText("MC")).not.toBeInTheDocument();
    expect(botao.querySelector("img")).toBeNull();
  });

  it("com foto: mostra a imagem e não as iniciais", async () => {
    const foto = "data:image/png;base64,QUJD";
    renderHeader(foto);
    const botao = screen.getByRole("button", { name: /abrir perfil/i });
    expect(botao.querySelector("img")).toHaveAttribute("src", foto);
    expect(screen.queryByText("MC")).not.toBeInTheDocument();
  });
});

describe("Header dentro do layout", () => {
  it("usa o perfil já buscado pelo AcessoProvider: uma busca só, com o nome do banco", async () => {
    // Dados fake só para o teste.
    mockBuscarPerfil.mockReset().mockResolvedValue({ tipo_perfil: "idoso", nome: "Maria Teste Silva" });

    render(
      <MemoryRouter>
        <AcessoProvider>
          <Header abrirSidebar={() => {}} />
        </AcessoProvider>
      </MemoryRouter>
    );
    await act(async () => {});

    expect(screen.getByRole("button", { name: /abrir perfil/i })).toHaveTextContent("MS");
    expect(mockBuscarPerfil).toHaveBeenCalledTimes(1);
  });
});
