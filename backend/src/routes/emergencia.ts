import { Router } from "express";
import { prisma } from "../lib/prisma";
import { configuracaoEmail, enviarEmail, ErroEnvioEmail } from "../lib/enviarEmail";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

// RF novo (número a definir pelo grupo): o idoso pede ajuda e o sistema manda um e-mail a cada pessoa com vínculo
// APROVADO (familiar ou cuidador) que tenha e-mail. Não substitui o 192: as mensagens repetem isso.
// Resposta só com contagens e mensagens fixas, nunca com e-mail de alguém. Log só com id do idoso, contagens e
// códigos de erro do provedor (nada do corpo, do nome nem dos endereços).
const MSG_403 = "Só o idoso pode pedir ajuda por aqui.";
const MSG_SEM_VINCULO = "Nenhuma pessoa vinculada para avisar.";
const MSG_ENVIADO = "Aviso enviado.";
const MSG_SEM_CONFIG = "Não foi possível avisar agora. Ligue 192.";
const MSG_FALHA = "Não foi possível avisar. Ligue 192.";
const MSG_LIMITE = "Você pediu ajuda há pouco. Se for urgente, ligue 192.";

// Limite por idoso: 1 aviso a cada 2 minutos e 5 por hora. Só conta tentativa real de envio.
// ponytail: em memória, zera quando o servidor reinicia (e o Render free dorme); tabela própria se isso importar.
const INTERVALO_MS = 2 * 60_000;
const JANELA_MS = 60 * 60_000;
const MAX_POR_JANELA = 5;
const envios = new Map<number, number[]>();

// Segundos até poder enviar de novo, ou 0. Também limpa o histórico vencido do idoso.
function esperaLimite(idosoId: number, agora: number): number {
  const recentes = (envios.get(idosoId) ?? []).filter((t) => agora - t < JANELA_MS);
  if (recentes.length === 0) envios.delete(idosoId);
  else envios.set(idosoId, recentes);
  const ultimo = recentes[recentes.length - 1];
  const espera = Math.max(
    ultimo === undefined ? 0 : ultimo + INTERVALO_MS - agora,
    recentes.length >= MAX_POR_JANELA ? recentes[0] + JANELA_MS - agora : 0,
  );
  return Math.ceil(espera / 1000);
}

// E-mails das pessoas com vínculo aprovado do idoso, sem repetição. Duas consultas simples (sem filtro aninhado).
async function destinatariosDoIdoso(idosoId: number): Promise<string[]> {
  const vinculos = await prisma.vinculo.findMany({
    where: { idoso_id: idosoId, status: "aprovado" },
    select: { vinculado_id: true },
  });
  if (vinculos.length === 0) return [];
  const pessoas = await prisma.usuario.findMany({
    where: { id: { in: vinculos.map((v) => v.vinculado_id) } },
    select: { email: true },
  });
  return [...new Set(pessoas.map((p) => p.email?.trim()).filter((e): e is string => !!e))];
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

    const para = await destinatariosDoIdoso(idosoId);
    if (para.length === 0) return res.json({ avisados: 0, falharam: 0, mensagem: MSG_SEM_VINCULO });
    if (!configuracaoEmail()) {
      console.error("Aviso de emergência sem envio", { idosoId, codigo: "SEM_CONFIGURACAO" });
      return res.status(503).json({ error: MSG_SEM_CONFIG });
    }

    // Checagem e registro sem await entre eles: dois pedidos simultâneos não passam juntos.
    const agora = Date.now();
    const espera = esperaLimite(idosoId, agora);
    if (espera > 0) {
      res.set("Retry-After", String(espera));
      return res.status(429).json({ error: MSG_LIMITE });
    }
    envios.set(idosoId, [...(envios.get(idosoId) ?? []), agora]);

    const { assunto, texto } = montarAviso(idoso.nome, new Date(agora));
    const resultados = await Promise.allSettled(para.map((email) => enviarEmail({ para: email, assunto, texto })));
    const avisados = resultados.filter((r) => r.status === "fulfilled").length;
    const falharam = resultados.length - avisados;
    const codigos = resultados.flatMap((r) =>
      r.status === "rejected" ? [r.reason instanceof ErroEnvioEmail ? r.reason.codigo : "DESCONHECIDO"] : [],
    );
    console.info("Aviso de emergência", { idosoId, avisados, falharam, codigos });

    if (avisados === 0) return res.status(502).json({ avisados, falharam, error: MSG_FALHA });
    res.json({ avisados, falharam, mensagem: MSG_ENVIADO });
  } catch (e) {
    next(e);
  }
});

export default router;
