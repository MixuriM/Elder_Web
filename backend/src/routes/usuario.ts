import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma";
import { auth as firebaseAuth } from "../lib/firebaseAdmin";
import { requireAuth } from "../middleware/requireAuth";
import { isDuplicateEmail, isValidEmailFormat } from "../lib/authHelpers";
import { resolverEstadoModoDecisao, MODO_DECISAO_SELECT } from "./vinculo";
import { CANCELAMENTO_SOLICITACAO } from "../lib/modoDecisao";
import { CONFLITO_EMAIL } from "../lib/mensagensConflito";
import {
  FOTO_LIMITE_BYTES,
  FOTO_MIME_TRIAGEM,
  FotoInvalida,
  montarFotoPerfilUrl,
  normalizarFoto,
  type MotivoFotoInvalida,
} from "../lib/fotoPerfil";

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

// Foto de perfil — qualquer tipo_perfil, sempre no próprio usuário autenticado. memoryStorage
// (nunca disco: o filesystem do Render é efêmero). O Content-Type declarado é só triagem; os bytes
// passam por normalizarFoto, e o banco recebe sempre o WebP reduzido, com o mime do servidor.
const MSG_FOTO_SEM_ARQUIVO = "Nenhuma foto enviada.";
const MSG_FOTO_TIPO = "Formato de foto não aceito. Envie uma foto em JPEG, PNG, WebP, GIF, AVIF ou TIFF.";
const MSG_FOTO_TAMANHO = "Foto acima do limite de 15 MB. Escolha uma foto menor.";
const MSG_FOTO_LIMITE = "Você já enviou muitas fotos na última hora. Tente de novo mais tarde.";
const MSG_FOTO_INVALIDA: Record<MotivoFotoInvalida, string> = {
  formato: MSG_FOTO_TIPO,
  resolucao: "Foto com resolução grande demais. Escolha uma foto menor.",
  corrompida: "Não foi possível abrir a foto. O arquivo pode estar danificado. Tente outra foto.",
};
const MSG_FOTO_OCUPADO = "Muitos envios de foto neste momento. Tente de novo em instantes.";
const FOTO_TIPO_INVALIDO = "FOTO_TIPO_INVALIDO";

// No máximo 2 envios de foto em andamento no processo inteiro: cada um pode ocupar o buffer de 15 MB mais
// a decodificação (pico medido de cerca de 141 MB num PNG de 40 MP), e o Render free tem 512 MB. Antes do
// multer, para limitar também o buffer. Desce no "close", que vem uma vez por resposta (normal, erro ou
// cliente que abortou).
const MAX_FOTOS_EM_ANDAMENTO = 2;
let fotosEmAndamento = 0;

function limitarConcorrenciaFoto(_req: Request, res: Response, next: NextFunction) {
  if (fotosEmAndamento >= MAX_FOTOS_EM_ANDAMENTO) {
    return res.status(429).json({ error: MSG_FOTO_OCUPADO });
  }
  fotosEmAndamento++;
  res.once("close", () => fotosEmAndamento--);
  next();
}

// Até 10 envios por hora por usuário; toda tentativa conta, inclusive a recusada. Roda antes do
// multer, então o envio barrado nem chega a ocupar memória.
// ponytail: em memória, zera quando o servidor reinicia (e o Render free dorme); tabela própria se isso importar.
const JANELA_FOTO_MS = 60 * 60_000;
const MAX_FOTOS_POR_JANELA = 10;
const enviosFoto = new Map<number, number[]>();

function limitarEnviosFoto(req: Request, res: Response, next: NextFunction) {
  const agora = Date.now();
  const recentes = (enviosFoto.get(req.usuarioId) ?? []).filter((t) => agora - t < JANELA_FOTO_MS);
  enviosFoto.set(req.usuarioId, recentes);
  if (recentes.length >= MAX_FOTOS_POR_JANELA) {
    res.set("Retry-After", String(Math.ceil((recentes[0] + JANELA_FOTO_MS - agora) / 1000)));
    return res.status(429).json({ error: MSG_FOTO_LIMITE });
  }
  recentes.push(agora);
  next();
}

const uploadFoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: FOTO_LIMITE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (FOTO_MIME_TRIAGEM.includes(file.mimetype)) return cb(null, true);
    cb(new Error(FOTO_TIPO_INVALIDO));
  },
}).single("foto");

function receberFoto(req: Request, res: Response, next: NextFunction) {
  uploadFoto(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: MSG_FOTO_TAMANHO });
    }
    if (err instanceof multer.MulterError && err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({ error: MSG_FOTO_SEM_ARQUIVO });
    }
    if (err instanceof Error && err.message === FOTO_TIPO_INVALIDO) {
      return res.status(400).json({ error: MSG_FOTO_TIPO });
    }
    next(err);
  });
}

// Rota separada de GET /usuario/me de propósito: a foto é o payload pesado (WebP de até 1024 px,
// em base64) e só quem exibe a foto precisa dela.
router.get("/me/foto", requireAuth, async (req, res, next) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.usuarioId },
      select: { foto_perfil: true, foto_perfil_mime_type: true },
    });
    res.json({ foto_perfil_url: montarFotoPerfilUrl(usuario?.foto_perfil, usuario?.foto_perfil_mime_type) });
  } catch (e) {
    next(e);
  }
});

router.post("/me/foto", requireAuth, limitarConcorrenciaFoto, limitarEnviosFoto, receberFoto, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: MSG_FOTO_SEM_ARQUIVO });
    let foto: Awaited<ReturnType<typeof normalizarFoto>>;
    try {
      foto = await normalizarFoto(req.file.buffer);
    } catch (e) {
      if (e instanceof FotoInvalida) return res.status(400).json({ error: MSG_FOTO_INVALIDA[e.motivo] });
      throw e;
    }
    await prisma.usuario.update({
      where: { id: req.usuarioId },
      data: {
        foto_perfil: foto.buffer,
        foto_perfil_mime_type: foto.mimeType,
        foto_perfil_atualizada_em: new Date(),
      },
      select: { id: true },
    });
    res.status(200).json({ foto_perfil_url: montarFotoPerfilUrl(foto.buffer, foto.mimeType) });
  } catch (e) {
    next(e);
  }
});

router.delete("/me/foto", requireAuth, async (req, res, next) => {
  try {
    await prisma.usuario.update({
      where: { id: req.usuarioId },
      data: { foto_perfil: null, foto_perfil_mime_type: null, foto_perfil_atualizada_em: null },
      select: { id: true },
    });
    res.status(200).json({ foto_perfil_url: null });
  } catch (e) {
    next(e);
  }
});

