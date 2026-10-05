import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import Agenda from "./Agenda";

expect.extend(toHaveNoViolations);

// Item 6.1: auditoria automática de acessibilidade (jest-axe) sobre o esqueleto de /agenda.
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
  it("estado inicial dos dois formulários", async () => {
    const { container } = render(<Agenda />);
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  describe.each(["idoso", "familiar"] as const)("formulário %s", (sufixo) => {
    async function preencherEEnviar() {
      const user = userEvent.setup();
      const utils = render(<Agenda />);
      if (sufixo === "familiar") await user.type(screen.getByLabelText("Id do idoso (familiar)", { exact: true }), "1");
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
