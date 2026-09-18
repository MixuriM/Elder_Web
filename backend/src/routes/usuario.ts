import { Router } from "express";
import { prisma } from "../lib/prisma";
import { auth as firebaseAuth } from "../lib/firebaseAdmin";
import { requireAuth } from "../middleware/requireAuth";
import { isDuplicateEmail } from "../lib/authHelpers";
import { resolverEstadoModoDecisao } from "./vinculo";

const router = Router();

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

export default router;
