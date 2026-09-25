import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { FotoPerfilProvider } from "./FotoPerfilContext";
import { useFotoPerfil } from "./useFotoPerfil";

const mockBuscarFoto = jest.fn();
let mockUsuario: object | null = null;
jest.mock("../services/perfilService", () => ({
  buscarFotoPerfil: (...args: unknown[]) => mockBuscarFoto(...args),
}));
jest.mock("../hooks/useAuthUser", () => ({
  useAuthUser: () => ({ usuario: mockUsuario, carregando: false }),
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
  beforeEach(() => mockBuscarFoto.mockReset());

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
