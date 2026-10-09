import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import VinculoDetalhe from "./VinculoDetalhe";
import Vinculos from "./Vinculos";

const mockGetCurrentUserToken = jest.fn();
jest.mock("../lib/auth", () => ({
  getCurrentUserToken: (...args: unknown[]) => mockGetCurrentUserToken(...args),
}));

function respostaJson(status: number, corpo: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(corpo),
  } as Response;
}

const vinculo = {
  id: 12,
  tipo_vinculo: "cuidador",
  origem: "solicitacao_cuidador",
  status: "aprovado",
  data_solicitacao: "2026-10-01T10:00:00.000Z",
  data_resposta: "2026-10-02T10:00:00.000Z",
  confirmado_em: "2026-10-02T10:00:00.000Z",
  papel_do_chamador: "dono",
  idoso: { id: 5, nome: "Maria da Silva", email_mascarado: "ma***@mail.com" },
  vinculado: { id: 8, nome: "João da Silva", email_mascarado: "jo***@mail.com" },
};

const vinculoFamiliar = {
  ...vinculo,
  id: 13,
  tipo_vinculo: "familiar",
  origem: "convite_idoso",
  vinculado: { id: 9, nome: "Ana Souza", email_mascarado: "an***@mail.com" },
};

function LocalizacaoAtual() {
  const location = useLocation();
  return <output data-testid="localizacao">{location.pathname}</output>;
}

function renderComRotas(rotaInicial = "/cuidadores") {
  return render(
    <MemoryRouter initialEntries={[rotaInicial]}>
      <Routes>
        <Route path="/familia" element={<Vinculos tipo="familiar" />} />
        <Route path="/cuidadores" element={<Vinculos tipo="cuidador" />} />
        <Route path="/vinculos/:id" element={<VinculoDetalhe />} />
      </Routes>
      <LocalizacaoAtual />
    </MemoryRouter>
  );
}

