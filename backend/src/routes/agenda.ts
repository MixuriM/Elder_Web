import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requireVinculoAprovado } from "../middleware/requireVinculoAprovado";
import { resolverModoDecisao } from "./vinculo";

const router = Router();

// Itens 6.1 (RF-015) e 6.2 (RF-016): criar compromisso na agenda. Evento 'medico' pode carregar dado de saúde no título
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

// "comum" (idoso e familiar) cria 'pessoal' e 'medico'; "cuidador" cria só 'cuidado' (item 6.2).
type Ator = "comum" | "cuidador";

// Ordem: tipo_evento primeiro (o tipo que o ator não pode criar é 403 mesmo com o resto inválido; tipo fora da
// CHECK ou fora do formato é 400), depois os demais campos.
function validarCorpoEvento(body: unknown, ator: Ator): { status: number; erro: string } | { dados: DadosEvento } {
  const { tipo_evento, titulo, descricao, data_hora_inicio, data_hora_fim } = (body ?? {}) as Record<string, unknown>;

  if (ator === "cuidador") {
    if (typeof tipo_evento === "string" && TIPOS_PERMITIDOS.includes(tipo_evento)) return { status: 403, erro: MSG_403 };
    if (tipo_evento !== "cuidado") return { status: 400, erro: "tipo_evento inválido." };
  } else {
    if (tipo_evento === "cuidado") return { status: 403, erro: MSG_403 };
    if (typeof tipo_evento !== "string" || !TIPOS_PERMITIDOS.includes(tipo_evento)) {
      return { status: 400, erro: "tipo_evento inválido." };
    }
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
async function criarEvento(req: Request, res: Response, idosoId: number, ator: Ator) {
  const validado = validarCorpoEvento(req.body, ator);
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
    await criarEvento(req, res, req.usuarioId, "comum");
  } catch (e) {
    next(e);
  }
});

// Familiar e cuidador criam na agenda do idoso vinculado. O middleware não filtra tipo_vinculo: o ator exige
// tipo_vinculo E tipo_perfil iguais. Familiar: modo_decisao efetivo 'familiar' (sempre via resolver, nunca a
// coluna). Cuidador (6.2): permite_criar_evento_cuidado === true lida do banco a cada requisição; as outras
// flags não abrem esta porta e o resolver NUNCA é consultado para cuidador (curto-circuito). A checagem de ator
// vem antes do resolver. Ordem: 401, 400 (idosoId), 403 (vínculo), 403 (ator, flag ou modo_decisao), 400 (tipo
// do cuidador) ou 403 (tipo que o ator não cria), 400 (campos), 201. 403 sempre genérico.
router.post("/idoso/:idosoId", requireAuth, requireVinculoAprovado("idosoId"), async (req, res, next) => {
  try {
    const vinculo = req.vinculoAprovado;
    if (!vinculo) return res.status(403).json({ error: MSG_403 });
    const chamador = await prisma.usuario.findUnique({
      where: { id: req.usuarioId },
      select: { tipo_perfil: true },
    });
    const cuidadorAutorizado =
      vinculo.tipo_vinculo === "cuidador" &&
      chamador?.tipo_perfil === "cuidador" &&
      vinculo.permite_criar_evento_cuidado === true;
    const familiarAutorizado =
      vinculo.tipo_vinculo === "familiar" &&
      chamador?.tipo_perfil === "familiar" &&
      (await resolverModoDecisao(vinculo.idoso_id)) === "familiar";
    if (!cuidadorAutorizado && !familiarAutorizado) return res.status(403).json({ error: MSG_403 });
    await criarEvento(req, res, vinculo.idoso_id, cuidadorAutorizado ? "cuidador" : "comum");
  } catch (e) {
    next(e);
  }
});

// Item 6.3 (RF-017, RNF-003): visualizar a agenda. Todos os atores veem os 3 tipos, sem filtro por tipo nem por autor
// (risco aceito: cuidador e familiar veem compromissos pessoais). Título 'medico' pode ter dado de saúde (RNF-001):
// nenhum log aqui. Sem paginação (aceito). Leitura nunca consulta modo_decisao nem permite_*.
const MSG_403_LEITURA = "Sem permissão para visualizar agenda.";

async function agendaDoIdoso(idosoId: number) {
  const eventos = await prisma.evento.findMany({
    where: { idoso_id: idosoId },
    orderBy: [{ data_hora_inicio: "asc" }, { id: "asc" }],
  });
  return { eventos: eventos.map(serializarEvento) };
}

// Idoso lê a própria agenda. Ordem: 401, 403 (não é idoso), 200.
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const chamador = await prisma.usuario.findUnique({
      where: { id: req.usuarioId },
      select: { tipo_perfil: true },
    });
    if (chamador?.tipo_perfil !== "idoso") return res.status(403).json({ error: MSG_403_LEITURA });
    res.json(await agendaDoIdoso(req.usuarioId));
  } catch (e) {
    next(e);
  }
});

// Cuidador ou familiar com vínculo aprovado. Ordem: 401, 400 (idosoId), 403 (vínculo), 200. idoso_id vem do vínculo.
router.get("/idoso/:idosoId", requireAuth, requireVinculoAprovado("idosoId"), async (req, res, next) => {
  try {
    const vinculo = req.vinculoAprovado;
    if (!vinculo) return res.status(403).json({ error: MSG_403_LEITURA });
    res.json(await agendaDoIdoso(vinculo.idoso_id));
  } catch (e) {
    next(e);
  }
});

export default router;
