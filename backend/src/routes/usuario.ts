import { Router } from "express";
import { prisma } from "../lib/prisma";
import { auth as firebaseAuth } from "../lib/firebaseAdmin";
import { requireAuth } from "../middleware/requireAuth";
import { isDuplicateEmail } from "../lib/authHelpers";
import { resolverEstadoModoDecisao, MODO_DECISAO_SELECT } from "./vinculo";

const router = Router();

// Item 2.10 (RF-034) — cancelamento de uma transferência de decisão em curso. Mesmos 6
// campos zerados em POST /auth/sync (login do idoso) e em resolverEstadoModoDecisao
// (routes/vinculo.ts, lapso por expiração) — terceira cópia da mesma lista, ver
// relatório da tarefa (D8: não refatorar os outros dois pontos nesta tarefa).
const CANCELAMENTO_SOLICITACAO = {
  modo_decisao_solicitado: null,
  modo_decisao_solicitado_por_id: null,
  modo_decisao_solicitado_em: null,
  modo_decisao_expira_em: null,
  modo_decisao_segunda_confirmacao_id: null,
  modo_decisao_motivo: null,
} as const;

// Tarefa 2.9 (RF-033) — resolverEstadoModoDecisao roda a checagem preguiçosa de
// expiração da janela de transferência (efetiva a mudança ou limpa solicitação vencida)
// antes de responder, então este endpoint nunca devolve um modo_decisao_solicitado já
// expirado como se ainda estivesse em curso. Os campos modo_decisao_alterado_por_id e
// modo_decisao_alterado_em servem de "notificação" pro idoso — decisão desta tarefa: sem
// e-mail, só exposição aqui pro frontend mostrar um aviso.
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    // Sequencial, não Promise.all: resolverEstadoModoDecisao pode escrever no mesmo
    // Usuario (efetivação/lapso da transferência) — rodar antes garante que o findUnique
    // abaixo nunca leia um estado intermediário.
    const modoDecisao = await resolverEstadoModoDecisao(req.usuarioId);
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.usuarioId },
      select: { id: true, nome: true, email: true, telefone: true, tipo_perfil: true },
    });
    res.json({ ...usuario, ...modoDecisao });
  } catch (e) {
    next(e);
  }
});

router.patch("/me", requireAuth, async (req, res, next) => {
  try {
    const { nome, email, telefone } = req.body ?? {};

    const data: { nome?: string; email?: string | null; telefone?: string | null } = {};
    if (nome !== undefined) data.nome = typeof nome === "string" ? nome.trim() : nome;
    if (email !== undefined) data.email = typeof email === "string" ? email.trim() || null : email;
    if (telefone !== undefined)
      data.telefone = typeof telefone === "string" ? telefone.trim() || null : telefone;

    if ("email" in data || "telefone" in data) {
      const atual = await prisma.usuario.findUniqueOrThrow({
        where: { id: req.usuarioId },
        select: { email: true, telefone: true, firebase_uid: true },
      });
      const emailFinal = "email" in data ? data.email : atual.email;
      const telefoneFinal = "telefone" in data ? data.telefone : atual.telefone;
      if (!emailFinal && !telefoneFinal) {
        return res
          .status(400)
          .json({ error: "Informe ao menos um e-mail ou telefone — os dois não podem ficar vazios." });
      }

      // req.usuarioId sempre tem firebase_uid preenchido: requireAuth só resolve o id
      // buscando por firebase_uid, então um Usuario sem essa coluna nunca autentica
      // como si mesmo (caso do idoso cadastrado por familiar via RF-030, fora deste fluxo).
      if ("email" in data && data.email !== atual.email && atual.firebase_uid) {
        await firebaseAuth.updateUser(atual.firebase_uid, { email: data.email ?? undefined });
      }
    }

    const usuario = await prisma.usuario.update({
      where: { id: req.usuarioId },
      data,
      select: { id: true, nome: true, email: true, telefone: true, tipo_perfil: true },
    });
    res.json(usuario);
  } catch (e) {
    if (isDuplicateEmail(e)) {
      return res.status(409).json({ error: "Este e-mail já está em uso por outra conta." });
    }
    next(e);
  }
});

// Item 2.10 (RF-034) — o próprio idoso altera Usuario.modo_decisao diretamente, a
// qualquer momento, sem janela de carência e sem checar familiares na reversão
// 'familiar' -> 'idoso' (o idoso detém autoridade top-level sobre o campo). Rota
// separada de PATCH /usuario/me de propósito, pra não misturar campo de autorização
// com edição de perfil. Escopo separado da tarefa 2.9 (RF-033, transferência pra
// 'familiar' solicitada por um Familiar) — não reaberta aqui.
router.patch("/me/modo-decisao", requireAuth, async (req, res, next) => {
  try {
    const chamador = await prisma.usuario.findUnique({
      where: { id: req.usuarioId },
      select: { tipo_perfil: true },
    });
    if (chamador?.tipo_perfil !== "idoso") {
      return res.status(403).json({ error: "Só o idoso pode alterar quem decide por ele." });
    }

    const pedido = req.body?.modo_decisao;
    if (pedido !== "idoso" && pedido !== "familiar") {
      return res.status(400).json({ error: "modo_decisao precisa ser 'idoso' ou 'familiar'." });
    }

    // Sequencial, mesmo motivo de GET /usuario/me: resolverEstadoModoDecisao pode
    // escrever no mesmo Usuario (efetivação/lapso de uma transferência vencida da
    // tarefa 2.9) antes de decidirmos a partir do estado atual.
    const estado = await resolverEstadoModoDecisao(req.usuarioId);
    const atual = estado.modo_decisao === "familiar" ? "familiar" : "idoso";
    const solicitacaoEmCurso = estado.modo_decisao_solicitado === "familiar";

    if (pedido === atual) {
      if (!solicitacaoEmCurso) {
        return res.status(200).json(estado);
      }
      const cancelado = await prisma.usuario.update({
        where: { id: req.usuarioId },
        data: CANCELAMENTO_SOLICITACAO,
        select: MODO_DECISAO_SELECT,
      });
      return res.status(200).json(cancelado);
    }

    // Delegar 'idoso' -> 'familiar' exige pelo menos 1 familiar aprovado (sem isso,
    // aprovações de vínculo e flags do cuidador ficam sem ninguém com autoridade).
    // Reverter 'familiar' -> 'idoso' nunca passa por este guard.
    if (pedido === "familiar") {
      const familiarAprovado = await prisma.vinculo.findFirst({
        where: { idoso_id: req.usuarioId, tipo_vinculo: "familiar", status: "aprovado" },
        select: { id: true },
      });
      if (!familiarAprovado) {
        return res
          .status(409)
          .json({ error: "Nenhum familiar com vínculo aprovado para assumir a decisão." });
      }
    }

    const atualizado = await prisma.usuario.update({
      where: { id: req.usuarioId },
      data: {
        modo_decisao: pedido,
        modo_decisao_alterado_por_id: req.usuarioId,
        modo_decisao_alterado_em: new Date(),
        ...CANCELAMENTO_SOLICITACAO,
      },
      select: MODO_DECISAO_SELECT,
    });
    res.status(200).json(atualizado);
  } catch (e) {
    next(e);
  }
});

export default router;
