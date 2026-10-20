import "@testing-library/jest-dom";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ExcluirConta from "./ExcluirConta";

// Exclusão de conta (2026-10-20): seção no fim de Meu Perfil, diálogo com o que acontece por perfil, confirmação digitada,
// senha só para conta com senha, reautenticação ANTES da chamada à API e erro claro por caso. Firebase e API são mocks;
// nada aqui apaga conta de verdade. Nomes e senhas FICTÍCIOS.

const mockContaComSenha = jest.fn();
const mockReautenticar = jest.fn();
const mockLogout = jest.fn();
jest.mock("../../lib/auth", () => ({
  contaComSenha: () => mockContaComSenha(),
  reautenticar: (...args: unknown[]) => mockReautenticar(...args),
  logoutUser: () => mockLogout(),
}));

const mockExcluirConta = jest.fn();
jest.mock("../../services/perfilService", () => ({ excluirConta: () => mockExcluirConta() }));

const mockModoDemo = jest.fn();
jest.mock("../../hooks/useModoDemo", () => ({ useModoDemo: () => mockModoDemo() }));

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

const ordem: string[] = [];

function renderSecao(tipoPerfil: string | null = "idoso") {
  return render(
    <MemoryRouter>
      <ExcluirConta tipoPerfil={tipoPerfil} />
    </MemoryRouter>,
  );
}

async function abrir(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Excluir minha conta" }));
  return screen.getByRole("dialog");
}

const botaoExcluir = (dialogo: HTMLElement) => within(dialogo).getByRole("button", { name: /^excluir minha conta$|^excluindo/i });

async function digitarConfirmacao(user: ReturnType<typeof userEvent.setup>, dialogo: HTMLElement, texto = "EXCLUIR") {
  await user.type(within(dialogo).getByLabelText(/digite excluir/i), texto);
}

beforeEach(() => {
  ordem.length = 0;
  mockContaComSenha.mockReset().mockReturnValue(true);
  mockReautenticar.mockReset().mockImplementation(async () => void ordem.push("reautenticar"));
  mockExcluirConta.mockReset().mockImplementation(async () => void ordem.push("excluirConta"));
  mockLogout.mockReset().mockImplementation(async () => void ordem.push("logout"));
  mockNavigate.mockReset().mockImplementation(() => void ordem.push("navigate"));
  mockModoDemo.mockReset().mockReturnValue(false);
});

