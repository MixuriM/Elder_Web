import { FOTO_ACCEPT, prepararFoto } from "./prepararFoto";

// jsdom não tem canvas nem createImageBitmap: os dois são simulados aqui, e a biblioteca de HEIC também.
const mockHeicTo = jest.fn();
jest.mock("heic-to", () => ({ heicTo: (...args: unknown[]) => mockHeicTo(...args) }));

const MB = 1024 * 1024;
const drawImage = jest.fn();
const fillRect = jest.fn();
let tipoGerado: (pedido: string) => string;
let canvasCriados: HTMLCanvasElement[];

function bitmap(width: number, height: number) {
  return { width, height, close: jest.fn() } as unknown as ImageBitmap;
}

const arquivo = (nome: string, tipo: string, tamanho = 1000) => {
  const f = new File(["x"], nome, { type: tipo });
  Object.defineProperty(f, "size", { value: tamanho });
  return f;
};

beforeEach(() => {
  mockHeicTo.mockReset();
  drawImage.mockReset();
  fillRect.mockReset();
  canvasCriados = [];
  tipoGerado = (pedido) => pedido;
  (globalThis as { createImageBitmap?: unknown }).createImageBitmap = jest.fn(async () => bitmap(4000, 3000));
  const criarOriginal = document.createElement.bind(document);
  jest.spyOn(document, "createElement").mockImplementation((tag: string, opcoes?: ElementCreationOptions) => {
    const el = criarOriginal(tag, opcoes);
    if (tag === "canvas") {
      const canvas = el as HTMLCanvasElement;
      canvas.getContext = jest.fn(() => ({ drawImage, fillRect, fillStyle: "" })) as never;
      canvas.toBlob = (cb: BlobCallback, tipo?: string) => cb(new Blob(["convertida"], { type: tipoGerado(tipo ?? "") }));
      canvasCriados.push(canvas);
    }
    return el;
  });
});

afterEach(() => jest.restoreAllMocks());

