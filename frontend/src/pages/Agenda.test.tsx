import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Agenda from "./Agenda";
import { listaDoisIdosos7, listaPerfilIdoso, listaSemIdosos, listaUmIdoso } from "../hooks/idososFixtures";

function renderAgenda() {
  return render(
    <MemoryRouter>
      <Agenda />
    </MemoryRouter>,
  );
}

const mockUseIdosos = jest.fn();
jest.mock("../hooks/useIdososVinculados", () => ({
  useIdososVinculados: () => mockUseIdosos(),
}));

const mockGetCurrentUserToken = jest.fn();
jest.mock("../lib/auth", () => ({
  getCurrentUserToken: (...args: unknown[]) => mockGetCurrentUserToken(...args),
}));

function respostaJson(status: number, corpo: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(corpo) } as Response;
}

// Itens 6.1 (RF-015) e 6.2 (RF-016): esqueleto cru da página /agenda, só para exercitar POST /agenda e
// POST /agenda/idoso/:idosoId (familiar e cuidador). Valores abaixo são obviamente falsos, só para teste.
const TITULO = "compromisso-falso-sigiloso";
const INICIO_LOCAL = "2026-10-10T09:00";
const FIM_LOCAL = "2026-10-10T10:30";

beforeEach(() => {
  mockUseIdosos.mockReturnValue(listaUmIdoso);
  mockGetCurrentUserToken.mockReset();
  mockGetCurrentUserToken.mockResolvedValue("token-fake");
  global.fetch = jest.fn();
});
afterEach(() => jest.restoreAllMocks());

function regiaoDe(nome: string) {
  return within(screen.getByRole("region", { name: nome }));
}

const REGIAO = {
  idoso: "Criar compromisso",
  familiar: "Criar compromisso para um idoso vinculado",
  cuidador: "Criar compromisso de cuidado",
} as const;

// Rótulos sem o papel: cada campo é buscado dentro da seção (região) do seu formulário.
function secao(sufixo: "idoso" | "familiar") {
  const r = regiaoDe(REGIAO[sufixo]);
  return {
    idosoId: sufixo === "familiar" ? r.getByLabelText("Idoso", { exact: true }) : null,
    tipo: r.getByLabelText("Tipo", { exact: true }) as HTMLSelectElement,
    titulo: r.getByLabelText("Título", { exact: true }),
    descricao: r.getByLabelText("Descrição (opcional)", { exact: true }),
    inicio: r.getByLabelText("Início", { exact: true }),
    fim: r.getByLabelText("Fim (opcional)", { exact: true }),
    botao: r.getByRole("button", { name: /^criar compromisso$/i }),
  };
}

async function preencher(c: ReturnType<typeof secao>, user: ReturnType<typeof userEvent.setup>, titulo = "Consulta Ficticia") {
  if (c.idosoId) await user.selectOptions(c.idosoId, "7");
  await user.type(c.titulo, titulo);
  fireEvent.change(c.inicio, { target: { value: INICIO_LOCAL } });
}

function chamada(i = 0) {
  const [url, init] = (global.fetch as jest.Mock).mock.calls[i];
  return { url: String(url), init, corpo: JSON.parse(init.body) };
}

