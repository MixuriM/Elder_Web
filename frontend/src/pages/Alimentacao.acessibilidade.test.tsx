import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { MemoryRouter } from "react-router-dom";
import Alimentacao from "./Alimentacao";
import { listaUmIdoso } from "../hooks/idososFixtures";

expect.extend(toHaveNoViolations);

// Item 7.1 e Fase 11: auditoria automática de acessibilidade (jest-axe) sobre /alimentacao e o modal de registrar.
// LIMITE: jsdom não calcula layout nem cor, então contraste de cor NÃO é verificado aqui (regra color-contrast desligada de
// propósito, ver AXE); o contraste é auditado por npm run test:a11y (Playwright). Dados abaixo são obviamente falsos.
const AXE = {
  rules: {
    // jsdom não renderiza estilos computados de cor: a regra não tem como dar resultado confiável.
    "color-contrast": { enabled: false },
  },
};

// O histórico tem teste de acessibilidade próprio (components/Alimentacao/HistoricoAlimentar.acessibilidade.test.tsx).
jest.mock("../components/Alimentacao/HistoricoAlimentar", () => ({
  __esModule: true,
  default: () => <section aria-label="Histórico alimentar" />,
}));

const mockUseIdosos = jest.fn();
jest.mock("../hooks/useIdososVinculados", () => ({ useIdososVinculados: () => mockUseIdosos() }));

const mockGetCurrentUserToken = jest.fn();
jest.mock("../lib/auth", () => ({
  getCurrentUserToken: (...args: unknown[]) => mockGetCurrentUserToken(...args),
}));

function respostaJson(status: number, corpo: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(corpo) } as Response;
}

beforeEach(() => {
  mockUseIdosos.mockReturnValue(listaUmIdoso);
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

  it("detecta select sem label e textarea sem label", async () => {
    const { container } = render(
      <div>
        <select>
          <option>a</option>
        </select>
        <textarea />
      </div>,
    );
    const ids = (await axe(container, AXE)).violations.map((v) => v.id);
    expect(ids).toContain("select-name");
    expect(ids).toContain("label");
  });
});

describe("Alimentacao: acessibilidade", () => {
  function renderPagina() {
    return render(
      <MemoryRouter>
        <Alimentacao />
      </MemoryRouter>,
    );
  }

  async function abrirModal() {
    const user = userEvent.setup();
    const utils = renderPagina();
    await user.click(screen.getByRole("button", { name: "Registrar refeição" }));
    return { user, ...utils, dialogo: screen.getByRole("dialog", { name: "Registrar refeição" }) };
  }

  async function preencherEEnviar(user: ReturnType<typeof userEvent.setup>, dialogo: HTMLElement) {
    await user.type(within(dialogo).getByLabelText("Descrição", { exact: true }), "Almoço Ficticio");
    fireEvent.change(within(dialogo).getByLabelText("Data e hora", { exact: true }), { target: { value: "2026-10-10T12:30" } });
    await user.click(within(dialogo).getByRole("button", { name: /^salvar refeição$/i }));
  }

  it("estado inicial: título, botão de registrar e histórico, sem violações", async () => {
    const { container } = renderPagina();

    expect(screen.getByRole("heading", { level: 1, name: "Alimentação" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar refeição" })).toBeEnabled();
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it("modal aberto: dialog modal, foco dentro e campos rotulados, sem violações", async () => {
    const { dialogo } = await abrirModal();

    expect(dialogo).toHaveAttribute("aria-modal", "true");
    expect(dialogo).toHaveFocus();
    for (const rotulo of ["Refeição", "Descrição", "Data e hora"]) {
      expect(within(dialogo).getByLabelText(rotulo, { exact: true })).toBeInTheDocument();
    }
    expect(await axe(dialogo, AXE)).toHaveNoViolations();
  });

  it("carregando (botão ocupado)", async () => {
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => undefined));
    const { user, dialogo } = await abrirModal();

    await preencherEEnviar(user, dialogo);

    expect(await screen.findByRole("button", { name: /salvando/i })).toBeDisabled();
    expect(await axe(dialogo, AXE)).toHaveNoViolations();
  });

  it.each([400, 403])("erro %i em role=alert visível, dentro do modal", async (status) => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(status, { error: "Mensagem de erro de teste." }));
    const { user, dialogo } = await abrirModal();

    await preencherEEnviar(user, dialogo);

    expect(await within(dialogo).findByRole("alert")).toBeInTheDocument();
    expect(await axe(dialogo, AXE)).toHaveNoViolations();
  });

  it("sucesso: o modal fecha, o foco volta ao botão e o aviso é role=status", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 41 }));
    const { user, dialogo, container } = await abrirModal();

    await preencherEEnviar(user, dialogo);

    expect(await screen.findByText("Refeição registrada.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Refeição registrada.").closest('[role="status"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: "Registrar refeição" })).toHaveFocus();
    expect(await axe(container, AXE)).toHaveNoViolations();
  });
});
