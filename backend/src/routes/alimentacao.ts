import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requireVinculoAprovado } from "../middleware/requireVinculoAprovado";
import { resolverModoDecisao } from "./vinculo";

const router = Router();

// Item 7.1 (RF-018): registrar refeição ou plano alimentar (a mesma entidade RegistroAlimentar; data passada ou
// futura). A descrição pode revelar dieta e, por tabela, condição de saúde (RNF-001 por analogia): mensagens fixas
// que nunca incluem o valor enviado e nenhum log neste arquivo. Cuidador NUNCA cria (regra fixa de ator, como na
// Fase 5), com qualquer vínculo e qualquer combinação das flags permite_*.
const MSG_403 = "Sem permissão para registrar refeição.";
// Só na aplicação, sem CHECK no banco (não há CHECK de refeicao nas migrations). Valor exato: caixa e espaço contam.
const REFEICOES = ["cafe_manha", "lanche_manha", "almoco", "lanche_tarde", "jantar", "ceia"];
// Mesma regra de agenda.ts (replicada de propósito, sem refatorar): ISO 8601 com Z ou offset explícito,
// porque sem fuso o servidor (UTC) leria a hora local como UTC e deslocaria o registro.
const ISO_COM_FUSO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

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

type DadosRefeicao = { refeicao: string; descricao: string; data_hora: Date };

// Ordem: refeicao, descricao, data_hora (a primeira inválida decide a mensagem).
function validarCorpoRefeicao(body: unknown): { erro: string } | { dados: DadosRefeicao } {
  const { refeicao, descricao, data_hora } = (body ?? {}) as Record<string, unknown>;

  if (typeof refeicao !== "string" || !REFEICOES.includes(refeicao)) return { erro: "refeicao inválida." };

  const desc = typeof descricao === "string" ? descricao.trim() : "";
  if (!desc || desc.length > 500) return { erro: "descricao inválida." };

  const instante = instanteValido(data_hora);
  if (!instante) return { erro: "data_hora inválida." };

  return { dados: { refeicao, descricao: desc, data_hora: instante } };
}

type RegistroCriado = Awaited<ReturnType<typeof prisma.registroAlimentar.create>>;

function serializarRegistroAlimentar(r: RegistroCriado) {
  return {
    id: r.id,
    idoso_id: r.idoso_id,
    registrado_por_id: r.registrado_por_id,
    refeicao: r.refeicao,
    descricao: r.descricao,
    data_hora: r.data_hora.toISOString(),
    editado_por_id: r.editado_por_id,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

// Parte comum às duas rotas, depois da autorização. Whitelist: só os 3 campos validados vão ao create;
// id, timestamps e autoria do corpo nunca chegam aqui. Autoria é sempre req.usuarioId.
// Sem idempotência nem checagem de sobreposição: aceito.
async function criarRegistroAlimentar(req: Request, res: Response, idosoId: number) {
  const validado = validarCorpoRefeicao(req.body);
  if ("erro" in validado) return res.status(400).json({ error: validado.erro });

  const r = await prisma.registroAlimentar.create({
    data: { idoso_id: idosoId, registrado_por_id: req.usuarioId, editado_por_id: null, ...validado.dados },
  });
  return res.status(201).json(serializarRegistroAlimentar(r));
}

// Idoso registra a própria alimentação. Ordem: 401, 403 (perfil), 400 (corpo), 201.
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const chamador = await prisma.usuario.findUnique({
      where: { id: req.usuarioId },
      select: { tipo_perfil: true },
    });
    if (chamador?.tipo_perfil !== "idoso") return res.status(403).json({ error: MSG_403 });
    await criarRegistroAlimentar(req, res, req.usuarioId);
  } catch (e) {
    next(e);
  }
});

// Familiar registra para o idoso vinculado. O middleware não filtra tipo_vinculo: o ator exige tipo_vinculo E
// tipo_perfil 'familiar' E modo_decisao efetivo 'familiar' (sempre via resolver, nunca a coluna). Cuidador não
// tem ramo de sucesso: a checagem de ator vem antes do resolver (curto-circuito), então o resolver NUNCA é
// consultado para ele. Ordem: 401, 400 (idosoId), 403 (vínculo), 403 (ator ou modo_decisao), 400 (corpo), 201.
router.post("/idoso/:idosoId", requireAuth, requireVinculoAprovado("idosoId"), async (req, res, next) => {
  try {
    const vinculo = req.vinculoAprovado;
    if (!vinculo) return res.status(403).json({ error: MSG_403 });
    const chamador = await prisma.usuario.findUnique({
      where: { id: req.usuarioId },
      select: { tipo_perfil: true },
    });
    const familiarAutorizado =
      vinculo.tipo_vinculo === "familiar" &&
      chamador?.tipo_perfil === "familiar" &&
      (await resolverModoDecisao(vinculo.idoso_id)) === "familiar";
    if (!familiarAutorizado) return res.status(403).json({ error: MSG_403 });
    await criarRegistroAlimentar(req, res, vinculo.idoso_id);
  } catch (e) {
    next(e);
  }
});

export default router;
