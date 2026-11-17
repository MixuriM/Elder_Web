import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Agenda from "./Agenda";
import { AcessoContext } from "../contexts/useAcesso";
import type { Vinculo } from "../components/Vinculos/CardVinculo";
import { listaDoisIdosos7, listaPerfilIdoso, listaSemIdosos, listaUmIdoso } from "../hooks/idososFixtures";
import type { IdososVinculados } from "../hooks/useIdososVinculados";

// Itens 6.1 a 6.3 (RF-015 a RF-017) e Fase 11: a agenda carrega sozinha e um botão abre o modal de criar compromisso.
// O formulário em si tem teste próprio (components/Agenda/ModalCriarCompromisso.test.tsx). Valores obviamente falsos.

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

type Perfil = "idoso" | "familiar" | "cuidador" | null;

function vinculoCuidador(permite: boolean): Vinculo {
  return {
    id: 1,
    tipo_vinculo: "cuidador",
    origem: "solicitacao_cuidador",
    status: "aprovado",
    papel_do_chamador: "vinculado",
    permissoes: { permite_registrar_saude: false, permite_marcar_dose: false, permite_criar_evento_cuidado: permite },
    idoso: { id: 7, nome: "Idoso Teste Sete", email_mascarado: null },
    vinculado: { id: 50, nome: "Eu", email_mascarado: null },
  } as Vinculo;
}

function renderAgenda(perfil: Perfil = "idoso", vinculos: Vinculo[] | null = null) {
  return render(
    <AcessoContext.Provider
      value={{ tipoPerfil: perfil, temVinculoAprovado: true, temVinculoPendente: false, estado: "ok", vinculos }}
    >
      <MemoryRouter>
        <Agenda />
      </MemoryRouter>
    </AcessoContext.Provider>,
  );
}

const fetchMock = jest.fn();
let eventos: unknown[];

function chamadas(metodo: string) {
  return fetchMock.mock.calls.filter(([, init]) => (init?.method ?? "GET") === metodo);
}

function usarIdosos(lista: IdososVinculados, tipoPerfil?: string) {
  mockUseIdosos.mockReturnValue(tipoPerfil ? { ...lista, tipoPerfil } : lista);
}

