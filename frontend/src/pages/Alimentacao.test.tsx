import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Alimentacao from "./Alimentacao";

const mockGetCurrentUserToken = jest.fn();
jest.mock("../lib/auth", () => ({
  getCurrentUserToken: (...args: unknown[]) => mockGetCurrentUserToken(...args),
}));

function respostaJson(status: number, corpo: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(corpo) } as Response;
}

// Item 7.1 (RF-018): esqueleto cru da página /alimentacao, só para exercitar POST /alimentacao e
// POST /alimentacao/idoso/:idosoId. Valores abaixo são obviamente falsos, só para teste.
const DESCRICAO = "descricao-falsa-sigilosa";
const DATA_LOCAL = "2026-10-10T12:30";
const ERRO_DO_SERVIDOR = "mensagem-do-servidor-que-nao-deve-aparecer";

const OPCOES = [
  ["cafe_manha", "Café da manhã"],
  ["lanche_manha", "Lanche da manhã"],
  ["almoco", "Almoço"],
  ["lanche_tarde", "Lanche da tarde"],
  ["jantar", "Jantar"],
  ["ceia", "Ceia"],
];

const MENSAGENS: [number, string][] = [
  [400, "Dados inválidos. Confira refeição, descrição e data e hora."],
  [401, "Sessão expirada. Entre novamente."],
  [403, "Você não tem permissão para registrar esta refeição."],
  [404, "Não foi possível registrar a refeição."],
  [500, "Não foi possível registrar a refeição."],
];

beforeEach(() => {
  mockGetCurrentUserToken.mockReset();
  mockGetCurrentUserToken.mockResolvedValue("token-fake");
  global.fetch = jest.fn();
});
afterEach(() => jest.restoreAllMocks());

function campos() {
  return {
    idosoId: screen.getByLabelText("Id do idoso (vazio = minha alimentação)", { exact: true }),
    refeicao: screen.getByLabelText("Refeição", { exact: true }) as HTMLSelectElement,
    descricao: screen.getByLabelText("Descrição", { exact: true }),
    dataHora: screen.getByLabelText("Data e hora", { exact: true }),
    botao: screen.getByRole("button", { name: /^registrar refeição$/i }),
  };
}

async function preencherEEnviar(user: ReturnType<typeof userEvent.setup>, idosoId = "", refeicao?: string) {
  const c = campos();
  if (idosoId) await user.type(c.idosoId, idosoId);
  if (refeicao) await user.selectOptions(c.refeicao, refeicao);
  await user.type(c.descricao, DESCRICAO);
  fireEvent.change(c.dataHora, { target: { value: DATA_LOCAL } });
  await user.click(c.botao);
}

function chamada(i = 0) {
  const [url, init] = (global.fetch as jest.Mock).mock.calls[i];
  return { url: String(url), init, corpo: JSON.parse(init.body) };
}

