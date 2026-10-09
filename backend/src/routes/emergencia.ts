import { Router } from "express";
import { prisma } from "../lib/prisma";
import { configuracaoEmail, enviarEmail, ErroEnvioEmail } from "../lib/enviarEmail";
import { auth } from "../lib/firebaseAdmin";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

// RF novo (número a definir pelo grupo): o idoso pede ajuda e o sistema manda um e-mail a cada pessoa com vínculo
// APROVADO (familiar ou cuidador) com e-mail VERIFICADO no Firebase (sem isso, qualquer conta criada com o e-mail de
// outra pessoa receberia os avisos depois de aprovada). Não substitui o 192: as mensagens repetem isso.
// Resposta só com contagens e mensagens fixas, nunca com e-mail de alguém. Log só com id do idoso, contagens e
// códigos de erro do provedor (nada do corpo, do nome nem dos endereços).
const MSG_403 = "Só o idoso pode pedir ajuda por aqui.";
const MSG_SEM_VINCULO = "Nenhuma pessoa vinculada para avisar.";
const MSG_NINGUEM_CONFIRMADO = "Ninguém com e-mail confirmado para avisar.";
const MSG_ENVIADO = "Aviso enviado.";
const MSG_SEM_CONFIG = "Não foi possível avisar agora. Ligue 192.";
const MSG_FALHA = "Não foi possível avisar. Ligue 192.";
const MSG_LIMITE = "Você pediu ajuda há pouco. Se for urgente, ligue 192.";

// Limite por idoso: 5 tentativas de envio por hora (toda tentativa conta) e espera de 2 minutos só depois de um envio
// com sucesso. Envio em curso também bloqueia (dois pedidos simultâneos não mandam em dobro).
// ponytail: em memória, zera quando o servidor reinicia (e o Render free dorme); tabela própria se isso importar.
const INTERVALO_MS = 2 * 60_000;
const JANELA_MS = 60 * 60_000;
const MAX_POR_JANELA = 5;
type Historico = { tentativas: number[]; ultimoSucesso?: number; enviando?: boolean };
const historicos = new Map<number, Historico>();

// Segundos até poder enviar de novo, ou 0. Também limpa o histórico vencido do idoso.
function esperaLimite(idosoId: number, agora: number): number {
  const h = historicos.get(idosoId);
  if (!h) return 0;
  h.tentativas = h.tentativas.filter((t) => agora - t < JANELA_MS);
  if (h.tentativas.length === 0 && !h.enviando) historicos.delete(idosoId);
  const espera = Math.max(
    h.enviando ? INTERVALO_MS : 0,
    h.ultimoSucesso === undefined ? 0 : h.ultimoSucesso + INTERVALO_MS - agora,
    h.tentativas.length >= MAX_POR_JANELA ? h.tentativas[0] + JANELA_MS - agora : 0,
  );
  return Math.ceil(espera / 1000);
}

type Pessoa = { email: string; uid: string | null };

// Pessoas com vínculo aprovado do idoso e e-mail, sem repetir e-mail. Duas consultas simples (sem filtro aninhado).
async function destinatariosDoIdoso(idosoId: number): Promise<Pessoa[]> {
  const vinculos = await prisma.vinculo.findMany({
    where: { idoso_id: idosoId, status: "aprovado" },
    select: { vinculado_id: true },
  });
  if (vinculos.length === 0) return [];
  const usuarios = await prisma.usuario.findMany({
    where: { id: { in: vinculos.map((v) => v.vinculado_id) } },
    select: { email: true, firebase_uid: true },
  });
  const porEmail = new Map<string, Pessoa>();
  for (const u of usuarios) {
    const email = u.email?.trim();
    if (email && !porEmail.has(email)) porEmail.set(email, { email, uid: u.firebase_uid });
  }
  return [...porEmail.values()];
}

// Só quem tem, no Firebase, o MESMO e-mail do cadastro e verificado. Uma chamada só (getUsers aceita até 100 ids).
// Erro do Firebase sobe para quem chama: sem saber quem é verificado, não envia a ninguém (falha fechada).
async function comEmailVerificado(pessoas: Pessoa[]): Promise<string[]> {
  const comUid = pessoas.filter((p): p is { email: string; uid: string } => !!p.uid);
  if (comUid.length === 0) return [];
  const { users } = await auth.getUsers(comUid.map((p) => ({ uid: p.uid })));
  const ok = new Set(users.filter((u) => u.emailVerified && u.email).map((u) => `${u.uid} ${u.email!.toLowerCase()}`));
  return comUid.filter((p) => ok.has(`${p.uid} ${p.email.toLowerCase()}`)).map((p) => p.email);
}

