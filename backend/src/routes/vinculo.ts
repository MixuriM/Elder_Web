import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

// Mesmo padrão de detecção genérica de violação de índice único usado em
// authHelpers.ts (isDuplicateEmail/isDuplicateFirebaseUid) — aqui só como rede de
// segurança defensiva: NÃO existe hoje, no schema.prisma, nenhum índice único sobre
// (idoso_id, vinculado_id, tipo_vinculo) em Vinculo. A checagem de duplicidade abaixo
// é só em nível de aplicação (findFirst antes do create).
// ponytail: corrida real entre duas solicitações simultâneas do mesmo par
// idoso/cuidador não é 100% fechada sem um índice único no banco — se isso virar
// problema de verdade, precisa de migration nova (fora do escopo desta tarefa,
// combinar com o grupo antes).
function isDuplicateVinculoConstraint(e: unknown): boolean {
  return e instanceof Error && /UNIQUE constraint|duplicate key|Violation of/i.test(e.message);
}

router.post("/solicitar-cuidador", requireAuth, async (req, res, next) => {
  try {
    const cuidador = await prisma.usuario.findUnique({
      where: { id: req.usuarioId },
      select: { id: true, tipo_perfil: true },
    });
    if (cuidador?.tipo_perfil !== "cuidador") {
      return res.status(403).json({ error: "Apenas cuidadores podem solicitar este vínculo." });
    }

    const { email, nome_idoso } = req.body ?? {};
    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ error: "E-mail é obrigatório." });
    }
    const emailBusca = email.trim();

    // Mensagem genérica em todo caminho de "não encontrado" — não revela se o
    // e-mail existe associado a outro tipo de conta (evita oráculo de enumeração).
    const naoEncontrado = () =>
      res.status(404).json({ error: "Nenhum idoso encontrado para este e-mail." });

    // (1) Idoso direto — tentado sempre primeiro, independente de modo_decisao.
    const idosoDireto = await prisma.usuario.findFirst({
      where: { email: emailBusca, tipo_perfil: "idoso" },
      select: { id: true, nome: true },
    });

    let idosoAlvo: { id: number; nome: string } | null = idosoDireto;

    if (!idosoAlvo) {
      // (2) Familiar no controle (modo_decisao='familiar') de um ou mais idosos.
      const familiar = await prisma.usuario.findFirst({
        where: { email: emailBusca, tipo_perfil: "familiar" },
        select: { id: true },
      });
      if (!familiar) {
        return naoEncontrado();
      }

      const vinculos = await prisma.vinculo.findMany({
        where: {
          tipo_vinculo: "familiar",
          status: "aprovado",
          vinculado_id: familiar.id,
          idoso: { modo_decisao: "familiar" },
        },
        select: { idoso: { select: { id: true, nome: true } } },
      });
      const candidatosMap = new Map(vinculos.map((v) => [v.idoso.id, v.idoso]));
      const candidatos = [...candidatosMap.values()];

      if (candidatos.length === 0) {
        return naoEncontrado();
      }

      if (candidatos.length === 1) {
        idosoAlvo = candidatos[0];
      } else {
        if (typeof nome_idoso !== "string" || !nome_idoso.trim()) {
          return res.status(422).json({
            error: "Este e-mail controla mais de um idoso — informe nome_idoso para desambiguar.",
            candidatos,
          });
        }
        const nomeBusca = nome_idoso.trim().toLowerCase();
        const filtrados = candidatos.filter((c) => c.nome.trim().toLowerCase() === nomeBusca);
        if (filtrados.length !== 1) {
          return res.status(422).json({
            error:
              filtrados.length === 0
                ? "nome_idoso não corresponde a nenhum idoso sob este e-mail."
                : "nome_idoso corresponde a mais de um idoso sob este e-mail.",
            candidatos,
          });
        }
        idosoAlvo = filtrados[0];
      }
    }

    if (idosoAlvo.id === req.usuarioId) {
      return res.status(400).json({ error: "Você não pode solicitar vínculo com sua própria conta." });
    }

    const existente = await prisma.vinculo.findFirst({
      where: {
        idoso_id: idosoAlvo.id,
        vinculado_id: req.usuarioId,
        tipo_vinculo: "cuidador",
        status: { in: ["pendente", "aprovado"] },
      },
      select: { status: true },
    });
    if (existente?.status === "pendente") {
      return res.status(409).json({ error: "Já existe uma solicitação pendente para este idoso." });
    }
    if (existente?.status === "aprovado") {
      return res.status(409).json({ error: "Você já está vinculado a este idoso." });
    }
    // status === 'recusado': permite nova solicitação (novo registro). Decisão
    // assumida, não confirmada com o grupo — ver instrução original da tarefa 2.1.

    const vinculo = await prisma.vinculo.create({
      data: {
        idoso_id: idosoAlvo.id,
        vinculado_id: req.usuarioId,
        tipo_vinculo: "cuidador",
        origem: "solicitacao_cuidador",
        status: "pendente",
        data_solicitacao: new Date(),
      },
    });
    res.status(201).json(vinculo);
  } catch (e) {
    if (isDuplicateVinculoConstraint(e)) {
      return res.status(409).json({ error: "Já existe uma solicitação para este idoso." });
    }
    next(e);
  }
});

