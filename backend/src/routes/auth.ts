import { Router } from "express";
import { auth as firebaseAuth } from "../lib/firebaseAdmin";
import { prisma } from "../lib/prisma";

const router = Router();

const TIPOS_PERFIL = ["idoso", "cuidador", "familiar"] as const;
type TipoPerfil = (typeof TIPOS_PERFIL)[number];

export function isTipoPerfil(value: unknown): value is TipoPerfil {
  return typeof value === "string" && (TIPOS_PERFIL as readonly string[]).includes(value);
}

// SQL Server rejeita a criação concorrente do mesmo firebase_uid via índice único
// filtrado — firebase_uid não é @unique nativo do Prisma (é índice manual, ver
// schema.prisma), então o erro chega como texto genérico do driver, não como P2002.
// Mesmo padrão de detecção usado em backend/scripts/verify-constraints.ts.
export function isDuplicateFirebaseUid(e: unknown): boolean {
  return e instanceof Error && /UNIQUE constraint|duplicate key|Violation of/i.test(e.message);
}

router.post("/sync", async (req, res) => {
  const authHeader = req.headers.authorization;
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!idToken) {
    return res.status(401).json({ error: "Token ausente." });
  }

  let decoded;
  try {
    decoded = await firebaseAuth.verifyIdToken(idToken);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code?.startsWith("auth/")) {
      // Erro reconhecido do Firebase Auth sobre o token em si (expirado, revogado,
      // malformado) — problema do cliente, não do serviço.
      return res.status(401).json({ error: "Token inválido ou expirado." });
    }
    // Sem código auth/* = falha ao contatar o Firebase (rede, serviço fora do ar),
    // não o token — RNF-005.
    return res
      .status(503)
      .json({ error: "Firebase Auth indisponível no momento. Tente novamente em instantes." });
  }

  // findFirst, não findUnique: firebase_uid não é @unique no Prisma (o índice único
  // é filtrado e manual, ver schema.prisma) — o client não conhece essa constraint.
  const usuarioExistente = await prisma.usuario.findFirst({
    where: { firebase_uid: decoded.uid },
  });

  if (usuarioExistente) {
    return res.status(200).json({ criado: false, usuario: usuarioExistente });
  }

  // Não achou pelo firebase_uid: é cadastro. tipo_perfil é obrigatório aqui — nunca
  // no fluxo de login simples, e nunca inferido, porque é fixo/único por conta.
  const tipoPerfil = req.body?.tipo_perfil;
  if (!isTipoPerfil(tipoPerfil)) {
    return res
      .status(400)
      .json({ error: "tipo_perfil obrigatório ao criar conta (idoso, cuidador ou familiar)." });
  }

  const nome = typeof req.body?.nome === "string" ? req.body.nome.trim() : decoded.name;
  if (!nome) {
    return res.status(400).json({ error: "nome obrigatório ao criar conta." });
  }

  if (!decoded.email && !decoded.phone_number) {
    return res.status(400).json({ error: "Conta Firebase sem e-mail ou telefone associado." });
  }

  try {
    const usuario = await prisma.usuario.create({
      data: {
        firebase_uid: decoded.uid,
        nome,
        email: decoded.email,
        telefone: decoded.phone_number,
        tipo_perfil: tipoPerfil,
      },
    });
    return res.status(201).json({ criado: true, usuario });
  } catch (e) {
    if (isDuplicateFirebaseUid(e)) {
      // Duas requisições de sync simultâneas pro mesmo firebase_uid novo (ex.: dois
      // cliques rápidos) — a constraint do banco rejeitou a segunda criação, devolve
      // o registro que a primeira já criou em vez de estourar 500.
      const usuario = await prisma.usuario.findFirst({ where: { firebase_uid: decoded.uid } });
      if (usuario) {
        return res.status(200).json({ criado: false, usuario });
      }
    }
    throw e;
  }
});

export default router;
