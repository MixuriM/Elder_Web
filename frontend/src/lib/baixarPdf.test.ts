import { baixarPdf } from "./baixarPdf";

// Item 5.4 (RF-014): helper de download do PDF. jsdom não tem URL.createObjectURL: mockado aqui.
const mockGetCurrentUserToken = jest.fn();
jest.mock("./auth", () => ({
  getCurrentUserToken: (...args: unknown[]) => mockGetCurrentUserToken(...args),
}));

const BLOB = new Blob(["%PDF-falso"], { type: "application/pdf" });

function respostaPdf() {
  return { ok: true, status: 200, blob: () => Promise.resolve(BLOB) } as unknown as Response;
}
function respostaErro(status: number, corpo: unknown) {
  return { ok: false, status, json: () => (corpo === undefined ? Promise.reject(new Error("sem json")) : Promise.resolve(corpo)) } as unknown as Response;
}

let createObjectURL: jest.Mock;
let revokeObjectURL: jest.Mock;
let cliques: { href: string; download: string; noDom: boolean }[];

beforeEach(() => {
  mockGetCurrentUserToken.mockReset();
  mockGetCurrentUserToken.mockResolvedValue("token-fake");
  global.fetch = jest.fn();
  createObjectURL = jest.fn().mockReturnValue("blob:fake-url");
  revokeObjectURL = jest.fn();
  Object.assign(URL, { createObjectURL, revokeObjectURL });
  cliques = [];
  jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    cliques.push({ href: this.href, download: this.download, noDom: document.body.contains(this) });
  });
});
afterEach(() => jest.restoreAllMocks());

describe("baixarPdf", () => {
  it("GET na URL certa com Authorization e sem Content-Type JSON", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaPdf());
    await baixarPdf("/historico/pdf");

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(url)).toMatch(/\/historico\/pdf$/);
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer token-fake");
    const nomes = Object.keys(init.headers).map((h) => h.toLowerCase());
    expect(nomes).not.toContain("content-type");
    expect(init.body).toBeUndefined();
  });

  it("entrega o Blob ao download: createObjectURL com o Blob, <a download> clicado e anexado ao DOM", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaPdf());
    await baixarPdf("/historico/idoso/7/pdf");

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL.mock.calls[0][0]).toBe(BLOB);
    expect(cliques).toHaveLength(1);
    expect(cliques[0].href).toBe("blob:fake-url");
    expect(cliques[0].download).toBe("historico-saude-remedios.pdf");
    expect(cliques[0].noDom).toBe(true); // anexado durante o clique
    expect(document.querySelector("a[download]")).toBeNull(); // removido depois
  });

  it("revoga a URL do objeto depois do clique", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaPdf());
    await baixarPdf("/historico/pdf");
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
  });

  it("revoga a URL mesmo se o clique lançar erro", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaPdf());
    (HTMLAnchorElement.prototype.click as jest.Mock).mockImplementation(() => {
      throw new Error("clique falhou");
    });
    await expect(baixarPdf("/historico/pdf")).rejects.toThrow("clique falhou");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
  });

  it.each([
    [403, { error: "Sem permissão para exportar histórico." }, "Sem permissão para exportar histórico."],
    [500, { error: "Erro interno." }, "Erro interno."],
  ])("erro HTTP %i vira Error com a mensagem do backend, sem download", async (status, corpo, mensagem) => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaErro(status, corpo));
    await expect(baixarPdf("/historico/pdf")).rejects.toThrow(mensagem);
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(cliques).toHaveLength(0);
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it("erro HTTP sem JSON usa mensagem com o status", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(respostaErro(502, undefined));
    await expect(baixarPdf("/historico/pdf")).rejects.toThrow("Falha na requisição: status 502");
  });

  it("falha de rede propaga o erro", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("rede caiu"));
    await expect(baixarPdf("/historico/pdf")).rejects.toThrow("rede caiu");
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("não escreve nada em console.*", async () => {
    const espioes = (["log", "info", "warn", "error", "debug"] as const).map((m) => jest.spyOn(console, m).mockImplementation(() => undefined));
    (global.fetch as jest.Mock).mockResolvedValueOnce(respostaPdf()).mockResolvedValueOnce(respostaErro(403, { error: "x" }));
    await baixarPdf("/historico/pdf");
    await baixarPdf("/historico/pdf").catch(() => undefined);
    for (const e of espioes) expect(e).not.toHaveBeenCalled();
  });
});
