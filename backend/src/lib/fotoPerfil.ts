import { Prisma, type Usuario } from "@prisma/client";

// Foto de perfil guardada como BLOB em Usuario (foto_perfil + foto_perfil_mime_type). O
// backend devolve sempre data URI pronta, nunca o buffer cru.
export const FOTO_MIME_PERMITIDOS = ["image/jpeg", "image/png"];
export const FOTO_LIMITE_BYTES = 2 * 1024 * 1024;

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
    const res = await fetch(alvo, { signal: AbortSignal.timeout(TIMEOUT_FOTO_GOOGLE_MS), redirect: "manual" });
    if (!res.ok) return falhou("resposta HTTP não-2xx");

    const mimeType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!FOTO_MIME_PERMITIDOS.includes(mimeType)) return falhou("Content-Type não suportado");

    const declarado = Number(res.headers.get("content-length"));
    if (declarado > FOTO_LIMITE_BYTES) return falhou("acima do limite de tamanho");

    // ponytail: lê o corpo inteiro antes de checar o tamanho quando não há Content-Length;
    // trocar por leitura em stream com corte se isso virar risco (a origem é o Google).
    const foto = Buffer.from(await res.arrayBuffer());
    if (foto.length > FOTO_LIMITE_BYTES) return falhou("acima do limite de tamanho");

    return { foto, mimeType };
  } catch (e) {
    return falhou(e instanceof Error && e.name === "TimeoutError" ? "timeout" : "erro no download");
  }
}
