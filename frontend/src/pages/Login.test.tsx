import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Login from "./Login";
import { SyncError } from "../lib/auth";

jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(),
  GoogleAuthProvider: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signInWithPopup: jest.fn(),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  onAuthStateChanged: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  sendEmailVerification: jest.fn(),
}));
jest.mock("../lib/firebase", () => ({ app: {} }));

const mockSignOut = jest.fn();
const mockLoginUser = jest.fn();
const mockLoginWithGoogle = jest.fn();
const mockSyncUser = jest.fn();
jest.mock("../lib/auth", () => {
  const actual = jest.requireActual("../lib/auth");
  return {
    ...actual,
    loginUser: (...args: unknown[]) => mockLoginUser(...args),
    loginWithGoogle: (...args: unknown[]) => mockLoginWithGoogle(...args),
    syncUser: (...args: unknown[]) => mockSyncUser(...args),
  };
});

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

async function preencherEEnviar(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^e-mail$/i), "ana@a.com");
  await user.type(screen.getByLabelText(/^senha$/i), "123456");
  await user.click(screen.getByRole("button", { name: /^entrar$/i }));
}

describe("Login", () => {
  beforeEach(() => {
    mockLoginUser.mockReset();
    mockLoginWithGoogle.mockReset();
    mockSyncUser.mockReset();
    mockNavigate.mockReset();
    mockSignOut.mockReset();
    mockSignOut.mockResolvedValue(undefined);
  });

  it("login e sync com sucesso: navega pra /Home", async () => {
    mockLoginUser.mockResolvedValue(undefined);
    mockSyncUser.mockResolvedValue({ criado: false });
    const user = userEvent.setup();
    renderLogin();

    await preencherEEnviar(user);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/Home"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("Firebase rejeita a senha: mostra erro de credencial com orientação ao idoso cadastrado por familiar e link pro cadastro, não navega, não chama syncUser", async () => {
    mockLoginUser.mockRejectedValue(Object.assign(new Error("senha errada"), { code: "auth/wrong-password" }));
    const user = userEvent.setup();
    renderLogin();

    await preencherEEnviar(user);

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(/e-mail ou senha incorretos/i);
    expect(alerta).toHaveTextContent(/familiar cadastrou você/i);
    expect(screen.getByRole("link", { name: /ir para o cadastro/i })).toHaveAttribute("href", "/cadastro");
    expect(mockSyncUser).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("Google autenticou mas sem conta no Elder (400 tipo_perfil): orienta a criar conta, link pro cadastro, encerra a sessão e não navega", async () => {
    mockLoginWithGoogle.mockResolvedValue(undefined);
    mockSyncUser.mockRejectedValue(
      new SyncError(400, "tipo_perfil obrigatório ao criar conta (idoso, cuidador ou familiar).")
    );
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole("button", { name: /google/i }));

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(/ainda não tem uma conta/i);
    expect(screen.getByRole("link", { name: /ir para o cadastro/i })).toBeInTheDocument();
    expect(mockSignOut).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("erro que não é de conta inexistente (rede): sem link pro cadastro e sem encerrar sessão", async () => {
    mockLoginUser.mockRejectedValue(Object.assign(new Error("x"), { code: "auth/too-many-requests" }));
    const user = userEvent.setup();
    renderLogin();

    await preencherEEnviar(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(/muitas tentativas/i);
    expect(screen.queryByRole("link", { name: /ir para o cadastro/i })).not.toBeInTheDocument();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("campos com autocomplete, limite de e-mail e botão mostrar/ocultar senha", async () => {
    const user = userEvent.setup();
    renderLogin();

    const email = screen.getByLabelText(/^e-mail$/i);
    const senha = screen.getByLabelText(/^senha$/i);
    expect(email).toHaveAttribute("autocomplete", "username");
    expect(email).toHaveAttribute("maxlength", "255");
    expect(senha).toHaveAttribute("autocomplete", "current-password");

    expect(senha).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: /mostrar senha/i }));
    expect(senha).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: /ocultar senha/i }));
    expect(senha).toHaveAttribute("type", "password");
  });

  it("login funciona mas /auth/sync falha com 5xx: mostra mensagem de servidor iniciando, não navega", async () => {
    mockLoginUser.mockResolvedValue(undefined);
    mockSyncUser.mockRejectedValue(new SyncError(503, "Firebase Auth indisponível no momento."));
    const user = userEvent.setup();
    renderLogin();

    await preencherEEnviar(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(/servidor está iniciando/i);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("desabilita o botão de entrar enquanto a requisição está em andamento", async () => {
    let resolverLogin!: () => void;
    mockLoginUser.mockReturnValue(
      new Promise<void>((resolve) => {
        resolverLogin = resolve;
      })
    );
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/^e-mail$/i), "ana@a.com");
    await user.type(screen.getByLabelText(/^senha$/i), "123456");
    const botao = screen.getByRole("button", { name: /^entrar$/i });
    await user.click(botao);

    expect(botao).toBeDisabled();

    resolverLogin();
    await waitFor(() => expect(botao).not.toBeDisabled());
  });
});
