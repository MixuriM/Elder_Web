import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Saude from "./Saude";

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

// Item 4.1 (RF-007): esqueleto cru da página /saude, formulário "Registrar leitura de saúde".
describe("Saude — Registrar leitura de saúde (item 4.1)", () => {
  beforeEach(() => {
    mockGetCurrentUserToken.mockReset();
    mockGetCurrentUserToken.mockResolvedValue("token-fake");
    global.fetch = jest.fn();
  });

  function renderESecao() {
    render(<Saude />);
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