describe("ExcluirConta: a seção", () => {
  it("mostra o título, o aviso e o botão de perigo com área de toque de 44 px", () => {
    renderSecao();
    expect(screen.getByRole("heading", { level: 2, name: "Excluir minha conta" })).toBeInTheDocument();
    const botao = screen.getByRole("button", { name: "Excluir minha conta" });
    expect(botao).toBeEnabled();
    expect(botao.className).toMatch(/min-h-\[44px\]|min-h-11|h-11/);
  });

  it("conta de demonstração não mostra a seção", () => {
    mockModoDemo.mockReturnValue(true);
    const { container } = renderSecao();
    expect(container).toBeEmptyDOMElement();
  });

  it("não abre o diálogo sozinha", () => {
    renderSecao();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("ExcluirConta: o diálogo", () => {
  it("é um dialog modal com nome e descrição, e a descrição é o texto do que acontece", async () => {
    const user = userEvent.setup();
    renderSecao("idoso");
    const dialogo = await abrir(user);
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    expect(dialogo).toHaveAccessibleName(/excluir minha conta/i);
    expect(dialogo).toHaveAccessibleDescription(
      "Apaga seu histórico de saúde, remédios, agenda e alimentação e remove o acesso de familiares e cuidadores. Não dá para desfazer.",
    );
  });

  it.each(["cuidador", "familiar"])("perfil %s: descreve vínculos, autoria sem nome e idosos cadastrados", async (perfil) => {
    const user = userEvent.setup();
    renderSecao(perfil);
    const dialogo = await abrir(user);
    expect(dialogo).toHaveAccessibleDescription(
      "Remove seus vínculos e seus dados de perfil. O que você registrou sobre idosos continua no histórico deles, sem o seu nome (a conta passa a se chamar Conta excluída). Idosos que você cadastrou, que ainda não acessaram a própria conta e que não tenham outro vínculo aprovado também são apagados. Não dá para desfazer.",
    );
  });

  it("Esc fecha e devolve o foco ao botão que abriu", async () => {
    const user = userEvent.setup();
    renderSecao();
    const abridor = screen.getByRole("button", { name: "Excluir minha conta" });
    abridor.focus();
    await abrir(user);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(abridor).toHaveFocus();
  });

  it("Cancelar fecha sem chamar nada", async () => {
    const user = userEvent.setup();
    renderSecao();
    const dialogo = await abrir(user);
    await user.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mockReautenticar).not.toHaveBeenCalled();
    expect(mockExcluirConta).not.toHaveBeenCalled();
  });

  it("o foco fica preso: Tab no último elemento volta ao primeiro", async () => {
    const user = userEvent.setup();
    renderSecao();
    const dialogo = await abrir(user);
    await user.type(within(dialogo).getByLabelText(/digite excluir/i), "EXCLUIR");
    await user.type(within(dialogo).getByLabelText(/sua senha/i), "SenhaFicticia1!");
    within(dialogo).getByRole("button", { name: "Cancelar" }).focus();
    await user.tab();
    expect(botaoExcluir(dialogo)).toHaveFocus();
    await user.tab();
    expect(dialogo.contains(document.activeElement)).toBe(true);
  });
});

describe("ExcluirConta: o botão Excluir só liga com a confirmação", () => {
  it("desabilitado até digitar EXCLUIR exatamente (e a senha, na conta com senha)", async () => {
    const user = userEvent.setup();
    renderSecao();
    const dialogo = await abrir(user);
    expect(botaoExcluir(dialogo)).toBeDisabled();

    await digitarConfirmacao(user, dialogo, "excluir");
    expect(botaoExcluir(dialogo)).toBeDisabled();

    await user.clear(within(dialogo).getByLabelText(/digite excluir/i));
    await digitarConfirmacao(user, dialogo, "EXCLUIR");
    expect(botaoExcluir(dialogo)).toBeDisabled(); // falta a senha

    await user.type(within(dialogo).getByLabelText(/sua senha/i), "SenhaFicticia1!");
    expect(botaoExcluir(dialogo)).toBeEnabled();

    await user.type(within(dialogo).getByLabelText(/digite excluir/i), "X");
    expect(botaoExcluir(dialogo)).toBeDisabled();

    // Com a senha já digitada, minúsculas e espaço sozinhos ainda não bastam.
    for (const errado of ["excluir", "Excluir", " EXCLUIR", "EXCLUIR "]) {
      await user.clear(within(dialogo).getByLabelText(/digite excluir/i));
      await user.type(within(dialogo).getByLabelText(/digite excluir/i), errado);
      expect(botaoExcluir(dialogo)).toBeDisabled();
    }
  });

  it("conta com senha: o campo é do tipo password e aceita autocompletar de senha atual", async () => {
    const user = userEvent.setup();
    renderSecao();
    const dialogo = await abrir(user);
    const senha = within(dialogo).getByLabelText(/sua senha/i);
    expect(senha).toHaveAttribute("type", "password");
    expect(senha).toHaveAttribute("autocomplete", "current-password");
  });

  it("conta Google: sem campo de senha, e a confirmação sozinha liga o botão", async () => {
    mockContaComSenha.mockReturnValue(false);
    const user = userEvent.setup();
    renderSecao();
    const dialogo = await abrir(user);
    expect(within(dialogo).queryByLabelText(/sua senha/i)).not.toBeInTheDocument();
    expect(botaoExcluir(dialogo)).toBeDisabled();
    await digitarConfirmacao(user, dialogo);
    expect(botaoExcluir(dialogo)).toBeEnabled();
  });

  it("campos de texto têm 16 px (sem zoom no celular)", async () => {
    const user = userEvent.setup();
    renderSecao();
    const dialogo = await abrir(user);
    for (const campo of [within(dialogo).getByLabelText(/digite excluir/i), within(dialogo).getByLabelText(/sua senha/i)]) {
      expect(campo.className).toMatch(/text-base|text-\[16px\]|text-lg/);
    }
  });
});

describe("ExcluirConta: o fluxo", () => {
  it("conta com senha: reautentica com a senha, depois exclui, vai para a landing com o aviso e só então sai da sessão", async () => {
    const user = userEvent.setup();
    renderSecao();
    const dialogo = await abrir(user);
    await digitarConfirmacao(user, dialogo);
    await user.type(within(dialogo).getByLabelText(/sua senha/i), "SenhaFicticia1!");
    await user.click(botaoExcluir(dialogo));

    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
    expect(mockReautenticar).toHaveBeenCalledWith("SenhaFicticia1!");
    expect(ordem).toEqual(["reautenticar", "excluirConta", "navigate", "logout"]);
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true, state: { contaExcluida: true } });
  });

  it("conta Google: reautentica sem senha (popup), depois exclui", async () => {
    mockContaComSenha.mockReturnValue(false);
    const user = userEvent.setup();
    renderSecao("familiar");
    const dialogo = await abrir(user);
    await digitarConfirmacao(user, dialogo);
    await user.click(botaoExcluir(dialogo));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
    expect(mockReautenticar).toHaveBeenCalledWith(undefined);
    expect(ordem).toEqual(["reautenticar", "excluirConta", "navigate", "logout"]);
  });

  it("enquanto exclui, o botão diz Excluindo e fica desabilitado (sem envio duplo)", async () => {
    let terminar!: () => void;
    mockExcluirConta.mockImplementation(() => new Promise<void>((r) => (terminar = r)));
    const user = userEvent.setup();
    renderSecao();
    const dialogo = await abrir(user);
    await digitarConfirmacao(user, dialogo);
    await user.type(within(dialogo).getByLabelText(/sua senha/i), "SenhaFicticia1!");
    await user.click(botaoExcluir(dialogo));
    const ocupado = await within(dialogo).findByRole("button", { name: /excluindo/i });
    expect(ocupado).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument(); // não fecha no meio da exclusão
    terminar();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    expect(mockExcluirConta).toHaveBeenCalledTimes(1);
  });

  it("se sair da sessão falhar depois de excluir, ainda vai para a landing", async () => {
    mockLogout.mockRejectedValue(new Error("x"));
    const user = userEvent.setup();
    renderSecao();
    const dialogo = await abrir(user);
    await digitarConfirmacao(user, dialogo);
    await user.type(within(dialogo).getByLabelText(/sua senha/i), "SenhaFicticia1!");
    await user.click(botaoExcluir(dialogo));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true, state: { contaExcluida: true } }));
  });
});

