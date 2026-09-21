import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { CANCELAMENTO_SOLICITACAO } from "../lib/modoDecisao";
import { mascararEmail } from "../lib/mascararEmail";
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
  const estado = await resolverEstadoModoDecisao(idosoId);
  return estado.modo_decisao === "familiar" ? "familiar" : "idoso";
}

async function familiarTemVinculoAprovado(idosoId: number, familiarId: number): Promise<boolean> {
  const vinculo = await prisma.vinculo.findFirst({
    where: { idoso_id: idosoId, vinculado_id: familiarId, tipo_vinculo: "familiar", status: "aprovado" },
    select: { id: true },
  });
  return !!vinculo;
}

// Tarefa 2.9 (RF-033) — transferência de Usuario.modo_decisao pra 'familiar', com janela
// de carência de 7 dias e segunda confirmação quando o idoso tem 2+ familiares aprovados.
// Mecanismo completo em Elder Web - Modelagem ER.md seção 3.
export const MODO_DECISAO_SELECT = {
  modo_decisao: true,
  modo_decisao_solicitado: true,
  modo_decisao_solicitado_por_id: true,
  modo_decisao_solicitado_em: true,
  modo_decisao_expira_em: true,
  modo_decisao_segunda_confirmacao_id: true,
  modo_decisao_alterado_por_id: true,
  modo_decisao_alterado_em: true,
  modo_decisao_motivo: true,
} as const;

type ModoDecisaoEstado = {
  modo_decisao: string | null;
  modo_decisao_solicitado: string | null;
  modo_decisao_solicitado_por_id: number | null;
  modo_decisao_solicitado_em: Date | null;
  modo_decisao_expira_em: Date | null;
  modo_decisao_segunda_confirmacao_id: number | null;
  modo_decisao_alterado_por_id: number | null;
  modo_decisao_alterado_em: Date | null;
  modo_decisao_motivo: string | null;
};

const MODO_DECISAO_NEUTRO: ModoDecisaoEstado = {
  modo_decisao: null,
  modo_decisao_solicitado: null,
  modo_decisao_solicitado_por_id: null,
  modo_decisao_solicitado_em: null,
  modo_decisao_expira_em: null,
  modo_decisao_segunda_confirmacao_id: null,
  modo_decisao_alterado_por_id: null,
  modo_decisao_alterado_em: null,
  modo_decisao_motivo: null,
};

