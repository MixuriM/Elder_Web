import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import EsqueciSenha from "./EsqueciSenha";

jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(),
  GoogleAuthProvider: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
}));
jest.mock("../lib/firebase", () => ({ app: {} }));

const mockResetPassword = jest.fn();
jest.mock("../lib/auth", () => {
  const actual = jest.requireActual("../lib/auth");
  return {
    ...actual,
    resetPassword: (...args: unknown[]) => mockResetPassword(...args),
  };
});

function renderEsqueciSenha() {
  return render(
    <MemoryRouter>
      <EsqueciSenha />
    </MemoryRouter>
  );
}

async function enviar(user: ReturnType<typeof userEvent.setup>, email: string) {
  await user.type(screen.getByLabelText(/e-mail/i), email);
  await user.click(screen.getByRole("button", { name: /enviar/i }));
}

describe("EsqueciSenha", () => {
  beforeEach(() => {
    mockResetPassword.mockReset();
  });

  it("sucesso: mostra mensagem de e-mail enviado", async () => {
    mockResetPassword.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderEsqueciSenha();

    await enviar(user, "ana@a.com");

    expect(await screen.findByRole("alert")).toHaveTextContent(/receberá/i);
  });

  it("e-mail não encontrado: também mostra mensagem de enviado, não revela a ausência da conta", async () => {
    mockResetPassword.mockRejectedValue(Object.assign(new Error("não achado"), { code: "auth/user-not-found" }));
    const user = userEvent.setup();
    renderEsqueciSenha();

    await enviar(user, "inexistente@a.com");

    expect(await screen.findByRole("alert")).toHaveTextContent(/receberá/i);
  });

  it("e-mail em formato inválido: mostra mensagem de erro específica", async () => {
    mockResetPassword.mockRejectedValue(Object.assign(new Error("inválido"), { code: "auth/invalid-email" }));
    const user = userEvent.setup();
    renderEsqueciSenha();

    // "a@b" passa a validação nativa do <input type="email"> (WHATWG não exige TLD),
    // mas o Firebase Auth é mais estrito e rejeitaria com auth/invalid-email — por
    // isso o mock, não o campo em si, é quem decide o "formato inválido" aqui.
    await enviar(user, "a@b");

    expect(await screen.findByRole("alert")).toHaveTextContent(/e-mail válido/i);
  });

  it("muitas tentativas: mostra mensagem de limite", async () => {
    mockResetPassword.mockRejectedValue(
      Object.assign(new Error("limite"), { code: "auth/too-many-requests" })
    );
    const user = userEvent.setup();
    renderEsqueciSenha();

    await enviar(user, "ana@a.com");

    expect(await screen.findByRole("alert")).toHaveTextContent(/muitas tentativas/i);
  });

  it("erro desconhecido: mostra mensagem genérica de conexão", async () => {
    mockResetPassword.mockRejectedValue(new Error("qualquer coisa"));
    const user = userEvent.setup();
    renderEsqueciSenha();

    await enviar(user, "ana@a.com");

    expect(await screen.findByRole("alert")).toHaveTextContent(/não foi possível enviar/i);
  });
});
