import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Alimentacao from "./Alimentacao";
import { AcessoContext } from "../contexts/useAcesso";
import { listaPerfilIdoso } from "../hooks/idososFixtures";

// O formulário tem teste próprio (components/Alimentacao/ModalRegistrarRefeicao.test.tsx) e o histórico também
// (HistoricoAlimentar.test.tsx). Aqui o histórico é um marcador: só importa a versão que a página passa a ele, que sobe a cada
// refeição registrada, e se recebe o botão do cartão de lista vazia. Valores obviamente falsos.
jest.mock("../components/Alimentacao/HistoricoAlimentar", () => ({
  __esModule: true,
  default: ({ versao = 0, onAdicionar }: { versao?: number; onAdicionar?: () => void }) => (
    <section aria-label="Histórico alimentar" data-versao={versao}>
      {onAdicionar && (
        <button type="button" onClick={onAdicionar}>
          Registrar primeira refeição
        </button>
      )}
    </section>
  ),
}));

const mockUseIdosos = jest.fn();
jest.mock("../hooks/useIdososVinculados", () => ({ useIdososVinculados: () => mockUseIdosos() }));
jest.mock("../lib/auth", () => ({ getCurrentUserToken: () => Promise.resolve("token-fake") }));

function respostaJson(status: number, corpo: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(corpo) } as Response;
}

function renderAlimentacao(perfil: string | null = "idoso") {
  return render(
    <AcessoContext.Provider
      value={{ tipoPerfil: perfil, temVinculoAprovado: true, temVinculoPendente: false, estado: "ok", vinculos: null }}
    >
      <MemoryRouter>
        <Alimentacao />
      </MemoryRouter>
    </AcessoContext.Provider>,
  );
}

async function registrar(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Registrar refeição" }));
  const dialogo = screen.getByRole("dialog", { name: "Registrar refeição" });
  await user.type(within(dialogo).getByLabelText("Descrição"), "descricao-falsa");
  fireEvent.change(within(dialogo).getByLabelText("Data e hora"), { target: { value: "2026-10-10T12:30" } });
  await user.click(within(dialogo).getByRole("button", { name: "Salvar refeição" }));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseIdosos.mockReturnValue(listaPerfilIdoso);
  global.fetch = jest.fn();
});

describe("Alimentacao: página", () => {
  it("só o histórico fica na tela: o formulário não aparece até clicar em Registrar refeição", () => {
    renderAlimentacao();

    expect(screen.getByRole("heading", { level: 1, name: "Alimentação" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Histórico alimentar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar refeição" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Descrição")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("clicar em Registrar refeição abre o modal sobreposto; Cancelar fecha sem enviar", async () => {
    const user = userEvent.setup();
    renderAlimentacao();

    await user.click(screen.getByRole("button", { name: "Registrar refeição" }));
    expect(screen.getByRole("dialog", { name: "Registrar refeição" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("o botão do cartão de lista vazia abre o mesmo modal", async () => {
    const user = userEvent.setup();
    renderAlimentacao();

    await user.click(screen.getByRole("button", { name: "Registrar primeira refeição" }));

    expect(screen.getByRole("dialog", { name: "Registrar refeição" })).toBeInTheDocument();
  });

  it("depois de registrar: o modal fecha, a página avisa em role=status e o histórico recebe uma versão nova", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 31 }));
    const user = userEvent.setup();
    renderAlimentacao();
    const historico = screen.getByRole("region", { name: "Histórico alimentar" });
    expect(historico).toHaveAttribute("data-versao", "0");

    await registrar(user);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("Refeição registrada.").closest('[role="status"]')).not.toBeNull();
    expect(historico).toHaveAttribute("data-versao", "1");
  });

  it("registro com erro não fecha o modal nem recarrega o histórico", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(403, {}));
    const user = userEvent.setup();
    renderAlimentacao();

    await registrar(user);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Histórico alimentar" })).toHaveAttribute("data-versao", "0");
    expect(screen.queryByText("Refeição registrada.")).not.toBeInTheDocument();
  });

  it("abrir de novo limpa o aviso anterior", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(201, { id: 31 }));
    const user = userEvent.setup();
    renderAlimentacao();
    await registrar(user);
    await screen.findByText("Refeição registrada.");

    await user.click(screen.getByRole("button", { name: "Registrar refeição" }));

    expect(screen.queryByText("Refeição registrada.")).not.toBeInTheDocument();
  });

  it("cuidador não registra: sem o botão da página e sem o botão da lista vazia", () => {
    renderAlimentacao("cuidador");

    expect(screen.queryByRole("button", { name: "Registrar refeição" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registrar primeira refeição" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Histórico alimentar" })).toBeInTheDocument();
  });

  it("familiar registra: vê o botão", () => {
    renderAlimentacao("familiar");

    expect(screen.getByRole("button", { name: "Registrar refeição" })).toBeInTheDocument();
  });
});