// Checagem preguiçosa de expiração — chamada em todo ponto que já lê modo_decisao pra
// autoridade (resolverModoDecisao acima) e nas duas rotas novas desta tarefa. NÃO cobre
// login do idoso: cancelamento por login é tratado separadamente em POST /auth/sync,
// porque login sempre cancela a solicitação primeiro, com prioridade sobre a expiração
// (mesmo se os dois acontecerem "ao mesmo tempo") — ver CLAUDE.md, limitação aceita desta
// tarefa: sem job agendado, uma linha pode ficar com modo_decisao_solicitado* preenchido
// além do prazo até o próximo ponto de leitura relevante rodar esta função.
export async function resolverEstadoModoDecisao(idosoId: number): Promise<ModoDecisaoEstado> {
  // findUnique, não findUniqueOrThrow: mesmo padrão do antigo resolverModoDecisao — id
  // sempre vem de um Vinculo.idoso_id ou de req.usuarioId já resolvido por requireAuth,
  // nunca de entrada não confiável, mas mantém a mesma tolerância defensiva de antes.
  const usuario = await prisma.usuario.findUnique({
    where: { id: idosoId },
    select: MODO_DECISAO_SELECT,
  });
  if (!usuario) {
    return MODO_DECISAO_NEUTRO;
  }

  const expirou =
    usuario.modo_decisao_solicitado === "familiar" &&
    usuario.modo_decisao_expira_em !== null &&
    usuario.modo_decisao_expira_em !== undefined &&
    usuario.modo_decisao_expira_em <= new Date();

  if (!expirou) {
    return usuario;
  }

  const aprovadosCount = await prisma.vinculo.count({
    where: { idoso_id: idosoId, tipo_vinculo: "familiar", status: "aprovado" },
  });
  const exigeSegundaConfirmacao = aprovadosCount >= 2;
  const podeEfetivar = !exigeSegundaConfirmacao || usuario.modo_decisao_segunda_confirmacao_id !== null;

  if (podeEfetivar) {
    return prisma.usuario.update({
      where: { id: idosoId },
      data: {
        modo_decisao: "familiar",
        modo_decisao_alterado_por_id: usuario.modo_decisao_solicitado_por_id,
        modo_decisao_alterado_em: new Date(),
        modo_decisao_solicitado: null,
        modo_decisao_solicitado_por_id: null,
        modo_decisao_solicitado_em: null,
        modo_decisao_expira_em: null,
        modo_decisao_segunda_confirmacao_id: null,
      },
      select: MODO_DECISAO_SELECT,
    });
  }

  // Expirou sem a segunda confirmação exigida: solicitação vencida, não efetiva.
  // modo_decisao_motivo é limpo junto (mesmo padrão do cancelamento por login em
  // POST /auth/sync) — evita motivo órfão sobrevivendo em GET /usuario/me sem
  // nenhum modo_decisao_solicitado*/alterado* pra dar contexto.
  return prisma.usuario.update({
    where: { id: idosoId },
    data: CANCELAMENTO_SOLICITACAO,
    select: MODO_DECISAO_SELECT,
  });
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

// Contestação de vínculo automático Familiar↔Idoso já 'aprovado' (RF-022; dívida técnica
// do item 2.5). Elegível: tipo_vinculo='familiar', origem 'convite_idoso' (Fluxo A) ou
// 'cadastro_familiar' (RF-030) — os dois que aprovam por e-mail, sem humano. Vínculo
// 'solicitacao_familiar' já passou por aprovação manual e não entra aqui. Mesma autoridade
// de aprovar/recusar (Usuario.modo_decisao). Efeito idêntico a /recusar: status='recusado'
// + aprovador_id + data_resposta (que nos vínculos automáticos é NULL, então passa a
// registrar a data da contestação). Não depende de notificado_em: não há canal de
// notificação, ver ER.md REV.16.
//
// Contestar o próprio vínculo dá 403: é desvincular (outro requisito) e poderia deixar sem
// familiar um idoso cadastrado via RF-030, que não tem login.
router.post("/:id/contestar", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Id de vínculo inválido." });
    }

    const vinculo = await prisma.vinculo.findUnique({
      where: { id },
      select: { id: true, idoso_id: true, vinculado_id: true, status: true, tipo_vinculo: true, origem: true },
    });
    if (!vinculo) {
      return res.status(404).json({ error: "Vínculo não encontrado." });
    }
    if (vinculo.tipo_vinculo !== "familiar" || !["convite_idoso", "cadastro_familiar"].includes(vinculo.origem)) {
      return res.status(400).json({ error: "Só é possível contestar vínculo automático de familiar." });
    }
    if (vinculo.status !== "aprovado") {
      return res.status(409).json({ error: "Só é possível contestar um vínculo aprovado." });
    }

    const estado = await resolverEstadoModoDecisao(vinculo.idoso_id);
    if (estado.modo_decisao !== "familiar") {
      if (req.usuarioId !== vinculo.idoso_id) {
        return res.status(403).json({ error: "Só o idoso pode contestar este vínculo." });
      }
    } else {
      if (req.usuarioId === vinculo.idoso_id) {
        return res.status(403).json({ error: "Autoridade transferida para familiar(es)." });
      }
      if (!(await familiarTemVinculoAprovado(vinculo.idoso_id, req.usuarioId))) {
        return res.status(403).json({ error: "Só familiar vinculado e aprovado pode contestar este vínculo." });
      }
      if (req.usuarioId === vinculo.vinculado_id) {
        return res.status(403).json({ error: "Você não pode contestar o seu próprio vínculo." });
      }
    }

    // resolverEstadoModoDecisao não revalida o vínculo de quem solicitou/confirmou a
    // transferência na hora de efetivar — sem isto, um familiar contestado ainda
    // conseguiria promover modo_decisao='familiar' com o pedido que já tinha aberto.
    const operacoes: Prisma.PrismaPromise<unknown>[] = [
      prisma.vinculo.update({
        where: { id },
        data: { status: "recusado", aprovador_id: req.usuarioId, data_resposta: new Date() },
      }),
    ];
    if (estado.modo_decisao_solicitado === "familiar") {
      if (estado.modo_decisao_solicitado_por_id === vinculo.vinculado_id) {
        operacoes.push(prisma.usuario.update({ where: { id: vinculo.idoso_id }, data: CANCELAMENTO_SOLICITACAO }));
      } else if (estado.modo_decisao_segunda_confirmacao_id === vinculo.vinculado_id) {
        operacoes.push(
          prisma.usuario.update({
            where: { id: vinculo.idoso_id },
            data: { modo_decisao_segunda_confirmacao_id: null },
          }),
        );
      }
    }
    const [atualizado] = await prisma.$transaction(operacoes);
    res.status(200).json(atualizado);
  } catch (e) {
    next(e);
  }
});

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

