import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
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
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.getByTestId("localizacao")).toHaveTextContent("/cuidadores");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("mostra estado vazio quando não há vínculos", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      respostaJson(200, { vinculos: [] })
    );

    renderComRotas();

    expect(await screen.findByText("Nenhum cuidador vinculado")).toBeInTheDocument();
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

  it("alterna entre modo claro e escuro e salva a preferência", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      respostaJson(200, { vinculos: [] })
    );

    renderComRotas();

    const ativarModoEscuro = await screen.findByRole("button", {
      name: "Ativar modo escuro",
    });
    fireEvent.click(ativarModoEscuro);

    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("tema")).toBe("escuro");
    expect(
      screen.getByRole("button", { name: "Ativar modo claro" })
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Ativar modo claro" }));

    expect(document.documentElement).not.toHaveClass("dark");
    expect(localStorage.getItem("tema")).toBe("claro");
  });

  it("mostra o botão Voltar apontando para a Home", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      respostaJson(200, { vinculos: [] })
    );

    renderComRotas();

    const botaoVoltar = await screen.findByRole("link", { name: /voltar/i });
    expect(botaoVoltar).toHaveAttribute("href", "/Home");
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
    expect(screen.getByRole("button", { name: "Ativar modo escuro" })).toBeInTheDocument();
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
