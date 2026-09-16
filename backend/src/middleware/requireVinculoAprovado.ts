import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";

// Tarefa 2.3 (RF-023, RNF-003) — middleware factory: libera rota de Cuidador/Familiar
// sobre dados de um Idoso só se existir Vinculo aprovado entre req.usuarioId (o
// cuidador/familiar) e o idoso identificado pelo parâmetro de rota `paramIdoso`.
// Não cobre o caso "idoso acessando o próprio dado" (fora de escopo aqui) nem as
// flags permite_* (tarefa 2.8).
export function requireVinculoAprovado(paramIdoso: string) {
  return async function (req: Request, res: Response, next: NextFunction) {
    const idosoId = Number(req.params[paramIdoso]);
    if (!Number.isInteger(idosoId)) {
      return res.status(400).json({ error: "Id de idoso inválido." });
    }

    const vinculo = await prisma.vinculo.findFirst({
      where: { idoso_id: idosoId, vinculado_id: req.usuarioId, status: "aprovado" },
    });

    // Mesma resposta pra "não existe" e pra "existe mas pendente/recusado" — não
    // vaza estado do vínculo pra quem não tem autorização.
    if (!vinculo) {
      return res.status(403).json({ error: "Vínculo aprovado não encontrado para este idoso." });
    }

    req.vinculoAprovado = vinculo;
    next();
  };
}
