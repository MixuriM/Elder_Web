import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Vinculos from "./Vinculos";
import { AcessoContext } from "../contexts/useAcesso";

jest.mock("../lib/auth", () => ({
  getCurrentUserToken: jest.fn().mockResolvedValue("token-fake"),
}));

function respostaJson(status: number, corpo: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(corpo) } as Response;
}

// Fixtures: dados fake, só para o teste.
const pedido = {
  id: 20,
  tipo_vinculo: "cuidador",
  origem: "solicitacao_cuidador",
  status: "pendente",
  data_solicitacao: "2026-10-01T10:00:00.000Z",
  data_resposta: null,
  confirmado_em: null,
  papel_do_chamador: "dono",
  permissoes: null,
  idoso: { id: 5, nome: "Maria Idosa", email_mascarado: "ma***@mail.test" },
  vinculado: { id: 8, nome: "João Cuidador", email_mascarado: "jo***@mail.test" },
};

function renderComPerfil(tipoPerfil: string, tipo: "familiar" | "cuidador") {
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

type Rotas = Record<string, (corpo?: unknown) => Response>;
function fetchPorRota(rotas: Rotas) {
  global.fetch = jest.fn((url: string, init?: RequestInit) => {
    const chave = `${init?.method ?? "GET"} ${String(url).replace(/^.*?(\/(vinculo|usuario).*)$/, "$1")}`;
    const resposta = rotas[chave];
    return Promise.resolve(resposta ? resposta() : respostaJson(500, { error: `sem rota: ${chave}` }));
  }) as jest.Mock;
}

describe("Vinculos: responder pedidos", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("idoso aprova: o pedido sai da seção, a lista e o resumo atualizam, o resultado fica anunciado", async () => {
    let aprovado = false;
    fetchPorRota({
      "GET /usuario/me": () => respostaJson(200, { id: 5, tipo_perfil: "idoso", modo_decisao: null }),
      "GET /vinculo": () =>
        respostaJson(200, { vinculos: [aprovado ? { ...pedido, status: "aprovado", permissoes: null } : pedido] }),
      "POST /vinculo/20/aprovar": () => {
        aprovado = true;
        return respostaJson(200, { id: 20 });
      },
    });
    renderComPerfil("idoso", "cuidador");

    const secao = await screen.findByRole("heading", { name: "Pedidos para você responder" });
    expect(secao).toBeInTheDocument();
    expect(screen.getByText("1 pedido aguardando resposta")).toBeInTheDocument();
    // Sem duplicar: o pedido que a pessoa decide não aparece de novo em "Pessoas vinculadas".
    expect(screen.queryByRole("heading", { name: "Pessoas vinculadas" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /aprovar o pedido de João/i }));

    expect(await screen.findByText("Pedido de João Cuidador aprovado.")).toBeInTheDocument();
    expect(await screen.findByText("1 cuidador vinculado")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Pedidos para você responder" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pessoas vinculadas" })).toBeInTheDocument();
  });

  it("idoso com modo familiar não vê botões de decisão; o pedido fica na lista", async () => {
    fetchPorRota({
      "GET /usuario/me": () => respostaJson(200, { id: 5, tipo_perfil: "idoso", modo_decisao: "familiar" }),
      "GET /vinculo": () => respostaJson(200, { vinculos: [pedido] }),
    });
    renderComPerfil("idoso", "cuidador");
    await screen.findByRole("heading", { name: "Pessoas vinculadas" });
    expect(screen.queryByRole("button", { name: /aprovar|recusar/i })).not.toBeInTheDocument();
    expect(screen.getByText("Pendente")).toBeInTheDocument();
  });

  it("se o estado de decisão não carregar, mostra os botões (o 403 do backend é a barreira)", async () => {
    fetchPorRota({
      "GET /usuario/me": () => respostaJson(500, { error: "x" }),
      "GET /vinculo": () => respostaJson(200, { vinculos: [pedido] }),
    });
    renderComPerfil("idoso", "cuidador");
    expect(await screen.findByRole("button", { name: /aprovar o pedido de João/i })).toBeInTheDocument();
  });

  it("não mostra botões enquanto o estado de decisão ainda carrega", async () => {
    let liberar!: (r: Response) => void;
    global.fetch = jest.fn((url: string) =>
      String(url).endsWith("/usuario/me")
        ? new Promise<Response>((r) => (liberar = r))
        : Promise.resolve(respostaJson(200, { vinculos: [pedido] }))
    ) as jest.Mock;
    renderComPerfil("idoso", "cuidador");
    await screen.findByText("1 pedido aguardando resposta");
    expect(screen.queryByRole("button", { name: /aprovar/i })).not.toBeInTheDocument();
    liberar(respostaJson(200, { modo_decisao: "familiar" }));
    await screen.findByRole("heading", { name: "Pessoas vinculadas" });
    expect(screen.queryByRole("button", { name: /aprovar/i })).not.toBeInTheDocument();
  });

  it("familiar com pedido automático pendente vê o aviso de e-mail não confirmado no cartão", async () => {
    const convite = {
      ...pedido,
      id: 30,
      tipo_vinculo: "familiar",
      origem: "convite_idoso",
      papel_do_chamador: "vinculado",
      idoso: { id: null, nome: null, email_mascarado: null },
    };
    fetchPorRota({ "GET /vinculo": () => respostaJson(200, { vinculos: [convite] }) });
    renderComPerfil("familiar", "familiar");
    const aviso = await screen.findByText(/o e-mail ainda não foi confirmado/i);
    expect(within(aviso.closest("article") as HTMLElement).getByText("Pendente")).toBeInTheDocument();
  });
});
