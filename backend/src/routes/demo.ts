import { Router, type RequestHandler } from "express";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { auth } from "../lib/firebaseAdmin";
import { verifyFirebaseToken } from "../lib/authHelpers";
import { criarLimitador, QUINZE_MIN } from "../lib/limiteTaxa";
import { contaPorSlug, ehUidDemo, ELENCO } from "../lib/demo/elenco";
import { semearDemo } from "../lib/demo/semear";

const router = Router();

// Modo demonstração (D6, docs/modo-demonstracao.md): só para apresentações. Entra nas seis contas FICTÍCIAS do elenco
// por custom token; dentro delas tudo roda como em produção, sem exceção de autorização. Quem pode: uid em
// DEMO_ADMIN_UIDS, ou sessão de uma conta do elenco (que só o custom token deste backend abre) cuja claim
// demo_admin_uid, se existir, ainda está na lista. A documentação do Firebase não garante que as claims do custom
// token sobrevivem à renovação do ID token, por isso a claim ausente é aceita. Desligado (DEMO_MODO_ATIVO diferente de
// "1") ou quem não pode: next("route"), o mesmo 404 de rota inexistente. Nada aqui loga nem devolve uid ou e-mail.
const ligado = () => process.env.DEMO_MODO_ATIVO === "1";
const admins = () => (process.env.DEMO_ADMIN_UIDS ?? "").split(",").map((u) => u.trim()).filter(Boolean);

// res.locals.uidDemo: uid da sessão. res.locals.adminDemo: admin de origem (ausente se a claim se perdeu).
// res.locals.chaveDemo: chave dos limites, o admin efetivo.
const verificarAcessoDemo: RequestHandler = async (req, res, next) => {
  try {
    const cabecalho = req.headers.authorization;
    const idToken = cabecalho?.startsWith("Bearer ") ? cabecalho.slice(7) : null;
    if (!idToken) return res.status(401).json({ error: "Token ausente." });

    const resultado = await verifyFirebaseToken(idToken, { checarRevogado: true });
    if (!resultado.ok) return res.status(resultado.status).json({ error: resultado.error });

    const { uid, demo_admin_uid: reclamado } = resultado.decoded;
    const lista = admins();
    let admin: string | undefined;
    let pode = false;
    if (lista.includes(uid)) {
      admin = uid;
      pode = true;
    } else if (ehUidDemo(uid) && lista.length > 0) {
      if (reclamado === undefined) pode = true;
      else if (typeof reclamado === "string" && lista.includes(reclamado)) {
        admin = reclamado;
        pode = true;
      }
    }
    if (!ligado() || !pode) return next("route");

    res.locals.uidDemo = uid;
    res.locals.adminDemo = admin;
    res.locals.chaveDemo = admin ?? uid;
    next();
  } catch (e) {
    next(e);
  }
};

const chaveDemo = (_req: unknown, res: { locals: Record<string, unknown> }) => res.locals.chaveDemo as string | undefined;
const limiteEntrar = criarLimitador({ janelaMs: QUINZE_MIN, maximo: 30, chave: chaveDemo });
const limiteRestaurar = criarLimitador({ janelaMs: 60 * 60 * 1000, maximo: 5, chave: chaveDemo });

router.get("/estado", verificarAcessoDemo, (_req, res) => {
  res.json({
    contas: ELENCO.map(({ slug, nome, tipo_perfil, descricao }) => ({ slug, nome, tipo_perfil, descricao })),
    atual: ELENCO.find((c) => c.uid === res.locals.uidDemo)?.slug ?? null,
  });
});

router.post("/entrar-como", verificarAcessoDemo, limiteEntrar, async (req, res, next) => {
  try {
    // Lista fechada: o uid emitido sai sempre do elenco, nunca do corpo.
    const conta = contaPorSlug(req.body?.conta);
    if (!conta) return res.status(400).json({ error: "Conta de demonstração inválida." });
    const admin = res.locals.adminDemo as string | undefined;
    const token = await auth.createCustomToken(conta.uid, admin ? { demo: true, demo_admin_uid: admin } : { demo: true });
    res.json({ token });
  } catch (e) {
    next(e);
  }
});

router.post("/restaurar", verificarAcessoDemo, limiteRestaurar, async (_req, res, next) => {
  try {
    // O cliente com retry (lib/prisma) tem o mesmo $transaction do PrismaClient.
    await semearDemo({ prisma: prisma as unknown as PrismaClient, auth, agora: new Date() });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
