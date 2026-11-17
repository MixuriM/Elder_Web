import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Alimentacao from "./Alimentacao";
import { listaDoisIdosos7, listaPerfilIdoso, listaSemIdosos, listaUmIdoso } from "../hooks/idososFixtures";

const mockUseIdosos = jest.fn();
jest.mock("../hooks/useIdososVinculados", () => ({
  useIdososVinculados: () => mockUseIdosos(),
}));

const mockGetCurrentUserToken = jest.fn();
jest.mock("../lib/auth", () => ({
  getCurrentUserToken: (...args: unknown[]) => mockGetCurrentUserToken(...args),
}));
// O histórico tem teste próprio (components/Alimentacao/HistoricoAlimentar.test.tsx). Aqui ele é um marcador: só
// importa a versão que a página passa a ele, que sobe a cada refeição registrada.
jest.mock("../components/Alimentacao/HistoricoAlimentar", () => ({
  __esModule: true,
  default: ({ versao = 0 }: { versao?: number }) => <section aria-label="Histórico alimentar" data-versao={versao} />,
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
  mockUseIdosos.mockReturnValue(listaPerfilIdoso);
  mockGetCurrentUserToken.mockReset();
  mockGetCurrentUserToken.mockResolvedValue("token-fake");
  global.fetch = jest.fn();
});
afterEach(() => jest.restoreAllMocks());

function seletorRegistrar() {
  return within(screen.getByRole("region", { name: "Registrar refeição" })).queryByLabelText("Idoso", { exact: true });
}

function campos() {
  return {
    refeicao: screen.getByLabelText("Refeição", { exact: true }) as HTMLSelectElement,
    descricao: screen.getByLabelText("Descrição", { exact: true }),
    dataHora: screen.getByLabelText("Data e hora", { exact: true }),
    botao: screen.getByRole("button", { name: /^registrar refeição$/i }),
  };
}

async function preencherEEnviar(user: ReturnType<typeof userEvent.setup>, idosoId = "", refeicao?: string) {
  const c = campos();
  if (idosoId) await user.selectOptions(seletorRegistrar() as HTMLElement, idosoId);
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
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);
    expect(screen.getByRole("heading", { level: 1, name: "Alimentação" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Registrar refeição" })).toBeInTheDocument();
    Object.values(campos()).forEach((el) => expect(el).toBeInTheDocument());
  });

  it("select de refeição tem exatamente os 6 valores do backend, com rótulos em português", () => {
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);
    const opcoes = Array.from(campos().refeicao.options).map((o) => [o.value, o.textContent]);
    expect(opcoes).toEqual(OPCOES);
  });

  it("descrição é textarea com maxLength 500; descrição e data e hora são obrigatórias", () => {
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);
    const c = campos();
    expect(c.descricao.tagName).toBe("TEXTAREA");
    expect(c.descricao).toHaveAttribute("maxLength", "500");
    expect(c.descricao).toBeRequired();
    expect(c.dataHora).toHaveAttribute("type", "datetime-local");
    expect(c.dataHora).toBeRequired();
    // Perfil idoso não tem seletor (usa o endpoint sem ID).
    expect(seletorRegistrar()).not.toBeInTheDocument();
  });

  it("cuidador ou familiar: seletor de idoso obrigatório, sem campo de ID digitável", () => {
    mockUseIdosos.mockReturnValue(listaDoisIdosos7);
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);
    const seletor = seletorRegistrar() as HTMLElement;
    expect(seletor.tagName).toBe("SELECT");
    expect(seletor).toBeRequired();
    expect(screen.queryByLabelText(/id do idoso/i)).not.toBeInTheDocument();
  });

  it("escrita com 2+ idosos: sem pré-seleção e envio desabilitado até escolher; 1 idoso vem pré-selecionado", async () => {
    mockUseIdosos.mockReturnValue(listaDoisIdosos7);
    const user = userEvent.setup();
    const { unmount } = render(<MemoryRouter><Alimentacao /></MemoryRouter>);
    expect(seletorRegistrar()).toHaveValue("");
    expect(campos().botao).toBeDisabled();
    await user.selectOptions(seletorRegistrar() as HTMLElement, "9");
    expect(campos().botao).toBeEnabled();
    unmount();

    mockUseIdosos.mockReturnValue(listaUmIdoso);
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);
    expect(seletorRegistrar()).toHaveValue("7");
    expect(campos().botao).toBeEnabled();
  });

  it("0 idosos: orienta a solicitar vínculo e desabilita o registro", () => {
    mockUseIdosos.mockReturnValue(listaSemIdosos);
    render(
      <MemoryRouter>
        <Alimentacao />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole("link", { name: /solicite um vínculo/i }).length).toBeGreaterThan(0);
    expect(campos().botao).toBeDisabled();
  });

  it("perfil idoso (sem seletor): POST /alimentacao, Authorization e Content-Type JSON, corpo exato com data via toISOString", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 31 }));
    const user = userEvent.setup();
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);
    await preencherEEnviar(user);
    await screen.findByRole("status");
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const { url, init, corpo } = chamada();
    expect(url).toMatch(/\/alimentacao$/);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ Authorization: "Bearer token-fake", "Content-Type": "application/json" });
    expect(corpo).toEqual({ refeicao: "cafe_manha", descricao: DESCRICAO, data_hora: new Date(DATA_LOCAL).toISOString() });
  });

  it("idoso escolhido no seletor: POST /alimentacao/idoso/<id>, id só no caminho, nunca no corpo", async () => {
    mockUseIdosos.mockReturnValue(listaDoisIdosos7);
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 33 }));
    const user = userEvent.setup();
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);
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
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);
    await preencherEEnviar(user, "", valor);
    await screen.findByRole("status");
    expect(chamada().corpo.refeicao).toBe(valor);
  });

  it("201: sucesso em role=status com o id criado, sem alerta", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 41 }));
    const user = userEvent.setup();
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);
    await preencherEEnviar(user);
    expect(await screen.findByRole("status")).toHaveTextContent(/^Refeição registrada.$/);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each(MENSAGENS)("%i: mensagem fixa em role=alert, sem ecoar o corpo de erro do servidor", async (status, msg) => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(status, { error: ERRO_DO_SERVIDOR }));
    const user = userEvent.setup();
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);
    await preencherEEnviar(user);
    expect(await screen.findByRole("alert")).toHaveTextContent(msg);
    expect(screen.queryByText(new RegExp(ERRO_DO_SERVIDOR))).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("falha de rede: mensagem genérica fixa, sem ecoar o texto do erro", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error(ERRO_DO_SERVIDOR));
    const user = userEvent.setup();
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);
    await preencherEEnviar(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível registrar a refeição.");
    expect(screen.queryByText(new RegExp(ERRO_DO_SERVIDOR))).not.toBeInTheDocument();
  });

  it("carregando: botão desabilitado, aria-busy e texto 'Registrando...'", async () => {
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);
    await preencherEEnviar(user);
    const botao = await screen.findByRole("button", { name: /registrando/i });
    expect(botao).toBeDisabled();
    expect(botao).toHaveAttribute("aria-busy", "true");
  });

  it("depois da resposta o botão volta ao normal", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 5 }));
    const user = userEvent.setup();
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);
    await preencherEEnviar(user);
    await screen.findByRole("status");
    const botao = campos().botao;
    expect(botao).toBeEnabled();
    expect(botao).toHaveAttribute("aria-busy", "false");
  });

  it("reenviar limpa o erro anterior (e o sucesso anterior)", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);
    (global.fetch as jest.Mock).mockResolvedValueOnce(respostaJson(403, {}));
    await preencherEEnviar(user);
    await screen.findByRole("alert");
    (global.fetch as jest.Mock).mockReturnValueOnce(new Promise(() => undefined));
    await user.click(campos().botao);
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("reenviar limpa o sucesso anterior", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);
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
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);
    await preencherEEnviar(user);
    await screen.findByRole("alert");
    expect(JSON.stringify(espioes.map((s) => s.mock.calls))).not.toContain(DESCRICAO);
  });
});

describe("Alimentacao: histórico na página (item 7.2 e Fase 11)", () => {
  it("mostra o histórico sem o botão antigo; o carregamento é do próprio componente", () => {
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);

    expect(screen.getByRole("region", { name: "Histórico alimentar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ver histórico alimentar/i })).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("depois de registrar uma refeição, o histórico recebe uma versão nova (recarrega sozinho)", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 31 }));
    const user = userEvent.setup();
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);
    const historico = screen.getByRole("region", { name: "Histórico alimentar" });
    expect(historico).toHaveAttribute("data-versao", "0");

    await preencherEEnviar(user);
    await screen.findByText("Refeição registrada.");

    expect(historico).toHaveAttribute("data-versao", "1");
  });

  it("registro com erro não recarrega o histórico", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(403, {}));
    const user = userEvent.setup();
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);

    await preencherEEnviar(user);
    await screen.findByRole("alert");

    expect(screen.getByRole("region", { name: "Histórico alimentar" })).toHaveAttribute("data-versao", "0");
  });
});
