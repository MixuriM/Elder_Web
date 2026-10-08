
import { baixarPdf } from "./baixarPdf";
import { getCurrentUserToken } from "./auth";

jest.mock("./auth", () => ({
  getCurrentUserToken: jest.fn(),
}));

const mockGetCurrentUserToken =
  getCurrentUserToken as jest.MockedFunction<
    typeof getCurrentUserToken
  >;

const API_URL = "http://localhost:3000/";
const NOME_ARQUIVO = "historico-saude-remedios.pdf";

const BLOB = new Blob(["%PDF-falso"], {
  type: "application/pdf",
});

function respostaPdf(): Response {
  return {
    ok: true,
    status: 200,
    headers: {
      get: (nome: string) =>
        nome.toLowerCase() === "content-type"
          ? "application/pdf"
          : null,
    },
    blob: () => Promise.resolve(BLOB),
  } as unknown as Response;
}

function respostaErro(
  status: number,
  corpo: unknown,
): Response {
  return {
    ok: false,
    status,
    json: () =>
      corpo === undefined
        ? Promise.reject(new Error("sem json"))
        : Promise.resolve(corpo),
  } as unknown as Response;
}

let mockFetch: jest.Mock;
let createObjectURL: jest.Mock;
let revokeObjectURL: jest.Mock;

let cliques: {
  href: string;
  download: string;
  noDom: boolean;
}[];

beforeEach(() => {
  jest.useRealTimers();

  mockGetCurrentUserToken.mockReset();
  mockGetCurrentUserToken.mockResolvedValue("token-fake");

  // A URL deve estar configurada no ambiente de testes
  // para corresponder a import.meta.env.VITE_API_URL.
  expect(API_URL).toBe("http://localhost:3000/");

  mockFetch = jest.fn();
  global.fetch = mockFetch;

  createObjectURL = jest
    .fn()
    .mockReturnValue("blob:fake-url");

  revokeObjectURL = jest.fn();

  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: createObjectURL,
  });

  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: revokeObjectURL,
  });

  cliques = [];

  jest
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      cliques.push({
        href: this.href,
        download: this.download,
        noDom: document.body.contains(this),
      });
    });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe("baixarPdf", () => {
  it("realiza GET com Authorization e sem Content-Type JSON", async () => {
    mockFetch.mockResolvedValue(respostaPdf());

    await baixarPdf("/historico/pdf");

    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, init] = mockFetch.mock.calls[0];

    expect(String(url)).toBe(
      "http://localhost:3000/historico/pdf",
    );

    expect(init.method).toBe("GET");

    expect(init.headers.Authorization).toBe(
      "Bearer token-fake",
    );

    expect(init.headers.Accept).toBe(
      "application/pdf",
    );

    const nomes = Object.keys(init.headers).map(
      (nome) => nome.toLowerCase(),
    );

    expect(nomes).not.toContain("content-type");
    expect(init.body).toBeUndefined();
  });

  it("realiza o download do Blob corretamente", async () => {
    mockFetch.mockResolvedValue(respostaPdf());

    await baixarPdf("/historico/idoso/7/pdf");

    expect(createObjectURL).toHaveBeenCalledTimes(1);

    expect(
      createObjectURL.mock.calls[0][0],
    ).toBe(BLOB);

    expect(cliques).toHaveLength(1);

    expect(cliques[0].href).toBe("blob:fake-url");

    expect(cliques[0].download).toBe(NOME_ARQUIVO);

    expect(cliques[0].noDom).toBe(true);

    expect(
      document.querySelector("a[download]"),
    ).toBeNull();
  });

  it("revoga a URL após o download", async () => {
    jest.useFakeTimers();

    mockFetch.mockResolvedValue(respostaPdf());

    await baixarPdf("/historico/pdf");

    expect(revokeObjectURL).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);

    expect(revokeObjectURL).toHaveBeenCalledTimes(1);

    expect(revokeObjectURL).toHaveBeenCalledWith(
      "blob:fake-url",
    );
  });

  it("revoga a URL mesmo quando o clique falha", async () => {
    jest.useFakeTimers();

    mockFetch.mockResolvedValue(respostaPdf());

    jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {
        throw new Error("clique falhou");
      });

    await expect(
      baixarPdf("/historico/pdf"),
    ).rejects.toThrow("clique falhou");

    jest.advanceTimersByTime(1000);

    expect(revokeObjectURL).toHaveBeenCalledWith(
      "blob:fake-url",
    );
  });

  it.each([
    [
      403,
      { error: "Sem permissão para exportar histórico." },
      "Sem permissão para exportar histórico.",
    ],
    [
      500,
      { error: "Erro interno." },
      "Erro interno.",
    ],
  ])(
    "trata erro HTTP %i corretamente",
    async (status, corpo, mensagem) => {
      mockFetch.mockResolvedValue(
        respostaErro(status, corpo),
      );

      await expect(
        baixarPdf("/historico/pdf"),
      ).rejects.toThrow(mensagem);

      expect(createObjectURL).not.toHaveBeenCalled();
      expect(cliques).toHaveLength(0);
      expect(revokeObjectURL).not.toHaveBeenCalled();
    },
  );

  it("utiliza mensagem padrão quando não há JSON", async () => {
    mockFetch.mockResolvedValue(
      respostaErro(502, undefined),
    );

    await expect(
      baixarPdf("/historico/pdf"),
    ).rejects.toThrow(
      "Não foi possível gerar o PDF (HTTP 502).",
    );
  });

  it("trata falhas de conexão", async () => {
    mockFetch.mockRejectedValue(
      new Error("rede caiu"),
    );

    await expect(
      baixarPdf("/historico/pdf"),
    ).rejects.toThrow(
      "Não foi possível conectar ao servidor. Verifique a API, a conexão e as configurações de CORS.",
    );

    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("impede download quando a sessão expirou", async () => {
    mockGetCurrentUserToken.mockResolvedValueOnce(null);

    await expect(
      baixarPdf("/historico/pdf"),
    ).rejects.toThrow(
      "Sua sessão expirou. Entre novamente para baixar o histórico.",
    );

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("rejeita PDF vazio", async () => {
    mockFetch.mockResolvedValue({
      ...respostaPdf(),
      blob: () => Promise.resolve(new Blob()),
    });

    await expect(
      baixarPdf("/historico/pdf"),
    ).rejects.toThrow(
      "O servidor retornou um arquivo vazio.",
    );

    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("rejeita resposta que não seja PDF", async () => {
    mockFetch.mockResolvedValue({
      ...respostaPdf(),
      headers: {
        get: () => "text/html",
      },
    });

    await expect(
      baixarPdf("/historico/pdf"),
    ).rejects.toThrow(
      "O servidor não retornou um PDF válido.",
    );

    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("não registra informações no console", async () => {
    const espioes = (
      ["log", "info", "warn", "error", "debug"] as const
    ).map((metodo) =>
      jest
        .spyOn(console, metodo)
        .mockImplementation(() => undefined),
    );

    mockFetch
      .mockResolvedValueOnce(respostaPdf())
      .mockResolvedValueOnce(
        respostaErro(403, { error: "x" }),
      );

    await baixarPdf("/historico/pdf");

    await baixarPdf("/historico/pdf").catch(
      () => undefined,
    );

    for (const espiao of espioes) {
      expect(espiao).not.toHaveBeenCalled();
    }
  });
});
