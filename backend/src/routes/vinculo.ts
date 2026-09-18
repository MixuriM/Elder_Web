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

// Tarefa 2.6 (RF-026, Fluxo B) — Familiar solicita vínculo diretamente pelo e-mail do
// Idoso. Espelho de /solicitar-cuidador, mas sem a ambiguidade "1 ou 2+ idosos" daquela
// rota: aqui a busca é direta pelo e-mail do próprio Idoso, e email é @unique filtrado em
// Usuario — no máximo 1 conta bate. Não existe branch pra "e-mail de conta não-idoso": o
// findFirst abaixo já filtra tipo_perfil='idoso', então uma conta de outro tipo com esse
// e-mail resolve null e cai no mesmo 404 genérico — não revela a que tipo de conta o
// e-mail pertence (mesmo padrão da tarefa 2.1).
//
// Auto-vínculo: sem guard explícito. tipo_perfil é fixo e único por conta (decisão
// fechada) — o chamador já foi confirmado tipo_perfil='familiar' acima, e idosoAlvo só
// resolve contas tipo_perfil='idoso'. Os dois nunca podem ser o mesmo id.
router.post("/solicitar-familiar", requireAuth, async (req, res, next) => {
  try {
    const familiar = await prisma.usuario.findUnique({
      where: { id: req.usuarioId },
      select: { id: true, tipo_perfil: true },
    });
    if (familiar?.tipo_perfil !== "familiar") {
      return res.status(403).json({ error: "Apenas familiares podem solicitar este vínculo." });
    }

    const { email } = req.body ?? {};
    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ error: "E-mail é obrigatório." });
    }

    const idosoAlvo = await prisma.usuario.findFirst({
      where: { email: email.trim(), tipo_perfil: "idoso" },
      select: { id: true },
    });
    if (!idosoAlvo) {
      return res.status(404).json({ error: "Nenhum idoso encontrado para este e-mail." });
    }

    // Mesma checagem de duplicidade da tarefa 2.1 (findFirst antes do create — ver
    // isDuplicateVinculoConstraint acima pra rede de segurança contra corrida). O
    // índice único filtrado (idoso_id, vinculado_id, tipo_vinculo, WHERE status IN
    // ('pendente','aprovado')) não distingue origem — um Vinculo já criado pelo Fluxo A
    // (tarefa 2.5, origem='convite_idoso') pro mesmo par bloqueia aqui também, de
    // propósito: não duplicar vínculo entre os dois fluxos.
    const existente = await prisma.vinculo.findFirst({
      where: {
        idoso_id: idosoAlvo.id,
        vinculado_id: req.usuarioId,
        tipo_vinculo: "familiar",
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
    // status === 'recusado': permite nova solicitação (novo registro). Mesma decisão
    // assumida e não confirmada com o grupo da tarefa 2.1.

    const vinculo = await prisma.vinculo.create({
      data: {
        idoso_id: idosoAlvo.id,
        vinculado_id: req.usuarioId,
        tipo_vinculo: "familiar",
        origem: "solicitacao_familiar",
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
// Estendida pela tarefa 2.7 (RF-027) pra também cobrir vínculo de Familiar (Fluxo B,
// tarefa 2.6). Compartilhada entre /aprovar e /recusar, e entre os dois tipo_vinculo:
// mesma checagem de autoridade e de estado, só muda o status final. Autoridade segue
// Usuario.modo_decisao do IDOSO DONO do vínculo (Vinculo.idoso_id), nunca de quem está
// chamando — mesma regra pros dois tipos, sem variante nova. tipo_vinculo só tem os
// dois valores 'cuidador'/'familiar' (CHECK constraint em schema.prisma), então uma
// vez que vinculo existe, sempre pertence a um dos dois fluxos que esta rota cobre.
// Resolve quem tem autoridade sobre o idoso (Usuario.modo_decisao) — reaproveitado
// pela tarefa 2.8 (definir-permissoes) além de responderSolicitacaoVinculo. NULL
// (nunca setado) tratado como 'idoso', mesma decisão de sempre.
async function resolverModoDecisao(idosoId: number): Promise<"idoso" | "familiar"> {
  const idoso = await prisma.usuario.findUnique({
    where: { id: idosoId },
    select: { modo_decisao: true },
  });
  return idoso?.modo_decisao === "familiar" ? "familiar" : "idoso";
}

async function familiarTemVinculoAprovado(idosoId: number, familiarId: number): Promise<boolean> {
  const vinculo = await prisma.vinculo.findFirst({
    where: { idoso_id: idosoId, vinculado_id: familiarId, tipo_vinculo: "familiar", status: "aprovado" },
    select: { id: true },
  });
  return !!vinculo;
}

async function responderSolicitacaoVinculo(
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
    if (!vinculo) {
      return res.status(404).json({ error: "Vínculo não encontrado." });
    }
    if (vinculo.status !== "pendente") {
      return res.status(409).json({ error: "Este vínculo já foi resolvido." });
    }

    const modo = await resolverModoDecisao(vinculo.idoso_id);

    if (modo === "idoso") {
      if (req.usuarioId !== vinculo.idoso_id) {
        return res.status(403).json({ error: "Só o idoso pode responder esta solicitação." });
      }
    } else {
      if (req.usuarioId === vinculo.idoso_id) {
        return res.status(403).json({ error: "Autoridade transferida para familiar(es)." });
      }
      if (!(await familiarTemVinculoAprovado(vinculo.idoso_id, req.usuarioId))) {
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
  responderSolicitacaoVinculo(req, res, next, "aprovado"),
);
router.post("/:id/recusar", requireAuth, (req, res, next) =>
  responderSolicitacaoVinculo(req, res, next, "recusado"),
);

// Tarefa 2.8 (RF-032) — definir as 3 flags de permissão operacional do Cuidador
// (permite_registrar_saude, permite_marcar_dose, permite_criar_evento_cuidado).
// PATCH, não POST: diferente de /aprovar e /recusar (ações de estado fixas), esta
// rota atualiza colunas específicas de um recurso existente — mesmo padrão de
// PATCH /usuario/me (atualização parcial, só os campos enviados são tocados).
// Endpoint único pras 3 flags (não 3 rotas separadas): Vinculo.definido_em é um
// timestamp singular ("quando as permissões foram alteradas pela última vez", não
// um por flag — ver ER.md) e as 3 sempre pertencem à mesma decisão de autoridade
// (Usuario.modo_decisao do idoso), então um POST por flag só triplicaria a mesma
// checagem de autoridade sem nenhum ganho.
//
// Exige tipo_vinculo='cuidador' (400 se não) e status='aprovado' (409 se não) antes
// de checar autoridade — decisão fechada, ver <decisoes_ja_fechadas_nao_reabrir>: as
// flags não têm efeito fora de tipo_vinculo='cuidador', e liberar escrita num vínculo
// ainda pendente ativaria a permissão automaticamente na aprovação, sem reconfirmação.
router.patch("/:id/definir-permissoes", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Id de vínculo inválido." });
    }

    const vinculo = await prisma.vinculo.findUnique({
      where: { id },
      select: { id: true, idoso_id: true, status: true, tipo_vinculo: true },
    });
    if (!vinculo) {
      return res.status(404).json({ error: "Vínculo não encontrado." });
    }
    if (vinculo.tipo_vinculo !== "cuidador") {
      return res.status(400).json({ error: "Permissões só se aplicam a vínculo de cuidador." });
    }
    if (vinculo.status !== "aprovado") {
      return res.status(409).json({ error: "Vínculo precisa estar aprovado para ter permissões definidas." });
    }

    const modo = await resolverModoDecisao(vinculo.idoso_id);
    if (modo === "idoso") {
      if (req.usuarioId !== vinculo.idoso_id) {
        return res.status(403).json({ error: "Só o idoso pode definir as permissões deste vínculo." });
      }
    } else {
      if (req.usuarioId === vinculo.idoso_id) {
        return res.status(403).json({ error: "Autoridade transferida para familiar(es)." });
      }
      if (!(await familiarTemVinculoAprovado(vinculo.idoso_id, req.usuarioId))) {
        return res
          .status(403)
          .json({ error: "Só familiar vinculado e aprovado pode definir as permissões deste vínculo." });
      }
    }

    const { permite_registrar_saude, permite_marcar_dose, permite_criar_evento_cuidado } = req.body ?? {};
    const data: {
      permite_registrar_saude?: boolean;
      permite_marcar_dose?: boolean;
      permite_criar_evento_cuidado?: boolean;
    } = {};
    for (const [campo, valor] of [
      ["permite_registrar_saude", permite_registrar_saude],
      ["permite_marcar_dose", permite_marcar_dose],
      ["permite_criar_evento_cuidado", permite_criar_evento_cuidado],
    ] as const) {
      if (valor === undefined) continue;
      if (typeof valor !== "boolean") {
        return res.status(400).json({ error: `${campo} precisa ser booleano.` });
      }
      data[campo] = valor;
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        error: "Informe ao menos uma permissão (permite_registrar_saude, permite_marcar_dose ou permite_criar_evento_cuidado).",
      });
    }

    const atualizado = await prisma.vinculo.update({
      where: { id },
      data: { ...data, definido_por_id: req.usuarioId, definido_em: new Date() },
      select: {
        id: true,
        permite_registrar_saude: true,
        permite_marcar_dose: true,
        permite_criar_evento_cuidado: true,
        definido_por_id: true,
        definido_em: true,
      },
    });
    res.status(200).json(atualizado);
  } catch (e) {
    next(e);
  }
});

export default router;