describe("ExcluirConta: erros", () => {
  async function tentar(preparar: () => void, perfil = "idoso") {
    preparar();
    const user = userEvent.setup();
    renderSecao(perfil);
    const dialogo = await abrir(user);
    await digitarConfirmacao(user, dialogo);
    await user.type(within(dialogo).getByLabelText(/sua senha/i), "SenhaFicticia1!");
    await user.click(botaoExcluir(dialogo));
    return dialogo;
  }

  const erroFirebase = (code: string) => () => mockReautenticar.mockRejectedValue(Object.assign(new Error("x"), { code }));
  const erroApi = (status: number, message: string, codigo?: string) => () =>
    mockExcluirConta.mockRejectedValue(Object.assign(new Error(message), { status, codigo }));

  it.each([
    ["auth/wrong-password", "Senha incorreta. Confira e tente de novo."],
    ["auth/invalid-credential", "Senha incorreta. Confira e tente de novo."],
    ["auth/popup-closed-by-user", "A janela de confirmação foi fechada. Tente de novo."],
    ["auth/too-many-requests", "Muitas tentativas. Aguarde alguns minutos e tente de novo."],
    ["auth/network-request-failed", "Sem conexão. Verifique a internet e tente de novo."],
    ["auth/qualquer-outro", "Não foi possível confirmar sua identidade. Tente de novo."],
  ])("reautenticação falha (%s): alerta claro, API NÃO chamada, nada de sair da sessão", async (code, mensagem) => {
    const dialogo = await tentar(erroFirebase(code));
    expect(await within(dialogo).findByRole("alert")).toHaveTextContent(mensagem);
    expect(mockExcluirConta).not.toHaveBeenCalled();
    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(botaoExcluir(dialogo)).toBeEnabled();
  });

  it.each([
    ["401 reautenticar", erroApi(401, "Por segurança, confirme sua identidade de novo para excluir a conta.", "reautenticar"), "Por segurança, confirme sua identidade de novo para excluir a conta."],
    ["429", erroApi(429, "Muitas tentativas. Aguarde alguns minutos e tente de novo."), "Muitas tentativas. Aguarde alguns minutos e tente de novo."],
    ["502", erroApi(502, "Não foi possível excluir a conta agora. Nada foi apagado. Tente de novo em alguns minutos."), "Não foi possível excluir a conta agora. Nada foi apagado. Tente de novo em alguns minutos."],
    ["403", erroApi(403, "Ação indisponível no modo demonstração."), "Esta ação não está disponível nesta conta."],
    ["500", erroApi(500, "Erro interno."), "Não foi possível excluir a conta agora. Nada foi apagado. Tente de novo em alguns minutos."],
  ])("API %s: alerta claro, a conta continua logada e o diálogo aberto", async (_nome, preparar, mensagem) => {
    const dialogo = await tentar(preparar);
    expect(await within(dialogo).findByRole("alert")).toHaveTextContent(mensagem);
    expect(mockReautenticar).toHaveBeenCalledTimes(1);
    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(botaoExcluir(dialogo)).toBeEnabled();
  });

  it("falha de rede (erro sem status): mensagem de conexão", async () => {
    const dialogo = await tentar(() => mockExcluirConta.mockRejectedValue(new TypeError("Failed to fetch")));
    expect(await within(dialogo).findByRole("alert")).toHaveTextContent("Sem conexão com o servidor. Verifique a internet e tente de novo.");
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("nunca mostra a senha nem o corpo bruto do erro", async () => {
    const dialogo = await tentar(() => mockExcluirConta.mockRejectedValue(Object.assign(new Error("SenhaFicticia1! vazou"), { status: 500 })));
    const alerta = await within(dialogo).findByRole("alert");
    expect(alerta.textContent).not.toMatch(/SenhaFicticia1|vazou/);
  });

  it("o erro some ao tentar de novo", async () => {
    const dialogo = await tentar(erroFirebase("auth/wrong-password"));
    await within(dialogo).findByRole("alert");
    mockReautenticar.mockImplementation(async () => void ordem.push("reautenticar"));
    await userEvent.setup().click(botaoExcluir(dialogo));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
  });
});
