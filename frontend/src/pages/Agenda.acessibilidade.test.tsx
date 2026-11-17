import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { MemoryRouter } from "react-router-dom";
import Agenda from "./Agenda";
import { AcessoContext } from "../contexts/useAcesso";
import { listaPerfilIdoso, listaUmIdoso } from "../hooks/idososFixtures";

expect.extend(toHaveNoViolations);

// Itens 6.1 a 6.3 e Fase 11: auditoria automática de acessibilidade (jest-axe) sobre /agenda e o modal de criar.
// LIMITE: jsdom não calcula layout nem cor, então contraste de cor NÃO é verificado aqui (regra color-contrast
// desligada de propósito, ver AXE); o contraste é auditado por npm run test:a11y (Playwright). Dados obviamente falsos.
const AXE = {
  rules: {
    // jsdom não renderiza estilos computados de cor: regra não tem como dar resultado confiável.
    "color-contrast": { enabled: false },
  },
};

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

function renderAgenda(perfil: "idoso" | "familiar" | "cuidador" = "idoso") {
  return render(
    <AcessoContext.Provider
      value={{ tipoPerfil: perfil, temVinculoAprovado: true, temVinculoPendente: false, estado: "ok", vinculos: null }}
    >
      <MemoryRouter>
        <Agenda />
      </MemoryRouter>
    </AcessoContext.Provider>,
  );
}

const EV = (id: number, tipo: string, inicio: string, fim: string | null = null) => ({
  id,
  idoso_id: 7,
  criado_por_id: 7,
  tipo_evento: tipo,
  titulo: `titulo-falso-${id}`,
  descricao: null,
  data_hora_inicio: inicio,
  data_hora_fim: fim,
  editado_por_id: null,
  created_at: "2026-09-01T10:00:00.000Z",
  updated_at: "2026-09-01T10:00:00.000Z",
});

const fetchMock = jest.fn();
let eventos: unknown[];

beforeEach(() => {
  jest.clearAllMocks();
  eventos = [];
  mockUseIdosos.mockReturnValue(listaPerfilIdoso);
  mockGetCurrentUserToken.mockReset();
  mockGetCurrentUserToken.mockResolvedValue("token-fake");
  fetchMock.mockImplementation((_url: string, init: RequestInit = {}) =>
    Promise.resolve((init.method ?? "GET") === "GET" ? respostaJson(200, { eventos }) : respostaJson(201, { id: 41 })),
  );
  global.fetch = fetchMock;
});
afterEach(() => {
  window.localStorage.clear();
  jest.restoreAllMocks();
});

describe("jest-axe: controle positivo", () => {
  it("detecta violação real (input sem label), então o teste não está vazio", async () => {
    const { container } = render(<input type="text" />);
    const resultado = await axe(container, AXE);
    expect(resultado.violations.map((v) => v.id)).toContain("label");
    expect(resultado).not.toHaveNoViolations();
  });

  it("detecta select sem label", async () => {
    const { container } = render(
      <select>
        <option>a</option>
      </select>,
    );
    expect((await axe(container, AXE)).violations.map((v) => v.id)).toContain("select-name");
  });
});

