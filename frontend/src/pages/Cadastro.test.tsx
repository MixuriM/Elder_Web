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

    registerUser: (...args: unknown[]) =>
      mockRegisterUser(...args),

    loginWithGoogle: (...args: unknown[]) =>
      mockLoginWithGoogle(...args),

    syncUser: (...args: unknown[]) =>
      mockSyncUser(...args),

    sendEmailVerification: (...args: unknown[]) =>
      mockSendEmailVerification(...args),
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

async function preencherCamposBase(
  user: ReturnType<typeof userEvent.setup>,
  perfil: "idoso" | "cuidador" | "familiar" | null = "idoso"
) {
  if (perfil) {
    await user.click(
      screen.getByRole("radio", {
        name: new RegExp(perfil, "i"),
      })
    );
  }

  await user.type(
    screen.getByLabelText(/nome completo/i),
    "Ana Silva"
  );

  await user.type(
    screen.getByLabelText(/^e-mail$/i),
    "ana@a.com"
  );

  await user.type(
    screen.getByLabelText(/^senha$/i),
    "123456"
  );

  await user.type(
    screen.getByLabelText(/^confirmação da senha$/i),
    "123456"
  );
}

describe("Cadastro", () => {
  beforeEach(() => {
    mockRegisterUser.mockReset();

    mockLoginWithGoogle.mockReset();

    mockSyncUser.mockReset();

    mockSendEmailVerification.mockReset();

    mockNavigate.mockReset();

    // MUDANÇA:
    // Define retorno padrão para a confirmação de e-mail.
    mockSendEmailVerification.mockResolvedValue(true);
  });

  it(
    "cadastro de idoso com sucesso: dispara sendEmailVerification (3.3), sincroniza e navega pra /welcome avisando da confirmação",
    async () => {
      mockRegisterUser.mockResolvedValue(undefined);

      mockSendEmailVerification.mockResolvedValue(true);

      mockSyncUser.mockResolvedValue({
        criado: true,
      });

      const user = userEvent.setup();

      renderCadastro();

      await preencherCamposBase(user);

      await user.click(
        screen.getByRole("button", {
          name: /criar minha conta/i,
        })
      );

      await waitFor(() =>
        expect(mockNavigate).toHaveBeenCalledWith(
          "/welcome",
          {
            state: {
              cadastroSucesso: true,
              confirmarEmail: true,
            },
          }
        )
      );

      expect(mockSyncUser).toHaveBeenCalledWith(
        expect.objectContaining({
          tipoPerfil: "idoso",
          nome: "Ana Silva",
        })
      );

      expect(
        mockSendEmailVerification
      ).toHaveBeenCalledTimes(1);
    }
  );

  it.each(["familiar", "idoso"])(
    "perfil %s: dispara sendEmailVerification antes de sincronizar",
    async (perfil) => {
      mockRegisterUser.mockResolvedValue(undefined);

      mockSyncUser.mockResolvedValue({
        criado: true,
      });

      const user = userEvent.setup();

      renderCadastro();

      await preencherCamposBase(
        user,
        perfil as "idoso" | "familiar"
      );

      await user.click(
        screen.getByRole("button", {
          name: /criar minha conta/i,
        })
      );

      await waitFor(() =>
        expect(
          mockSendEmailVerification
        ).toHaveBeenCalledTimes(1)
      );

      expect(
        mockSyncUser
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          tipoPerfil: perfil,
        })
      );
    }
  );

  it(
    "perfil cuidador: NÃO dispara sendEmailVerification",
    async () => {
      mockRegisterUser.mockResolvedValue(undefined);

      mockSyncUser.mockResolvedValue({
        criado: true,
      });

      const user = userEvent.setup();

      renderCadastro();

      await preencherCamposBase(
        user,
        "cuidador"
      );

      await user.click(
        screen.getByRole("button", {
          name: /criar minha conta/i,
        })
      );

      await waitFor(() =>
        expect(
          mockSyncUser
        ).toHaveBeenCalled()
      );

      expect(
        mockSendEmailVerification
      ).not.toHaveBeenCalled();
    }
  );

  it(
    "Firebase rejeita o cadastro (e-mail já em uso): mostra erro, não chama syncUser",
    async () => {
      mockRegisterUser.mockRejectedValue(
        Object.assign(
          new Error("já existe"),
          {
            code: "auth/email-already-in-use",
          }
        )
      );

      const user = userEvent.setup();

      renderCadastro();

      await preencherCamposBase(user);

      await user.click(
        screen.getByRole("button", {
          name: /criar minha conta/i,
        })
      );

      expect(
        await screen.findByRole("alert")
      ).toHaveTextContent(
        /já existe uma conta com este e-mail/i
      );

      expect(
        mockSyncUser
      ).not.toHaveBeenCalled();

      expect(
        mockNavigate
      ).not.toHaveBeenCalled();
    }
  );

  it(
    "sem escolher o perfil: e-mail/senha barrado pelo radio required; Google mostra erro com role=alert",
    async () => {
      const user = userEvent.setup();

      renderCadastro();

      await preencherCamposBase(
        user,
        null
      );

      await user.click(
        screen.getByRole("button", {
          name: /criar minha conta/i,
        })
      );

      expect(
        mockRegisterUser
      ).not.toHaveBeenCalled();

      await user.click(
        screen.getByRole("button", {
          name: /google/i,
        })
      );

      expect(
        await screen.findByRole("alert")
      ).toHaveTextContent(
        /escolha se você é/i
      );

      expect(
        mockLoginWithGoogle
      ).not.toHaveBeenCalled();
    }
  );

  it(
    "senha e confirmação diferentes: erro com role=alert, não cria conta",
    async () => {
      const user = userEvent.setup();

      renderCadastro();

      await preencherCamposBase(user);

      await user.clear(
        screen.getByLabelText(
          /^confirmação da senha$/i
        )
      );

      await user.type(
        screen.getByLabelText(
          /^confirmação da senha$/i
        ),
        "654321"
      );

      await user.click(
        screen.getByRole("button", {
          name: /criar minha conta/i,
        })
      );

      expect(
        await screen.findByRole("alert")
      ).toHaveTextContent(
        /senhas não são iguais/i
      );

      expect(
        mockRegisterUser
      ).not.toHaveBeenCalled();
    }
  );

  it(
    "botão mostrar/ocultar senha alterna o tipo do campo",
    async () => {
      const user = userEvent.setup();

      renderCadastro();

      const campo =
        screen.getByLabelText(
          /^senha$/i
        );

      expect(campo).toHaveAttribute(
        "type",
        "password"
      );

      await user.click(
        screen.getByRole("button", {
          name: /mostrar senha/i,
        })
      );

      expect(campo).toHaveAttribute(
        "type",
        "text"
      );

      await user.click(
        screen.getByRole("button", {
          name: /ocultar senha/i,
        })
      );

      expect(campo).toHaveAttribute(
        "type",
        "password"
      );
    }
  );

  it(
    "campos com limite de tamanho e autocomplete",
    () => {
      renderCadastro();

      expect(
        screen.getByLabelText(
          /nome completo/i
        )
      ).toHaveAttribute(
        "maxlength",
        "150"
      );

      expect(
        screen.getByLabelText(
          /^e-mail$/i
        )
      ).toHaveAttribute(
        "maxlength",
        "255"
      );

      expect(
        screen.getByLabelText(
          /^senha$/i
        )
      ).toHaveAttribute(
        "autocomplete",
        "new-password"
      );

      expect(
        screen.getByLabelText(
          /^senha$/i
        )
      ).toHaveAttribute(
        "minlength",
        "6"
      );
    }
  );

  it(
    "desabilita o botão de criar conta enquanto a requisição está em andamento",
    async () => {
      let resolverRegistro!: () => void;

      mockRegisterUser.mockReturnValue(
        new Promise<void>((resolve) => {
          resolverRegistro = resolve;
        })
      );

      const user = userEvent.setup();

      renderCadastro();

      await preencherCamposBase(user);

      const botao =
        screen.getByRole("button", {
          name: /criar minha conta/i,
        });

      await user.click(botao);

      expect(botao).toBeDisabled();

      resolverRegistro();

      await waitFor(() =>
        expect(botao).not.toBeDisabled()
      );
    }
  );
});