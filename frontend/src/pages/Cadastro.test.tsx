import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Cadastro from "./Cadastro";

jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(),
  GoogleAuthProvider: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  sendEmailVerification: jest.fn(),
}));
jest.mock("../lib/firebase", () => ({ app: {} }));

const mockRegisterUser = jest.fn();
const mockLoginWithGoogle = jest.fn();
const mockSyncUser = jest.fn();
const mockSendEmailVerification = jest.fn();
jest.mock("../lib/auth", () => {
  const actual = jest.requireActual("../lib/auth");
  return {
    ...actual,
    registerUser: (...args: unknown[]) => mockRegisterUser(...args),
    loginWithGoogle: (...args: unknown[]) => mockLoginWithGoogle(...args),
    syncUser: (...args: unknown[]) => mockSyncUser(...args),
    sendEmailVerification: (...args: unknown[]) => mockSendEmailVerification(...args),
  };
});

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

function renderCadastro() {
  return render(
    <MemoryRouter>
      <Cadastro />
    </MemoryRouter>
  );
}

async function preencherCamposBase(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/nome completo/i), "Ana Silva");
  await user.type(screen.getByLabelText(/^e-mail$/i), "ana@a.com");
  await user.type(screen.getByLabelText(/^senha$/i), "123456");
}

describe("Cadastro", () => {
  beforeEach(() => {
    mockRegisterUser.mockReset();
    mockLoginWithGoogle.mockReset();
    mockSyncUser.mockReset();
    mockSendEmailVerification.mockReset();
    mockNavigate.mockReset();
  });

  it("cadastro (perfil padrão idoso) com sucesso: sincroniza e navega pra /welcome", async () => {
    mockRegisterUser.mockResolvedValue(undefined);
    mockSyncUser.mockResolvedValue({ criado: true });
    const user = userEvent.setup();
    renderCadastro();

    await preencherCamposBase(user);
    await user.click(screen.getByRole("button", { name: /criar minha conta/i }));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/welcome", { state: { cadastroSucesso: true } })
    );
    expect(mockSyncUser).toHaveBeenCalledWith(
      expect.objectContaining({ tipoPerfil: "idoso", nome: "Ana Silva" })
    );
    expect(mockSendEmailVerification).not.toHaveBeenCalled();
  });

  it("perfil familiar: dispara sendEmailVerification antes de sincronizar", async () => {
    mockRegisterUser.mockResolvedValue(undefined);
    mockSyncUser.mockResolvedValue({ criado: true });
    const user = userEvent.setup();
    renderCadastro();

    await user.click(screen.getByRole("radio", { name: /familiar/i }));
    await preencherCamposBase(user);
    await user.click(screen.getByRole("button", { name: /criar minha conta/i }));

    await waitFor(() => expect(mockSendEmailVerification).toHaveBeenCalledTimes(1));
    expect(mockSyncUser).toHaveBeenCalledWith(expect.objectContaining({ tipoPerfil: "familiar" }));
  });

  it("Firebase rejeita o cadastro (e-mail já em uso): mostra erro, não chama syncUser", async () => {
    mockRegisterUser.mockRejectedValue(
      Object.assign(new Error("já existe"), { code: "auth/email-already-in-use" })
    );
    const user = userEvent.setup();
    renderCadastro();

    await preencherCamposBase(user);
    await user.click(screen.getByRole("button", { name: /criar minha conta/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/criar a conta/i);
    expect(mockSyncUser).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("desabilita o botão de criar conta enquanto a requisição está em andamento", async () => {
    let resolverRegistro!: () => void;
    mockRegisterUser.mockReturnValue(
      new Promise<void>((resolve) => {
        resolverRegistro = resolve;
      })
    );
    const user = userEvent.setup();
    renderCadastro();

    await preencherCamposBase(user);
    const botao = screen.getByRole("button", { name: /criar minha conta/i });
    await user.click(botao);

    expect(botao).toBeDisabled();

    resolverRegistro();
    await waitFor(() => expect(botao).not.toBeDisabled());
  });
});
