// Casos que o sharp real não gera como fixture: HEIC (o build pré-compilado não codifica HEVC) e as
// proteções de memória chamadas no carregamento do módulo. O resto da normalização é testado com o
// sharp real em routes/usuarioFoto.test.ts.
const metadata = jest.fn();
const toBuffer = jest.fn();
const pipeline = { rotate: () => pipeline, resize: () => pipeline, webp: () => pipeline, toBuffer };
const construtor = jest.fn((_entrada: unknown, _opcoes?: unknown) => ({ metadata, ...pipeline }));
const cache = jest.fn();
const concurrency = jest.fn();

jest.mock("sharp", () => ({
  __esModule: true,
  default: Object.assign((entrada: unknown, opcoes?: unknown) => construtor(entrada, opcoes), {
    cache: (...a: unknown[]) => cache(...a),
    concurrency: (...a: unknown[]) => concurrency(...a),
  }),
}));

import { FotoInvalida, normalizarFoto } from "./fotoPerfil";

beforeEach(() => {
  metadata.mockReset();
  toBuffer.mockReset().mockResolvedValue(Buffer.from("webp"));
});

it("desliga o cache do libvips e usa uma thread por imagem (512 MB do Render)", () => {
  expect(cache).toHaveBeenCalledWith(false);
  expect(concurrency).toHaveBeenCalledWith(1);
});

it("HEIC (heif com hevc) é recusado como formato, sem tentar decodificar", async () => {
  metadata.mockResolvedValue({ format: "heif", compression: "hevc", width: 10, height: 10 });

  await expect(normalizarFoto(Buffer.from("x"))).rejects.toEqual(new FotoInvalida("formato"));
  expect(toBuffer).not.toHaveBeenCalled();
});

it("AVIF (heif com av1) passa e decodifica com limite de 50 milhões de pixels", async () => {
  metadata.mockResolvedValue({ format: "heif", compression: "av1", width: 10, height: 10 });

  await expect(normalizarFoto(Buffer.from("x"))).resolves.toEqual({ buffer: Buffer.from("webp"), mimeType: "image/webp" });
  expect(construtor).toHaveBeenLastCalledWith(expect.anything(), { limitInputPixels: 50_000_000 });
});

it("svg é recusado mesmo o sharp sabendo ler", async () => {
  metadata.mockResolvedValue({ format: "svg", width: 10, height: 10 });
  await expect(normalizarFoto(Buffer.from("x"))).rejects.toEqual(new FotoInvalida("formato"));
  expect(toBuffer).not.toHaveBeenCalled();
});