describe("Alimentacao (item 7.1)", () => {
  it("renderiza a seção com todos os campos acessíveis por label", () => {
    render(<Alimentacao />);
    expect(screen.getByRole("heading", { level: 1, name: "Alimentação" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Registrar refeição" })).toBeInTheDocument();
    Object.values(campos()).forEach((el) => expect(el).toBeInTheDocument());
  });

  it("select de refeição tem exatamente os 6 valores do backend, com rótulos em português", () => {
    render(<Alimentacao />);
    const opcoes = Array.from(campos().refeicao.options).map((o) => [o.value, o.textContent]);
    expect(opcoes).toEqual(OPCOES);
  });

  it("descrição é textarea com maxLength 500; descrição e data e hora são obrigatórias", () => {
    render(<Alimentacao />);
    const c = campos();
    expect(c.descricao.tagName).toBe("TEXTAREA");
    expect(c.descricao).toHaveAttribute("maxLength", "500");
    expect(c.descricao).toBeRequired();
    expect(c.dataHora).toHaveAttribute("type", "datetime-local");
    expect(c.dataHora).toBeRequired();
    expect(c.idosoId).not.toBeRequired();
  });

  it("id vazio: POST /alimentacao, Authorization e Content-Type JSON, corpo exato com data via toISOString", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 31 }));
    const user = userEvent.setup();
    render(<Alimentacao />);
    await preencherEEnviar(user);
    await screen.findByRole("status");
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const { url, init, corpo } = chamada();
    expect(url).toMatch(/\/alimentacao$/);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ Authorization: "Bearer token-fake", "Content-Type": "application/json" });
    expect(corpo).toEqual({ refeicao: "cafe_manha", descricao: DESCRICAO, data_hora: new Date(DATA_LOCAL).toISOString() });
  });

  it("id preenchido: POST /alimentacao/idoso/<id>, id só no caminho, nunca no corpo", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 33 }));
    const user = userEvent.setup();
    render(<Alimentacao />);
    await preencherEEnviar(user, "7", "jantar");
    await screen.findByRole("status");
    const { url, corpo } = chamada();
    expect(url).toMatch(/\/alimentacao\/idoso\/7$/);
    expect(corpo).toEqual({ refeicao: "jantar", descricao: DESCRICAO, data_hora: new Date(DATA_LOCAL).toISOString() });
    expect(corpo).not.toHaveProperty("idoso_id");
  });

  it.each(OPCOES.map(([v]) => v))("refeição '%s' escolhida vai no corpo", async (valor) => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 1 }));
    const user = userEvent.setup();
    render(<Alimentacao />);
    await preencherEEnviar(user, "", valor);
    await screen.findByRole("status");
    expect(chamada().corpo.refeicao).toBe(valor);
  });

  it("201: sucesso em role=status com o id criado, sem alerta", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 41 }));
    const user = userEvent.setup();
    render(<Alimentacao />);
    await preencherEEnviar(user);
    expect(await screen.findByRole("status")).toHaveTextContent("Refeição registrada (id 41).");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each(MENSAGENS)("%i: mensagem fixa em role=alert, sem ecoar o corpo de erro do servidor", async (status, msg) => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(status, { error: ERRO_DO_SERVIDOR }));
    const user = userEvent.setup();
    render(<Alimentacao />);
    await preencherEEnviar(user);
    expect(await screen.findByRole("alert")).toHaveTextContent(msg);
    expect(screen.queryByText(new RegExp(ERRO_DO_SERVIDOR))).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("falha de rede: mensagem genérica fixa, sem ecoar o texto do erro", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error(ERRO_DO_SERVIDOR));
    const user = userEvent.setup();
    render(<Alimentacao />);
    await preencherEEnviar(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível registrar a refeição.");
    expect(screen.queryByText(new RegExp(ERRO_DO_SERVIDOR))).not.toBeInTheDocument();
  });

  it("carregando: botão desabilitado, aria-busy e texto 'Registrando...'", async () => {
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    render(<Alimentacao />);
    await preencherEEnviar(user);
    const botao = await screen.findByRole("button", { name: /registrando/i });
    expect(botao).toBeDisabled();
    expect(botao).toHaveAttribute("aria-busy", "true");
  });

  it("depois da resposta o botão volta ao normal", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 5 }));
    const user = userEvent.setup();
    render(<Alimentacao />);
    await preencherEEnviar(user);
    await screen.findByRole("status");
    const botao = campos().botao;
    expect(botao).toBeEnabled();
    expect(botao).toHaveAttribute("aria-busy", "false");
  });

  it("reenviar limpa o erro anterior (e o sucesso anterior)", async () => {
    const user = userEvent.setup();
    render(<Alimentacao />);
    (global.fetch as jest.Mock).mockResolvedValueOnce(respostaJson(403, {}));
    await preencherEEnviar(user);
    await screen.findByRole("alert");
    (global.fetch as jest.Mock).mockReturnValueOnce(new Promise(() => undefined));
    await user.click(campos().botao);
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("reenviar limpa o sucesso anterior", async () => {
    const user = userEvent.setup();
    render(<Alimentacao />);
    (global.fetch as jest.Mock).mockResolvedValueOnce(respostaJson(201, { id: 9 }));
    await preencherEEnviar(user);
    await screen.findByRole("status");
    (global.fetch as jest.Mock).mockReturnValueOnce(new Promise(() => undefined));
    await user.click(campos().botao);
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("nunca loga a descrição em console.*", async () => {
    const espioes = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    );
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(400, { error: ERRO_DO_SERVIDOR }));
    const user = userEvent.setup();
    render(<Alimentacao />);
    await preencherEEnviar(user);
    await screen.findByRole("alert");
    expect(JSON.stringify(espioes.map((s) => s.mock.calls))).not.toContain(DESCRICAO);
  });
});
