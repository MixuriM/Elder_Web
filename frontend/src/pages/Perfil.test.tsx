import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { useState, type ReactNode } from "react";
import Perfil from "./Perfil";
import { FotoPerfilContext, useFotoPerfil } from "../contexts/useFotoPerfil";

// O contexto de foto importa useAuthUser (Firebase); o teste não precisa dele.
jest.mock("../hooks/useAuthUser", () => ({
  useAuthUser: () => ({ usuario: null, carregando: false }),
}));

const mockBuscarPerfil = jest.fn();
const mockSalvarPerfil = jest.fn();
const mockEnviarFoto = jest.fn();
const mockRemoverFoto = jest.fn();
jest.mock("../services/perfilService", () => ({
  buscarPerfil: (...args: unknown[]) => mockBuscarPerfil(...args),
  salvarPerfil: (...args: unknown[]) => mockSalvarPerfil(...args),
  enviarFotoPerfil: (...args: unknown[]) => mockEnviarFoto(...args),
  removerFotoPerfil: (...args: unknown[]) => mockRemoverFoto(...args),
}));

function renderPerfil() {
  return render(
    <MemoryRouter>
      <Perfil />
    </MemoryRouter>
  );
}

const DADOS = { id: 1, nome: "Ana", email: "ana@a.com", telefone: "123", tipo_perfil: "idoso" };