describe("Agenda (item 6.1)", () => {
  it("renderiza os dois formulários com todos os campos acessíveis por label", () => {
    renderAgenda();
    expect(screen.getByRole("heading", { name: "Criar compromisso" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Criar compromisso para um idoso vinculado" })).toBeInTheDocument();
    for (const s of ["idoso", "familiar"] as const) {
      Object.values(secao(s)).forEach((el) => el && expect(el).toBeInTheDocument());
    }
  });

  it.each(["idoso", "familiar"] as const)("select de tipo (%s) só tem Pessoal e Médico, sem 'cuidado'", (sufixo) => {
    renderAgenda();
    const opcoes = Array.from(secao(sufixo).tipo.options).map((o) => [o.value, o.textContent]);
    expect(opcoes).toEqual([
      ["pessoal", "Pessoal"],
      ["medico", "Médico"],
    ]);
    expect(screen.queryByRole("option", { name: /cuidado/i })).not.toBeInTheDocument();
  });

  it("campos trazem maxLength 150 (título) e 500 (descrição)", () => {
    renderAgenda();
    const c = secao("idoso");
    expect(c.titulo).toHaveAttribute("maxLength", "150");
    expect(c.descricao).toHaveAttribute("maxLength", "500");
  });

  it("idoso: POST /agenda com Authorization, início via toISOString e fim vazio omitido", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 31 }));
    const user = userEvent.setup();
    renderAgenda();
    const c = secao("idoso");
    await preencher(c, user);
    await user.click(c.botao);
    await screen.findByRole("status");
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const { url, init, corpo } = chamada();
    expect(url).toMatch(/\/agenda$/);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer token-fake");
    expect(corpo).toEqual({
      tipo_evento: "pessoal",
      titulo: "Consulta Ficticia",
      data_hora_inicio: new Date(INICIO_LOCAL).toISOString(),
    });
    expect(corpo).not.toHaveProperty("data_hora_fim");
    expect(corpo).not.toHaveProperty("descricao");
  });

  it("idoso: tipo médico, descrição e fim preenchidos vão no corpo, fim via toISOString", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 32 }));
    const user = userEvent.setup();
    renderAgenda();
    const c = secao("idoso");
    await preencher(c, user);
    await user.selectOptions(c.tipo, "medico");
    await user.type(c.descricao, "Levar exames");
    fireEvent.change(c.fim, { target: { value: FIM_LOCAL } });
    await user.click(c.botao);
    await screen.findByRole("status");
    expect(chamada().corpo).toEqual({
      tipo_evento: "medico",
      titulo: "Consulta Ficticia",
      descricao: "Levar exames",
      data_hora_inicio: new Date(INICIO_LOCAL).toISOString(),
      data_hora_fim: new Date(FIM_LOCAL).toISOString(),
    });
  });

  it("familiar: POST /agenda/idoso/<id> com o id digitado no caminho, nunca no corpo", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 33 }));
    const user = userEvent.setup();
    renderAgenda();
    const c = secao("familiar");
    await preencher(c, user);
    await user.click(c.botao);
    await screen.findByRole("status");
    const { url, init, corpo } = chamada();
    expect(url).toMatch(/\/agenda\/idoso\/7$/);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer token-fake");
    expect(corpo).not.toHaveProperty("idoso_id");
    expect(corpo.tipo_evento).toBe("pessoal");
  });

  it("sucesso em role=status com o id criado", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 41 }));
    const user = userEvent.setup();
    renderAgenda();
    const c = secao("idoso");
    await preencher(c, user);
    await user.click(c.botao);
    expect(await screen.findByRole("status")).toHaveTextContent(/^Compromisso criado.$/);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([400, 403, 500])("erro %i em role=alert com a mensagem do servidor", async (status) => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(status, { error: "Mensagem de erro de teste." }));
    const user = userEvent.setup();
    renderAgenda();
    const c = secao("familiar");
    await preencher(c, user);
    await user.click(c.botao);
    expect(await screen.findByRole("alert")).toHaveTextContent("Mensagem de erro de teste.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it.each(["idoso", "familiar"] as const)("durante o envio (%s): botão desabilitado e aria-busy", async (sufixo) => {
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    renderAgenda();
    const c = secao(sufixo);
    await preencher(c, user);
    await user.click(c.botao);
    const ocupado = await screen.findByRole("button", { name: /criando/i });
    expect(ocupado).toBeDisabled();
    expect(ocupado).toHaveAttribute("aria-busy", "true");
  });

  it("limpa a mensagem anterior ao reenviar", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(respostaJson(400, { error: "Mensagem de erro de teste." }))
      .mockReturnValueOnce(new Promise(() => undefined));
    const user = userEvent.setup();
    renderAgenda();
    const c = secao("idoso");
    await preencher(c, user);
    await user.click(c.botao);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await user.click(c.botao);
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("limpa o sucesso anterior ao reenviar", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(respostaJson(201, { id: 5 }))
      .mockReturnValueOnce(new Promise(() => undefined));
    const user = userEvent.setup();
    renderAgenda();
    const c = secao("idoso");
    await preencher(c, user);
    await user.click(c.botao);
    expect(await screen.findByRole("status")).toBeInTheDocument();
    // Depois do sucesso o formulário fica limpo: preenche de novo para reenviar.
    await preencher(c, user);
    await user.click(c.botao);
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("nunca loga o título nem o corpo enviado, nem no erro", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(400, { error: "Mensagem de erro de teste." }));
    const espioes = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    );
    const user = userEvent.setup();
    renderAgenda();
    const c = secao("idoso");
    await preencher(c, user, TITULO);
    await user.click(c.botao);
    await screen.findByRole("alert");
    expect(JSON.stringify(espioes.flatMap((s) => s.mock.calls))).not.toContain(TITULO);
  });
});

