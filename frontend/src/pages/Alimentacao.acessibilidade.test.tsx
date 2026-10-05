import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import Alimentacao from "./Alimentacao";

expect.extend(toHaveNoViolations);

// Item 7.1: auditoria automática de acessibilidade (jest-axe) sobre o esqueleto de /alimentacao.
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
  async function preencherEEnviar() {
    const user = userEvent.setup();
    const utils = render(<Alimentacao />);
    await user.type(screen.getByLabelText("Descrição", { exact: true }), "Descricao Ficticia");
    fireEvent.change(screen.getByLabelText("Data e hora", { exact: true }), { target: { value: "2026-10-10T12:30" } });
    await user.click(screen.getByRole("button", { name: /^registrar refeição$/i }));
    return utils;
  }

  it("estado inicial", async () => {
    const { container } = render(<Alimentacao />);
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it("carregando (botão ocupado)", async () => {
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => undefined));
    const { container } = await preencherEEnviar();
    expect(await screen.findByRole("button", { name: /registrando/i })).toHaveAttribute("aria-busy", "true");
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it("sucesso em role=status visível", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 41 }));
    const { container } = await preencherEEnviar();
    expect(await screen.findByRole("status")).toBeVisible();
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it.each([400, 403])("erro %i em role=alert visível", async (status) => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(status, { error: "Mensagem de erro de teste." }));
    const { container } = await preencherEEnviar();
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(await axe(container, AXE)).toHaveNoViolations();
  });
});
