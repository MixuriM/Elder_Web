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
