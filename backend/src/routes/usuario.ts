import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma";
import { auth as firebaseAuth } from "../lib/firebaseAdmin";
import { requireAuth, requireAuthRevogacao } from "../middleware/requireAuth";
import { bloquearContaDemo } from "../middleware/bloquearContaDemo";
import { criarLimitador, porUsuario, QUINZE_MIN } from "../lib/limiteTaxa";
import { emailDoTokenConfere, isDuplicateEmail, isValidEmailFormat } from "../lib/authHelpers";
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

// Limites por usuário (decisão D1 de 2026-10-14). Emergência e foto têm os seus próprios.
const limiteAtualizarPerfil = criarLimitador({ janelaMs: QUINZE_MIN, maximo: 30, chave: porUsuario });
const limiteCadastrarIdoso = criarLimitador({ janelaMs: 60 * 60 * 1000, maximo: 10, chave: porUsuario });
const limiteExcluirConta = criarLimitador({ janelaMs: 60 * 60 * 1000, maximo: 3, chave: porUsuario });

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

// No máximo 2 envios de foto em andamento no processo inteiro e 1 por usuário: cada um pode ocupar o buffer
// de 15 MB mais a decodificação (pico medido de cerca de 141 MB num PNG de 40 MP), e o Render free tem 512 MB.
// Antes do multer, para limitar também o buffer. A vaga nasce aqui e só volta quando a rota termina de
// processar (o sharp não para se o cliente aborta); o "close" só a devolve se a rota nem começou. O corpo tem
// 60 s para chegar, senão 408: um envio lento não segura a vaga até o limite do Node.
const MAX_FOTOS_EM_ANDAMENTO = 2;
const PRAZO_CORPO_FOTO_MS = 60_000;
const MSG_FOTO_PRAZO = "O envio da foto demorou demais. Tente de novo com uma conexão melhor.";
let fotosEmAndamento = 0;
const usuariosEnviandoFoto = new Set<number>();

