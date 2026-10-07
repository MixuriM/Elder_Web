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
// A página nunca usa chamarApi (força Content-Type JSON e repassa o corpo do erro): se usar, o teste do 7.2 falha.
const mockChamarApi = jest.fn();
jest.mock("../lib/chamarApi", () => ({
  chamarApi: (...args: unknown[]) => mockChamarApi(...args),
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
  mockChamarApi.mockReset();
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
    expect(await screen.findByRole("status")).toHaveTextContent("Refeição registrada (id 41).");
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

// Item 7.2 (RF-019): seção "Ver histórico alimentar". Lista plana na ordem recebida (o backend já ordena), data e
// hora em São Paulo. Todos os valores abaixo são obviamente falsos, só para teste.
const SENT_CORPO = "SENT_CORPO_ERRO_FALSO";

function regApi(id: number, refeicao: string, dataHora: string) {
  return {
    id,
    idoso_id: 7,
    registrado_por_id: 7,
    refeicao,
    descricao: `descricao-falsa-${id}`,
    data_hora: dataHora,
    editado_por_id: null,
    created_at: "2026-09-01T10:00:00.000Z",
    updated_at: "2026-09-01T10:00:00.000Z",
  };
}

// Fora de ordem cronológica de propósito: a seção não reordena.
const REGISTROS_API = [
  regApi(3, "almoco", "2026-10-05T12:00:00.000Z"),
  regApi(9, "ceia", "2099-12-31T23:59:59.987Z"),
  regApi(1, "cafe_manha", "2020-01-01T10:00:00.000Z"),
];

const MENSAGENS_HISTORICO: [number, string][] = [
  [400, "Id de idoso inválido."],
  [401, "Sessão expirada. Entre novamente."],
  [403, "Você não tem permissão para ver este histórico alimentar."],
  [404, "Não foi possível carregar o histórico alimentar."],
  [500, "Não foi possível carregar o histórico alimentar."],
  [503, "Não foi possível carregar o histórico alimentar."],
];

function verHistorico() {
  const regiao = screen.getByRole("region", { name: "Ver histórico alimentar" });
  return {
    regiao,
    campo: within(regiao).queryByLabelText("Idoso", { exact: true }),
    botao: within(regiao).getByRole("button", { name: /^ver histórico alimentar$/i }),
  };
}

async function pedirHistorico(user: ReturnType<typeof userEvent.setup>, idosoId = "") {
  if (idosoId) await user.selectOptions(verHistorico().campo as HTMLElement, idosoId);
  await user.click(verHistorico().botao);
}

describe("Alimentacao: seção Ver histórico alimentar (item 7.2)", () => {
  it("H1: a seção existe sempre, com heading, campo por label e botão; só busca ao enviar", () => {
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);
    const h = verHistorico();
    expect(within(h.regiao).getByRole("heading", { level: 2, name: "Ver histórico alimentar" })).toBeInTheDocument();
    expect(h.campo).not.toBeInTheDocument(); // perfil idoso: sem seletor
    expect(h.botao).toBeEnabled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("H2: perfil idoso (sem seletor) chama GET /alimentacao, com Authorization, sem Content-Type e sem corpo", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, { registros: [] }));
    const user = userEvent.setup();
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);
    await pedirHistorico(user);
    await within(verHistorico().regiao).findByText("Nenhuma refeição registrada.");
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(url)).toMatch(/\/alimentacao$/);
    expect(init.method).toBe("GET");
    expect(init.headers).toEqual({ Authorization: "Bearer token-fake" });
    expect(init.body).toBeUndefined();
  });

  it("H2: idoso escolhido no seletor chama GET /alimentacao/idoso/<id>, sem Content-Type", async () => {
    mockUseIdosos.mockReturnValue(listaDoisIdosos7);
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, { registros: [] }));
    const user = userEvent.setup();
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);
    await pedirHistorico(user, "7");
    await within(verHistorico().regiao).findByText("Nenhuma refeição registrada.");
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(url)).toMatch(/\/alimentacao\/idoso\/7$/);
    expect(init.headers).toEqual({ Authorization: "Bearer token-fake" });
  });

  it("H2: usa fetch direto, nunca chamarApi", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, { registros: REGISTROS_API }));
    const user = userEvent.setup();
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);
    await pedirHistorico(user);
    await within(verHistorico().regiao).findByText("descricao-falsa-3");
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(mockChamarApi).not.toHaveBeenCalled();
  });

  it("H3: itens na ordem recebida, cada um com rótulo em texto, <time dateTime> em ISO e a descrição", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, { registros: REGISTROS_API }));
    const user = userEvent.setup();
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);
    await pedirHistorico(user);
    const { regiao } = verHistorico();
    expect(await within(regiao).findByRole("status")).toHaveTextContent("3 registro(s) encontrado(s).");

    const itens = within(regiao).getAllByRole("listitem");
    expect(itens).toHaveLength(3);
    expect(itens.map((li) => within(li).getByText(/^descricao-falsa-/).textContent)).toEqual([
      "descricao-falsa-3",
      "descricao-falsa-9",
      "descricao-falsa-1",
    ]);

    const esperado = [
      ["Almoço", "2026-10-05T12:00:00.000Z", "05/10/2026 09:00"],
      ["Ceia", "2099-12-31T23:59:59.987Z", "31/12/2099 20:59"],
      ["Café da manhã", "2020-01-01T10:00:00.000Z", "01/01/2020 07:00"],
    ];
    itens.forEach((li, i) => {
      const [rotulo, iso, texto] = esperado[i];
      expect(within(li).getByText(rotulo)).toBeInTheDocument();
      const t = li.querySelector("time") as HTMLTimeElement;
      expect(t).not.toBeNull();
      expect(t).toHaveAttribute("datetime", iso);
      expect(t).toHaveTextContent(texto);
    });
    expect(within(regiao).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("H3: os 6 valores de refeição viram rótulo em português, em texto", async () => {
    const seis = ["cafe_manha", "lanche_manha", "almoco", "lanche_tarde", "jantar", "ceia"].map((r, i) =>
      regApi(i + 1, r, "2026-10-05T12:00:00.000Z"),
    );
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, { registros: seis }));
    const user = userEvent.setup();
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);
    await pedirHistorico(user);
    const { regiao } = verHistorico();
    await within(regiao).findByText("descricao-falsa-1");
    const itens = within(regiao).getAllByRole("listitem");
    expect(itens.map((li) => li.querySelector("strong")?.textContent)).toEqual(OPCOES.map(([, rotulo]) => rotulo));
  });

  it("H4: carregando: botão desabilitado com aria-busy, status de carregando, resultado anterior some", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(respostaJson(200, { registros: REGISTROS_API }));
    const user = userEvent.setup();
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);
    await pedirHistorico(user);
    await within(verHistorico().regiao).findByText("descricao-falsa-3");

    (global.fetch as jest.Mock).mockReturnValueOnce(new Promise(() => undefined));
    await user.click(verHistorico().botao);
    const regiao = screen.getByRole("region", { name: "Ver histórico alimentar" });
    const botao = within(regiao).getByRole("button", { name: /carregando/i });
    expect(botao).toBeDisabled();
    expect(botao).toHaveAttribute("aria-busy", "true");
    expect(within(regiao).getByRole("status")).toHaveTextContent("Carregando o histórico alimentar...");
    expect(within(regiao).queryByText("descricao-falsa-3")).not.toBeInTheDocument();
    expect(within(regiao).queryAllByRole("listitem")).toHaveLength(0);
  });

  it("H4: depois da resposta o botão volta ao normal", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, { registros: [] }));
    const user = userEvent.setup();
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);
    await pedirHistorico(user);
    await within(verHistorico().regiao).findByText("Nenhuma refeição registrada.");
    expect(verHistorico().botao).toBeEnabled();
    expect(verHistorico().botao).toHaveAttribute("aria-busy", "false");
  });

  it("H5: lista vazia mostra a mensagem fixa em role=status e nenhum item", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, { registros: [] }));
    const user = userEvent.setup();
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);
    await pedirHistorico(user);
    const { regiao } = verHistorico();
    expect(await within(regiao).findByRole("status")).toHaveTextContent("Nenhuma refeição registrada.");
    expect(within(regiao).queryAllByRole("listitem")).toHaveLength(0);
    expect(within(regiao).queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each(MENSAGENS_HISTORICO)("H6: erro %i vira mensagem fixa em role=alert, sem ecoar o corpo", async (status, mensagem) => {
    mockUseIdosos.mockReturnValue(listaDoisIdosos7);
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(status, { error: SENT_CORPO }));
    const user = userEvent.setup();
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);
    await pedirHistorico(user, "7");
    const { regiao } = verHistorico();
    expect(await within(regiao).findByRole("alert")).toHaveTextContent(mensagem);
    expect(document.body.textContent).not.toContain(SENT_CORPO);
    expect(within(regiao).queryByRole("status")).not.toBeInTheDocument();
  });

  it("H6: falha de rede vira a mensagem genérica, e a mensagem é limpa ao reenviar", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error(SENT_CORPO));
    const user = userEvent.setup();
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);
    await pedirHistorico(user);
    expect(await within(verHistorico().regiao).findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar o histórico alimentar.",
    );
    expect(document.body.textContent).not.toContain(SENT_CORPO);

    (global.fetch as jest.Mock).mockReturnValueOnce(new Promise(() => undefined));
    await user.click(verHistorico().botao);
    expect(within(screen.getByRole("region", { name: "Ver histórico alimentar" })).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("H6: erro limpo ao reenviar com sucesso", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(respostaJson(403, {}));
    const user = userEvent.setup();
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);
    await pedirHistorico(user);
    await within(verHistorico().regiao).findByRole("alert");
    (global.fetch as jest.Mock).mockResolvedValueOnce(respostaJson(200, { registros: REGISTROS_API }));
    await user.click(verHistorico().botao);
    await within(verHistorico().regiao).findByText("descricao-falsa-3");
    expect(within(verHistorico().regiao).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("H6: 200 sem a lista registros vira erro genérico, nunca tela vazia", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, { outra: 1 }));
    const user = userEvent.setup();
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);
    await pedirHistorico(user);
    expect(await within(verHistorico().regiao).findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar o histórico alimentar.",
    );
    expect(within(verHistorico().regiao).queryByRole("status")).not.toBeInTheDocument();
  });

  it.each([
    ["refeição desconhecida", regApi(1, "refeicao-sigilosa-falsa", "2026-10-05T12:00:00.000Z"), "refeicao-sigilosa-falsa"],
    ["data inválida", regApi(1, "almoco", "data-sigilosa-falsa"), "data-sigilosa-falsa"],
  ])("H7: %s (RangeError) vira 'Não foi possível exibir o histórico alimentar.' sem repetir o valor", async (_nome, reg, valor) => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, { registros: [reg] }));
    const user = userEvent.setup();
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);
    await pedirHistorico(user);
    const { regiao } = verHistorico();
    expect(await within(regiao).findByRole("alert")).toHaveTextContent("Não foi possível exibir o histórico alimentar.");
    expect(document.body.textContent).not.toContain(valor);
    expect(within(regiao).queryByRole("status")).not.toBeInTheDocument();
    expect(within(regiao).queryAllByRole("listitem")).toHaveLength(0);
  });

  it("H8: não loga descrição nem corpo em console.*", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, { registros: REGISTROS_API }));
    const espioes = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    );
    const user = userEvent.setup();
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);
    await pedirHistorico(user);
    await within(verHistorico().regiao).findByText("descricao-falsa-3");
    expect(JSON.stringify(espioes.flatMap((s) => s.mock.calls))).not.toContain("descricao-falsa");
  });

  it("H9: a seção de registro do 7.1 segue presente e registrar não recarrega a lista sozinho (D12)", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><Alimentacao /></MemoryRouter>);
    expect(screen.getByRole("heading", { level: 2, name: "Registrar refeição" })).toBeInTheDocument();
    (global.fetch as jest.Mock).mockResolvedValueOnce(respostaJson(200, { registros: [] }));
    await pedirHistorico(user);
    await within(verHistorico().regiao).findByText("Nenhuma refeição registrada.");

    (global.fetch as jest.Mock).mockResolvedValueOnce(respostaJson(201, { id: 50 }));
    await preencherEEnviar(user);
    expect(await screen.findByText("Refeição registrada (id 50).")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect((global.fetch as jest.Mock).mock.calls[1][1].method).toBe("POST");
    expect(within(verHistorico().regiao).getByRole("status")).toHaveTextContent("Nenhuma refeição registrada.");
  });
});
