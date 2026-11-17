import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requireVinculoAprovado } from "../middleware/requireVinculoAprovado";
import { resolverModoDecisao } from "./vinculo";
import { parseIdRegistro } from "./saude";
import type { Vinculo } from "@prisma/client";

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

// Autoridade de escrita do familiar sobre a alimentação do idoso do vínculo (criar, editar e excluir: a mesma regra). O
// middleware não filtra tipo_vinculo: exige tipo_vinculo E tipo_perfil 'familiar' E modo_decisao efetivo 'familiar'
// (sempre via resolver, nunca a coluna). Cuidador não tem ramo de sucesso: a checagem de ator vem antes do resolver
// (curto-circuito), então o resolver NUNCA é consultado para ele.
async function familiarPodeEscrever(vinculo: Vinculo, usuarioId: number): Promise<boolean> {
  const chamador = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { tipo_perfil: true },
  });
  return (
    vinculo.tipo_vinculo === "familiar" &&
    chamador?.tipo_perfil === "familiar" &&
    (await resolverModoDecisao(vinculo.idoso_id)) === "familiar"
  );
}

// Familiar registra para o idoso vinculado. Ordem: 401, 400 (idosoId), 403 (vínculo), 403 (ator ou modo_decisao),
// 400 (corpo), 201.
router.post("/idoso/:idosoId", requireAuth, requireVinculoAprovado("idosoId"), async (req, res, next) => {
  try {
    const vinculo = req.vinculoAprovado;
    if (!vinculo || !(await familiarPodeEscrever(vinculo, req.usuarioId))) return res.status(403).json({ error: MSG_403 });
    await criarRegistroAlimentar(req, res, vinculo.idoso_id);
  } catch (e) {
    next(e);
  }
});

// Fase 11 (11.1): editar e excluir refeição. Autoridade = a de criar (idoso só o próprio; familiar por
// familiarPodeEscrever; cuidador nunca). O registro é buscado com o idoso alvo no próprio where: inexistente e de outro
// idoso colapsam no mesmo 404 (um 403 separado vazaria que o id existe). Exclusão física, sem idempotência (repetida
// dá 404). Mensagens fixas, nunca com o valor enviado, e nenhum log (a descrição é dado sensível).
const MSG_403_EDICAO = "Sem permissão para editar refeição.";
const MSG_403_EXCLUSAO = "Sem permissão para excluir refeição.";
const MSG_404 = "Registro não encontrado.";
const CAMPOS_REFEICAO = ["refeicao", "descricao", "data_hora"] as const;

// Edição parcial: campo ausente (undefined) mantém o valor atual; monta o corpo completo a partir do registro e
// revalida com validarCorpoRefeicao, então regras e mensagens são as do POST (null em campo obrigatório dá 400).
function validarCorpoEdicaoRefeicao(body: unknown, atual: RegistroCriado): { erro: string } | { dados: DadosRefeicao } {
  const enviado = (body ?? {}) as Record<string, unknown>;
  if (CAMPOS_REFEICAO.every((c) => enviado[c] === undefined)) return { erro: "Nenhum campo de refeição informado." };
  const mesclado: Record<string, unknown> = {
    refeicao: atual.refeicao,
    descricao: atual.descricao,
    data_hora: atual.data_hora.toISOString(),
  };
  for (const c of CAMPOS_REFEICAO) if (enviado[c] !== undefined) mesclado[c] = enviado[c];
  return validarCorpoRefeicao(mesclado);
}

// Parte comum depois da autorização. idoso_id, registrado_por_id e created_at nunca entram no update;
// editado_por_id é sempre req.usuarioId.
async function editarRegistroAlimentar(req: Request, res: Response, atual: RegistroCriado) {
  const validado = validarCorpoEdicaoRefeicao(req.body, atual);
  if ("erro" in validado) return res.status(400).json({ error: validado.erro });

  const r = await prisma.registroAlimentar.update({
    where: { id: atual.id },
    data: { ...validado.dados, editado_por_id: req.usuarioId },
  });
  return res.json(serializarRegistroAlimentar(r));
}

// count 0 = apagado por outra chamada entre a leitura e o delete: 404, não 500.
async function excluirRegistroAlimentar(res: Response, id: number, idosoId: number) {
  const { count } = await prisma.registroAlimentar.deleteMany({ where: { id, idoso_id: idosoId } });
  if (count === 0) return res.status(404).json({ error: MSG_404 });
  return res.status(204).end();
}

