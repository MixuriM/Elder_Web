import "express";

declare global {
  namespace Express {
    interface Request {
      /** Usuario.id interno, resolvido pelo middleware requireAuth a partir do firebase_uid. */
      usuarioId: number;
    }
  }
}

export {};
