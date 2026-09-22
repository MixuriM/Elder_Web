import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Perfil from "./Perfil";

const mockBuscarPerfil = jest.fn();
const mockSalvarPerfil = jest.fn();
jest.mock("../services/perfilService", () => ({
  buscarPerfil: (...args: unknown[]) => mockBuscarPerfil(...args),
  salvarPerfil: (...args: unknown[]) => mockSalvarPerfil(...args),
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
});