// Idoso edita ou exclui o próprio registro, sem consultar vínculo nem tipo_perfil (dono = idoso_id igual ao token).
// Ordem: 401, 400 (id), 404, 400 (corpo, só PATCH), 200 ou 204.
router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = parseIdRegistro(req.params.id);
    if (id === null) return res.status(400).json({ error: "Id de registro inválido." });
    const registro = await prisma.registroAlimentar.findFirst({ where: { id, idoso_id: req.usuarioId } });
    if (!registro) return res.status(404).json({ error: MSG_404 });
    await editarRegistroAlimentar(req, res, registro);
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = parseIdRegistro(req.params.id);
    if (id === null) return res.status(400).json({ error: "Id de registro inválido." });
    const registro = await prisma.registroAlimentar.findFirst({ where: { id, idoso_id: req.usuarioId } });
    if (!registro) return res.status(404).json({ error: MSG_404 });
    await excluirRegistroAlimentar(res, id, req.usuarioId);
  } catch (e) {
    next(e);
  }
});

// Familiar edita ou exclui registro do idoso vinculado. Ordem: 401, 400 (idosoId), 403 (vínculo), 400 (id), 404,
// 403 (ator ou modo_decisao), 400 (corpo, só PATCH), 200 ou 204. 403 genérico, sem citar flag nem modo_decisao.
router.patch("/idoso/:idosoId/:id", requireAuth, requireVinculoAprovado("idosoId"), async (req, res, next) => {
  try {
    const vinculo = req.vinculoAprovado;
    if (!vinculo) return res.status(403).json({ error: MSG_403_EDICAO });
    const id = parseIdRegistro(req.params.id);
    if (id === null) return res.status(400).json({ error: "Id de registro inválido." });
    const registro = await prisma.registroAlimentar.findFirst({ where: { id, idoso_id: vinculo.idoso_id } });
    if (!registro) return res.status(404).json({ error: MSG_404 });
    if (!(await familiarPodeEscrever(vinculo, req.usuarioId))) return res.status(403).json({ error: MSG_403_EDICAO });
    await editarRegistroAlimentar(req, res, registro);
  } catch (e) {
    next(e);
  }
});

router.delete("/idoso/:idosoId/:id", requireAuth, requireVinculoAprovado("idosoId"), async (req, res, next) => {
  try {
    const vinculo = req.vinculoAprovado;
    if (!vinculo) return res.status(403).json({ error: MSG_403_EXCLUSAO });
    const id = parseIdRegistro(req.params.id);
    if (id === null) return res.status(400).json({ error: "Id de registro inválido." });
    const registro = await prisma.registroAlimentar.findFirst({ where: { id, idoso_id: vinculo.idoso_id } });
    if (!registro) return res.status(404).json({ error: MSG_404 });
    if (!(await familiarPodeEscrever(vinculo, req.usuarioId))) return res.status(403).json({ error: MSG_403_EXCLUSAO });
    await excluirRegistroAlimentar(res, id, vinculo.idoso_id);
  } catch (e) {
    next(e);
  }
});

// Item 7.2 (RF-019): visualizar o histórico alimentar. Alimentação não é configurável por vínculo (ER.md): leitura
// nunca consulta permite_* nem modo_decisao, vínculo aprovado basta. Descrição é dado sensível: nenhum log aqui.
// Sem paginação nem filtro (aceito). Passado e futuro (plano) entram.
const MSG_403_LEITURA = "Sem permissão para visualizar alimentação.";

async function historicoAlimentar(idosoId: number) {
  const registros = await prisma.registroAlimentar.findMany({
    where: { idoso_id: idosoId },
    orderBy: [{ data_hora: "desc" }, { id: "desc" }],
  });
  return { registros: registros.map(serializarRegistroAlimentar) };
}

// Idoso lê o próprio histórico. Ordem: 401, 403 (não é idoso), 200.
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const chamador = await prisma.usuario.findUnique({
      where: { id: req.usuarioId },
      select: { tipo_perfil: true },
    });
    if (chamador?.tipo_perfil !== "idoso") return res.status(403).json({ error: MSG_403_LEITURA });
    res.json(await historicoAlimentar(req.usuarioId));
  } catch (e) {
    next(e);
  }
});

// Cuidador ou familiar com vínculo aprovado. Ordem: 401, 400 (idosoId), 403 (vínculo), 200. idoso_id vem do vínculo.
router.get("/idoso/:idosoId", requireAuth, requireVinculoAprovado("idosoId"), async (req, res, next) => {
  try {
    const vinculo = req.vinculoAprovado;
    if (!vinculo) return res.status(403).json({ error: MSG_403_LEITURA });
    res.json(await historicoAlimentar(vinculo.idoso_id));
  } catch (e) {
    next(e);
  }
});

export default router;