router.patch("/me", requireAuth, async (req, res, next) => {
  try {
    const { nome, email, telefone } = req.body ?? {};
    // Só string (ou null em email/telefone) chega ao Prisma: um objeto como { set: "" } seria aceito
    // como operador no data e pularia as checagens abaixo.
    const naoTexto = (v: unknown, aceitaNull: boolean) =>
      v !== undefined && typeof v !== "string" && !(aceitaNull && v === null);
    if (naoTexto(nome, false) || naoTexto(email, true) || naoTexto(telefone, true)) {
      return res.status(400).json({ error: "Nome, e-mail e telefone precisam ser texto." });
    }

    const data: { nome?: string; email?: string | null; telefone?: string | null } = {};
    if (nome !== undefined) data.nome = nome.trim();
    if ("nome" in data && !data.nome) {
      return res.status(400).json({ error: "Nome não pode ficar vazio." });
    }
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

// Item 3.1 (RF-030) — Familiar cadastra conta de Idoso em seu nome. O idoso nasce sem
// firebase_uid (CK_Usuario_firebase_uid_cadastrado_por libera isso porque
// cadastrado_por_id vem preenchido). Usuario + Vinculo em um único create aninhado
// (transação implícita do Prisma): ou criam os dois, ou nenhum.
router.post("/cadastrar-idoso", requireAuth, async (req, res, next) => {
  try {
    const chamador = await prisma.usuario.findUnique({
      where: { id: req.usuarioId },
      select: { tipo_perfil: true },
    });
    if (chamador?.tipo_perfil !== "familiar") {
      return res.status(403).json({ error: "Apenas familiares podem cadastrar um idoso." });
    }

    // Só estes 4 campos são lidos do body — o resto (tipo_perfil, cadastrado_por_id,
    // firebase_uid, modo_decisao, timestamp do aceite...) é sempre definido aqui.
    const { nome, email, telefone, aceita_termo_responsabilidade } = req.body ?? {};

    if (aceita_termo_responsabilidade !== true) {
      return res.status(400).json({ error: "É necessário aceitar o termo de responsabilidade." });
    }
    const nomeLimpo = typeof nome === "string" ? nome.trim() : "";
    if (!nomeLimpo || nomeLimpo.length > 150) {
      return res.status(400).json({ error: "Nome é obrigatório e deve ter até 150 caracteres." });
    }
    const emailLimpo = typeof email === "string" ? email.trim() : "";
    const telefoneLimpo = typeof telefone === "string" ? telefone.trim() : "";
    // 3.3 (RF-001/RF-030 extensão): e-mail obrigatório — é a chave que /auth/sync usa
    // pra reconhecer o idoso assumindo a própria conta. Telefone continua opcional,
    // complementar, nunca mais suficiente sozinho.
    if (!emailLimpo) {
      return res.status(400).json({ error: "E-mail do idoso é obrigatório." });
    }
    if (emailLimpo.length > 255 || !isValidEmailFormat(emailLimpo)) {
      return res.status(400).json({ error: "E-mail inválido." });
    }
    if (telefoneLimpo.length > 20) {
      return res.status(400).json({ error: "Telefone deve ter até 20 caracteres." });
    }

    // RNF-011: valida o e-mail ANTES do INSERT, sem distinguir o tipo de conta que o
    // ocupa (uma mensagem só) e sem ler nada além do id. O catch abaixo é rede de
    // segurança pra corrida.
    if (emailLimpo) {
      const ocupado = await prisma.usuario.findFirst({ where: { email: emailLimpo }, select: { id: true } });
      if (ocupado) {
        return res.status(409).json(CONFLITO_EMAIL.EMAIL_JA_EM_USO_CADASTRO_IDOSO);
      }
    }

    const agora = new Date();
    // Fluxo A: e-mail do Familiar já verificado no token = posse já confirmada.
    const aprovado = req.emailVerificado;

    const idoso = await prisma.usuario.create({
      data: {
        nome: nomeLimpo,
        email: emailLimpo,
        ...(telefoneLimpo && { telefone: telefoneLimpo }),
        tipo_perfil: "idoso",
        cadastrado_por_id: req.usuarioId,
        termo_responsabilidade_aceito_em: agora,
        modo_decisao: "familiar",
        vinculos_como_idoso: {
          create: {
            vinculado_id: req.usuarioId,
            tipo_vinculo: "familiar",
            origem: "cadastro_familiar",
            data_solicitacao: agora,
            status: aprovado ? "aprovado" : "pendente",
            ...(aprovado && { confirmado_em: agora }),
          },
        },
      },
      include: { vinculos_como_idoso: true },
    });

    const vinculo = idoso.vinculos_como_idoso[0];
    res.status(201).json({
      usuario: {
        id: idoso.id,
        nome: idoso.nome,
        email: idoso.email,
        telefone: idoso.telefone,
        tipo_perfil: idoso.tipo_perfil,
      },
      vinculo: { id: vinculo.id, status: vinculo.status, origem: vinculo.origem },
    });
  } catch (e) {
    // Corrida entre a pré-checagem e o INSERT: mesmo corpo do 409 da pré-checagem.
    if (isDuplicateEmail(e)) {
      return res.status(409).json(CONFLITO_EMAIL.EMAIL_JA_EM_USO_CADASTRO_IDOSO);
    }
    next(e);
  }
});

export default router;
