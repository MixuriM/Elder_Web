import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";

// Tarefa 2.3 (RF-023, RNF-003) — middleware factory: libera rota de Cuidador/Familiar
// sobre dados de um Idoso só se existir Vinculo aprovado entre req.usuarioId (o
// cuidador/familiar) e o idoso identificado pelo parâmetro de rota `paramIdoso`.
// Não cobre o caso "idoso acessando o próprio dado" (fora de escopo aqui) nem as
// flags permite_* (tarefa 2.8).
export function requireVinculoAprovado(paramIdoso: string) {
  return async function (req: Request, res: Response, next: NextFunction) {
    try {
      // Guarda de trust boundary: se este middleware rodar sem requireAuth antes,
      // req.usuarioId vem undefined. Prisma ignora filtro de where com valor
      // undefined (não filtra por "nenhum"), então vinculado_id: undefined removeria
      // essa condição da query e aprovaria qualquer chamador com vínculo aprovado de
      // OUTRA pessoa para o mesmo idoso — fail-open. 401 explícito fecha essa lacuna.
      if (typeof req.usuarioId !== "number") {
        return res.status(401).json({ error: "Token ausente." });
      }

      const idosoId = Number(req.params[paramIdoso]);
      if (!Number.isInteger(idosoId)) {
        return res.status(400).json({ error: "Id de idoso inválido." });
      }

      // Suposição: o tipo_vinculo de qualquer vínculo aprovado de um vinculado_id é único e
      // consistente com o tipo_perfil fixo da conta, porque toda rota de criação amarra os dois
      // e nenhuma rota altera tipo_perfil nem tipo_vinculo depois de criado. Quebra se existir
      // "troca de tipo_perfil" ou um novo fluxo de criação de vínculo sem essa checagem; nesse
      // caso este findFirst precisa passar a filtrar por tipo_vinculo.
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
    } catch (e) {
      // Express 4 não captura rejeição de middleware async: sem isto o Node 24 derruba o processo.
      next(e);
    }
  };
}
