import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import CardVinculo from "../components/Vinculos/CardVinculo";
import DetalhesVinculo from "../components/Vinculos/DetalhesVinculo";
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
  papel_do_chamador: "vinculado",
  idoso: { id: 5, nome: "Maria da Silva", email_mascarado: "ma***@mail.com" },
  vinculado: { id: 8, nome: "João da Silva", email_mascarado: "jo***@mail.com" },
};

describe("Vinculos", () => {
  beforeEach(() => {
    mockGetCurrentUserToken.mockReset();
    mockGetCurrentUserToken.mockResolvedValue("token-fake");
    global.fetch = jest.fn();
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

    render(<Vinculos />);

    expect(screen.getByText("Carregando vínculos...")).toBeInTheDocument();
    resolverFetch(respostaJson(200, { vinculos: [vinculo] }));

    expect(await screen.findByRole("heading", { name: "Pessoas vinculadas" })).toBeInTheDocument();
    expect(screen.getByText("João da Silva")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /ver detalhes/i }));
    expect(screen.getByRole("dialog", { name: "Detalhes do vínculo" })).toBeInTheDocument();
  });

  it("mostra estado vazio quando não há vínculos", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      respostaJson(200, { vinculos: [] })
    );

    render(<Vinculos />);

    expect(await screen.findByText("Nenhum vínculo encontrado")).toBeInTheDocument();
  });

  it("mostra uma mensagem acessível quando a API falha", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    (global.fetch as jest.Mock).mockResolvedValue(
      respostaJson(500, { error: "Falha ao carregar vínculos." })
    );

    render(<Vinculos />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Falha ao carregar vínculos."
    );
  });
});

describe("Vinculos — detalhes de vínculo", () => {
  it("dispara o callback ao selecionar uma pessoa e mostra os dados do vínculo", () => {
    const onVerDetalhes = jest.fn();
    render(<CardVinculo vinculo={vinculo} onVerDetalhes={onVerDetalhes} />);

    fireEvent.click(screen.getByRole("button", { name: /ver detalhes/i }));

    expect(onVerDetalhes).toHaveBeenCalledWith(vinculo);
  });

  it("renderiza um diálogo de detalhes com informações acessíveis", () => {
    const onFechar = jest.fn();
    render(<DetalhesVinculo vinculo={vinculo} onFechar={onFechar} />);

    const dialogo = screen.getByRole("dialog", { name: "Detalhes do vínculo" });
    expect(dialogo).toHaveTextContent("João da Silva");
    expect(dialogo).toHaveTextContent("Cuidador");
    expect(dialogo).toHaveTextContent("Aprovado");
    expect(dialogo).toHaveTextContent("Pessoa que cuida do idoso");

    fireEvent.click(screen.getByRole("button", { name: /fechar detalhes/i }));
    expect(onFechar).toHaveBeenCalledTimes(1);
  });
});
