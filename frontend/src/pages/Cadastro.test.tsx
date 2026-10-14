import "@testing-library/jest-dom";

import { render, screen, waitFor } from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import { MemoryRouter } from "react-router-dom";

import Cadastro from "./Cadastro";
import {
  MENSAGEM_ACEITE,
  TEXTO_ACEITE_TERMOS,
  TEXTO_CONSENTIMENTO_SAUDE,
} from "../lib/documentosLegais";

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

const caixaTermos = () =>
  screen.getByRole("checkbox", { name: TEXTO_ACEITE_TERMOS });
const caixaSaude = () =>
  screen.getByRole("checkbox", { name: TEXTO_CONSENTIMENTO_SAUDE });

async function marcarAceite(user: ReturnType<typeof userEvent.setup>) {
  await user.click(caixaTermos());
  await user.click(caixaSaude());
}

async function preencherCamposBase(
  user: ReturnType<typeof userEvent.setup>,
  perfil: "idoso" | "cuidador" | "familiar" | null = "idoso",
  aceitar = true
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

  if (aceitar) await marcarAceite(user);
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

  it.each(["familiar", "idoso", "cuidador"])(
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
        perfil as "idoso" | "familiar" | "cuidador"
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
    // Cuidador também confirma o e-mail: o aviso de emergência só vai para e-mail verificado.
    "perfil cuidador: também dispara sendEmailVerification",
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
      ).toHaveBeenCalledTimes(1);
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

  it.each(["idoso", "familiar", "cuidador"] as const)(
    "perfil %s: falha ao enviar o e-mail de confirmação não derruba o cadastro",
    async (perfil) => {
      mockRegisterUser.mockResolvedValue(undefined);
      mockSendEmailVerification.mockRejectedValue(
        Object.assign(new Error("falhou para ana@a.com"), { code: "auth/too-many-requests" })
      );
      mockSyncUser.mockResolvedValue({ criado: true });
      const espiao = jest.spyOn(console, "error").mockImplementation(() => {});

      const user = userEvent.setup();
      renderCadastro();
      await preencherCamposBase(user, perfil);
      await user.click(screen.getByRole("button", { name: /criar minha conta/i }));

      await waitFor(() =>
        expect(mockNavigate).toHaveBeenCalledWith("/welcome", {
          state: {
            cadastroSucesso: true,
            confirmarEmail: false,
            confirmacaoFalhou: true,
            reenviarNoPerfil: perfil !== "idoso",
          },
        })
      );
      expect(mockSyncUser).toHaveBeenCalledWith(expect.objectContaining({ tipoPerfil: perfil }));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(JSON.stringify(espiao.mock.calls)).not.toContain("ana@a.com");
      espiao.mockRestore();
    }
  );

  it("Google, perfil cuidador: também pede a confirmação (no-op se o Google já confirmou)", async () => {
    mockLoginWithGoogle.mockResolvedValue(undefined);
    mockSendEmailVerification.mockResolvedValue(false);
    mockSyncUser.mockResolvedValue({ criado: true });

    const user = userEvent.setup();
    renderCadastro();
    await user.click(screen.getByRole("radio", { name: /cuidador/i }));
    await marcarAceite(user);
    await user.click(screen.getByRole("button", { name: /google/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    expect(mockSendEmailVerification).toHaveBeenCalledTimes(1);
  });

  describe("aceite dos termos e consentimento de saúde (só interface)", () => {
    it("as duas caixas nascem desmarcadas e o botão segue habilitado", () => {
      renderCadastro();
      expect(caixaTermos()).not.toBeChecked();
      expect(caixaSaude()).not.toBeChecked();
      expect(screen.getByRole("button", { name: /criar minha conta/i })).toBeEnabled();
      expect(screen.getByRole("button", { name: /google/i })).toBeEnabled();
    });

    it("e-mail e senha sem as caixas: não cria conta, mostra o erro e leva o foco à primeira caixa", async () => {
      const user = userEvent.setup();
      renderCadastro();
      await preencherCamposBase(user, "idoso", false);
      await user.click(screen.getByRole("button", { name: /criar minha conta/i }));

      expect(await screen.findByRole("alert")).toHaveTextContent(MENSAGEM_ACEITE);
      expect(caixaTermos()).toHaveFocus();
      expect(caixaTermos()).toHaveAccessibleDescription(MENSAGEM_ACEITE);
      expect(mockRegisterUser).not.toHaveBeenCalled();
      expect(mockSyncUser).not.toHaveBeenCalled();
    });

    it("só a primeira caixa marcada: não cria conta e o foco vai para a segunda", async () => {
      const user = userEvent.setup();
      renderCadastro();
      await preencherCamposBase(user, "idoso", false);
      await user.click(caixaTermos());
      await user.click(screen.getByRole("button", { name: /criar minha conta/i }));

      expect(await screen.findByRole("alert")).toHaveTextContent(MENSAGEM_ACEITE);
      expect(caixaSaude()).toHaveFocus();
      expect(mockRegisterUser).not.toHaveBeenCalled();
    });

    it("Google sem as caixas: a janela do Google não abre", async () => {
      const user = userEvent.setup();
      renderCadastro();
      await user.click(screen.getByRole("radio", { name: /idoso/i }));
      await user.click(caixaSaude());
      await user.click(screen.getByRole("button", { name: /google/i }));

      expect(await screen.findByRole("alert")).toHaveTextContent(MENSAGEM_ACEITE);
      expect(caixaTermos()).toHaveFocus();
      expect(mockLoginWithGoogle).not.toHaveBeenCalled();
    });

    it("Google com as duas caixas: segue o fluxo", async () => {
      mockLoginWithGoogle.mockResolvedValue(undefined);
      mockSyncUser.mockResolvedValue({ criado: true });
      const user = userEvent.setup();
      renderCadastro();
      await user.click(screen.getByRole("radio", { name: /idoso/i }));
      await marcarAceite(user);
      await user.click(screen.getByRole("button", { name: /google/i }));

      await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
      expect(mockLoginWithGoogle).toHaveBeenCalledTimes(1);
    });

    it("links dos documentos abrem em nova aba, com aviso para leitor de tela", () => {
      renderCadastro();
      for (const [nome, href] of [
        [/termos de uso/i, "/termos"],
        [/política de privacidade/i, "/privacidade"],
      ] as const) {
        const link = screen.getByRole("link", { name: nome });
        expect(link).toHaveAttribute("href", href);
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noopener noreferrer");
        expect(link).toHaveTextContent("(abre em nova aba)");
      }
    });
  });
});
