import { Router, type Response } from "express";
import { prisma } from "../lib/prisma";
import { gerarHistoricoPdf } from "../lib/historicoPdf";
import { requireAuth } from "../middleware/requireAuth";
import { requireVinculoAprovado } from "../middleware/requireVinculoAprovado";

const router = Router();

// Item 5.4 (RF-014): exportar o histórico combinado (remédios + saúde) em um único PDF. Dado sensível
// (RNF-001): nenhum console.* aqui, mensagens fixas, nome de arquivo fixo (sem nome nem id de pessoa).
// Sem paginação, filtro nem limite (coerente com 4.4 e 5.3): o PDF inteiro é montado em memória.
const MSG_403_EXPORTACAO = "Sem permissão para exportar histórico.";

// Carrega e monta o PDF INTEIRO em memória antes de qualquer byte ser enviado. Se algo falhar no meio, o
// erro cai no errorHandler como 500 normal; com pipe, o ramo headersSent derrubaria o socket e entregaria
// um PDF truncado. Todas as consultas filtram por idosoId (vindo de req.usuarioId ou do vínculo).
async function montarPdf(idosoId: number, nomeIdoso: string): Promise<Buffer> {
  const [medicamentos, registros] = await Promise.all([
    prisma.medicamento.findMany({
      where: { idoso_id: idosoId },
      orderBy: [{ data_inicio: "desc" }, { id: "desc" }],
      include: { doses: { orderBy: [{ data_hora_administracao: "desc" }, { id: "desc" }] } },
    }),
    prisma.registroSaude.findMany({
      where: { idoso_id: idosoId },
      orderBy: { data_hora: "desc" },
    }),
  ]);
  return gerarHistoricoPdf({
    nomeIdoso,
    geradoEm: new Date(),
    medicamentos: medicamentos.map((m) => ({
      nome: m.nome,
      dosagem: m.dosagem,
      frequencia: m.frequencia,
      data_inicio: m.data_inicio,
      data_fim: m.data_fim,
      ativo: m.ativo,
      observacoes: m.observacoes,
      doses: m.doses.map((d) => ({
        data_hora_administracao: d.data_hora_administracao,
        status_administracao: d.status_administracao,
        observacoes: d.observacoes,
      })),
    })),
    registros: registros.map((r) => ({
      data_hora: r.data_hora,
      tipo_medicao: r.tipo_medicao,
      valor_1: Number(r.valor_1),
      valor_2: r.valor_2 === null ? null : Number(r.valor_2),
      unidade: r.unidade,
      observacoes: r.observacoes,
    })),
  });
}

function enviarPdf(res: Response, pdf: Buffer) {
  res
    .status(200)
    .set({
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="historico-saude-remedios.pdf"',
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    })
    .send(pdf);
}

// Idoso exporta o próprio histórico. Ordem: 401, 403 (não é idoso). Cuidador e familiar usam a outra rota.
router.get("/pdf", requireAuth, async (req, res, next) => {
  try {
    const idoso = await prisma.usuario.findUnique({
      where: { id: req.usuarioId },
      select: { nome: true, tipo_perfil: true },
    });
    if (idoso?.tipo_perfil !== "idoso") {
      return res.status(403).json({ error: MSG_403_EXPORTACAO });
    }
    enviarPdf(res, await montarPdf(req.usuarioId, idoso.nome));
  } catch (e) {
    next(e);
  }
});

// Cuidador ou familiar com vínculo aprovado exporta o histórico do idoso. Ordem: 401, 400 (idosoId), 403
// (vínculo). Nenhuma checagem além do middleware, de propósito: leitura não depende de permite_* nem de
// modo_decisao (só escrita depende), então resolverModoDecisao não é chamado. idoso_id vem do vínculo.
router.get("/idoso/:idosoId/pdf", requireAuth, requireVinculoAprovado("idosoId"), async (req, res, next) => {
  try {
    const vinculo = req.vinculoAprovado;
    if (!vinculo) return res.status(403).json({ error: MSG_403_EXPORTACAO });
    // select só do nome: nunca carregar o BLOB da foto de perfil.
    const idoso = await prisma.usuario.findUnique({ where: { id: vinculo.idoso_id }, select: { nome: true } });
    if (!idoso) return res.status(403).json({ error: MSG_403_EXPORTACAO });
    enviarPdf(res, await montarPdf(vinculo.idoso_id, idoso.nome));
  } catch (e) {
    next(e);
  }
});

export default router;
