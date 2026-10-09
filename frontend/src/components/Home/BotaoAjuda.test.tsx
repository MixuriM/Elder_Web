import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";

import BotaoAjuda from "./BotaoAjuda";

expect.extend(toHaveNoViolations);

const mockChamarApi = jest.fn();
jest.mock("../../lib/chamarApi", () => ({ chamarApi: (...a: unknown[]) => mockChamarApi(...a) }));

const erroHttp = (status: number) => Object.assign(new Error("texto do servidor"), { status });
const AVISO = "Este aviso não substitui a ligação para a emergência. Se for urgente, ligue 192.";

beforeEach(() => mockChamarApi.mockReset());

async function abrir() {
  const user = userEvent.setup();
  render(<BotaoAjuda />);
  await user.click(screen.getByRole("button", { name: "Preciso de ajuda" }));
  return user;
}

const botaoAvisar = () => screen.getByRole("button", { name: /avisar minha família e cuidadores|avisando/i });

describe("BotaoAjuda: diálogo", () => {
  it("abre um diálogo com a ligação para o 192 em destaque, o 193 e o aviso fixo", async () => {
    await abrir();
    const dialogo = screen.getByRole("dialog", { name: "Pedir ajuda" });
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("link", { name: "Ligar para o SAMU (192)" })).toHaveAttribute("href", "tel:192");
    expect(screen.getByText("192", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("Bombeiros: 193")).toBeInTheDocument();
    expect(screen.getByText(AVISO)).toBeInTheDocument();
    expect(botaoAvisar()).toBeEnabled();
    expect(mockChamarApi).not.toHaveBeenCalled();
  });

  it("o diálogo fica fora do cabeçalho (o backdrop-blur do header prenderia o position: fixed)", async () => {
    const user = userEvent.setup();
    render(
      <header>
        <BotaoAjuda />
      </header>,
    );
    await user.click(screen.getByRole("button", { name: "Preciso de ajuda" }));
    expect(screen.getByRole("dialog").closest("header")).toBeNull();
  });

  it("Esc fecha e o foco volta ao botão", async () => {
    const user = await abrir();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preciso de ajuda" })).toHaveFocus();
  });

  it("clicar fora não fecha", async () => {
    const user = await abrir();
    await user.click(screen.getByRole("dialog").parentElement as HTMLElement);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("Tab fica preso dentro do diálogo", async () => {
    const user = await abrir();
    for (let i = 0; i < 6; i++) {
      await user.tab();
      expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it("sem violações de axe", async () => {
    await abrir();
    expect(await axe(document.body, { rules: { "color-contrast": { enabled: false } } })).toHaveNoViolations();
  });
});

describe("BotaoAjuda: avisar família e cuidadores", () => {
  it("enquanto envia: botão desativado e status anunciado; depois, quantos foram avisados", async () => {
    let concluir: (v: unknown) => void = () => {};
    mockChamarApi.mockReturnValue(new Promise((r) => (concluir = r)));
    const user = await abrir();
    await user.click(botaoAvisar());

    expect(mockChamarApi).toHaveBeenCalledWith("/emergencia/avisar", { method: "POST" });
    expect(botaoAvisar()).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Enviando o aviso...");

    await act(async () => concluir({ avisados: 2, falharam: 1, mensagem: "Aviso enviado." }));
    expect(screen.getByRole("status")).toHaveTextContent("Avisamos 2 de 3 pessoas.");
    expect(botaoAvisar()).toBeEnabled();
  });

  it("o resultado é rolado para a vista (em tela pequena ele fica abaixo da dobra do diálogo)", async () => {
    const rolar = jest.fn();
    Element.prototype.scrollIntoView = rolar;
    mockChamarApi.mockResolvedValue({ avisados: 1, falharam: 0 });
    const user = await abrir();
    await user.click(botaoAvisar());
    await screen.findByText("Avisamos 1 de 1 pessoa.");
    expect(rolar.mock.contexts).toContain(screen.getByText("Avisamos 1 de 1 pessoa."));
  });

  it("singular: Avisamos 1 de 1 pessoa.", async () => {
    mockChamarApi.mockResolvedValue({ avisados: 1, falharam: 0 });
    const user = await abrir();
    await user.click(botaoAvisar());
    expect(await screen.findByText("Avisamos 1 de 1 pessoa.")).toBeInTheDocument();
  });

  it("sem ninguém vinculado: orienta ligar 192 e vincular alguém depois", async () => {
    mockChamarApi.mockResolvedValue({ avisados: 0, falharam: 0 });
    const user = await abrir();
    await user.click(botaoAvisar());
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Ninguém está vinculado para receber o aviso. Ligue 192. Depois, vincule alguém da família ou um cuidador.",
    );
  });

  it.each([
    [502, "Não foi possível avisar. Ligue 192."],
    [503, "Não foi possível avisar agora. Ligue 192."],
    [429, "Você já pediu ajuda há pouco. Se for urgente, ligue 192."],
    [500, "Não foi possível avisar. Ligue 192."],
  ])("erro %i: mensagem fixa, nunca o texto do servidor", async (status, texto) => {
    mockChamarApi.mockRejectedValue(erroHttp(status));
    const user = await abrir();
    await user.click(botaoAvisar());
    expect(await screen.findByText(texto)).toBeInTheDocument();
    expect(screen.queryByText("texto do servidor")).not.toBeInTheDocument();
  });

  it("falha de rede (sem status): falha com 192", async () => {
    mockChamarApi.mockRejectedValue(new Error("rede"));
    const user = await abrir();
    await user.click(botaoAvisar());
    expect(await screen.findByText("Não foi possível avisar. Ligue 192.")).toBeInTheDocument();
  });

  it("reabrir depois de um resultado começa limpo", async () => {
    mockChamarApi.mockResolvedValue({ avisados: 1, falharam: 0 });
    const user = await abrir();
    await user.click(botaoAvisar());
    await screen.findByText("Avisamos 1 de 1 pessoa.");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Preciso de ajuda" }));
    expect(screen.queryByText("Avisamos 1 de 1 pessoa.")).not.toBeInTheDocument();
  });
});