const FORMATO_HORA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function montarAviso(nomeIdoso: string, instante: Date) {
  const nome = nomeIdoso.replace(/[\r\n]+/g, " ").trim();
  const partes = Object.fromEntries(FORMATO_HORA.formatToParts(instante).map((p) => [p.type, p.value]));
  const quando = `${partes.day}/${partes.month}/${partes.year} às ${partes.hour}:${partes.minute}`;
  return {
    assunto: `${nome} pediu ajuda pelo Elder Web`,
    texto:
      `${nome} pediu ajuda pelo Elder Web em ${quando} (horário de Brasília).\n\n` +
      "Ligue para ele(a) agora. Se não conseguir contato, ligue 192.\n\n" +
      `Você recebeu este aviso porque tem vínculo com ${nome} no Elder Web.`,
  };
}

router.post("/avisar", requireAuth, async (req, res, next) => {
  try {
    const idoso = await prisma.usuario.findUnique({
      where: { id: req.usuarioId },
      select: { tipo_perfil: true, nome: true },
    });
    if (idoso?.tipo_perfil !== "idoso") return res.status(403).json({ error: MSG_403 });
    const idosoId = req.usuarioId;

    const pessoas = await destinatariosDoIdoso(idosoId);
    if (pessoas.length === 0) {
      return res.json({ avisados: 0, falharam: 0, nao_confirmados: 0, mensagem: MSG_SEM_VINCULO });
    }
    if (!configuracaoEmail()) {
      console.error("Aviso de emergência sem envio", { idosoId, codigo: "SEM_CONFIGURACAO" });
      return res.status(503).json({ error: MSG_SEM_CONFIG });
    }

    let para: string[];
    try {
      para = await comEmailVerificado(pessoas);
    } catch {
      // Nunca loga o erro do Firebase: a mensagem pode trazer e-mail.
      console.error("Aviso de emergência sem envio", { idosoId, codigo: "VERIFICACAO_EMAIL" });
      return res.status(503).json({ error: MSG_SEM_CONFIG });
    }
    const nao_confirmados = pessoas.length - para.length;
    if (para.length === 0) {
      return res.json({ avisados: 0, falharam: 0, nao_confirmados, mensagem: MSG_NINGUEM_CONFIRMADO });
    }

    // Checagem e registro sem await entre eles: dois pedidos simultâneos não passam juntos.
    const agora = Date.now();
    const espera = esperaLimite(idosoId, agora);
    if (espera > 0) {
      res.set("Retry-After", String(espera));
      return res.status(429).json({ error: MSG_LIMITE });
    }
    const historico = historicos.get(idosoId) ?? { tentativas: [] };
    historicos.set(idosoId, historico);
    historico.tentativas.push(agora);
    historico.enviando = true;

    const { assunto, texto } = montarAviso(idoso.nome, new Date(agora));
    let resultados: PromiseSettledResult<void>[];
    try {
      resultados = await Promise.allSettled(para.map((email) => enviarEmail({ para: email, assunto, texto })));
    } finally {
      historico.enviando = false;
    }
    const avisados = resultados.filter((r) => r.status === "fulfilled").length;
    const falharam = resultados.length - avisados;
    if (avisados > 0) historico.ultimoSucesso = agora;
    const codigos = resultados.flatMap((r) =>
      r.status === "rejected" ? [r.reason instanceof ErroEnvioEmail ? r.reason.codigo : "DESCONHECIDO"] : [],
    );
    console.info("Aviso de emergência", { idosoId, avisados, falharam, nao_confirmados, codigos });

    if (avisados === 0) return res.status(502).json({ avisados, falharam, nao_confirmados, error: MSG_FALHA });
    res.json({ avisados, falharam, nao_confirmados, mensagem: MSG_ENVIADO });
  } catch (e) {
    next(e);
  }
});

export default router;