// Tarefa 2.2 (RF-021, RF-022) — aprovar/recusar solicitação de vínculo de Cuidador.
// Compartilhada entre /aprovar e /recusar: mesma checagem de autoridade e de estado,
// só muda o status final. Autoridade segue Usuario.modo_decisao do IDOSO DONO do
// vínculo (Vinculo.idoso_id), nunca de quem está chamando — mesma regra que vai
// valer pra vínculo de Familiar Fluxo B (tarefa 2.7, fora de escopo aqui) e pras
// flags permite_* (tarefa 2.8, também fora de escopo).
async function responderSolicitacaoCuidador(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
  novoStatus: "aprovado" | "recusado",
) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Id de vínculo inválido." });
    }

    const vinculo = await prisma.vinculo.findUnique({
      where: { id },
      select: { id: true, idoso_id: true, status: true, tipo_vinculo: true },
    });
    // tipo_vinculo !== 'cuidador': vínculo de Familiar existe mas pertence ao fluxo da
    // tarefa 2.7, não a esta rota — tratado como inexistente aqui. Decisão de backend,
    // confirmada por Marcos (2026-09-15).
    if (!vinculo || vinculo.tipo_vinculo !== "cuidador") {
      return res.status(404).json({ error: "Vínculo não encontrado." });
    }
    if (vinculo.status !== "pendente") {
      return res.status(409).json({ error: "Este vínculo já foi resolvido." });
    }

    const idoso = await prisma.usuario.findUnique({
      where: { id: vinculo.idoso_id },
      select: { modo_decisao: true },
    });
    // NULL (modo_decisao nunca setado) tratado como 'idoso' — estado inicial/default
    // do sistema até ser explicitamente transferido pra 'familiar'. Decisão de backend,
    // confirmada por Marcos (2026-09-15).
    const modo = idoso?.modo_decisao ?? "idoso";

    if (modo === "idoso") {
      if (req.usuarioId !== vinculo.idoso_id) {
        return res.status(403).json({ error: "Só o idoso pode responder esta solicitação." });
      }
    } else {
      if (req.usuarioId === vinculo.idoso_id) {
        return res.status(403).json({ error: "Autoridade transferida para familiar(es)." });
      }
      const familiarAprovado = await prisma.vinculo.findFirst({
        where: {
          idoso_id: vinculo.idoso_id,
          vinculado_id: req.usuarioId,
          tipo_vinculo: "familiar",
          status: "aprovado",
        },
        select: { id: true },
      });
      if (!familiarAprovado) {
        return res.status(403).json({ error: "Só familiar vinculado e aprovado pode responder esta solicitação." });
      }
    }

    const atualizado = await prisma.vinculo.update({
      where: { id },
      data: { status: novoStatus, aprovador_id: req.usuarioId, data_resposta: new Date() },
    });
    res.status(200).json(atualizado);
  } catch (e) {
    next(e);
  }
}

router.post("/:id/aprovar", requireAuth, (req, res, next) =>
  responderSolicitacaoCuidador(req, res, next, "aprovado"),
);
router.post("/:id/recusar", requireAuth, (req, res, next) =>
  responderSolicitacaoCuidador(req, res, next, "recusado"),
);

export default router;
