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
export async function verifyFirebaseToken(idToken: string): Promise<TokenVerificationResult> {
  try {
    const decoded = await firebaseAuth.verifyIdToken(idToken);
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

// SQL Server rejeita a criação concorrente do mesmo firebase_uid via índice único
// filtrado — firebase_uid não é @unique nativo do Prisma (é índice manual, ver
// schema.prisma), então o erro chega como texto genérico do driver, não como P2002.
// Mesmo padrão de detecção usado em backend/scripts/verify-constraints.ts.
export function isDuplicateFirebaseUid(e: unknown): boolean {
  return e instanceof Error && /UNIQUE constraint|duplicate key|Violation of/i.test(e.message);
}