beforeEach(() => {
  jest.clearAllMocks();
  eventos = [];
  usarIdosos(listaPerfilIdoso);
  mockGetCurrentUserToken.mockReset();
  mockGetCurrentUserToken.mockResolvedValue("token-fake");
  fetchMock.mockImplementation((_url: string, init: RequestInit = {}) =>
    Promise.resolve(
      (init.method ?? "GET") === "GET" ? respostaJson(200, { eventos }) : respostaJson(201, { id: 31 }),
    ),
  );
  global.fetch = fetchMock;
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const regiao = () => screen.getByRole("region", { name: "Compromissos" });

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

// "Agora" fixado com relógio falso (só Date, para não travar userEvent/waitFor). Fuso fixo de São Paulo.
const AGORA = new Date("2026-10-05T15:00:00.000Z"); // 12:00 de segunda, 05/10/2026 em São Paulo
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

describe("Agenda: carrega sozinha (item 6.3)", () => {
  it("idoso: GET /agenda ao abrir, com Authorization, sem botão 'Ver agenda' e sem seletor", async () => {
    renderAgenda();

    expect(await screen.findByText("Nenhum compromisso na agenda.")).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/agenda$/);
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer token-fake");
    expect(init.body).toBeUndefined();
    expect(screen.queryByRole("button", { name: /ver agenda/i })).not.toBeInTheDocument();
    expect(within(regiao()).queryByLabelText("Idoso")).not.toBeInTheDocument();
  });

  it("cuidador ou familiar: pré-seleciona o primeiro idoso e carrega GET /agenda/idoso/<id>", async () => {
    usarIdosos(listaDoisIdosos7, "familiar");
    renderAgenda("familiar");

    expect(within(regiao()).getByLabelText("Idoso")).toHaveValue("7");
    await screen.findByText("Nenhum compromisso na agenda.");
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/agenda\/idoso\/7$/);
  });

  it("trocar o idoso recarrega pelo caminho do novo idoso", async () => {
    usarIdosos(listaDoisIdosos7, "familiar");
    const user = userEvent.setup();
    renderAgenda("familiar");
    await screen.findByText("Nenhum compromisso na agenda.");

    await user.selectOptions(within(regiao()).getByLabelText("Idoso"), "9");

    await waitFor(() =>
      expect(fetchMock.mock.calls.map(([url]) => String(url)).some((u) => /\/agenda\/idoso\/9$/.test(u))).toBe(true),
    );
  });

  it("sem idosos vinculados não consulta a API", () => {
    usarIdosos(listaSemIdosos, "familiar");
    renderAgenda("familiar");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("C3: dias na ordem certa, (hoje), passados em details fechado, tipo em texto, time dateTime, título e descrição", async () => {
    relogioFalso();
    eventos = EVENTOS_API;
    window.localStorage.setItem("agendaVisao", "lista");
    renderAgenda();
    const r = regiao();
    expect(await within(r).findByText(/4 compromisso\(s\)/)).toBeInTheDocument();

    const dias = within(r).getAllByRole("heading", { level: 3 }).map((h) => h.textContent ?? "");
    expect(dias).toHaveLength(3);
    expect(dias[0]).toContain("03/10/2026");
    expect(dias[1]).toContain("05/10/2026");
    expect(dias[1]).toContain("(hoje)");
    expect(dias[2]).toContain("08/10/2026");
    expect(dias.filter((d) => d.includes("(hoje)"))).toHaveLength(1);

    const detalhes = r.querySelector("details") as HTMLDetailsElement;
    expect(detalhes).not.toBeNull();
    expect(detalhes.open).toBe(false);
    expect(within(detalhes).getByText("titulo-falso-1")).toBeInTheDocument();
    expect(within(detalhes).queryByText("titulo-falso-2")).not.toBeInTheDocument();
    expect(within(detalhes).queryByText("titulo-falso-4")).not.toBeInTheDocument();

    // Evento das 23:00 a 02:00 aparece uma vez, no dia em que começa.
    expect(within(r).getAllByText("titulo-falso-3")).toHaveLength(1);
    const item3 = within(r).getByText("titulo-falso-3").closest("li") as HTMLElement;
    expect(item3).toHaveTextContent("23:00 até 06/10/2026 02:00");
    expect(item3.closest("section")).toHaveTextContent("05/10/2026");

    const item2 = within(r).getByText("titulo-falso-2").closest("li") as HTMLElement;
    expect(item2).toHaveTextContent("descricao-falsa-2");
    const t = item2.querySelector("time") as HTMLTimeElement;
    expect(t).toHaveAttribute("dateTime", "2026-10-05T12:00:00.000Z");
    expect(t).toHaveTextContent("09:00 às 10:30");
    expect(within(r).getByText("titulo-falso-4").closest("li")).toHaveTextContent("Cuidado");
    window.localStorage.clear();
  });

  it("visão calendário (a escolha fica salva): mostra o calendário com o alternador Mês e Dia", async () => {
    relogioFalso();
    eventos = EVENTOS_API;
    window.localStorage.setItem("agendaVisao", "calendario");
    renderAgenda();

    expect(await within(regiao()).findByText(/4 compromisso\(s\)/)).toBeInTheDocument();
    expect(within(regiao()).getByRole("radio", { name: "Mês" })).toBeChecked();
    expect(within(regiao()).getByRole("radio", { name: "Dia" })).toBeInTheDocument();
    expect(within(regiao()).getByRole("radio", { name: "Calendário" })).toBeChecked();
    window.localStorage.clear();
  });

  it("trocar a visão grava a escolha", async () => {
    const user = userEvent.setup();
    eventos = [];
    renderAgenda();
    await screen.findByText("Nenhum compromisso na agenda.");

    // Sem tela larga salva, a visão padrão no jsdom é a lista: escolher o calendário grava a escolha.
    await user.click(within(regiao()).getByRole("radio", { name: "Calendário" }));

    expect(window.localStorage.getItem("agendaVisao")).toBe("calendario");
    window.localStorage.clear();
  });

  it("carregando em role=status e lista vazia com mensagem fixa", async () => {
    renderAgenda();

    expect(within(regiao()).getByRole("status")).toHaveTextContent("Carregando a agenda...");
    expect(await screen.findByText("Nenhum compromisso na agenda.")).toBeInTheDocument();
    expect(within(regiao()).queryAllByRole("heading", { level: 3 })).toHaveLength(0);
  });

  it.each([
    [400, "Id de idoso inválido."],
    [401, "Sessão expirada. Entre novamente."],
    [403, "Você não tem permissão para ver esta agenda."],
    [404, "Não foi possível carregar a agenda."],
    [500, "Não foi possível carregar a agenda."],
  ])("GET com status %i: mensagem fixa em role=alert, nunca o corpo do servidor", async (status, mensagem) => {
    fetchMock.mockResolvedValue(respostaJson(status, { error: "SENT_CORPO_ERRO_FALSO" }));
    renderAgenda();

    const alerta = await within(regiao()).findByRole("alert");
    expect(alerta).toHaveTextContent(mensagem);
    expect(alerta).not.toHaveTextContent("SENT_CORPO_ERRO_FALSO");
  });

  it("falha de rede vira mensagem genérica", async () => {
    fetchMock.mockRejectedValue(new Error("SENT_CORPO_ERRO_FALSO"));
    renderAgenda();

    const alerta = await within(regiao()).findByRole("alert");
    expect(alerta).toHaveTextContent("Não foi possível carregar a agenda.");
    expect(alerta).not.toHaveTextContent("SENT_CORPO_ERRO_FALSO");
  });

  it("200 sem a lista 'eventos' vira erro genérico, nunca tela vazia", async () => {
    fetchMock.mockResolvedValue(respostaJson(200, { outra: [] }));
    renderAgenda();

    expect(await within(regiao()).findByRole("alert")).toHaveTextContent("Não foi possível carregar a agenda.");
    expect(within(regiao()).queryByText("Nenhum compromisso na agenda.")).not.toBeInTheDocument();
  });

  it("data inválida (RangeError) vira 'Não foi possível exibir a agenda.' sem repetir o valor", async () => {
    eventos = [evApi(9, "pessoal", "data-invalida-falsa")];
    renderAgenda();

    const alerta = await within(regiao()).findByRole("alert");
    expect(alerta).toHaveTextContent("Não foi possível exibir a agenda.");
    expect(alerta).not.toHaveTextContent("data-invalida-falsa");
  });

  it("não loga título, descrição nem corpo em console.*", async () => {
    const espioes = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    );
    eventos = EVENTOS_API;
    window.localStorage.setItem("agendaVisao", "lista");
    renderAgenda();
    await within(regiao()).findByText(/4 compromisso\(s\)/);

    const logado = JSON.stringify(espioes.map((s) => s.mock.calls));
    expect(logado).not.toContain("titulo-falso");
    expect(logado).not.toContain("descricao-falsa");
    window.localStorage.clear();
  });
});

describe("Agenda: botão Criar compromisso (itens 6.1 e 6.2 e Fase 11)", () => {
  it("as três seções antigas não existem mais", async () => {
    renderAgenda();
    await screen.findByText("Nenhum compromisso na agenda.");

    expect(screen.queryByRole("heading", { name: /criar compromisso/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Criar compromisso" })).toHaveLength(1);
  });

  it("idoso: abre o modal, cria com POST /agenda, fecha, avisa e recarrega o calendário", async () => {
    const user = userEvent.setup();
    renderAgenda("idoso");
    await screen.findByText("Nenhum compromisso na agenda.");

    await user.click(screen.getByRole("button", { name: "Criar compromisso" }));
    const dialogo = screen.getByRole("dialog", { name: "Criar compromisso" });
    await user.type(within(dialogo).getByLabelText("Título"), "compromisso-falso");
    fireEvent.change(within(dialogo).getByLabelText("Início"), { target: { value: "2026-10-10T09:00" } });
    await user.click(within(dialogo).getByRole("button", { name: "Criar compromisso" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(String(chamadas("POST")[0][0])).toMatch(/\/agenda$/);
    expect(within(regiao()).getByText("Compromisso criado.").closest('[role="status"]')).not.toBeNull();
    await waitFor(() => expect(chamadas("GET")).toHaveLength(2));
  });

  it("familiar: o modal usa o idoso escolhido na agenda e mostra o nome dele", async () => {
    usarIdosos(listaDoisIdosos7, "familiar");
    const user = userEvent.setup();
    renderAgenda("familiar");
    await screen.findByText("Nenhum compromisso na agenda.");
    await user.selectOptions(within(regiao()).getByLabelText("Idoso"), "9");

    await user.click(screen.getByRole("button", { name: "Criar compromisso" }));
    const dialogo = screen.getByRole("dialog", { name: "Criar compromisso" });

    expect(within(dialogo).getByText(/compromisso para:/i)).toHaveTextContent("Idoso Teste Nove");
    await user.type(within(dialogo).getByLabelText("Título"), "compromisso-falso");
    fireEvent.change(within(dialogo).getByLabelText("Início"), { target: { value: "2026-10-10T09:00" } });
    await user.click(within(dialogo).getByRole("button", { name: "Criar compromisso" }));

    await waitFor(() => expect(chamadas("POST")).toHaveLength(1));
    expect(String(chamadas("POST")[0][0])).toMatch(/\/agenda\/idoso\/9$/);
  });

  it("cuidador com a permissão de criar compromisso de cuidado: vê o botão e o modal sem o campo Tipo", async () => {
    usarIdosos(listaUmIdoso, "cuidador");
    const user = userEvent.setup();
    renderAgenda("cuidador", [vinculoCuidador(true)]);
    await screen.findByText("Nenhum compromisso na agenda.");

    await user.click(screen.getByRole("button", { name: "Criar compromisso" }));

    expect(screen.queryByLabelText("Tipo")).not.toBeInTheDocument();
  });

  it("cuidador sem a permissão não vê o botão, mas continua vendo a agenda", async () => {
    usarIdosos(listaUmIdoso, "cuidador");
    renderAgenda("cuidador", [vinculoCuidador(false)]);

    expect(await screen.findByText("Nenhum compromisso na agenda.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Criar compromisso" })).not.toBeInTheDocument();
  });

  it("sem idoso vinculado: o botão fica desabilitado", () => {
    usarIdosos(listaSemIdosos, "familiar");
    renderAgenda("familiar");

    expect(screen.getByRole("button", { name: "Criar compromisso" })).toBeDisabled();
  });

  it("perfil e idosos ainda desconhecidos: sem botão (não dá para saber qual formulário)", () => {
    mockUseIdosos.mockReturnValue({ estado: "carregando", ehIdoso: false, idosos: [], bloqueado: true });
    renderAgenda(null);

    expect(screen.queryByRole("button", { name: "Criar compromisso" })).not.toBeInTheDocument();
  });

  it("o título da área e o texto de apoio estão presentes", async () => {
    renderAgenda();

    expect(screen.getByRole("heading", { level: 1, name: "Agenda" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Compromissos" })).toBeInTheDocument();
    await screen.findByText("Nenhum compromisso na agenda.");
  });
});
