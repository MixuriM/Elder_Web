import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requireVinculoAprovado } from "../middleware/requireVinculoAprovado";
import { resolverModoDecisao } from "./vinculo";

const router = Router();

// Item 6.1 (RF-015): criar compromisso na agenda. Evento 'medico' pode carregar dado de saúde no título
// (RNF-001): mensagens fixas que nunca incluem o valor enviado e nenhum log neste arquivo.
const MSG_403 = "Sem permissão para criar compromisso.";
const TIPOS_PERMITIDOS = ["pessoal", "medico"];
// Mesma regra de remedios.ts (replicada de propósito, sem refatorar): ISO 8601 com Z ou offset explícito,
// porque sem fuso o servidor (UTC) leria a hora local como UTC e deslocaria o evento.
const ISO_COM_FUSO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function textoObrigatorio(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t && t.length <= max ? t : null;
}

// Instante exato (UTC) de um ISO com fuso. Além do Date válido, confere ida e volta de ano, mês e dia:
// o parser do JS aceita dia que não existe em algumas formas (2026-02-30 vira março).
function instanteValido(v: unknown): Date | null {
  if (typeof v !== "string" || !ISO_COM_FUSO.test(v)) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const [ano, mes, dia] = v.slice(0, 10).split("-").map(Number);
  const cal = new Date(Date.UTC(ano, mes - 1, dia));
  return cal.getUTCFullYear() === ano && cal.getUTCMonth() === mes - 1 && cal.getUTCDate() === dia ? d : null;
}

type DadosEvento = {
  tipo_evento: string;
  titulo: string;
  descricao: string | null;
  data_hora_inicio: Date;
  data_hora_fim: Date | null;
};

// Ordem: tipo_evento primeiro ('cuidado' é 403 mesmo com o resto inválido), depois os demais campos.
function validarCorpoEvento(body: unknown): { status: number; erro: string } | { dados: DadosEvento } {
  const { tipo_evento, titulo, descricao, data_hora_inicio, data_hora_fim } = (body ?? {}) as Record<string, unknown>;

  if (tipo_evento === "cuidado") return { status: 403, erro: MSG_403 };
  if (typeof tipo_evento !== "string" || !TIPOS_PERMITIDOS.includes(tipo_evento)) {
    return { status: 400, erro: "tipo_evento inválido." };
  }

  const tituloValido = textoObrigatorio(titulo, 150);
  if (!tituloValido) return { status: 400, erro: "titulo inválido." };

  let desc: string | null = null;
  if (descricao !== undefined && descricao !== null) {
    if (typeof descricao !== "string" || descricao.trim().length > 500) {
      return { status: 400, erro: "descricao inválida." };
    }
    desc = descricao.trim() || null;
  }

  const inicio = instanteValido(data_hora_inicio);
  if (!inicio) return { status: 400, erro: "data_hora_inicio inválida." };
  let fim: Date | null = null;
  if (data_hora_fim !== undefined && data_hora_fim !== null) {
    fim = instanteValido(data_hora_fim);
    if (!fim || fim < inicio) return { status: 400, erro: "data_hora_fim inválida." };
  }

  return { dados: { tipo_evento, titulo: tituloValido, descricao: desc, data_hora_inicio: inicio, data_hora_fim: fim } };
}

type EventoCriado = Awaited<ReturnType<typeof prisma.evento.create>>;

function serializarEvento(e: EventoCriado) {
  return {
    id: e.id,
    idoso_id: e.idoso_id,
    criado_por_id: e.criado_por_id,
    tipo_evento: e.tipo_evento,
    titulo: e.titulo,
    descricao: e.descricao,
    data_hora_inicio: e.data_hora_inicio.toISOString(),
    data_hora_fim: e.data_hora_fim === null ? null : e.data_hora_fim.toISOString(),
    editado_por_id: e.editado_por_id,
    created_at: e.created_at,
    updated_at: e.updated_at,
  };
}

// Parte comum às duas rotas, depois da autorização. Whitelist: só os 5 campos validados vão ao create;
// id, timestamps e autoria do corpo nunca chegam aqui. Autoria é sempre req.usuarioId.
// Sem idempotência nem checagem de sobreposição: aceito (item 6.1).
async function criarEvento(req: Request, res: Response, idosoId: number) {
  const validado = validarCorpoEvento(req.body);
  if ("erro" in validado) return res.status(validado.status).json({ error: validado.erro });

  const e = await prisma.evento.create({
    data: { idoso_id: idosoId, criado_por_id: req.usuarioId, editado_por_id: null, ...validado.dados },
  });
  return res.status(201).json(serializarEvento(e));
}

// Idoso cria na própria agenda. Ordem: 401, 403 (perfil), 400 (tipo), 403 ('cuidado'), 400 (campos), 201.
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const chamador = await prisma.usuario.findUnique({
      where: { id: req.usuarioId },
      select: { tipo_perfil: true },
    });
    if (chamador?.tipo_perfil !== "idoso") {
      return res.status(403).json({ error: MSG_403 });
    }
    await criarEvento(req, res, req.usuarioId);
  } catch (e) {
    next(e);
  }
});

// Familiar cria na agenda do idoso vinculado. Exige tipo_vinculo E tipo_perfil 'familiar' (o middleware não
// filtra tipo_vinculo) e modo_decisao efetivo 'familiar' (sempre via resolver, nunca a coluna). Cuidador
// recebe 403 sempre (6.2 trata depois). A checagem de ator vem antes do resolver. Ordem: 401, 400
// (idosoId), 403 (vínculo), 403 (ator ou modo_decisao), 400 (tipo), 403 ('cuidado'), 400 (campos), 201.
router.post("/idoso/:idosoId", requireAuth, requireVinculoAprovado("idosoId"), async (req, res, next) => {
  try {
    const vinculo = req.vinculoAprovado;
    if (!vinculo || vinculo.tipo_vinculo !== "familiar") {
      return res.status(403).json({ error: MSG_403 });
    }
    const chamador = await prisma.usuario.findUnique({
      where: { id: req.usuarioId },
      select: { tipo_perfil: true },
    });
    if (chamador?.tipo_perfil !== "familiar" || (await resolverModoDecisao(vinculo.idoso_id)) !== "familiar") {
      return res.status(403).json({ error: MSG_403 });
    }
    await criarEvento(req, res, vinculo.idoso_id);
  } catch (e) {
    next(e);
  }
});

export default router;
