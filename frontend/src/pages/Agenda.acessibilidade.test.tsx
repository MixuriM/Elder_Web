import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { MemoryRouter } from "react-router-dom";
import Agenda from "./Agenda";

function renderAgenda() {
  return render(
    <MemoryRouter>
      <Agenda />
    </MemoryRouter>,
  );
}

expect.extend(toHaveNoViolations);

// Itens 6.1 e 6.2: auditoria automática de acessibilidade (jest-axe) sobre o esqueleto de /agenda.
// LIMITE: jsdom não calcula layout nem cor, então contraste de cor NÃO é verificado aqui
// (regra color-contrast desligada de propósito, ver AXE). Contraste segue pendente para o item 9.1.
// Dados abaixo são valores obviamente falsos de teste.
const AXE = {
  rules: {
    // jsdom não renderiza estilos computados de cor: a regra não tem como dar resultado confiável.
    "color-contrast": { enabled: false },
  },
};

const mockGetCurrentUserToken = jest.fn();
jest.mock("../lib/auth", () => ({
  getCurrentUserToken: (...args: unknown[]) => mockGetCurrentUserToken(...args),
}));

function respostaJson(status: number, corpo: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(corpo) } as Response;
}

beforeEach(() => {
  mockGetCurrentUserToken.mockReset();
  mockGetCurrentUserToken.mockResolvedValue("token-fake");
  global.fetch = jest.fn();
});
afterEach(() => jest.restoreAllMocks());

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

describe("Agenda: acessibilidade", () => {
  it("estado inicial dos três formulários", async () => {
    const { container } = renderAgenda();
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  describe.each(["idoso", "familiar", "cuidador"] as const)("formulário %s", (sufixo) => {
    async function preencherEEnviar() {
      const user = userEvent.setup();
      const utils = renderAgenda();
      if (sufixo !== "idoso") await user.type(screen.getByLabelText(`Id do idoso (${sufixo})`, { exact: true }), "1");
      await user.type(screen.getByLabelText(`Título (${sufixo})`, { exact: true }), "Consulta Ficticia");
      fireEvent.change(screen.getByLabelText(`Início (${sufixo})`, { exact: true }), { target: { value: "2026-10-10T09:00" } });
      await user.click(screen.getByRole("button", { name: new RegExp(`^criar compromisso \\(${sufixo}\\)$`, "i") }));
      return utils;
    }

    it("carregando (botão ocupado)", async () => {
      (global.fetch as jest.Mock).mockReturnValue(new Promise(() => undefined));
      const { container } = await preencherEEnviar();
      expect(await screen.findByRole("button", { name: /criando/i })).toBeDisabled();
      expect(await axe(container, AXE)).toHaveNoViolations();
    });

    it("sucesso em role=status visível", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 41 }));
      const { container } = await preencherEEnviar();
      expect(await screen.findByRole("status")).toHaveTextContent("Compromisso criado (id 41).");
      expect(await axe(container, AXE)).toHaveNoViolations();
    });

    it.each([400, 403])("erro %i em role=alert visível", async (status) => {
      (global.fetch as jest.Mock).mockResolvedValue(respostaJson(status, { error: "Mensagem de erro de teste." }));
      const { container } = await preencherEEnviar();
      expect(await screen.findByRole("alert")).toHaveTextContent("Mensagem de erro de teste.");
      expect(await axe(container, AXE)).toHaveNoViolations();
    });
  });
});

// Item 6.3: seção "Ver agenda". Mesmo limite: contraste de cor segue no item 9.1. Dados obviamente falsos.
describe("Agenda: acessibilidade da seção Ver agenda", () => {
  const EV = (id: number, tipo: string, inicio: string, fim: string | null = null) => ({
    id,
    idoso_id: 7,
    criado_por_id: 7,
    tipo_evento: tipo,
    titulo: `titulo-falso-${id}`,
    descricao: id === 2 ? "descricao-falsa-2" : null,
    data_hora_inicio: inicio,
    data_hora_fim: fim,
    editado_por_id: null,
    created_at: "2026-09-01T10:00:00.000Z",
    updated_at: "2026-09-01T10:00:00.000Z",
  });
  const EVENTOS = [
    EV(1, "pessoal", "2026-10-03T12:00:00.000Z"),
    EV(2, "medico", "2026-10-05T12:00:00.000Z", "2026-10-05T13:30:00.000Z"),
    EV(3, "pessoal", "2026-10-06T02:00:00.000Z", "2026-10-06T05:00:00.000Z"),
    EV(4, "cuidado", "2026-10-08T15:00:00.000Z"),
  ];

  async function ver() {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const utils = renderAgenda();
    await user.click(screen.getByRole("button", { name: /^ver agenda$/i }));
    return { ...utils, user };
  }

  beforeEach(() => {
    jest.useFakeTimers({
      now: new Date("2026-10-05T15:00:00.000Z"),
      doNotFake: [
        "hrtime", "nextTick", "performance", "queueMicrotask", "requestAnimationFrame", "cancelAnimationFrame",
        "requestIdleCallback", "cancelIdleCallback", "setImmediate", "clearImmediate", "setInterval", "clearInterval",
        "setTimeout", "clearTimeout",
      ],
    });
  });
  afterEach(() => jest.useRealTimers());

  it("carregando (botão ocupado)", async () => {
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => undefined));
    const { container } = await ver();
    expect(await screen.findByRole("button", { name: /carregando/i })).toHaveAttribute("aria-busy", "true");
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it("sucesso com hoje e passado, details fechado e aberto", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, { eventos: EVENTOS }));
    const { container, user } = await ver();
    expect(await screen.findByText(/\(hoje\)/)).toBeInTheDocument();
    const detalhes = container.querySelector("details") as HTMLDetailsElement;
    expect(detalhes.open).toBe(false);
    expect(await axe(container, AXE)).toHaveNoViolations();
    await user.click(screen.getByText("Compromissos anteriores"));
    expect(detalhes.open).toBe(true);
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it("vazio", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, { eventos: [] }));
    const { container } = await ver();
    expect(await screen.findByText("Nenhum compromisso na agenda.")).toBeInTheDocument();
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it.each([403, 500])("erro %i em role=alert visível", async (status) => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(status, { error: "Mensagem de erro de teste." }));
    const { container } = await ver();
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(await axe(container, AXE)).toHaveNoViolations();
  });
});