// Tarefa 2.9 (RF-033) — Familiar com vínculo aprovado solicita a transferência de
// Usuario.modo_decisao do idoso pra 'familiar'. :id é o vínculo aprovado DO PRÓPRIO
// solicitante com aquele idoso (não o de um cuidador, como em /definir-permissoes) — é
// como identificamos o idoso alvo e autenticamos que quem chama é de fato um familiar
// aprovado dele. Abre uma janela de carência de 7 dias (ver
// resolverEstadoModoDecisao acima) — nenhum job agendado, a expiração é resolvida sob
// demanda nos pontos onde modo_decisao já é lido, e no login do idoso (POST /auth/sync).
router.post("/:id/solicitar-transferencia-decisao", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Id de vínculo inválido." });
    }

    const vinculo = await prisma.vinculo.findUnique({
      where: { id },
      select: { id: true, idoso_id: true, vinculado_id: true, tipo_vinculo: true, status: true },
    });
    if (!vinculo) {
      return res.status(404).json({ error: "Vínculo não encontrado." });
    }
    if (vinculo.tipo_vinculo !== "familiar") {
      return res.status(400).json({ error: "Transferência de decisão só pode ser solicitada por vínculo de familiar." });
    }
    if (vinculo.status !== "aprovado") {
      return res.status(409).json({ error: "Vínculo precisa estar aprovado para solicitar transferência." });
    }
    if (vinculo.vinculado_id !== req.usuarioId) {
      return res.status(403).json({ error: "Você só pode solicitar transferência usando seu próprio vínculo." });
    }

    const estado = await resolverEstadoModoDecisao(vinculo.idoso_id);
    if (estado.modo_decisao === "familiar") {
      return res.status(409).json({ error: "Autoridade já está com familiar(es)." });
    }
    if (estado.modo_decisao_solicitado === "familiar") {
      return res.status(409).json({ error: "Já existe uma solicitação de transferência em curso para este idoso." });
    }

    const motivoRaw = req.body?.modo_decisao_motivo;
    let motivo: string | null = null;
    if (motivoRaw !== undefined && motivoRaw !== null && motivoRaw !== "") {
      if (typeof motivoRaw !== "string") {
        return res.status(400).json({ error: "modo_decisao_motivo precisa ser texto." });
      }
      const motivoTrim = motivoRaw.trim();
      if (motivoTrim.length > 300) {
        return res.status(400).json({ error: "modo_decisao_motivo excede 300 caracteres." });
      }
      motivo = motivoTrim;
    }

    const agora = new Date();
    const expiraEm = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);

    const atualizado = await prisma.usuario.update({
      where: { id: vinculo.idoso_id },
      data: {
        modo_decisao_solicitado: "familiar",
        modo_decisao_solicitado_por_id: req.usuarioId,
        modo_decisao_solicitado_em: agora,
        modo_decisao_expira_em: expiraEm,
        modo_decisao_segunda_confirmacao_id: null,
        modo_decisao_motivo: motivo,
      },
      select: MODO_DECISAO_SELECT,
    });
    res.status(200).json(atualizado);
  } catch (e) {
    next(e);
  }
});

