import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Vinculos from "./Vinculos";

const mockGetCurrentUserToken = jest.fn();
jest.mock("../lib/auth", () => ({
  getCurrentUserToken: (...args: unknown[]) => mockGetCurrentUserToken(...args),
}));

function respostaJson(status: number, corpo: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(corpo),
  } as Response;
}

// Último teste pendente da tabela "Testes" da Fase 3 (item 3.1): esqueleto cru de
// Vinculos.tsx, seção "Cadastrar idoso" — cobre só os 3 pontos listados no plano
// (checkbox de aceite obrigatório, erro com role="alert", botão desabilitado durante a
// chamada). Esqueleto é descartável (layout final é de Laureane/Jennifer), então o teste
// é mínimo, sem cobrir listagem/estilo.
describe("Vinculos — Cadastrar idoso (item 3.1)", () => {
  beforeEach(() => {
    mockGetCurrentUserToken.mockReset();
    mockGetCurrentUserToken.mockResolvedValue("token-fake");
    global.fetch = jest.fn();
  });

  function renderESecionaCadastro() {
    render(<Vinculos />);
    return {
      nome: screen.getByLabelText("Nome do idoso", { exact: true }),
      email: document.getElementById("email_idoso_cadastro") as HTMLElement,
      aceite: screen.getByLabelText(/declaro que sou responsável/i),
      botao: screen.getByRole("button", { name: /^cadastrar idoso$/i }),
    };
  }

  it("cadastro com sucesso: mostra o resultado, sem erro", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      respostaJson(201, {
        usuario: { id: 99, nome: "Dona Maria" },
        vinculo: { id: 7, status: "pendente" },
      })
    );
    const user = userEvent.setup();
    const { nome, email, aceite, botao } = renderESecionaCadastro();

    await user.type(nome, "Dona Maria");
    await user.type(email, "maria@a.com");
    await user.click(aceite);
    await user.click(botao);

    expect(await screen.findByText(/Dona Maria cadastrado \(id 99\)/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sem aceitar o termo: erro do backend (400) aparece com role=\"alert\"", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      respostaJson(400, { error: "É necessário aceitar o termo de responsabilidade." })
    );
    const user = userEvent.setup();
    const { nome, email, botao } = renderESecionaCadastro();

    await user.type(nome, "Dona Maria");
    await user.type(email, "maria@a.com");
    // aceite NÃO marcado de propósito
    await user.click(botao);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /aceitar o termo de responsabilidade/i
    );
  });

  it("botão fica desabilitado (aria-busy) durante a chamada, reabilita depois", async () => {
    let resolverFetch!: (value: Response) => void;
    (global.fetch as jest.Mock).mockReturnValue(
      new Promise<Response>((resolve) => {
        resolverFetch = resolve;
      })
    );
    const user = userEvent.setup();
    const { nome, email, aceite, botao } = renderESecionaCadastro();

    await user.type(nome, "Dona Maria");
    await user.type(email, "maria@a.com");
    await user.click(aceite);
    await user.click(botao);

    expect(botao).toBeDisabled();
    expect(botao).toHaveAttribute("aria-busy", "true");

    resolverFetch(respostaJson(201, { usuario: { id: 1, nome: "Dona Maria" }, vinculo: { id: 1, status: "pendente" } }));

    await waitFor(() => expect(botao).not.toBeDisabled());
    expect(botao).toHaveAttribute("aria-busy", "false");
  });
});
