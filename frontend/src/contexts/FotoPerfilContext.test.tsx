import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { FotoPerfilProvider } from "./FotoPerfilContext";
import { useFotoPerfil } from "./useFotoPerfil";

const mockBuscarFoto = jest.fn();
let mockUsuario: object | null = null;
let mockCarregando = false;
jest.mock("../services/perfilService", () => ({
  buscarFotoPerfil: (...args: unknown[]) => mockBuscarFoto(...args),
}));
jest.mock("../hooks/useAuthUser", () => ({
  useAuthUser: () => ({ usuario: mockUsuario, carregando: mockCarregando }),
}));

function Sonda() {
  const { fotoPerfilUrl, carregandoFoto } = useFotoPerfil();
  return (
    <>
      <span data-testid="foto">{fotoPerfilUrl ?? "sem-foto"}</span>
      <span data-testid="carregando">{carregandoFoto ? "sim" : "nao"}</span>
    </>
  );
}

function renderProvider() {
  return render(
    <FotoPerfilProvider>
      <Sonda />
    </FotoPerfilProvider>
  );
}

describe("FotoPerfilProvider", () => {
  beforeEach(() => {
    mockBuscarFoto.mockReset();
    mockCarregando = false;
    localStorage.clear();
  });

  it("logado: carrega foto_perfil_url de GET /usuario/me/foto", async () => {
    mockUsuario = { uid: "u" };
    mockBuscarFoto.mockResolvedValue("data:image/png;base64,QUJD");
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("foto")).toHaveTextContent("data:image/png;base64,QUJD"));
  });

  it("logado: carregandoFoto fica true até a busca terminar e volta false depois", async () => {
    mockUsuario = { uid: "u" };
    let resolver!: (v: string | null) => void;
    mockBuscarFoto.mockReturnValue(new Promise((r) => (resolver = r)));
    renderProvider();
    expect(screen.getByTestId("carregando")).toHaveTextContent("sim");
    resolver(null);
    await waitFor(() => expect(screen.getByTestId("carregando")).toHaveTextContent("nao"));
  });

  it("F5 com foto em cache: mostra a foto na hora, sem esperar sessão nem servidor", () => {
    localStorage.setItem("elderweb:fotoPerfil", JSON.stringify({ uid: "u", url: "data:image/png;base64,QUJD" }));
    mockUsuario = null;
    mockCarregando = true; // Firebase ainda restaurando a sessão
    mockBuscarFoto.mockReturnValue(new Promise(() => {}));
    renderProvider();
    expect(screen.getByTestId("foto")).toHaveTextContent("data:image/png;base64,QUJD");
    expect(screen.getByTestId("carregando")).toHaveTextContent("nao");
  });

  it("cache de outra conta é descartado", async () => {
    localStorage.setItem("elderweb:fotoPerfil", JSON.stringify({ uid: "outro", url: "data:image/png;base64,QUJD" }));
    mockUsuario = { uid: "u" };
    mockBuscarFoto.mockResolvedValue(null);
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("carregando")).toHaveTextContent("nao"));
    expect(screen.getByTestId("foto")).toHaveTextContent("sem-foto");
  });

  it("servidor confirma a foto e grava no cache; logout limpa o cache", async () => {
    mockUsuario = { uid: "u" };
    mockBuscarFoto.mockResolvedValue("data:image/png;base64,QUJD");
    const { rerender } = renderProvider();
    await waitFor(() => expect(localStorage.getItem("elderweb:fotoPerfil")).toContain("QUJD"));
    mockUsuario = null;
    rerender(
      <FotoPerfilProvider>
        <Sonda />
      </FotoPerfilProvider>
    );
    await waitFor(() => expect(localStorage.getItem("elderweb:fotoPerfil")).toBeNull());
  });

  it("deslogado: não busca nada e fica sem foto", () => {
    mockUsuario = null;
    renderProvider();
    expect(mockBuscarFoto).not.toHaveBeenCalled();
    expect(screen.getByTestId("foto")).toHaveTextContent("sem-foto");
  });

  it("falha ao buscar: fica sem foto, sem quebrar", async () => {
    mockUsuario = { uid: "u" };
    mockBuscarFoto.mockRejectedValue(new Error("rede"));
    renderProvider();
    await waitFor(() => expect(mockBuscarFoto).toHaveBeenCalled());
    expect(screen.getByTestId("foto")).toHaveTextContent("sem-foto");
  });
});
