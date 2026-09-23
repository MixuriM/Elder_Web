import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfirmarEmail from "./ConfirmarEmail";

const mockSyncUser = jest.fn();
const mockGetCurrentUserToken = jest.fn();
const mockOnAuthChange = jest.fn();

jest.mock("../lib/auth", () => ({
  syncUser: (...args: unknown[]) => mockSyncUser(...args),
  getCurrentUserToken: (...args: unknown[]) => mockGetCurrentUserToken(...args),
  onAuthChange: (cb: (user: unknown) => void) => mockOnAuthChange(cb),
}));

// Regressão da rodada 2 (item 3.3): ConfirmarEmail.tsx passou a chamar
// syncUser({ tipoPerfil: 'idoso' }) fixo, em vez de syncUser() sem argumento — pra
// destravar o anexo de firebase_uid do idoso. A justificativa foi que o branch de
// login de /auth/sync ignora tipo_perfil, então o fluxo original do Familiar (item
// 2.5, que já tem firebase_uid) não regride. Este teste prova o lado do frontend
// dessa afirmação: mesmo enviando tipoPerfil fixo, uma resposta de sucesso do
// backend (o formato real do branch de login, criado:false) ainda é tratada como
// sucesso pela página — nada aqui quebra ou reinterpreta o resultado.
describe("ConfirmarEmail", () => {
  beforeEach(() => {
    mockSyncUser.mockReset();
    mockGetCurrentUserToken.mockReset();
    mockOnAuthChange.mockReset();
  });

  it("Familiar com sessão ativa (firebase_uid já existente): syncUser chamado com tipoPerfil fixo, resultado continua sucesso", async () => {
    mockOnAuthChange.mockImplementation((cb: (user: unknown) => void) => {
      cb({ uid: "uid-familiar-existente" });
      return () => {};
    });
    mockGetCurrentUserToken.mockResolvedValue("token-fresco");
    // Resposta real do branch de login de /auth/sync quando firebase_uid já bate —
    // tipo_perfil enviado é ignorado pelo backend nesse caso.
    mockSyncUser.mockResolvedValue({ criado: false, usuario: { id: 10, tipo_perfil: "familiar" } });

    render(<ConfirmarEmail />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /^confirmar$/i }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/confirmado com sucesso/i));

    expect(mockGetCurrentUserToken).toHaveBeenCalledWith(true);
    expect(mockSyncUser).toHaveBeenCalledWith({ tipoPerfil: "idoso" });
    expect(mockSyncUser).toHaveBeenCalledTimes(1);
  });

  it("sem sessão ativa: mostra aviso pra fazer login, nunca chama syncUser", async () => {
    mockOnAuthChange.mockImplementation((cb: (user: unknown) => void) => {
      cb(null);
      return () => {};
    });

    render(<ConfirmarEmail />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/faça login primeiro/i);
    expect(mockSyncUser).not.toHaveBeenCalled();
  });

  it("falha em syncUser (ex.: backend fora do ar): mostra erro, não finge sucesso", async () => {
    mockOnAuthChange.mockImplementation((cb: (user: unknown) => void) => {
      cb({ uid: "uid-familiar-existente" });
      return () => {};
    });
    mockGetCurrentUserToken.mockResolvedValue("token-fresco");
    mockSyncUser.mockRejectedValue(new Error("falha de rede"));

    render(<ConfirmarEmail />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /^confirmar$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/falha de rede/i);
  });
});