// Tarefa 2.9 (RF-033) — segunda confirmação, exigida só quando o idoso tem 2+ familiares
// aprovados (checado dentro de resolverEstadoModoDecisao no momento da efetivação, não
// aqui). :id é o vínculo aprovado do familiar QUE ESTÁ CONFIRMANDO — precisa ser
// diferente do familiar que solicitou. Confirmar não efetiva a mudança na hora: só marca
// modo_decisao_segunda_confirmacao_id; a efetivação de fato só acontece quando a janela
// de 7 dias expirar (resolverEstadoModoDecisao), conforme o mecanismo do ER.md.
router.post("/:id/confirmar-transferencia-decisao", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Id de vínculo inválido." });
    }

    const vinculo = await prisma.vinculo.findUnique({
      where: { id },
      select: { id: true, idoso_id: true, vinculado_id: true, tipo_vinculo: true, status: true },
    });
    if (!vinculo) {
      return res.status(404).json({ error: "Vínculo não encontrado." });
    }
    if (vinculo.tipo_vinculo !== "familiar") {
      return res.status(400).json({ error: "Confirmação de transferência só pode ser feita por vínculo de familiar." });
    }
    if (vinculo.status !== "aprovado") {
      return res.status(409).json({ error: "Vínculo precisa estar aprovado para confirmar transferência." });
    }
    if (vinculo.vinculado_id !== req.usuarioId) {
      return res.status(403).json({ error: "Você só pode confirmar transferência usando seu próprio vínculo." });
    }

    // resolverEstadoModoDecisao já resolve expiração antes desta checagem: se a janela
    // expirou sem a segunda confirmação (que é exatamente o cenário que levaria alguém a
    // chamar esta rota), a solicitação já terá sido limpa e cai no 409 abaixo — cobre o
    // caso de borda "confirmação chega depois que a janela já expirou" sem checagem extra.
    const estado = await resolverEstadoModoDecisao(vinculo.idoso_id);
    if (estado.modo_decisao_solicitado !== "familiar") {
      return res.status(409).json({ error: "Não há solicitação de transferência em curso para este idoso." });
    }
    if (estado.modo_decisao_solicitado_por_id === req.usuarioId) {
      return res.status(403).json({ error: "Quem solicitou a transferência não pode confirmá-la." });
    }

    const atualizado = await prisma.usuario.update({
      where: { id: vinculo.idoso_id },
      data: { modo_decisao_segunda_confirmacao_id: req.usuarioId },
      select: MODO_DECISAO_SELECT,
    });
    res.status(200).json(atualizado);
  } catch (e) {
    next(e);
  }
});

// Item 2.11 — listagem de vínculos visíveis ao chamador. Visibilidade (mesma regra de
// autoridade das rotas de ação): idoso vê os vínculos de que é dono; cuidador e familiar
// veem os próprios; familiar com vínculo aprovado com um idoso cujo modo_decisao (já
// resolvido pela checagem preguiçosa) é 'familiar' também vê todos os vínculos desse
// idoso (papel 'titular'). Nunca devolve Usuario inteiro: só id, nome e e-mail mascarado.
// Efeito colateral conhecido: resolverEstadoModoDecisao pode gravar (efetivar ou lapsar
// transferência vencida) durante este GET, igual a GET /usuario/me.
// ponytail: sem paginação; uma consulta de resolverEstadoModoDecisao por idoso do titular.
const STATUS_VALIDOS = ["pendente", "aprovado", "recusado"];
const LADO_SELECT = { select: { id: true, nome: true, email: true } } as const;

