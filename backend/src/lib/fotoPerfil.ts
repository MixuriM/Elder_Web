import { Prisma, type Usuario } from "@prisma/client";
import sharp from "sharp";

// Foto de perfil guardada como BLOB em Usuario (foto_perfil + foto_perfil_mime_type). O
// backend devolve sempre data URI pronta, nunca o buffer cru.

// Render free tem 512 MB: sem cache de operações do libvips e uma thread por imagem.
sharp.cache(false);
sharp.concurrency(1);

// Teto do upload (fica inteiro na RAM, memoryStorage). O que vai pro banco é a versão normalizada.
export const FOTO_LIMITE_BYTES = 15 * 1024 * 1024;
const FOTO_LIMITE_PIXELS = 50_000_000;
const FOTO_LADO_MAX = 1024;
// Triagem barata do multer pelo Content-Type declarado. Quem decide é normalizarFoto, pelos bytes.
export const FOTO_MIME_TRIAGEM = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/tiff"];
// AVIF aparece como "heif" com compressão av1; HEIC (heif com hevc) fica de fora: o sharp lê o
// cabeçalho mas não decodifica. O frontend converte HEIC e BMP antes de enviar.
const FORMATOS_ACEITOS = ["jpeg", "png", "webp", "gif", "tiff"];

export type MotivoFotoInvalida = "formato" | "resolucao" | "corrompida";
export class FotoInvalida extends Error {
  constructor(readonly motivo: MotivoFotoInvalida) {
    super(motivo);
    this.name = "FotoInvalida";
  }
}

// Valida pelos bytes, gira conforme o EXIF, reduz pra caber em 1024 x 1024 e reencoda em WebP.
// O EXIF (GPS inclusive) é descartado: o sharp só copia metadados com withMetadata(). Reencodar
// também destrói qualquer payload escondido nos bytes. Erro do sharp nunca sai daqui cru.
export async function normalizarFoto(entrada: Buffer): Promise<{ buffer: Buffer; mimeType: "image/webp" }> {
  // Só lê o cabeçalho (não decodifica): sem limite aqui, pra a resolução virar "resolucao" e não "formato".
  const meta = await sharp(entrada, { limitInputPixels: false })
    .metadata()
    .catch(() => null);
  if (!meta) throw new FotoInvalida("formato");
  const aceito = FORMATOS_ACEITOS.includes(meta.format ?? "") || (meta.format === "heif" && meta.compression === "av1");
  if (!aceito) throw new FotoInvalida("formato");
  if ((meta.width ?? 0) * (meta.height ?? 0) > FOTO_LIMITE_PIXELS) throw new FotoInvalida("resolucao");

  try {
    // Sem `animated`: o sharp lê só o primeiro quadro de GIF/WebP animado.
    const buffer = await sharp(entrada, { limitInputPixels: FOTO_LIMITE_PIXELS })
      .rotate()
      .resize(FOTO_LADO_MAX, FOTO_LADO_MAX, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    return { buffer, mimeType: "image/webp" };
  } catch {
    throw new FotoInvalida("corrompida");
  }
}

export function montarFotoPerfilUrl(
  foto: Uint8Array | null | undefined,
  mimeType: string | null | undefined,
): string | null {
  if (!foto || !mimeType) return null;
  return `data:${mimeType};base64,${Buffer.from(foto).toString("base64")}`;
}

// Resposta de /auth/sync devolve a linha de Usuario: nunca com o buffer da foto.
export function semFotoPerfil<T extends object>(usuario: T): Omit<T, "foto_perfil"> {
  const { foto_perfil: _foto, ...resto } = usuario as T & { foto_perfil?: unknown }; // eslint-disable-line @typescript-eslint/no-unused-vars
  return resto as Omit<T, "foto_perfil">;
}

// select com todas as colunas de Usuario menos as da foto: mesma linha de antes, sem carregar o
// BLOB. Prisma 5.22 não tem `omit` estável. Derivado do enum do client, então coluna nova entra sozinha.
const COLUNAS_FOTO = ["foto_perfil", "foto_perfil_mime_type", "foto_perfil_atualizada_em"];
export const USUARIO_SEM_FOTO_SELECT = Object.fromEntries(
  Object.values(Prisma.UsuarioScalarFieldEnum)
    .filter((c) => !COLUNAS_FOTO.includes(c))
    .map((c) => [c, true]),
) as { [K in Exclude<keyof Usuario, "foto_perfil" | "foto_perfil_mime_type" | "foto_perfil_atualizada_em">]: true };

const TIMEOUT_FOTO_GOOGLE_MS = 5000;
// O seed do Google mantém as regras antigas (JPEG/PNG até 2 MB): a origem é fixa e a foto vem em 400 px.
const FOTO_GOOGLE_MIME = ["image/jpeg", "image/png"];
const FOTO_GOOGLE_LIMITE_BYTES = 2 * 1024 * 1024;

// Seed único da foto no cadastro via Google (decoded.picture). Feature decorativa: uma vez, sem
// retry, timeout curto; qualquer falha devolve null e o cadastro segue sem foto. O log nunca
// leva a URL nem os bytes, só um motivo fixo.
export async function baixarFotoDoGoogle(
  url: string,
): Promise<{ foto: Buffer; mimeType: string } | null> {
  const falhou = (motivo: string) => {
    console.warn(`[auth/sync] foto do Google não aproveitada: ${motivo}`);
    return null;
  };
  try {
    // Anti-SSRF: só https em host do Google (fotos de conta Google), sem seguir redirect.
    const alvo = new URL(url);
    const host = alvo.hostname.toLowerCase().replace(/\.$/, "");
    if (alvo.protocol !== "https:" || !(host === "googleusercontent.com" || host.endsWith(".googleusercontent.com"))) {
      return falhou("host não permitido");
    }
    // O Google entrega a foto em 96 px (`=s96-c`); pede 400 px pra não ficar pixelada no Perfil e em telas de alta densidade.
    alvo.pathname = alvo.pathname.replace(/=s\d+(-c)?$/, "=s400-c");
    const res = await fetch(alvo, { signal: AbortSignal.timeout(TIMEOUT_FOTO_GOOGLE_MS), redirect: "manual" });
    if (!res.ok) return falhou("resposta HTTP não-2xx");

    const mimeType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!FOTO_GOOGLE_MIME.includes(mimeType)) return falhou("Content-Type não suportado");

    const declarado = Number(res.headers.get("content-length"));
    if (declarado > FOTO_GOOGLE_LIMITE_BYTES) return falhou("acima do limite de tamanho");

    // ponytail: lê o corpo inteiro antes de checar o tamanho quando não há Content-Length;
    // trocar por leitura em stream com corte se isso virar risco (a origem é o Google).
    const foto = Buffer.from(await res.arrayBuffer());
    if (foto.length > FOTO_GOOGLE_LIMITE_BYTES) return falhou("acima do limite de tamanho");

    return { foto, mimeType };
  } catch (e) {
    return falhou(e instanceof Error && e.name === "TimeoutError" ? "timeout" : "erro no download");
  }
}