describe("prepararFoto", () => {
  it("recusa acima de 15 MB sem tentar converter", async () => {
    await expect(prepararFoto(arquivo("foto.jpg", "image/jpeg", 15 * MB + 1))).rejects.toThrow(
      "Foto acima do limite de 15 MB. Escolha uma foto menor.",
    );
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it("recusa SVG explicando o motivo", async () => {
    await expect(prepararFoto(arquivo("logo.svg", "image/svg+xml"))).rejects.toThrow(
      "Arquivos SVG não são aceitos, porque podem conter código. Escolha uma foto em JPEG ou PNG.",
    );
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it.each([
    ["arte.psd", "image/vnd.adobe.photoshop"],
    ["logo.ai", "application/postscript"],
    ["logo.eps", "application/postscript"],
    ["logo.cdr", ""],
  ])("recusa arquivo de programa de desenho (%s)", async (nome, tipo) => {
    await expect(prepararFoto(arquivo(nome, tipo))).rejects.toThrow(
      "Arquivos de programas de desenho não são aceitos. Salve a imagem como JPEG ou PNG e tente de novo.",
    );
  });

  it("recusa PDF", async () => {
    await expect(prepararFoto(arquivo("exame.pdf", "application/pdf"))).rejects.toThrow(
      "PDF não é foto. Escolha uma foto em JPEG ou PNG.",
    );
  });

  it.each(["foto.cr2", "foto.nef", "foto.dng", "foto.arw"])("recusa RAW de câmera (%s)", async (nome) => {
    await expect(prepararFoto(arquivo(nome, ""))).rejects.toThrow(
      "Fotos RAW de câmera não são aceitas. Salve a foto como JPEG e tente de novo.",
    );
  });

  it("recusa arquivo que não é imagem", async () => {
    await expect(prepararFoto(arquivo("nota.txt", "text/plain"))).rejects.toThrow(
      "Este arquivo não é uma foto aceita. Escolha uma foto em JPEG, PNG, WebP, GIF, AVIF, TIFF, BMP ou HEIC.",
    );
  });

  it("BMP passa pelo canvas e sai WebP reduzido a 2048 px, com nome .webp", async () => {
    const pronto = await prepararFoto(arquivo("scanner.bmp", "image/bmp"));

    expect(createImageBitmap).toHaveBeenCalledTimes(1);
    expect([canvasCriados[0].width, canvasCriados[0].height]).toEqual([2048, 1536]);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2048, 1536);
    expect(pronto.type).toBe("image/webp");
    expect(pronto.name).toBe("scanner.webp");
  });

  it("não amplia foto pequena", async () => {
    (createImageBitmap as jest.Mock).mockResolvedValueOnce(bitmap(300, 200));
    await prepararFoto(arquivo("p.png", "image/png"));
    expect([canvasCriados[0].width, canvasCriados[0].height]).toEqual([300, 200]);
  });

  it("navegador sem WebP no canvas: cai para JPEG com fundo branco (sem fundo preto na transparência)", async () => {
    tipoGerado = (pedido) => (pedido === "image/webp" ? "image/png" : pedido);
    const pronto = await prepararFoto(arquivo("p.png", "image/png"));
    expect(pronto.type).toBe("image/jpeg");
    expect(pronto.name).toBe("p.jpg");
    expect(fillRect).toHaveBeenCalled();
  });

  it.each([
    ["foto.heic", "image/heic"],
    ["foto.HEIF", "image/heif"],
    ["IMG_0001.HEIC", ""],
  ])("HEIC (%s) passa pela biblioteca carregada sob demanda e depois pelo canvas", async (nome, tipo) => {
    mockHeicTo.mockResolvedValue(bitmap(4032, 3024));

    const pronto = await prepararFoto(arquivo(nome, tipo));

    expect(mockHeicTo).toHaveBeenCalledWith(expect.objectContaining({ type: "bitmap" }));
    expect(createImageBitmap).not.toHaveBeenCalled();
    expect([canvasCriados[0].width, canvasCriados[0].height]).toEqual([2048, 1536]);
    expect(pronto.type).toBe("image/webp");
  });

  it("JPEG comum não carrega a biblioteca de HEIC", async () => {
    await prepararFoto(arquivo("f.jpg", "image/jpeg"));
    expect(mockHeicTo).not.toHaveBeenCalled();
  });

  it("falha ao converter HEIC: mensagem simples, nada é devolvido para envio", async () => {
    mockHeicTo.mockRejectedValue(new Error("libheif: erro interno"));
    await expect(prepararFoto(arquivo("f.heic", "image/heic"))).rejects.toThrow(
      "Não foi possível preparar esta foto. Tente outra foto ou escolha uma em JPEG ou PNG.",
    );
  });

  it("falha ao abrir BMP: mensagem simples, nada é devolvido para envio", async () => {
    (createImageBitmap as jest.Mock).mockRejectedValueOnce(new Error("decode"));
    await expect(prepararFoto(arquivo("f.bmp", "image/bmp"))).rejects.toThrow(
      "Não foi possível preparar esta foto. Tente outra foto ou escolha uma em JPEG ou PNG.",
    );
  });

  it("TIFF que o navegador não abre segue o original, porque o servidor confere os bytes e converte", async () => {
    (createImageBitmap as jest.Mock).mockRejectedValueOnce(new Error("decode"));
    const original = arquivo("scan.tiff", "image/tiff");
    await expect(prepararFoto(original)).resolves.toBe(original);
  });

  it("libera o bitmap depois de desenhar", async () => {
    const b = bitmap(10, 10);
    (createImageBitmap as jest.Mock).mockResolvedValueOnce(b);
    await prepararFoto(arquivo("f.jpg", "image/jpeg"));
    expect(b.close).toHaveBeenCalled();
  });

  it("accept lista os formatos tratados e nenhum dos recusados", () => {
    for (const t of [".jpg", ".png", ".webp", ".gif", ".avif", ".tiff", ".bmp", ".heic", ".heif", "image/heic"]) {
      expect(FOTO_ACCEPT.split(",")).toContain(t);
    }
    for (const t of [".svg", "image/svg+xml", ".pdf", ".psd", ".ai", ".eps", ".cdr", ".cr2", ".dng"]) {
      expect(FOTO_ACCEPT.split(",")).not.toContain(t);
    }
  });
});
