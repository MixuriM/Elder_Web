import type { DecodedIdToken } from "firebase-admin/auth";
import { auth as firebaseAuth } from "./firebaseAdmin";

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
export function isValidEmailFormat(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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