describe("Agenda: compromisso de cuidado do cuidador (item 6.2)", () => {
  function secaoCuidador() {
    const r = regiaoDe(REGIAO.cuidador);
    return {
      idosoId: r.getByLabelText("Idoso", { exact: true }),
      titulo: r.getByLabelText("Título", { exact: true }),
      descricao: r.getByLabelText("Descrição (opcional)", { exact: true }),
      inicio: r.getByLabelText("Início", { exact: true }),
      fim: r.getByLabelText("Fim (opcional)", { exact: true }),
      botao: r.getByRole("button", { name: /^criar compromisso$/i }),
    };
  }

  async function preencherCuidador(c: ReturnType<typeof secaoCuidador>, user: ReturnType<typeof userEvent.setup>) {
    await user.selectOptions(c.idosoId, "7");
    await user.type(c.titulo, "Banho Ficticio");
    fireEvent.change(c.inicio, { target: { value: INICIO_LOCAL } });
  }

  it("renderiza o título da seção e os campos acessíveis por label, sem select de tipo", () => {
    renderAgenda();
    expect(screen.getByRole("heading", { name: "Criar compromisso de cuidado" })).toBeInTheDocument();
    Object.values(secaoCuidador()).forEach((el) => expect(el).toBeInTheDocument());
    expect(screen.queryByLabelText(/Tipo \(cuidador\)/)).not.toBeInTheDocument();
    // Só as duas seções antigas têm select de tipo (os demais comboboxes são seletores de idoso).
    expect(screen.getAllByRole("combobox", { name: /^Tipo/ })).toHaveLength(2);
  });

  it("campos trazem maxLength 150 (título) e 500 (descrição)", () => {
    renderAgenda();
    const c = secaoCuidador();
    expect(c.titulo).toHaveAttribute("maxLength", "150");
    expect(c.descricao).toHaveAttribute("maxLength", "500");
  });

  it("POST /agenda/idoso/<id> com tipo_evento 'cuidado' fixo, datas em ISO UTC com Z, id só no caminho", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 51 }));
    const user = userEvent.setup();
    renderAgenda();
    const c = secaoCuidador();
    await preencherCuidador(c, user);
    await user.type(c.descricao, "Trocar curativo");
    fireEvent.change(c.fim, { target: { value: FIM_LOCAL } });
    await user.click(c.botao);
    await screen.findByRole("status");
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const { url, init, corpo } = chamada();
    expect(url).toMatch(/\/agenda\/idoso\/7$/);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer token-fake");
    expect(corpo).toEqual({
      tipo_evento: "cuidado",
      titulo: "Banho Ficticio",
      descricao: "Trocar curativo",
      data_hora_inicio: new Date(INICIO_LOCAL).toISOString(),
      data_hora_fim: new Date(FIM_LOCAL).toISOString(),
    });
    expect(corpo.data_hora_inicio).toMatch(/Z$/);
    expect(corpo.data_hora_fim).toMatch(/Z$/);
    expect(corpo).not.toHaveProperty("idoso_id");
  });

  it("opcionais em branco não vão no corpo", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 52 }));
    const user = userEvent.setup();
    renderAgenda();
    const c = secaoCuidador();
    await preencherCuidador(c, user);
    await user.click(c.botao);
    await screen.findByRole("status");
    expect(chamada().corpo).toEqual({
      tipo_evento: "cuidado",
      titulo: "Banho Ficticio",
      data_hora_inicio: new Date(INICIO_LOCAL).toISOString(),
    });
  });

  it("sucesso em role=status com o id criado", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 53 }));
    const user = userEvent.setup();
    renderAgenda();
    const c = secaoCuidador();
    await preencherCuidador(c, user);
    await user.click(c.botao);
    expect(await screen.findByRole("status")).toHaveTextContent(/^Compromisso criado.$/);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([400, 403, 500])("erro %i em role=alert com a mensagem do servidor", async (status) => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(status, { error: "Mensagem de erro de teste." }));
    const user = userEvent.setup();
    renderAgenda();
    const c = secaoCuidador();
    await preencherCuidador(c, user);
    await user.click(c.botao);
    expect(await screen.findByRole("alert")).toHaveTextContent("Mensagem de erro de teste.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("durante o envio: botão desabilitado e aria-busy", async () => {
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    renderAgenda();
    const c = secaoCuidador();
    await preencherCuidador(c, user);
    await user.click(c.botao);
    const ocupado = await screen.findByRole("button", { name: /criando/i });
    expect(ocupado).toBeDisabled();
    expect(ocupado).toHaveAttribute("aria-busy", "true");
  });

  it("limpa o erro anterior e o sucesso anterior ao reenviar", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(respostaJson(403, { error: "Mensagem de erro de teste." }))
      .mockResolvedValueOnce(respostaJson(201, { id: 54 }))
      .mockReturnValueOnce(new Promise(() => undefined));
    const user = userEvent.setup();
    renderAgenda();
    const c = secaoCuidador();
    await preencherCuidador(c, user);
    await user.click(c.botao);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await user.click(c.botao);
    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // Depois do sucesso o formulário fica limpo: preenche de novo para reenviar.
    await preencherCuidador(c, user);
    await user.click(c.botao);
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("nunca loga o título nem o corpo enviado, nem no erro 403", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(403, { error: "Mensagem de erro de teste." }));
    const espioes = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    );
    const user = userEvent.setup();
    renderAgenda();
    const c = secaoCuidador();
    await user.selectOptions(c.idosoId, "7");
    await user.type(c.titulo, TITULO);
    fireEvent.change(c.inicio, { target: { value: INICIO_LOCAL } });
    await user.click(c.botao);
    await screen.findByRole("alert");
    expect(JSON.stringify(espioes.flatMap((s) => s.mock.calls))).not.toContain(TITULO);
  });
});

