import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Vinculos from "./Vinculos";
import { AcessoContext } from "../contexts/useAcesso";

const mockGetCurrentUserToken = jest.fn();
jest.mock("../lib/auth", () => ({
  getCurrentUserToken: (...args: unknown[]) => mockGetCurrentUserToken(...args),
}));

function respostaJson(status: number, corpo: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(corpo) } as Response;
}

// Fixtures: dados fake, só para o teste.
const aprovado = {
  id: 12,
  tipo_vinculo: "cuidador",
  origem: "solicitacao_cuidador",
  status: "aprovado",
  data_solicitacao: "2026-10-01T10:00:00.000Z",
  data_resposta: "2026-10-02T10:00:00.000Z",
  confirmado_em: null,
  papel_do_chamador: "vinculado",
  permissoes: null,
  idoso: { id: 5, nome: "Maria da Silva", email_mascarado: "ma***@mail.com" },
  vinculado: { id: 8, nome: "João da Silva", email_mascarado: "jo***@mail.com" },
};

function renderComPerfil(tipoPerfil: string | null, tipo: "familiar" | "cuidador") {
  return render(
    <AcessoContext.Provider
      value={{ tipoPerfil, temVinculoAprovado: true, temVinculoPendente: false, estado: "ok" }}
    >
      <MemoryRouter>
        <Vinculos tipo={tipo} />
      </MemoryRouter>
    </AcessoContext.Provider>
  );
}

describe("Vinculos: Adicionar pessoa e resumo", () => {
  beforeEach(() => {
    mockGetCurrentUserToken.mockReset();
    mockGetCurrentUserToken.mockResolvedValue("token-fake");
    global.fetch = jest.fn().mockResolvedValue(respostaJson(200, { vinculos: [aprovado] }));
  });

  it("mostra o resumo em frases com a contagem do tipo da tela", async () => {
    renderComPerfil("cuidador", "cuidador");
    expect(await screen.findByText("1 cuidador vinculado")).toBeInTheDocument();
    expect(screen.getByText("Nenhum pedido aguardando resposta")).toBeInTheDocument();
  });

  it("cuidador: o botão abre o diálogo e Fechar devolve o foco ao botão", async () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    renderComPerfil("cuidador", "cuidador");
    await screen.findByText("1 cuidador vinculado");

    const botao = screen.getByRole("button", { name: "Adicionar pessoa" });
    await userEvent.click(botao);
    const dialogo = screen.getByRole("dialog", { name: "Adicionar pessoa" });
    await userEvent.click(within(dialogo).getByRole("button", { name: "Fechar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(botao).toHaveFocus();
    expect(log).not.toHaveBeenCalled();
  });

  it("familiar na tela de família também vê o botão", async () => {
    renderComPerfil("familiar", "familiar");
    await screen.findByText("Nenhum familiar vinculado");
    expect(screen.getByRole("button", { name: "Adicionar pessoa" })).toBeInTheDocument();
  });

  it.each([
    ["idoso", "cuidador"],
    ["familiar", "cuidador"],
    [null, "familiar"],
  ] as const)("perfil %s na tela %s: sem botão", async (perfil, tipo) => {
    renderComPerfil(perfil, tipo);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("button", { name: "Adicionar pessoa" })).not.toBeInTheDocument();
  });

  it("idoso vê como a pessoa entra: pede pelo e-mail do idoso e ele aprova", async () => {
    global.fetch = jest.fn().mockResolvedValue(respostaJson(200, { vinculos: [] }));
    renderComPerfil("idoso", "cuidador");
    expect(
      await screen.findByText(/o cuidador pede o vínculo usando o seu e-mail e você responde ao pedido/i)
    ).toBeInTheDocument();
  });
});

describe("Vinculos: pedir vínculo pelo modal", () => {
  it("cuidador envia o pedido, a lista recarrega e mostra o pedido como pendente", async () => {
    const pendente = { ...aprovado, id: 20, status: "pendente", idoso: { id: null, nome: null, email_mascarado: null } };
    let enviado = false;
    global.fetch = jest.fn((url: string, init?: RequestInit) => {
      if (init?.method === "POST" && String(url).endsWith("/vinculo/solicitar-cuidador")) {
        enviado = true;
        return Promise.resolve(respostaJson(201, { id: 20 }));
      }
      return Promise.resolve(respostaJson(200, { vinculos: enviado ? [aprovado, pendente] : [aprovado] }));
    }) as jest.Mock;

    renderComPerfil("cuidador", "cuidador");
    await screen.findByText("1 cuidador vinculado");
    await userEvent.click(screen.getByRole("button", { name: "Adicionar pessoa" }));

    await userEvent.type(screen.getByLabelText(/e-mail do idoso/i), "idoso.teste@exemplo.test");
    await userEvent.click(screen.getByRole("button", { name: "Enviar pedido" }));

    const dialogo = screen.getByRole("dialog");
    expect(await within(dialogo).findByRole("status")).toHaveTextContent("Pedido enviado.");
    expect(await screen.findByText("1 pedido aguardando resposta")).toBeInTheDocument();
    expect(screen.getByText("Pendente")).toBeInTheDocument();
    // A mensagem permanece e o modal continua aberto até a pessoa concluir.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Concluir" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("Vinculos: idoso convida familiar", () => {
  it("idoso na tela de família vê o botão e o modal abre direto o convite", async () => {
    global.fetch = jest.fn().mockResolvedValue(respostaJson(200, { vinculos: [] }));
    renderComPerfil("idoso", "familiar");
    await userEvent.click(await screen.findByRole("button", { name: "Adicionar pessoa" }));
    const dialogo = screen.getByRole("dialog", { name: "Adicionar pessoa" });
    expect(within(dialogo).getByLabelText(/e-mail do familiar/i)).toBeInTheDocument();
    expect(within(dialogo).getByRole("button", { name: "Enviar convite" })).toBeInTheDocument();
  });
});