describe("Vinculos", () => {
  beforeEach(() => {
    mockGetCurrentUserToken.mockReset();
    mockGetCurrentUserToken.mockResolvedValue("token-fake");
    global.fetch = jest.fn();
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("mostra carregamento, lista os vínculos e permite abrir os detalhes", async () => {
    let resolverFetch!: (value: Response) => void;
    (global.fetch as jest.Mock).mockReturnValue(
      new Promise<Response>((resolve) => {
        resolverFetch = resolve;
      })
    );

    renderComRotas();

    expect(screen.getByText("Carregando vínculos...")).toBeInTheDocument();
    resolverFetch(respostaJson(200, { vinculos: [vinculo] }));

    expect(await screen.findByRole("heading", { name: "Pessoas vinculadas" })).toBeInTheDocument();
    expect(screen.getByText("João da Silva")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /ver detalhes de joão da silva/i });
    expect(link).toHaveAttribute("href", "/vinculos/12");
    expect(link).not.toHaveAttribute("target");
    expect(screen.getByTestId("localizacao")).toHaveTextContent("/cuidadores");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("mostra estado vazio quando não há vínculos", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      respostaJson(200, { vinculos: [] })
    );

    renderComRotas();

    expect(await screen.findByText("Nenhum cuidador vinculado")).toBeInTheDocument();
    // Menu e tema vêm do layout: a lista não tem botão que tire a pessoa da página.
    expect(screen.queryByRole("link", { name: /voltar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /modo/i })).not.toBeInTheDocument();
  });

  it("cada rota mostra só os vínculos do seu tipo", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      respostaJson(200, { vinculos: [vinculo, vinculoFamiliar] })
    );

    const { unmount } = renderComRotas("/cuidadores");
    expect(await screen.findByText("João da Silva")).toBeInTheDocument();
    expect(screen.queryByText("Ana Souza")).not.toBeInTheDocument();
    unmount();

    renderComRotas("/familia");
    expect(await screen.findByText("Ana Souza")).toBeInTheDocument();
    expect(screen.queryByText("João da Silva")).not.toBeInTheDocument();
  });

  it("mostra o aviso fixo quando a guarda redirecionou por falta de vínculo", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, { vinculos: [] }));

    render(
      <MemoryRouter initialEntries={[{ pathname: "/familia", state: { semVinculo: true } }]}>
        <Routes>
          <Route path="/familia" element={<Vinculos tipo="familiar" />} />
        </Routes>
      </MemoryRouter>
    );

    expect(
      await screen.findByText("Para usar esta área, vincule-se a um idoso.")
    ).toHaveAttribute("role", "status");
  });

  it("sem o sinal da guarda não mostra aviso", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaJson(200, { vinculos: [] }));

    renderComRotas("/familia");

    await screen.findByText("Nenhum familiar vinculado");
    expect(
      screen.queryByText("Para usar esta área, vincule-se a um idoso.")
    ).not.toBeInTheDocument();
  });

  it("estado vazio é próprio do tipo e ignora vínculos do outro tipo", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      respostaJson(200, { vinculos: [vinculo] })
    );

    renderComRotas("/familia");

    expect(await screen.findByText("Nenhum familiar vinculado")).toBeInTheDocument();
    expect(screen.queryByText("João da Silva")).not.toBeInTheDocument();
  });

  it.each([
    ["/familia", "Família"],
    ["/cuidadores", "Cuidadores"],
  ])("%s tem um único h1 e título da aba próprios", async (rota, titulo) => {
    (global.fetch as jest.Mock).mockResolvedValue(
      respostaJson(200, { vinculos: [] })
    );

    renderComRotas(rota);

    await screen.findByRole("heading", { level: 1, name: titulo });
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(document.title).toBe(`${titulo} | Elder Web`);
  });



  it("mostra uma mensagem acessível quando a API falha", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    (global.fetch as jest.Mock).mockResolvedValue(
      respostaJson(500, { error: "Falha ao carregar vínculos." })
    );

    renderComRotas();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Falha ao carregar vínculos."
    );
  });

  it("com falha ao carregar, não mostra o resumo zerado (seria informação falsa)", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      respostaJson(500, { error: "Falha ao carregar vínculos." })
    );

    renderComRotas();

    await screen.findByRole("alert");
    expect(screen.queryByText("Nenhum cuidador vinculado")).not.toBeInTheDocument();
    expect(screen.queryByText("Nenhum pedido aguardando resposta")).not.toBeInTheDocument();
  });

  it("abre os detalhes ao acessar diretamente a URL do vínculo", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      respostaJson(200, { vinculos: [vinculo] })
    );

    renderComRotas("/vinculos/12");

    expect(await screen.findByRole("heading", { name: "João da Silva" })).toBeInTheDocument();
    expect(screen.getByText("E-mail")).toBeInTheDocument();
  });

  it("informa quando o vínculo da URL não existe ou não está acessível", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      respostaJson(200, { vinculos: [] })
    );

    renderComRotas("/vinculos/999");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Vínculo não encontrado ou sem acesso."
    );
  });

  it("informa erro quando a API falha ao carregar os detalhes", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      respostaJson(500, { error: "Falha ao carregar vínculos." })
    );

    renderComRotas("/vinculos/12");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Falha ao carregar vínculos."
    );
  });
});

describe("VínculoDetalhe", () => {
  it("carrega e exibe os dados do vínculo acessado pela URL", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      respostaJson(200, { vinculos: [vinculo] })
    );

    renderComRotas("/vinculos/12");

    expect(await screen.findByRole("heading", { name: "João da Silva" })).toBeInTheDocument();
    expect(screen.getByText("Cuidador")).toBeInTheDocument();
    expect(screen.getByText("Aprovado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar" })).toHaveAttribute(
      "href",
      "/cuidadores"
    );
  });

  it("Voltar leva à lista de família quando o vínculo é de familiar", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      respostaJson(200, { vinculos: [vinculo, vinculoFamiliar] })
    );

    renderComRotas("/vinculos/13");

    await screen.findByRole("heading", { name: "Ana Souza" });
    expect(screen.getByRole("link", { name: "Voltar" })).toHaveAttribute(
      "href",
      "/familia"
    );
  });
});