type Papel = "dono" | "vinculado" | "titular";
type VinculoComLados = Prisma.VinculoGetPayload<{ include: { idoso: typeof LADO_SELECT; vinculado: typeof LADO_SELECT } }>;

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const status = req.query.status;
    if (status !== undefined && (typeof status !== "string" || !STATUS_VALIDOS.includes(status))) {
      return res.status(400).json({ error: "status deve ser 'pendente', 'aprovado' ou 'recusado'." });
    }

    const chamador = await prisma.usuario.findUnique({
      where: { id: req.usuarioId },
      select: { tipo_perfil: true },
    });
    if (!chamador) {
      return res.status(403).json({ error: "Usuário não sincronizado." });
    }

    const include = { idoso: LADO_SELECT, vinculado: LADO_SELECT } as const;
    const visiveis = new Map<number, { vinculo: VinculoComLados; papel: Papel }>();

    if (chamador.tipo_perfil === "idoso") {
      const donos = await prisma.vinculo.findMany({ where: { idoso_id: req.usuarioId }, include });
      donos.forEach((v) => visiveis.set(v.id, { vinculo: v, papel: "dono" }));
    } else {
      const proprios = await prisma.vinculo.findMany({ where: { vinculado_id: req.usuarioId }, include });
      proprios.forEach((v) => visiveis.set(v.id, { vinculo: v, papel: "vinculado" }));

      if (chamador.tipo_perfil === "familiar") {
        const idosos = [
          ...new Set(
            proprios.filter((v) => v.tipo_vinculo === "familiar" && v.status === "aprovado").map((v) => v.idoso_id),
          ),
        ];
        const titularDe: number[] = [];
        for (const idosoId of idosos) {
          if ((await resolverModoDecisao(idosoId)) === "familiar") titularDe.push(idosoId);
        }
        if (titularDe.length > 0) {
          const doIdoso = await prisma.vinculo.findMany({ where: { idoso_id: { in: titularDe } }, include });
          doIdoso.forEach((v) => {
            if (!visiveis.has(v.id)) visiveis.set(v.id, { vinculo: v, papel: "titular" });
          });
        }
      }
    }

    const vinculos = [...visiveis.values()]
      .filter(({ vinculo }) => status === undefined || vinculo.status === status)
      .sort(
        (a, b) =>
          b.vinculo.data_solicitacao.getTime() - a.vinculo.data_solicitacao.getTime() || b.vinculo.id - a.vinculo.id,
      )
      .map(({ vinculo: v, papel }) => {
        // Fail-closed: quem é só o vinculado não lê nome/e-mail do idoso antes de 'aprovado'
        // (senão qualquer conta leria o nome de um idoso solicitando vínculo pelo e-mail).
        const escondeIdoso = papel === "vinculado" && v.status !== "aprovado";
        return {
          id: v.id,
          tipo_vinculo: v.tipo_vinculo,
          origem: v.origem,
          status: v.status,
          data_solicitacao: v.data_solicitacao,
          data_resposta: v.data_resposta,
          confirmado_em: v.confirmado_em,
          papel_do_chamador: papel,
          idoso: {
            id: v.idoso.id,
            nome: escondeIdoso ? null : v.idoso.nome,
            email_mascarado: escondeIdoso ? null : mascararEmail(v.idoso.email),
          },
          vinculado: { id: v.vinculado.id, nome: v.vinculado.nome, email_mascarado: mascararEmail(v.vinculado.email) },
        };
      });

    res.json({ vinculos });
  } catch (e) {
    next(e);
  }
});

export default router;
