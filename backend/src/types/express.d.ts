import "express";
import type { Vinculo } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      /** Usuario.id interno, resolvido pelo middleware requireAuth a partir do firebase_uid. */
      usuarioId: number;
      /** Vinculo aprovado, resolvido pelo middleware requireVinculoAprovado. */
      vinculoAprovado?: Vinculo;
    }
  }
}

export {};
