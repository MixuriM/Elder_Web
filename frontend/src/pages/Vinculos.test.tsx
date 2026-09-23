import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
      email: screen.getByLabelText("E-mail do idoso (opcional se informar telefone)"),
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

// Item 4.1 (RF-007): esqueleto cru da seção "Registrar leitura de saúde (só idoso)".
describe("Vinculos — Registrar leitura de saúde (item 4.1)", () => {
  beforeEach(() => {
    mockGetCurrentUserToken.mockReset();
    mockGetCurrentUserToken.mockResolvedValue("token-fake");
    global.fetch = jest.fn();
  });

  function renderESecao() {
    render(<Vinculos />);
    return {
      tipo: screen.getByLabelText("Tipo de medição", { exact: true }),
      valor1: screen.getByLabelText("Valor 1", { exact: true }),
      valor2: screen.getByLabelText("Valor 2 (opcional)", { exact: true }),
      unidade: screen.getByLabelText("Unidade", { exact: true }),
      dataHora: screen.getByLabelText("Data e hora (opcional)", { exact: true }),
      obs: screen.getByLabelText("Observações (opcional)", { exact: true }),
      botao: screen.getByRole("button", { name: /^registrar leitura$/i }),
    };
  }

  it("campos acessíveis por label", () => {
    const c = renderESecao();
    Object.values(c).forEach((el) => expect(el).toBeInTheDocument());
  });

  it("envia POST /saude com Authorization e valores numéricos, sem campos de autoria", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 55 }));
    const user = userEvent.setup();
    const c = renderESecao();

    await user.type(c.tipo, "pressao");
    await user.type(c.valor1, "120");
    await user.type(c.valor2, "80");
    await user.type(c.unidade, "mmHg");
    fireEvent.change(c.dataHora, { target: { value: "2026-09-23T10:00" } });
    await user.click(c.botao);

    await screen.findByText(/id 55/);
    const [url, opcoes] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toMatch(/\/saude$/);
    expect(opcoes.method).toBe("POST");
    expect(opcoes.headers.Authorization).toBe("Bearer token-fake");
    const corpo = JSON.parse(opcoes.body);
    expect(corpo.valor_1).toBe(120);
    expect(corpo.valor_2).toBe(80);
    expect(typeof corpo.valor_1).toBe("number");
    expect(corpo.data_hora).toBe(new Date("2026-09-23T10:00").toISOString());
    expect(corpo).not.toHaveProperty("idoso_id");
    expect(corpo).not.toHaveProperty("registrado_por_id");
    expect(corpo).not.toHaveProperty("editado_por_id");
  });

  it("sucesso mostra o id do registro, sem alerta", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 55 }));
    const user = userEvent.setup();
    const c = renderESecao();
    await user.type(c.tipo, "peso");
    await user.type(c.valor1, "70.5");
    await user.type(c.unidade, "kg");
    await user.click(c.botao);

    expect(await screen.findByText(/Leitura registrada \(id 55\)/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([
    [400, "valor_1 inválido."],
    [403, "Sem permissão para registrar leitura de saúde."],
  ])("erro %i aparece com role=alert", async (status, mensagem) => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(status, { error: mensagem }));
    const user = userEvent.setup();
    const c = renderESecao();
    await user.type(c.tipo, "peso");
    await user.type(c.valor1, "70");
    await user.type(c.unidade, "kg");
    await user.click(c.botao);

    expect(await screen.findByRole("alert")).toHaveTextContent(mensagem);
  });

  it("console.error não recebe valores de saúde", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(400, { error: "valor_1 inválido." }));
    const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const user = userEvent.setup();
      const c = renderESecao();
      await user.type(c.tipo, "pressao");
      await user.type(c.valor1, "123.45");
      await user.type(c.unidade, "mmHg");
      await user.type(c.obs, "segredo-clinico");
      await user.click(c.botao);
      await screen.findByRole("alert");
      const tudo = JSON.stringify(spy.mock.calls.map((c) => c.map((a) => (a instanceof Error ? a.message : a))));
      expect(tudo).not.toContain("123.45");
      expect(tudo).not.toContain("segredo-clinico");
    } finally {
      spy.mockRestore();
    }
  });
});
