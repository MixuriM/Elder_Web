import "express";
import type { Vinculo } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      /** Usuario.id interno, resolvido pelo middleware requireAuth a partir do firebase_uid. */
      usuarioId: number;
      /** email_verified do ID Token, resolvido por requireAuth (false quando ausente). */
      emailVerificado: boolean;
      /** Vinculo aprovado, resolvido pelo middleware requireVinculoAprovado. */
      vinculoAprovado?: Vinculo;
    }
  }
}

export {};