// Item 6.3 (RF-017, RNF-003): seção "Ver agenda". Fuso fixo de São Paulo; "agora" fixado com relógio falso (só Date,
// para não travar userEvent/waitFor). Todos os valores são obviamente falsos.
const AGORA = new Date("2026-10-05T15:00:00.000Z"); // 12:00 de segunda 05/10/2026 em São Paulo
const SENT_CORPO = "SENT_CORPO_ERRO_FALSO";

function evApi(id: number, tipo: string, inicio: string, fim: string | null = null, descricao: string | null = null) {
  return {
    id,
    idoso_id: 7,
    criado_por_id: 7,
    tipo_evento: tipo,
    titulo: `titulo-falso-${id}`,
    descricao,
    data_hora_inicio: inicio,
    data_hora_fim: fim,
    editado_por_id: null,
    created_at: "2026-09-01T10:00:00.000Z",
    updated_at: "2026-09-01T10:00:00.000Z",
  };
}

const EVENTOS_API = [
  evApi(4, "cuidado", "2026-10-08T15:00:00.000Z"),
  evApi(1, "pessoal", "2026-10-03T12:00:00.000Z"), // passado (03/10)
  evApi(3, "pessoal", "2026-10-06T02:00:00.000Z", "2026-10-06T05:00:00.000Z"), // 23:00 a 02:00, dia 05/10
  evApi(2, "medico", "2026-10-05T12:00:00.000Z", "2026-10-05T13:30:00.000Z", "descricao-falsa-2"),
];

