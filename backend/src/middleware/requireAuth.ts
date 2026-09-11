import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { verifyFirebaseToken } from "../lib/authHelpers";

// Middleware Express reutilizável (plano de desenvolvimento, item 1.3): resolve
// req.usuarioId a partir do firebase_uid em toda rota protegida. Ainda não aplicado
// a nenhuma rota existente — só /auth/sync existe hoje, e ela não usa este
// middleware porque é ela quem cria o Usuario na primeira sincronização.
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!idToken) {
    return res.status(401).json({ error: "Token ausente." });
  }

  const resultado = await verifyFirebaseToken(idToken);
  if (!resultado.ok) {
    return res.status(resultado.status).json({ error: resultado.error });
  }

  // findFirst, não findUnique: firebase_uid não é @unique no Prisma (índice único
  // filtrado e manual, ver schema.prisma) — mesmo padrão usado em /auth/sync.
  const usuario = await prisma.usuario.findFirst({
    where: { firebase_uid: resultado.decoded.uid },
  });

  if (!usuario) {
    // Token Firebase válido (identidade confirmada), mas sem linha correspondente em
    // Usuario (ex.: /auth/sync nunca rodou ou falhou nessa conta) — 403, não 401:
    // sabemos quem é, só não existe/autorizado na aplicação ainda. Bloqueio
    // intencional, não auto-cria o Usuario aqui: isso reaproveitaria a lógica de
    // /auth/sync, mas é decisão de arquitetura maior ainda não discutida com o grupo.
    // Pode mudar.
    return res.status(403).json({ error: "Usuário não sincronizado." });
  }

  req.usuarioId = usuario.id;
  next();
}