describe("Agenda: acessibilidade da área de compromissos", () => {
  it("vazia, em lista: sem violações", async () => {
    window.localStorage.setItem("agendaVisao", "lista");
    const { container } = renderAgenda();
    await screen.findByText("Nenhum compromisso na agenda.");
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it("carregando é anunciado em role=status e o botão de criar tem nome", async () => {
    const { container } = renderAgenda();
    expect(within(screen.getByRole("region", { name: "Compromissos" })).getByRole("status")).toHaveTextContent(
      "Carregando a agenda...",
    );
    expect(screen.getByRole("button", { name: "Criar compromisso" })).toBeEnabled();
    await screen.findByText("Nenhum compromisso na agenda.");
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it("erro de carga é anunciado em role=alert", async () => {
    fetchMock.mockResolvedValue(respostaJson(403, {}));
    const { container } = renderAgenda();
    expect(await screen.findByRole("alert")).toHaveTextContent("Você não tem permissão para ver esta agenda.");
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it("com compromissos, em lista (passados em details fechado e aberto): sem violações", async () => {
    eventos = [
      EV(1, "pessoal", "2026-01-03T12:00:00.000Z"),
      EV(2, "medico", "2099-10-05T12:00:00.000Z", "2099-10-05T13:30:00.000Z"),
      EV(3, "cuidado", "2099-10-08T15:00:00.000Z"),
    ];
    window.localStorage.setItem("agendaVisao", "lista");
    const { container } = renderAgenda();
    await screen.findByText(/3 compromisso\(s\)/);
    expect(await axe(container, AXE)).toHaveNoViolations();

    const detalhes = container.querySelector("details") as HTMLDetailsElement;
    detalhes.open = true;
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it("com compromissos, em calendário: sem violações", async () => {
    eventos = [EV(2, "medico", "2099-10-05T12:00:00.000Z"), EV(3, "cuidado", "2099-10-08T15:00:00.000Z")];
    window.localStorage.setItem("agendaVisao", "calendario");
    const { container } = renderAgenda();
    await screen.findByText(/2 compromisso\(s\)/);
    expect(await axe(container, AXE)).toHaveNoViolations();
  });
});

describe.each(["idoso", "familiar", "cuidador"] as const)("Agenda: acessibilidade do modal (%s)", (perfil) => {
  beforeEach(() => {
    if (perfil !== "idoso") mockUseIdosos.mockReturnValue({ ...listaUmIdoso, tipoPerfil: perfil });
  });

  async function abrir() {
    const user = userEvent.setup();
    const utils = renderAgenda(perfil);
    await screen.findByText("Nenhum compromisso na agenda.");
    await user.click(screen.getByRole("button", { name: "Criar compromisso" }));
    return { user, ...utils, dialogo: screen.getByRole("dialog", { name: "Criar compromisso" }) };
  }

  it("dialog modal nomeado, foco dentro, campos rotulados e sem violações", async () => {
    const { dialogo } = await abrir();

    expect(dialogo).toHaveAttribute("aria-modal", "true");
    expect(dialogo).toHaveFocus();
    for (const rotulo of ["Título", "Descrição (opcional)", "Início", "Fim (opcional)"]) {
      expect(within(dialogo).getByLabelText(rotulo)).toBeInTheDocument();
    }
    expect(within(dialogo).queryByLabelText("Tipo") !== null).toBe(perfil !== "cuidador");
    expect(await axe(dialogo, AXE)).toHaveNoViolations();
  });

  it("erro do servidor em role=alert dentro do modal, sem violações", async () => {
    fetchMock.mockImplementation((_url: string, init: RequestInit = {}) =>
      Promise.resolve(
        (init.method ?? "GET") === "GET" ? respostaJson(200, { eventos: [] }) : respostaJson(400, { error: "x" }),
      ),
    );
    const { user, dialogo } = await abrir();

    await user.type(within(dialogo).getByLabelText("Título"), "compromisso-falso");
    fireEvent.change(within(dialogo).getByLabelText("Início"), { target: { value: "2026-10-10T09:00" } });
    await user.click(within(dialogo).getByRole("button", { name: "Criar compromisso" }));

    expect(await within(dialogo).findByRole("alert")).toHaveTextContent("Dados inválidos.");
    expect(await axe(dialogo, AXE)).toHaveNoViolations();
  });

  it("sucesso: o modal fecha, o foco volta ao botão e o aviso é role=status", async () => {
    const { user, dialogo, container } = await abrir();

    await user.type(within(dialogo).getByLabelText("Título"), "compromisso-falso");
    fireEvent.change(within(dialogo).getByLabelText("Início"), { target: { value: "2026-10-10T09:00" } });
    await user.click(within(dialogo).getByRole("button", { name: "Criar compromisso" }));

    expect(await screen.findByText("Compromisso criado.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Compromisso criado.").closest('[role="status"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: "Criar compromisso" })).toHaveFocus();
    expect(await axe(container, AXE)).toHaveNoViolations();
  });
});
