// Prepara a foto de perfil antes do envio: recusa na hora o que não é foto, converte no navegador o que o
// servidor não lê (HEIC e BMP) e reduz fotos grandes de celular para no máximo 2048 px. O servidor confere
// os bytes de novo e grava sempre um WebP de até 1024 px; isto aqui é só para o erro vir rápido e o envio
// ser leve.
export const FOTO_LIMITE_BYTES = 15 * 1024 * 1024;
const LADO_MAX = 2048;
const QUALIDADE = 0.9;

export const FOTO_ACCEPT = [
  ".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".tif", ".tiff", ".bmp", ".heic", ".heif",
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/tiff", "image/bmp", "image/heic",
  "image/heif",
].join(",");

const MSG_TAMANHO = "Foto acima do limite de 15 MB. Escolha uma foto menor.";
const MSG_CONVERSAO = "Não foi possível preparar esta foto. Tente outra foto ou escolha uma em JPEG ou PNG.";
const MSG_FORMATO =
  "Este arquivo não é uma foto aceita. Escolha uma foto em JPEG, PNG, WebP, GIF, AVIF, TIFF, BMP ou HEIC.";

// Recusados com o motivo: SVG pode levar script; formatos de design e RAW não são imagem de navegador.
const RECUSADOS: [RegExp, string][] = [
  [/\.svgz?$|^image\/svg/, "Arquivos SVG não são aceitos, porque podem conter código. Escolha uma foto em JPEG ou PNG."],
  [
    /\.(psd|ai|eps|cdr)$|photoshop|postscript/,
    "Arquivos de programas de desenho não são aceitos. Salve a imagem como JPEG ou PNG e tente de novo.",
  ],
  [/\.pdf$|^application\/pdf/, "PDF não é foto. Escolha uma foto em JPEG ou PNG."],
  [
    /\.(cr2|cr3|nef|nrw|arw|dng|orf|rw2|raf|pef|srw|raw)$/,
    "Fotos RAW de câmera não são aceitas. Salve a foto como JPEG e tente de novo.",
  ],
];

// O servidor decodifica estes sozinho; os outros dois precisam sair convertidos daqui.
const NATIVOS_DO_SERVIDOR = /\.(jpe?g|png|webp|gif|avif|tiff?)$|^image\/(jpeg|png|webp|gif|avif|tiff)$/;
const HEIC = /\.hei[cf]$|^image\/hei[cf]$/;
const BMP = /\.bmp$|^image\/(x-ms-)?bmp$/;

function canvasParaArquivo(canvas: HTMLCanvasElement, tipo: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, QUALIDADE));
}

async function desenhar(bitmap: ImageBitmap, nome: string): Promise<File> {
  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(MSG_CONVERSAO);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const base = nome.replace(/\.[^.]*$/, "") || "foto";
  // WebP mantém a transparência; navegador que não gera WebP devolve PNG, aí vai JPEG com fundo branco.
  const webp = await canvasParaArquivo(canvas, "image/webp");
  if (webp?.type === "image/webp") return new File([webp], `${base}.webp`, { type: "image/webp" });

  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const jpeg = await canvasParaArquivo(canvas, "image/jpeg");
  if (!jpeg) throw new Error(MSG_CONVERSAO);
  return new File([jpeg], `${base}.jpg`, { type: "image/jpeg" });
}

// Devolve o File pronto para enviarFotoPerfil, ou lança Error com a mensagem para mostrar à pessoa.
export async function prepararFoto(arquivo: File): Promise<File> {
  if (arquivo.size > FOTO_LIMITE_BYTES) throw new Error(MSG_TAMANHO);

  const nome = arquivo.name.toLowerCase();
  const tipo = arquivo.type.toLowerCase();
  const testa = (re: RegExp) => re.test(nome) || re.test(tipo);

  for (const [re, mensagem] of RECUSADOS) if (testa(re)) throw new Error(mensagem);
  const heic = testa(HEIC);
  const nativo = !heic && testa(NATIVOS_DO_SERVIDOR);
  if (!heic && !nativo && !testa(BMP)) throw new Error(MSG_FORMATO);

  let bitmap: ImageBitmap;
  try {
    if (heic) {
      // ~3 MB de WASM: só baixa quando a pessoa escolhe uma foto HEIC.
      const { heicTo } = await import("heic-to");
      bitmap = await heicTo({ blob: arquivo, type: "bitmap" });
    } else {
      bitmap = await createImageBitmap(arquivo);
    }
  } catch {
    // Formato que o servidor lê mas este navegador não abre (TIFF fora do Safari, por exemplo): segue o
    // original, que o servidor confere pelos bytes. HEIC e BMP nunca seguem sem conversão.
    if (nativo) return arquivo;
    throw new Error(MSG_CONVERSAO);
  }

  try {
    return await desenhar(bitmap, arquivo.name);
  } catch {
    throw new Error(MSG_CONVERSAO);
  } finally {
    bitmap.close();
  }
}