function relogioFalso() {
  jest.useFakeTimers({
    now: AGORA,
    doNotFake: [
      "hrtime", "nextTick", "performance", "queueMicrotask", "requestAnimationFrame", "cancelAnimationFrame",
      "requestIdleCallback", "cancelIdleCallback", "setImmediate", "clearImmediate", "setInterval", "clearInterval",
      "setTimeout", "clearTimeout",
    ],
  });
}

function verAgenda() {
  const regiao = screen.getByRole("region", { name: "Ver agenda" });
  return {
    regiao,
    campo: within(regiao).queryByLabelText("Idoso", { exact: true }),
    botao: within(regiao).getByRole("button", { name: /^ver agenda$/i }),
  };
}

describe("Agenda: seção Ver agenda (item 6.3)", () => {
  afterEach(() => jest.useRealTimers());

  it("C1: a seção existe sempre, sem depender de vínculo, permissão ou modo_decisao", () => {
    renderAgenda();
    const v = verAgenda();
    expect(within(v.regiao).getByRole("heading", { name: "Ver agenda" })).toBeInTheDocument();
    expect(v.campo).toBeInTheDocument();
    expect(v.botao).toBeEnabled();
    expect(global.fetch).not.toHaveBeenCalled(); // só busca ao enviar
  });

  it("C2: perfil idoso, sem seletor, chama GET /agenda, com Authorization e sem Content-Type", async () => {
    mockUseIdosos.mockReturnValue(listaPerfilIdoso);
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, { eventos: [] }));
    const user = userEvent.setup();
    renderAgenda();
    expect(verAgenda().campo).not.toBeInTheDocument();
    await user.click(verAgenda().botao);
    await screen.findByText("Nenhum compromisso na agenda.");
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(url)).toMatch(/\/agenda$/);
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer token-fake");
    expect(init.headers["Content-Type"]).toBeUndefined();
    expect(init.body).toBeUndefined();
  });

  it("C2: idoso escolhido no seletor chama GET /agenda/idoso/<id>", async () => {
    mockUseIdosos.mockReturnValue(listaDoisIdosos7);
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, { eventos: [] }));
    const user = userEvent.setup();
    renderAgenda();
    await user.selectOptions(verAgenda().campo as HTMLElement, "9");
    await user.click(verAgenda().botao);
    await screen.findByText("Nenhum compromisso na agenda.");
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(url)).toMatch(/\/agenda\/idoso\/9$/);
    expect(init.headers.Authorization).toBe("Bearer token-fake");
    expect(init.headers["Content-Type"]).toBeUndefined();
  });

  it("C3: dias na ordem certa, (hoje), passados em details fechado, tipo em texto, time dateTime, título e descrição", async () => {
    relogioFalso();
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, { eventos: EVENTOS_API }));
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderAgenda();
    await user.click(verAgenda().botao);
    const { regiao } = verAgenda();
    expect(await within(regiao).findByRole("status")).toHaveTextContent("4 compromisso(s)");

    const dias = within(regiao).getAllByRole("heading", { level: 3 }).map((h) => h.textContent ?? "");
    expect(dias).toHaveLength(3);
    expect(dias[0]).toContain("03/10/2026");
    expect(dias[1]).toContain("05/10/2026");
    expect(dias[1]).toContain("(hoje)");
    expect(dias[2]).toContain("08/10/2026");
    expect(dias.filter((d) => d.includes("(hoje)"))).toHaveLength(1);

    // Passado dentro de <details> fechado; hoje e futuro fora dele.
    const detalhes = regiao.querySelector("details") as HTMLDetailsElement;
    expect(detalhes).not.toBeNull();
    expect(detalhes.open).toBe(false);
    expect(within(detalhes).getByText("Compromissos anteriores")).toBeInTheDocument();
    expect(within(detalhes).getByText("titulo-falso-1")).toBeInTheDocument();
    expect(within(detalhes).queryByText("titulo-falso-2")).not.toBeInTheDocument();
    expect(within(detalhes).queryByText("titulo-falso-4")).not.toBeInTheDocument();

    // Evento 23:00 a 02:00 aparece uma única vez, no dia do início, com a data do fim.
    expect(within(regiao).getAllByText("titulo-falso-3")).toHaveLength(1);
    const item3 = within(regiao).getByText("titulo-falso-3").closest("li") as HTMLElement;
    expect(item3).toHaveTextContent("23:00 até 06/10/2026 02:00");
    expect(item3.closest("section")).toHaveTextContent("05/10/2026");

    // Tipo em texto, <time dateTime>, título e descrição.
    const item2 = within(regiao).getByText("titulo-falso-2").closest("li") as HTMLElement;
    expect(item2).toHaveTextContent("Médico");
    expect(item2).toHaveTextContent("descricao-falsa-2");
    const t = item2.querySelector("time") as HTMLTimeElement;
    expect(t).toHaveAttribute("datetime", "2026-10-05T12:00:00.000Z");
    expect(t).toHaveTextContent("09:00 às 10:30");
    expect(within(regiao).getByText("titulo-falso-4").closest("li")).toHaveTextContent("Cuidado");
    expect(item3).toHaveTextContent("Pessoal");
    // Cada dia é uma section com heading e ul.
    for (const h of within(regiao).getAllByRole("heading", { level: 3 })) {
      const sec = h.closest("section") as HTMLElement;
      expect(sec.querySelector("ul")).not.toBeNull();
    }
  });

  it("C4: carregando em aria-busy com o botão desabilitado; resultado anterior some ao reenviar", async () => {
    relogioFalso();
    (global.fetch as jest.Mock).mockResolvedValueOnce(respostaJson(200, { eventos: EVENTOS_API }));
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderAgenda();
    await user.click(verAgenda().botao);
    await screen.findByText("titulo-falso-2");

    (global.fetch as jest.Mock).mockReturnValueOnce(new Promise(() => undefined));
    await user.click(verAgenda().botao);
    const regiao = screen.getByRole("region", { name: "Ver agenda" });
    const botao = within(regiao).getByRole("button", { name: /carregando/i });
    expect(botao).toBeDisabled();
    expect(botao).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("titulo-falso-2")).not.toBeInTheDocument();
    expect(within(regiao).queryByRole("status")).not.toBeInTheDocument();
  });

  it("C4: lista vazia mostra a mensagem fixa e nenhum dia", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, { eventos: [] }));
    const user = userEvent.setup();
    renderAgenda();
    await user.click(verAgenda().botao);
    expect(await screen.findByText("Nenhum compromisso na agenda.")).toBeInTheDocument();
    expect(within(verAgenda().regiao).queryAllByRole("heading", { level: 3 })).toHaveLength(0);
  });

  it.each([
    [400, "Id de idoso inválido."],
    [401, "Sessão expirada. Entre novamente."],
    [403, "Você não tem permissão para ver esta agenda."],
    [500, "Não foi possível carregar a agenda."],
    [404, "Não foi possível carregar a agenda."],
  ])("C4: erro %i vira mensagem fixa em role=alert, sem ecoar o corpo", async (status, mensagem) => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(status, { error: SENT_CORPO }));
    const user = userEvent.setup();
    renderAgenda();
    await user.click(verAgenda().botao);
    const alerta = await within(verAgenda().regiao).findByRole("alert");
    expect(alerta).toHaveTextContent(mensagem);
    expect(document.body.textContent).not.toContain(SENT_CORPO);
  });

  it("C4: falha de rede vira a mensagem genérica e a mensagem anterior é limpa ao reenviar", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error(SENT_CORPO));
    const user = userEvent.setup();
    renderAgenda();
    await user.click(verAgenda().botao);
    expect(await within(verAgenda().regiao).findByRole("alert")).toHaveTextContent("Não foi possível carregar a agenda.");
    expect(document.body.textContent).not.toContain(SENT_CORPO);

    (global.fetch as jest.Mock).mockReturnValueOnce(new Promise(() => undefined));
    await user.click(verAgenda().botao);
    expect(within(screen.getByRole("region", { name: "Ver agenda" })).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("C4: 200 sem a lista eventos vira erro genérico, nunca tela vazia", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, { outra: 1 }));
    const user = userEvent.setup();
    renderAgenda();
    await user.click(verAgenda().botao);
    expect(await within(verAgenda().regiao).findByRole("alert")).toHaveTextContent("Não foi possível carregar a agenda.");
  });

  it("C4: data inválida (RangeError) vira 'Não foi possível exibir a agenda.' sem repetir o valor", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      respostaJson(200, { eventos: [evApi(1, "medico", "data-sigilosa-falsa")] }),
    );
    const user = userEvent.setup();
    renderAgenda();
    await user.click(verAgenda().botao);
    const alerta = await within(verAgenda().regiao).findByRole("alert");
    expect(alerta).toHaveTextContent("Não foi possível exibir a agenda.");
    expect(document.body.textContent).not.toContain("data-sigilosa-falsa");
    expect(within(verAgenda().regiao).queryByRole("status")).not.toBeInTheDocument();
  });

  it("não loga título, descrição nem corpo em console.*", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, { eventos: EVENTOS_API }));
    const espioes = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    );
    const user = userEvent.setup();
    renderAgenda();
    await user.click(verAgenda().botao);
    await screen.findByText("titulo-falso-2");
    const logado = JSON.stringify(espioes.flatMap((s) => s.mock.calls));
    expect(logado).not.toContain("titulo-falso");
    expect(logado).not.toContain("descricao-falsa");
  });

  it("C5: as seções de criação seguem presentes", () => {
    renderAgenda();
    expect(screen.getByRole("heading", { name: "Criar compromisso" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Criar compromisso de cuidado" })).toBeInTheDocument();
  });
});

describe("Agenda: seletor de idoso", () => {
  it("escrita com 2+ idosos: sem pré-seleção, envio desabilitado até escolher, id escolhido vai no caminho", async () => {
    mockUseIdosos.mockReturnValue(listaDoisIdosos7);
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 61 }));
    const user = userEvent.setup();
    renderAgenda();
    const c = secao("familiar");
    expect(c.idosoId).toHaveValue("");
    expect(within(c.idosoId as HTMLElement).getByRole("option", { name: "Selecione o idoso" })).toBeInTheDocument();
    expect(c.botao).toBeDisabled();
    await user.type(c.titulo, "Consulta Ficticia");
    fireEvent.change(c.inicio, { target: { value: INICIO_LOCAL } });
    expect(c.botao).toBeDisabled();
    await user.selectOptions(c.idosoId as HTMLElement, "9");
    expect(c.botao).toBeEnabled();
    await user.click(c.botao);
    await screen.findByRole("status");
    expect(chamada().url).toMatch(/\/agenda\/idoso\/9$/);
  });

  it("1 idoso: vem pré-selecionado nas seções de escrita", () => {
    renderAgenda();
    expect(secao("familiar").idosoId).toHaveValue("7");
    expect(regiaoDe("Criar compromisso de cuidado").getByLabelText("Idoso")).toHaveValue("7");
  });

  it("0 idosos: orienta a solicitar vínculo e desabilita o envio", () => {
    mockUseIdosos.mockReturnValue(listaSemIdosos);
    renderAgenda();
    expect(screen.getAllByRole("link", { name: /solicite um vínculo/i }).length).toBeGreaterThan(0);
    expect(regiaoDe(REGIAO.familiar).getByRole("button", { name: /^criar compromisso$/i })).toBeDisabled();
    expect(verAgenda().botao).toBeDisabled();
  });

  it("perfil idoso: seções de terceiros (familiar e cuidador) não renderizam; criar o próprio compromisso continua", () => {
    mockUseIdosos.mockReturnValue(listaPerfilIdoso);
    renderAgenda();
    expect(screen.queryByRole("heading", { name: "Criar compromisso para um idoso vinculado" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Criar compromisso de cuidado" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Criar compromisso" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ver agenda" })).toBeInTheDocument();
  });
});

describe("Agenda: ver como Calendário ou Lista", () => {
  function telaLarga(larga: boolean) {
    window.matchMedia = ((q: string) => ({ matches: q.includes("min-width") ? larga : false })) as unknown as typeof window.matchMedia;
  }
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    jest.useRealTimers();
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  async function carregar(larga: boolean) {
    relogioFalso();
    telaLarga(larga);
    mockUseIdosos.mockReturnValue(listaPerfilIdoso);
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, { eventos: EVENTOS_API }));
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderAgenda();
    expect(screen.queryByRole("radio", { name: "Calendário" })).not.toBeInTheDocument(); // só depois de carregar
    await user.click(verAgenda().botao);
    await screen.findByRole("status");
    return user;
  }

  it("tela larga abre no Calendário, no mês de hoje, com os compromissos buscados", async () => {
    await carregar(true);
    expect(screen.getByRole("radio", { name: "Calendário" })).toBeChecked();
    expect(screen.getByRole("grid", { name: "Outubro de 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^5 de outubro, hoje, 2 compromissos/ })).toBeInTheDocument();
    expect(within(verAgenda().regiao).getByText("titulo-falso-2")).toBeInTheDocument(); // painel do dia de hoje
  });

  it("tela estreita abre na Lista intacta; trocar para Calendário fica guardado", async () => {
    const user = await carregar(false);
    expect(screen.getByRole("radio", { name: "Lista" })).toBeChecked();
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
    expect(screen.getByText("Compromissos anteriores")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Calendário" }));
    expect(screen.getByRole("grid")).toBeInTheDocument();
    expect(screen.queryByText("Compromissos anteriores")).not.toBeInTheDocument();
    expect(localStorage.getItem("agendaVisao")).toBe("calendario");
  });

  it("cuidador ou familiar: o calendário mostra a agenda do idoso escolhido", async () => {
    relogioFalso();
    telaLarga(true);
    mockUseIdosos.mockReturnValue(listaDoisIdosos7);
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, { eventos: EVENTOS_API }));
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderAgenda();
    await user.selectOptions(verAgenda().campo as HTMLElement, "9");
    await user.click(verAgenda().botao);
    expect(await screen.findByRole("button", { name: /^8 de outubro, 1 compromisso: 1 cuidado$/ })).toBeInTheDocument();
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toMatch(/\/agenda\/idoso\/9$/);
  });
});

describe("Agenda: formulário limpo depois de criar", () => {
  it.each(["idoso", "familiar"] as const)("%s: depois do sucesso todos os campos voltam ao padrão", async (sufixo) => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 51 }));
    const user = userEvent.setup();
    renderAgenda();
    const c = secao(sufixo);
    await preencher(c, user);
    await user.selectOptions(c.tipo, "medico");
    await user.click(c.botao);
    await screen.findByRole("status");
    expect(chamada().corpo.tipo_evento).toBe("medico");
    expect(c.tipo).toHaveValue("pessoal");
    expect(c.titulo).toHaveValue("");
    expect(c.descricao).toHaveValue("");
    expect(c.inicio).toHaveValue("");
    expect(c.fim).toHaveValue("");
    // Com 1 idoso só (fixture padrão), o SeletorIdoso escolhe ele de novo.
    if (c.idosoId) expect(c.idosoId).toHaveValue("7");
  });

  it("no erro tudo o que a pessoa preencheu continua", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(400, { error: "Mensagem de erro de teste." }));
    const user = userEvent.setup();
    renderAgenda();
    const c = secao("idoso");
    await preencher(c, user);
    await user.selectOptions(c.tipo, "medico");
    await user.click(c.botao);
    await screen.findByRole("alert");
    expect(c.tipo).toHaveValue("medico");
    expect(c.titulo).toHaveValue("Consulta Ficticia");
    expect(c.inicio).toHaveValue(INICIO_LOCAL);
  });
});
