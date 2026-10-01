import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import Remedios from "./Remedios";

expect.extend(toHaveNoViolations);

// Item 5.1: auditoria automática de acessibilidade (jest-axe) sobre o esqueleto de /remedios.
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
  // O esqueleto registra a mensagem do erro em console.error; é esperado no caso de erro.
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe("jest-axe: controle positivo", () => {
  it("detecta violação real (input sem label), então o teste não está vazio", async () => {
    const { container } = render(<input type="text" />);
    const resultado = await axe(container, AXE);
    expect(resultado.violations.map((v) => v.id)).toContain("label");
    expect(resultado).not.toHaveNoViolations();
  });
});

describe("Remedios: acessibilidade", () => {
  it("estado inicial das duas seções", async () => {
    const { container } = render(<Remedios />);
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  describe.each(["idoso", "familiar"] as const)("seção %s", (sufixo) => {
    async function enviar(resposta: Response) {
      (global.fetch as jest.Mock).mockResolvedValue(resposta);
      const user = userEvent.setup();
      const utils = render(<Remedios />);
      if (sufixo === "familiar") await user.type(screen.getByLabelText("Id do idoso (familiar)", { exact: true }), "1");
      await user.type(screen.getByLabelText(`Nome (${sufixo})`, { exact: true }), "Remedio Ficticio");
      await user.type(screen.getByLabelText(`Dosagem (${sufixo})`, { exact: true }), "10 mg");
      await user.type(screen.getByLabelText(`Frequência (${sufixo})`, { exact: true }), "2x ao dia");
      fireEvent.change(screen.getByLabelText(`Data de início (${sufixo})`, { exact: true }), { target: { value: "2026-10-01" } });
      await user.click(screen.getByRole("button", { name: new RegExp(`^cadastrar medicamento \\(${sufixo}\\)$`, "i") }));
      return utils;
    }

    it("com sucesso em role=status visível", async () => {
      const { container } = await enviar(respostaJson(201, { id: 41 }));
      expect(await screen.findByRole("status")).toHaveTextContent("Medicamento cadastrado (id 41).");
      expect(await axe(container, AXE)).toHaveNoViolations();
    });

    it("com erro em role=alert visível", async () => {
      const { container } = await enviar(respostaJson(400, { error: "Mensagem de erro de teste." }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Mensagem de erro de teste.");
      expect(await axe(container, AXE)).toHaveNoViolations();
    });
  });
});