describe("Perfil", () => {
  beforeEach(() => {
    mockBuscarPerfil.mockReset();
    mockSalvarPerfil.mockReset();
    mockEnviarFoto.mockReset();
    mockRemoverFoto.mockReset();
  });

  it("mostra 'Carregando...' antes de buscarPerfil resolver", async () => {
    let resolver!: (v: typeof DADOS) => void;
    mockBuscarPerfil.mockReturnValue(
      new Promise((resolve) => {
        resolver = resolve;
      })
    );
    renderPerfil();

    expect(screen.getByText("Carregando...")).toBeInTheDocument();

    resolver(DADOS);
    await waitFor(() => expect(screen.queryByText("Carregando...")).not.toBeInTheDocument());
  });

  it("preenche os campos com os dados retornados por buscarPerfil", async () => {
    mockBuscarPerfil.mockResolvedValue(DADOS);
    renderPerfil();

    expect(await screen.findByLabelText(/nome/i)).toHaveValue("Ana");
    expect(screen.getByLabelText(/^e-mail$/i)).toHaveValue("ana@a.com");
    expect(screen.getByLabelText(/telefone/i)).toHaveValue("123");
  });

  it("buscarPerfil falha: mostra erro, não quebra a página", async () => {
    mockBuscarPerfil.mockRejectedValue(new Error("rede fora"));
    renderPerfil();

    expect(await screen.findByRole("alert")).toHaveTextContent(/não foi possível carregar/i);
  });

  it("salva alterações com sucesso: chama salvarPerfil e mostra mensagem de sucesso", async () => {
    mockBuscarPerfil.mockResolvedValue(DADOS);
    mockSalvarPerfil.mockResolvedValue({ ...DADOS, nome: "Ana Silva" });
    const user = userEvent.setup();
    renderPerfil();

    const campoNome = await screen.findByLabelText(/nome/i);
    await user.clear(campoNome);
    await user.type(campoNome, "Ana Silva");
    await user.click(screen.getByRole("button", { name: /salvar/i }));

    await waitFor(() =>
      expect(mockSalvarPerfil).toHaveBeenCalledWith({ nome: "Ana Silva", email: "ana@a.com", telefone: "123" })
    );
    expect(await screen.findByRole("status")).toBeInTheDocument();
  });

  it("falha ao salvar: mostra a mensagem de erro retornada", async () => {
    mockBuscarPerfil.mockResolvedValue(DADOS);
    mockSalvarPerfil.mockRejectedValue(new Error("Este e-mail já está em uso por outra conta."));
    const user = userEvent.setup();
    renderPerfil();

    await screen.findByLabelText(/nome/i);
    await user.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/já está em uso/i);
  });

  describe("foto de perfil", () => {
    const FOTO = "data:image/jpeg;base64,QUJD";

    // Provider com estado real, pra checar a sincronização com o contexto (Header).
    function ProviderReal({ children, inicial = null }: { children: ReactNode; inicial?: string | null }) {
      const [fotoPerfilUrl, definirFotoPerfil] = useState<string | null>(inicial);
      return (
        <FotoPerfilContext.Provider value={{ fotoPerfilUrl, carregandoFoto: false, definirFotoPerfil }}>
          {children}
          <span data-testid="contexto">{fotoPerfilUrl ?? "sem-foto"}</span>
        </FotoPerfilContext.Provider>
      );
    }

    function renderComProvider(inicial: string | null = null) {
      return render(
        <MemoryRouter>
          <ProviderReal inicial={inicial}>
            <Perfil />
          </ProviderReal>
        </MemoryRouter>
      );
    }

    const arquivo = () => new File(["abc"], "eu.jpg", { type: "image/jpeg" });

    it("sem foto: não mostra 'Remover foto de perfil'", async () => {
      mockBuscarPerfil.mockResolvedValue(DADOS);
      renderComProvider();
      await screen.findByLabelText(/nome/i);

      expect(screen.queryByRole("button", { name: /remover foto/i })).not.toBeInTheDocument();
      expect(screen.getByTestId("contexto")).toHaveTextContent("sem-foto");
    });

    it("com foto: mostra a imagem e o botão de remover; a foto vem do contexto", async () => {
      mockBuscarPerfil.mockResolvedValue(DADOS);
      renderComProvider(FOTO);

      expect(await screen.findByRole("button", { name: /remover foto/i })).toBeInTheDocument();
      expect(screen.getByAltText("Foto de perfil")).toHaveAttribute("src", FOTO);
      expect(screen.getByTestId("contexto")).toHaveTextContent(FOTO);
    });

    it("upload com sucesso: chama enviarFotoPerfil, atualiza contexto e mostra feedback", async () => {
      mockBuscarPerfil.mockResolvedValue(DADOS);
      mockEnviarFoto.mockResolvedValue(FOTO);
      const user = userEvent.setup();
      renderComProvider();
      await screen.findByLabelText(/nome/i);

      const arq = arquivo();
      await user.upload(screen.getByLabelText(/escolher foto de perfil/i), arq);

      await waitFor(() => expect(mockEnviarFoto).toHaveBeenCalledWith(arq));
      expect(await screen.findByRole("status")).toHaveTextContent(/foto de perfil atualizada/i);
      expect(screen.getByTestId("contexto")).toHaveTextContent(FOTO);
      expect(screen.getByRole("button", { name: /remover foto/i })).toBeInTheDocument();
    });

    it("upload recusado pelo servidor: mostra a mensagem em role=alert e mantém sem foto", async () => {
      mockBuscarPerfil.mockResolvedValue(DADOS);
      mockEnviarFoto.mockRejectedValue(new Error("Foto acima do limite de 2 MB."));
      const user = userEvent.setup();
      renderComProvider();
      await screen.findByLabelText(/nome/i);

      await user.upload(screen.getByLabelText(/escolher foto de perfil/i), arquivo());

      expect(await screen.findByRole("alert")).toHaveTextContent(/limite de 2 MB/i);
      expect(screen.getByTestId("contexto")).toHaveTextContent("sem-foto");
    });

    it("remover: chama removerFotoPerfil, zera o contexto e esconde o botão", async () => {
      mockBuscarPerfil.mockResolvedValue(DADOS);
      mockRemoverFoto.mockResolvedValue(null);
      const user = userEvent.setup();
      renderComProvider(FOTO);

      await user.click(await screen.findByRole("button", { name: /remover foto/i }));

      await waitFor(() => expect(mockRemoverFoto).toHaveBeenCalled());
      expect(await screen.findByRole("status")).toHaveTextContent(/foto de perfil removida/i);
      expect(screen.getByTestId("contexto")).toHaveTextContent("sem-foto");
      expect(screen.queryByRole("button", { name: /remover foto/i })).not.toBeInTheDocument();
    });

    it("useFotoPerfil sem Provider devolve 'sem foto'", () => {
      function Sonda() {
        return <span>{useFotoPerfil().fotoPerfilUrl ?? "nada"}</span>;
      }
      render(<Sonda />);
      expect(screen.getByText("nada")).toBeInTheDocument();
    });
  });
});
