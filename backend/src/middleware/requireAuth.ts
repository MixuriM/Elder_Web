import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { verifyFirebaseToken } from "../lib/authHelpers";
import { criarLimitador, porUsuario, QUINZE_MIN } from "../lib/limiteTaxa";
import { ehUidDemo } from "../lib/demo/elenco";
import { ehContaExcluida, MSG_TOKEN_INVALIDO } from "../lib/contaExcluida";

// Limite geral por usuário em toda rota autenticada (decisão D1 de 2026-10-14). 2000 por 15 min, não 600: a entrada na
// Home faz 12 chamadas à API e um uso intenso (voltar à Home a cada minuto) chega a cerca de 180 em 15 min; o limite
// fica acima de 10 vezes isso.
const limiteGeral = criarLimitador({ janelaMs: QUINZE_MIN, maximo: 2000, chave: porUsuario });

// Middleware Express reutilizável (plano de desenvolvimento, item 1.3): resolve
// req.usuarioId a partir do firebase_uid em toda rota protegida. Ainda não aplicado
// a nenhuma rota existente — só /auth/sync existe hoje, e ela não usa este
// middleware porque é ela quem cria o Usuario na primeira sincronização.
// checarRevogado: ver verifyFirebaseToken. Duas instâncias abaixo; o inventário de rotas confere qual cada rota usa.
function criarRequireAuth(checarRevogado: boolean) {
  return async function (req: Request, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers.authorization;
      const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

      if (!idToken) {
        return res.status(401).json({ error: "Token ausente." });
      }

      const resultado = await verifyFirebaseToken(idToken, { checarRevogado });
      if (!resultado.ok) {
        return res.status(resultado.status).json({ error: resultado.error });
      }

      // findFirst, não findUnique: firebase_uid não é @unique no Prisma (índice único
      // filtrado e manual, ver schema.prisma) — mesmo padrão usado em /auth/sync.
      const usuario = await prisma.usuario.findFirst({
        where: { firebase_uid: resultado.decoded.uid },
        select: { id: true, email: true }, // sem select traria o BLOB da foto a cada requisição autenticada
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

      // Conta excluída (anonimizada): o ID Token de antes da exclusão segue válido no Firebase por até 1 h e a linha
      // mantém o firebase_uid. Mesma resposta do token inválido, para a rota nunca escrever na conta que ninguém apaga mais.
      if (ehContaExcluida(usuario.email)) {
        return res.status(401).json({ error: MSG_TOKEN_INVALIDO });
      }

      req.usuarioId = usuario.id;
      // RF-030: expõe se o e-mail do token já foi verificado (ausente vira false).
      req.emailVerificado = resultado.decoded.email_verified ?? false;
      // O aceite de convite compara este e-mail com o do cadastro (email_verified sozinho não diz de quem é o e-mail).
      req.emailDoToken = typeof resultado.decoded.email === "string" ? resultado.decoded.email : undefined;
      // A exclusão de conta exige login recente: só número finito vale como auth_time.
      const authTime = resultado.decoded.auth_time;
      req.authTime = typeof authTime === "number" && Number.isFinite(authTime) ? authTime : undefined;
      // Modo demonstração: conta fictícia do elenco (bloquearContaDemo e requireVinculoAprovado usam).
      req.contaDemo = ehUidDemo(resultado.decoded.uid);
      limiteGeral(req, res, next);
    } catch (e) {
      // Express 4 não captura rejeição de middleware async: sem isto o Node 24 derruba o processo.
      next(e);
    }
  };
}

export const requireAuth = criarRequireAuth(false);

// D5 (2026-10-14): só nas ações sensíveis (perfil, cadastro de idoso, pedidos, convites e respostas de vínculo,
// permissões e transferência de decisão). Token revogado dá 401. Nunca em leitura, saúde, remédio, agenda,
// alimentação, emergência (precisa funcionar com o Firebase lento) nem foto.
export const requireAuthRevogacao = criarRequireAuth(true);
