import type { DecodedIdToken } from "firebase-admin/auth";
import { auth as firebaseAuth } from "./firebaseAdmin";
import { ehContaExcluida } from "./contaExcluida";

export type TokenVerificationResult =
  | { ok: true; decoded: DecodedIdToken }
  | { ok: false; status: 401 | 503; error: string };

// Códigos do Firebase Admin SDK sobre o token em si (não sobre disponibilidade do
// serviço) — https://firebase.google.com/docs/auth/admin/errors. Tratados
// explicitamente porque são os casos esperados (expirado/revogado/malformado);
// qualquer outro código "auth/*" ainda cai em 401 pelo fallback abaixo, só não é
// citado nominalmente.
const TOKEN_ERROR_CODES = new Set([
  "auth/id-token-expired",
  "auth/id-token-revoked",
  "auth/argument-error",
  "auth/invalid-id-token",
]);

// Usada por /auth/sync (cria Usuario se não existir) e pelo middleware requireAuth
// (só lê) — mesma validação de token, consumidores diferentes.
// checarRevogado (D5, 2026-10-14): pede ao Firebase para recusar token de sessão revogada (senha redefinida, por
// exemplo). Custa uma chamada a mais ao Firebase, por isso só nas ações sensíveis (requireAuthRevogacao).
export async function verifyFirebaseToken(
  idToken: string,
  { checarRevogado = false }: { checarRevogado?: boolean } = {},
): Promise<TokenVerificationResult> {
  try {
    const decoded = checarRevogado
      ? await firebaseAuth.verifyIdToken(idToken, true)
      : await firebaseAuth.verifyIdToken(idToken);
    return { ok: true, decoded };
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code && (TOKEN_ERROR_CODES.has(code) || code.startsWith("auth/"))) {
      return { ok: false, status: 401, error: "Token inválido ou expirado." };
    }
    // Sem código auth/* = falha ao contatar o Firebase (rede, serviço fora do ar),
    // não o token — RNF-005.
    return {
      ok: false,
      status: 503,
      error: "Firebase Auth indisponível no momento. Tente novamente em instantes.",
    };
  }
}

const TIPOS_PERFIL = ["idoso", "cuidador", "familiar"] as const;
export type TipoPerfil = (typeof TIPOS_PERFIL)[number];

export function isTipoPerfil(value: unknown): value is TipoPerfil {
  return typeof value === "string" && (TIPOS_PERFIL as readonly string[]).includes(value);
}

// Validação simples de formato — sem lib de e-mail no projeto, checagem real de
// entregabilidade não é o objetivo aqui, só barrar lixo óbvio antes de persistir.
// Usada por /auth/sync (email_convite_familiar, RF-024).
// E-mail do marcador de conta excluída nunca é válido (F3 do fechamento do 9.5): senão alguém abriria vínculo ou convite para uma
// conta morta, ou gravaria o marcador no próprio cadastro e se trancaria para fora.
// Sem regex (CodeQL: polynomial-redos em /^[^\s@]+@[^\s@]+\.[^\s@]+$/): mesma regra em passo linear. Um "@" só, parte local não
// vazia, sem espaço em branco, e na parte do domínio um "." que não seja o primeiro nem o último caractere. 320 é o teto do
// formato de e-mail; os chamadores já limitam a 255.
export function isValidEmailFormat(value: string): boolean {
  if (value.length > 320) return false;
  const arroba = value.indexOf("@");
  if (arroba < 1 || value.indexOf("@", arroba + 1) !== -1) return false;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    // \s do JavaScript: espaço, tabulação, quebras de linha, NBSP, separadores Unicode e BOM.
    if (c === 32 || (c >= 9 && c <= 13) || c === 160 || c === 0x1680 || (c >= 0x2000 && c <= 0x200a) || c === 0x2028 || c === 0x2029 || c === 0x202f || c === 0x205f || c === 0x3000 || c === 0xfeff) return false;
  }
  const dominio = value.slice(arroba + 1);
  let achouPonto = false;
  for (let i = 1; i <= dominio.length - 2; i++) {
    if (dominio[i] === ".") {
      achouPonto = true;
      break;
    }
  }
  return achouPonto && !ehContaExcluida(value);
}

// "E-mail verificado" do token vale para o e-mail DO TOKEN. O ID token emitido antes de uma troca de e-mail segue com
// email_verified=true por até 1 h, então toda aprovação automática por posse de e-mail só vale se o e-mail do token for o
// do cadastro (sem diferenciar maiúsculas). Token sem e-mail ou cadastro sem e-mail: não confere.
export function emailDoTokenConfere(emailDoToken: unknown, emailCadastro: string | null | undefined): boolean {
  return (
    typeof emailDoToken === "string" &&
    emailDoToken !== "" &&
    !!emailCadastro &&
    emailDoToken.toLowerCase() === emailCadastro.toLowerCase()
  );
}

// SQL Server rejeita a criação concorrente do mesmo firebase_uid via índice único
// filtrado — firebase_uid não é @unique nativo do Prisma (é índice manual, ver
// schema.prisma), então o erro chega como texto genérico do driver, não como P2002.
// Mesmo padrão de detecção usado em backend/scripts/verify-constraints.ts.
export function isDuplicateFirebaseUid(e: unknown): boolean {
  return e instanceof Error && /UNIQUE constraint|duplicate key|Violation of/i.test(e.message);
}

// Mesma detecção genérica de violação de índice único do driver (índice filtrado de
// email não é @unique nativo do Prisma, então também não chega como P2002) — usada em
// PATCH /usuario/me ao trocar email.
export function isDuplicateEmail(e: unknown): boolean {
  return e instanceof Error && /UNIQUE constraint|duplicate key|Violation of/i.test(e.message);
}