function limitarConcorrenciaFoto(req: Request, res: Response, next: NextFunction) {
  const usuarioId = req.usuarioId;
  if (fotosEmAndamento >= MAX_FOTOS_EM_ANDAMENTO || usuariosEnviandoFoto.has(usuarioId)) {
    return res.status(429).json({ error: MSG_FOTO_OCUPADO });
  }
  fotosEmAndamento++;
  usuariosEnviandoFoto.add(usuarioId);

  let liberada = false;
  let rotaComecou = false;
  const liberar = () => {
    clearTimeout(prazo);
    if (liberada) return;
    liberada = true;
    fotosEmAndamento--;
    usuariosEnviandoFoto.delete(usuarioId);
  };
  const prazo = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).set("Connection", "close").json({ error: MSG_FOTO_PRAZO });
      res.once("finish", () => req.destroy());
    }
    liberar();
  }, PRAZO_CORPO_FOTO_MS);
  // A rota chama ao começar: cancela o prazo e passa a ser ela quem libera a vaga (no finally).
  res.locals.comecarProcessamentoFoto = () => {
    rotaComecou = true;
    clearTimeout(prazo);
    return liberar;
  };
  res.once("close", () => {
    clearTimeout(prazo);
    if (!rotaComecou) liberar();
  });
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
    // Depois do 408 o multer ainda reclama do corpo cortado: a resposta já foi, nada a fazer.
    if (res.headersSent) return;
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
  const liberarVaga: () => void = res.locals.comecarProcessamentoFoto();
  try {
    // res.destroyed, não req.destroyed: o req já vem destruído quando o multer termina de ler o corpo.
    if (res.headersSent || res.destroyed) return;
    if (!req.file) return res.status(400).json({ error: MSG_FOTO_SEM_ARQUIVO });
    let foto: Awaited<ReturnType<typeof normalizarFoto>>;
    try {
      foto = await normalizarFoto(req.file.buffer);
    } catch (e) {
      if (e instanceof FotoInvalida) return res.status(400).json({ error: MSG_FOTO_INVALIDA[e.motivo] });
      throw e;
    }
    // Cliente saiu durante a decodificação: não grava.
    if (res.destroyed) return;
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
  } finally {
    liberarVaga();
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

// Exclusão de conta (item 9.5, LGPD art. 18). Só a PRÓPRIA conta (alvo = req.usuarioId, nunca id de path, query ou corpo).
// Tudo numa transação do Prisma: apaga os dados do idoso, anonimiza a linha de Usuario (a autoria sobre outros idosos é
// obrigatória, RNF-006, e as FKs são NoAction: a linha não pode sumir) e, por último, apaga o login no Firebase. Firebase
// falhou: a exceção desfaz o banco. Risco aceito: Firebase apagou e o commit falhou (conta sem login, dados intactos).
// ponytail: apagarDadosDoIdoso usa `in` com os ids dos medicamentos; acima de ~2000 medicamentos de um idoso estoura o
// limite de parâmetros do SQL Server (volume do TCC não chega perto).
const MSG_CONFIRMACAO_INVALIDA = "Confirmação inválida.";
const MSG_REAUTENTICAR = {
  error: "Por segurança, confirme sua identidade de novo para excluir a conta.",
  codigo: "reautenticar",
};
const MSG_EXCLUSAO_FALHOU = "Não foi possível excluir a conta agora. Nada foi apagado. Tente de novo em alguns minutos.";
const LOGIN_RECENTE_SEGUNDOS = 300;

class FalhaFirebase extends Error {}

// O cliente do callback de $transaction (o `prisma` daqui é o cliente estendido, com retry de conexão).
type Tx = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

async function apagarDadosDoIdoso(tx: Tx, idosoId: number) {
  const medicamentos = await tx.medicamento.findMany({ where: { idoso_id: idosoId }, select: { id: true } });
  const ids = medicamentos.map((m) => m.id);
  // As doses antes dos medicamentos: a FK da dose aponta para o medicamento.
  if (ids.length > 0) await tx.registroDoseMedicamento.deleteMany({ where: { medicamento_id: { in: ids } } });
  await tx.medicamento.deleteMany({ where: { idoso_id: idosoId } });
  await tx.registroSaude.deleteMany({ where: { idoso_id: idosoId } });
  await tx.registroAlimentar.deleteMany({ where: { idoso_id: idosoId } });
  await tx.evento.deleteMany({ where: { idoso_id: idosoId } });
  await tx.vinculo.deleteMany({ where: { idoso_id: idosoId } });
}

// Fica o que não identifica: firebase_uid (uid apagado no Firebase não é reutilizado), tipo_perfil, created_at,
// cadastrado_por_id e a prova de aceite (LGPD art. 16, I). Respeita as CHECKs de Usuario (grupos de campos juntos).
async function anonimizarUsuario(tx: Tx, id: number) {
  await tx.usuario.update({
    where: { id },
    data: {
      nome: "Conta excluída",
      email: `excluido-${id}@excluido.invalid`,
      telefone: null,
      email_convite_familiar: null,
      ultimo_login_em: null,
      foto_perfil: null,
      foto_perfil_mime_type: null,
      foto_perfil_atualizada_em: null,
      termo_responsabilidade_aceito_em: null,
      modo_decisao: null,
      modo_decisao_alterado_por_id: null,
      modo_decisao_alterado_em: null,
      ...CANCELAMENTO_SOLICITACAO,
    },
    select: { id: true },
  });
}

// Idoso que perdeu o último familiar aprovado não pode ficar decidido por 'familiar' nem com transferência pendente; e
// transferência iniciada ou confirmada por quem foi excluído não tem mais quem a sustente. Não usa resolverModoDecisao:
// ele lê pelo prisma global e travaria nas linhas que esta transação já escreveu.
async function reconciliarDecisao(tx: Tx, idosoId: number, excluidoId: number) {
  const idoso = await tx.usuario.findFirst({
    where: { id: idosoId },
    select: {
      modo_decisao: true,
      modo_decisao_solicitado: true,
      modo_decisao_solicitado_por_id: true,
      modo_decisao_segunda_confirmacao_id: true,
    },
  });
  if (!idoso) return;
  const familiares = await tx.vinculo.count({ where: { idoso_id: idosoId, tipo_vinculo: "familiar", status: "aprovado" } });
  const pendente = idoso.modo_decisao_solicitado !== null;
  if (familiares === 0 && (idoso.modo_decisao === "familiar" || pendente)) {
    await tx.usuario.update({
      where: { id: idosoId },
      data: { modo_decisao: "idoso", ...CANCELAMENTO_SOLICITACAO },
      select: { id: true },
    });
  } else if (
    pendente &&
    (idoso.modo_decisao_solicitado_por_id === excluidoId || idoso.modo_decisao_segunda_confirmacao_id === excluidoId)
  ) {
    await tx.usuario.update({ where: { id: idosoId }, data: { ...CANCELAMENTO_SOLICITACAO }, select: { id: true } });
  }
}

router.delete("/me", requireAuthRevogacao, bloquearContaDemo, limiteExcluirConta, async (req, res, next) => {
  try {
    const confirmacao = (req.body as { confirmacao?: unknown } | undefined)?.confirmacao;
    if (typeof confirmacao !== "string" || confirmacao !== "EXCLUIR") {
      return res.status(400).json({ error: MSG_CONFIRMACAO_INVALIDA });
    }
    // Login recente (auth_time em segundos, relógio do servidor). Ausente ou não numérico conta como vencido.
    const idade = req.authTime === undefined ? Infinity : Date.now() / 1000 - req.authTime;
    if (!(idade <= LOGIN_RECENTE_SEGUNDOS)) return res.status(401).json(MSG_REAUTENTICAR);

    const usuarioId = req.usuarioId;
    try {
      await prisma.$transaction(
        async (tx) => {
          const eu = await tx.usuario.findFirst({ where: { id: usuarioId }, select: { firebase_uid: true } });
          if (!eu?.firebase_uid) throw new Error("conta sem login");

          // Lido antes de apagar os vínculos: quem perde o último familiar e o que U deixou pendente.
          const comoFamiliar = await tx.vinculo.findMany({
            where: { vinculado_id: usuarioId, tipo_vinculo: "familiar", status: "aprovado" },
            select: { idoso_id: true },
          });
          const semLogin = await tx.usuario.findMany({
            where: { cadastrado_por_id: usuarioId, firebase_uid: null },
            select: { id: true },
          });
          const iniciadas = await tx.usuario.findMany({ where: { modo_decisao_solicitado_por_id: usuarioId }, select: { id: true } });
          const confirmadas = await tx.usuario.findMany({ where: { modo_decisao_segunda_confirmacao_id: usuarioId }, select: { id: true } });
          const afetados = new Set<number>([...comoFamiliar.map((v) => v.idoso_id), ...iniciadas.map((u) => u.id), ...confirmadas.map((u) => u.id)]);
          afetados.delete(usuarioId);

          await apagarDadosDoIdoso(tx, usuarioId);
          await tx.vinculo.deleteMany({ where: { vinculado_id: usuarioId } });

          // Idoso sem login que U cadastrou: sem mais ninguém com acesso, o dado não tem finalidade.
          for (const { id } of semLogin) {
            const aprovados = await tx.vinculo.count({ where: { idoso_id: id, status: "aprovado" } });
            if (aprovados === 0) {
              await apagarDadosDoIdoso(tx, id);
              await anonimizarUsuario(tx, id);
              afetados.delete(id);
            } else {
              afetados.add(id);
            }
          }
          for (const id of afetados) await reconciliarDecisao(tx, id, usuarioId);

          await anonimizarUsuario(tx, usuarioId);
          try {
            await firebaseAuth.deleteUser(eu.firebase_uid);
          } catch {
            // Sem log nem eco: a mensagem do Firebase pode trazer o uid. A exceção desfaz a transação.
            throw new FalhaFirebase();
          }
        },
        { timeout: 20000, maxWait: 5000 },
      );
    } catch (e) {
      if (e instanceof FalhaFirebase) return res.status(502).json({ error: MSG_EXCLUSAO_FALHOU });
      throw e;
    }
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

const MSG_EMAIL_INVALIDO = "E-mail inválido.";
const MSG_EMAIL_EM_USO = "Este e-mail já está em uso por outra conta.";

router.patch("/me", requireAuthRevogacao, limiteAtualizarPerfil, async (req, res, next) => {
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
    // Limites das colunas (NVarChar 150 e 20), checados antes do Firebase: senão o update do banco falharia depois dele.
    if (data.nome && data.nome.length > 150) {
      return res.status(400).json({ error: "Nome deve ter até 150 caracteres." });
    }
    if (email !== undefined) data.email = typeof email === "string" ? email.trim() || null : email;
    if (telefone !== undefined)
      data.telefone = typeof telefone === "string" ? telefone.trim() || null : telefone;
    if (data.telefone && data.telefone.length > 20) {
      return res.status(400).json({ error: "Telefone deve ter até 20 caracteres." });
    }

    // Trocar o e-mail de verdade (ignorando caixa; apagar conta): zera a verificação no Firebase e cancela os convites
    // pendentes do idoso. Trocar só a caixa não é troca.
    let emailMudou = false;
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

      // E-mail novo: formato e unicidade no banco ANTES do Firebase. Assim o Firebase só é alterado com e-mail válido e livre
      // no banco, e o 409 e o 400 abaixo são os mesmos quando é o Firebase que acusa o problema (a resposta não revela em
      // qual sistema o e-mail existe). E-mail igual ao atual não é revalidado (cadastro antigo fora do formato).
      if (data.email && data.email !== atual.email) {
        if (data.email.length > 255 || !isValidEmailFormat(data.email)) {
          return res.status(400).json({ error: MSG_EMAIL_INVALIDO });
        }
        const ocupado = await prisma.usuario.findFirst({
          where: { email: data.email, id: { not: req.usuarioId } },
          select: { id: true },
        });
        if (ocupado) {
          return res.status(409).json({ error: MSG_EMAIL_EM_USO });
        }
      }

      emailMudou = "email" in data && (data.email ?? "").toLowerCase() !== (atual.email ?? "").toLowerCase();

      // req.usuarioId sempre tem firebase_uid preenchido: requireAuth só resolve o id
      // buscando por firebase_uid, então um Usuario sem essa coluna nunca autentica
      // como si mesmo (caso do idoso cadastrado por familiar via RF-030, fora deste fluxo).
      if (emailMudou && atual.firebase_uid) {
        // E-mail novo (texto não vazio) ainda não foi provado: emailVerified false de forma explícita, sem depender do que
        // o Firebase faz sozinho. Sem isso a verificação do e-mail antigo valeria para o novo (e o aceite de convite e o
        // aviso de emergência confiam em "e-mail verificado"). Apagar o e-mail não manda emailVerified.
        try {
          await firebaseAuth.updateUser(
            atual.firebase_uid,
            data.email ? { email: data.email, emailVerified: false } : { email: undefined },
          );
        } catch (e) {
          // Só estes dois códigos viram resposta tratada; o resto (rede, serviço) segue para o errorHandler.
          const codigo = (e as { code?: unknown }).code;
          if (codigo === "auth/email-already-exists") return res.status(409).json({ error: MSG_EMAIL_EM_USO });
          if (codigo === "auth/invalid-email") return res.status(400).json({ error: MSG_EMAIL_INVALIDO });
          throw e;
        }
      }
    }

    const atualizacao = prisma.usuario.update({
      where: { id: req.usuarioId },
      data,
      select: { id: true, nome: true, email: true, telefone: true, tipo_perfil: true },
    });
    // O convite pendente do idoso (convite_idoso, familiar ou cuidador) foi criado para quem tinha o e-mail antigo: com
    // outro e-mail ele não vale (senão quem criou conta com o e-mail de um terceiro trocaria para um e-mail seu, o
    // confirmaria e ficaria com o vínculo). O idoso convida de novo. Só os pendentes desta origem e deste usuário, na
    // mesma transação que grava o e-mail novo.
    const usuario = emailMudou
      ? (
          await prisma.$transaction([
            prisma.vinculo.updateMany({
              where: { vinculado_id: req.usuarioId, origem: "convite_idoso", status: "pendente" },
              data: { status: "recusado", aprovador_id: req.usuarioId, data_resposta: new Date() },
            }),
            atualizacao,
          ])
        )[1]
      : await atualizacao;
    res.json(usuario);
  } catch (e) {
    if (isDuplicateEmail(e)) {
      return res.status(409).json({ error: MSG_EMAIL_EM_USO });
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
router.patch("/me/modo-decisao", requireAuthRevogacao, async (req, res, next) => {
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
router.post("/cadastrar-idoso", requireAuthRevogacao, bloquearContaDemo, limiteCadastrarIdoso, async (req, res, next) => {
  try {
    const chamador = await prisma.usuario.findUnique({
      where: { id: req.usuarioId },
      select: { tipo_perfil: true, email: true },
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
    // Fluxo A: e-mail do Familiar já verificado no token = posse já confirmada. O e-mail do token tem que ser o do
    // cadastro: token anterior a uma troca de e-mail ainda diz verificado (senão o vínculo nasce pendente, mesma resposta).
    const aprovado = req.emailVerificado && emailDoTokenConfere(req.emailDoToken, chamador.email);

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
