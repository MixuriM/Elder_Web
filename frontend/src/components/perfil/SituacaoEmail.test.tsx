import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";

import SituacaoEmail from "./SituacaoEmail";

expect.extend(toHaveNoViolations);

// Firebase sempre mockado: nenhum e-mail sai de verdade. E-mail fictício, só para provar que nunca vaza.
const mockEmailConfirmado = jest.fn();
const mockEnviar = jest.fn();
jest.mock("../../lib/auth", () => ({
  emailConfirmado: (...a: unknown[]) => mockEmailConfirmado(...a),
  sendEmailVerification: (...a: unknown[]) => mockEnviar(...a),
}));

const NAO_CONFIRMADO =
  "E-mail ainda não confirmado. Sem isso você não recebe o aviso de emergência de quem você cuida.";
let consoles: jest.SpyInstance[];

beforeEach(() => {
  mockEmailConfirmado.mockReset().mockResolvedValue(false);
  mockEnviar.mockReset().mockResolvedValue(true);
  consoles = (["log", "info", "warn", "error"] as const).map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
});
afterEach(() => {
  expect(consoles.every((s) => s.mock.calls.length === 0)).toBe(true);
  jest.restoreAllMocks();
});

const reenviar = () => screen.getByRole("button", { name: /reenviar e-mail de confirmação|enviando/i });
const jaConfirmei = () => screen.getByRole("button", { name: /já confirmei|verificando/i });

describe("SituacaoEmail", () => {
  it("confirmado: mostra 'E-mail confirmado' sem botões", async () => {
    mockEmailConfirmado.mockResolvedValue(true);
    render(<SituacaoEmail />);
    expect(await screen.findByText("E-mail confirmado")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("não confirmado: texto simples e os dois botões", async () => {
    render(<SituacaoEmail />);
    expect(await screen.findByText(NAO_CONFIRMADO)).toBeInTheDocument();
    expect(reenviar()).toBeEnabled();
    expect(jaConfirmei()).toBeEnabled();
  });

  it("reenviar: botão desativado durante o envio e mensagem de sucesso", async () => {
    let concluir: (v: boolean) => void = () => {};
    mockEnviar.mockReturnValue(new Promise((r) => (concluir = r)));
    const user = userEvent.setup();
    render(<SituacaoEmail />);
    await screen.findByText(NAO_CONFIRMADO);
    await user.click(reenviar());
    expect(reenviar()).toBeDisabled();
    expect(reenviar()).toHaveTextContent("Enviando...");
    await act(async () => concluir(true));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Enviamos um novo e-mail de confirmação. Abra a mensagem e clique no link.",
    );
    expect(reenviar()).toBeEnabled();
  });

  it("excesso de tentativas: 'Aguarde alguns minutos para pedir de novo.'", async () => {
    mockEnviar.mockRejectedValue(Object.assign(new Error("pessoa@exemplo.test"), { code: "auth/too-many-requests" }));
    const user = userEvent.setup();
    render(<SituacaoEmail />);
    await screen.findByText(NAO_CONFIRMADO);
    await user.click(reenviar());
    expect(await screen.findByText("Aguarde alguns minutos para pedir de novo.")).toBeInTheDocument();
    expect(screen.queryByText(/exemplo\.test/)).not.toBeInTheDocument();
  });

  it("outro erro: mensagem fixa, sem texto técnico", async () => {
    mockEnviar.mockRejectedValue(Object.assign(new Error("auth/network-request-failed"), { code: "auth/network-request-failed" }));
    const user = userEvent.setup();
    render(<SituacaoEmail />);
    await screen.findByText(NAO_CONFIRMADO);
    await user.click(reenviar());
    expect(await screen.findByText("Não foi possível enviar agora. Tente de novo mais tarde.")).toBeInTheDocument();
    expect(screen.queryByText(/auth\//)).not.toBeInTheDocument();
  });

  it("Já confirmei: recarrega do Firebase e passa a mostrar 'E-mail confirmado'", async () => {
    const user = userEvent.setup();
    render(<SituacaoEmail />);
    await screen.findByText(NAO_CONFIRMADO);
    mockEmailConfirmado.mockResolvedValue(true);
    await user.click(jaConfirmei());
    expect(await screen.findByText("E-mail confirmado")).toBeInTheDocument();
    expect(mockEmailConfirmado).toHaveBeenCalledTimes(2);
  });

  it("Já confirmei sem ter confirmado: orienta abrir o link", async () => {
    const user = userEvent.setup();
    render(<SituacaoEmail />);
    await screen.findByText(NAO_CONFIRMADO);
    await user.click(jaConfirmei());
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Ainda não aparece como confirmado. Abra o link do e-mail e tente de novo.",
    );
  });

  it("reenviar quando já estava confirmado (outra aba): mostra 'E-mail confirmado'", async () => {
    mockEnviar.mockResolvedValue(false);
    const user = userEvent.setup();
    render(<SituacaoEmail />);
    await screen.findByText(NAO_CONFIRMADO);
    await user.click(reenviar());
    expect(await screen.findByText("E-mail confirmado")).toBeInTheDocument();
  });

  it("sem violações de axe", async () => {
    const { container } = render(<SituacaoEmail />);
    await screen.findByText(NAO_CONFIRMADO);
    expect(await axe(container, { rules: { "color-contrast": { enabled: false } } })).toHaveNoViolations();
  });
});
