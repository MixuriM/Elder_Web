import "express";
import type { Vinculo } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      /** Usuario.id interno, resolvido pelo middleware requireAuth a partir do firebase_uid. */
      usuarioId: number;
      /** email_verified do ID Token, resolvido por requireAuth (false quando ausente). */
      emailVerificado: boolean;
      /** E-mail do ID Token (claim `email`), resolvido por requireAuth; undefined quando ausente ou não texto. */
      emailDoToken?: string;
      /** auth_time do ID Token (segundos desde a época: quando o login foi feito); undefined se ausente ou não numérico. */
      authTime?: number;
      /** Conta do elenco do modo demonstração (uid na lista fechada), resolvido por requireAuth. */
      contaDemo?: boolean;
      /** Vinculo aprovado, resolvido pelo middleware requireVinculoAprovado. */
      vinculoAprovado?: Vinculo;
    }
  }
}

export {};
