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
// D9 (2026-10-14): a página também é o ponto em que o idoso cadastrado por familiar assume a conta (anexo, item 3.3),
// então o botão exige as duas caixas do aceite e manda a versão dos documentos ao /auth/sync.
async function marcarAceite(user: ReturnType<typeof userEvent.setup>) {
  for (const caixa of await screen.findAllByRole("checkbox")) await user.click(caixa);
}

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
    await marcarAceite(user);
    await user.click(await screen.findByRole("button", { name: /^confirmar e-mail$/i }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/confirmado com sucesso/i));

    expect(mockGetCurrentUserToken).toHaveBeenCalledWith(true);
    expect(mockSyncUser).toHaveBeenCalledWith({ tipoPerfil: "idoso", aceiteDocumentos: "1.1" });
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
    await marcarAceite(user);
    await user.click(await screen.findByRole("button", { name: /^confirmar e-mail$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/falha de rede/i);
  });

  it("sem as duas caixas: mostra o erro, leva o foco à caixa desmarcada e não chama syncUser", async () => {
    mockOnAuthChange.mockImplementation((cb: (user: unknown) => void) => {
      cb({ uid: "uid-idoso-ficticio" });
      return () => {};
    });
    render(<ConfirmarEmail />);
    const user = userEvent.setup();
    const [termos] = await screen.findAllByRole("checkbox");
    await user.click(await screen.findByRole("button", { name: /^confirmar e-mail$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Marque as duas caixas para continuar.");
    expect(termos).toHaveFocus();
    expect(mockSyncUser).not.toHaveBeenCalled();
    expect(mockGetCurrentUserToken).not.toHaveBeenCalled();
  });
});
