import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requireVinculoAprovado } from "../middleware/requireVinculoAprovado";
import { resolverModoDecisao } from "./vinculo";

const router = Router();

const MSG_403 = "Sem permissão para cadastrar medicamento.";
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

// Mensagens fixas: nunca incluem o valor enviado (dado sensível, LGPD Art. 5º, XI).
function textoObrigatorio(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t && t.length <= max ? t : null;
}

// YYYY-MM-DD de calendário real, sem horário nem fuso. Ida e volta pelo ISO rejeita 2026-02-30.
function dataValida(v: unknown): Date | null {
  if (typeof v !== "string" || !DATA_ISO.test(v)) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : d;
}

type DadosMedicamento = {
  nome: string;
  dosagem: string;
  frequencia: string;
  data_inicio: Date;
  data_fim: Date | null;
  observacoes: string | null;
};

function validarCorpoMedicamento(body: unknown): { erro: string } | { dados: DadosMedicamento } {
  const { nome, dosagem, frequencia, data_inicio, data_fim, observacoes } = (body ?? {}) as Record<string, unknown>;

  const nomeValido = textoObrigatorio(nome, 150);
  if (!nomeValido) return { erro: "nome inválido." };
  const dosagemValida = textoObrigatorio(dosagem, 50);
  if (!dosagemValida) return { erro: "dosagem inválida." };
  const frequenciaValida = textoObrigatorio(frequencia, 100);
  if (!frequenciaValida) return { erro: "frequencia inválida." };

  const inicio = dataValida(data_inicio);
  if (!inicio) return { erro: "data_inicio inválida." };
  let fim: Date | null = null;
  if (data_fim !== undefined && data_fim !== null) {
    fim = dataValida(data_fim);
    if (!fim || fim < inicio) return { erro: "data_fim inválida." };
  }

  let obs: string | null = null;
  if (observacoes !== undefined && observacoes !== null) {
    if (typeof observacoes !== "string" || observacoes.trim().length > 500) {
      return { erro: "observacoes inválidas." };
    }
    obs = observacoes.trim() || null;
  }

  return {
    dados: {
      nome: nomeValido,
      dosagem: dosagemValida,
      frequencia: frequenciaValida,
      data_inicio: inicio,
      data_fim: fim,
      observacoes: obs,
    },
  };
}

type MedicamentoCriado = Awaited<ReturnType<typeof prisma.medicamento.create>>;

// Datas @db.Date voltam como Date UTC à meia-noite: YYYY-MM-DD sem deslocar o dia.
function serializarMedicamento(m: MedicamentoCriado) {
  return {
    id: m.id,
    idoso_id: m.idoso_id,
    criado_por_id: m.criado_por_id,
    nome: m.nome,
    dosagem: m.dosagem,
    frequencia: m.frequencia,
    data_inicio: m.data_inicio.toISOString().slice(0, 10),
    data_fim: m.data_fim === null ? null : m.data_fim.toISOString().slice(0, 10),
    observacoes: m.observacoes,
    ativo: m.ativo,
    editado_por_id: m.editado_por_id,
    created_at: m.created_at,
    updated_at: m.updated_at,
  };
}

// Item 5.1 (RF-011): idoso cadastra o próprio medicamento. Qualquer outro perfil recebe 403.
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const chamador = await prisma.usuario.findUnique({
      where: { id: req.usuarioId },
      select: { tipo_perfil: true },
    });
    if (chamador?.tipo_perfil !== "idoso") {
      return res.status(403).json({ error: MSG_403 });
    }

    const validado = validarCorpoMedicamento(req.body);
    if ("erro" in validado) return res.status(400).json({ error: validado.erro });

    const m = await prisma.medicamento.create({
      data: {
        idoso_id: req.usuarioId,
        criado_por_id: req.usuarioId,
        editado_por_id: null,
        ativo: true,
        ...validado.dados,
      },
    });

    res.status(201).json(serializarMedicamento(m));
  } catch (e) {
    next(e);
  }
});

// Item 5.1 (RF-011): familiar cadastra medicamento do idoso vinculado. Regra fixa de ator: cuidador
// nunca cria, com qualquer vínculo e qualquer flag permite_*. Exige tipo_vinculo E tipo_perfil do
// chamador 'familiar' (o segundo vale mesmo se a convenção de tipo_vinculo do middleware quebrar) e
// modo_decisao efetivo 'familiar' (via resolver, nunca a coluna). Ordem: 401, 400 (idosoId), 403
// (vínculo), 403 (ator ou modo_decisao), 400 (corpo). 403 genérico, sem citar o motivo.
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

    const validado = validarCorpoMedicamento(req.body);
    if ("erro" in validado) return res.status(400).json({ error: validado.erro });

    const m = await prisma.medicamento.create({
      data: {
        idoso_id: vinculo.idoso_id,
        criado_por_id: req.usuarioId,
        editado_por_id: null,
        ativo: true,
        ...validado.dados,
      },
    });

    res.status(201).json(serializarMedicamento(m));
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------------------------
// Item 5.2 (RF-012): marcar dose administrada. Dose e medicamento são dado sensível (RNF-001):
// mensagens fixas, nunca com o valor enviado, e nenhum console.* aqui.
// ---------------------------------------------------------------------------------------------
const MSG_403_DOSE = "Sem permissão para registrar dose.";
const STATUS_DOSE = ["administrado", "pulado", "atrasado"] as const;
const TOLERANCIA_FUTURO_MS = 5 * 60 * 1000;
// Mesma regra de data_hora de saude.ts (replicada de propósito, sem refatorar saude.ts): ISO 8601 com
// Z ou offset explícito, porque sem fuso o servidor (UTC) leria a hora local como UTC.
const ISO_COM_FUSO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const INT32_MAX = 2147483647;

// Só dígitos: rejeita "1e2", "1.5", "-1", " " e "0x10", que Number() aceitaria.
function idPositivo(v: string): number | null {
  if (!/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n >= 1 && n <= INT32_MAX ? n : null;
}

type DadosDose = { status_administracao: string; data_hora_administracao: Date; observacoes: string | null };

function validarCorpoDose(body: unknown): { erro: string } | { dados: DadosDose } {
  const { status_administracao, data_hora_administracao, observacoes } = (body ?? {}) as Record<string, unknown>;

  if (typeof status_administracao !== "string" || !(STATUS_DOSE as readonly string[]).includes(status_administracao)) {
    return { erro: "status_administracao inválido." };
  }

  let dataHora = new Date();
  if (data_hora_administracao !== undefined) {
    const d =
      typeof data_hora_administracao === "string" && ISO_COM_FUSO.test(data_hora_administracao)
        ? new Date(data_hora_administracao)
        : null;
    if (!d || Number.isNaN(d.getTime()) || d.getTime() > Date.now() + TOLERANCIA_FUTURO_MS) {
      return { erro: "data_hora_administracao inválida." };
    }
    dataHora = d;
  }

  let obs: string | null = null;
  if (observacoes !== undefined && observacoes !== null) {
    if (typeof observacoes !== "string" || observacoes.trim().length > 300) {
      return { erro: "observacoes inválidas." };
    }
    obs = observacoes.trim() || null;
  }

  return { dados: { status_administracao, data_hora_administracao: dataHora, observacoes: obs } };
}

type DoseCriada = Awaited<ReturnType<typeof prisma.registroDoseMedicamento.create>>;

function serializarDose(d: DoseCriada) {
  return {
    id: d.id,
    medicamento_id: d.medicamento_id,
    registrado_por_id: d.registrado_por_id,
    data_hora_administracao: d.data_hora_administracao.toISOString(),
    status_administracao: d.status_administracao,
    observacoes: d.observacoes,
    created_at: d.created_at,
  };
}

// Parte comum às duas rotas, depois da autorização: 400 (medicamentoId), 400 (corpo), 404, 409, 201.
// O medicamento é buscado com o idoso alvo no próprio where: inexistente e de outro idoso colapsam no
// mesmo 404 (um 403 separado vazaria que o id existe). Autoria é sempre req.usuarioId.
// Sem idempotência: duas doses idênticas seguidas são aceitas (limitação documentada).
async function registrarDose(req: Request, res: Response, idosoId: number) {
  const medicamentoId = idPositivo(String(req.params.medicamentoId));
  if (medicamentoId === null) return res.status(400).json({ error: "Id de medicamento inválido." });

  const validado = validarCorpoDose(req.body);
  if ("erro" in validado) return res.status(400).json({ error: validado.erro });

  const medicamento = await prisma.medicamento.findFirst({ where: { id: medicamentoId, idoso_id: idosoId } });
  if (!medicamento) return res.status(404).json({ error: "Medicamento não encontrado." });
  // ponytail: não valida a janela data_inicio/data_fim (decisão do item 5.2); só o flag ativo.
  if (!medicamento.ativo) return res.status(409).json({ error: "Medicamento inativo." });

  const dose = await prisma.registroDoseMedicamento.create({
    data: { medicamento_id: medicamento.id, registrado_por_id: req.usuarioId, ...validado.dados },
  });
  return res.status(201).json(serializarDose(dose));
}

// Item 5.2: o idoso marca dose do próprio medicamento. Qualquer outro perfil recebe 403.
// Ordem: 401, 403 (perfil), 400 (medicamentoId), 400 (corpo), 404, 409, 201.
router.post("/:medicamentoId/doses", requireAuth, async (req, res, next) => {
  try {
    const chamador = await prisma.usuario.findUnique({
      where: { id: req.usuarioId },
      select: { tipo_perfil: true },
    });
    if (chamador?.tipo_perfil !== "idoso") {
      return res.status(403).json({ error: MSG_403_DOSE });
    }
    await registrarDose(req, res, req.usuarioId);
  } catch (e) {
    next(e);
  }
});

// Item 5.2: cuidador ou familiar marca dose de um idoso vinculado. Cuidador exige tipo_vinculo E
// tipo_perfil 'cuidador' E permite_marcar_dose === true (as outras flags não abrem esta porta).
// Familiar exige tipo_vinculo E tipo_perfil 'familiar' E modo_decisao efetivo 'familiar' (sempre via
// resolverModoDecisao, nunca a coluna; NULL vale 'idoso'), como no 5.1. A checagem de ator vem antes do
// resolver. Ordem: 401, 400 (idosoId), 403 (vínculo), 403 (ator, flag ou modo_decisao), 400
// (medicamentoId), 400 (corpo), 404, 409, 201. 403 genérico, sem citar o motivo.
router.post("/idoso/:idosoId/:medicamentoId/doses", requireAuth, requireVinculoAprovado("idosoId"), async (req, res, next) => {
  try {
    const vinculo = req.vinculoAprovado;
    if (!vinculo) return res.status(403).json({ error: MSG_403_DOSE });

    const chamador = await prisma.usuario.findUnique({
      where: { id: req.usuarioId },
      select: { tipo_perfil: true },
    });
    const cuidadorAutorizado =
      vinculo.tipo_vinculo === "cuidador" &&
      chamador?.tipo_perfil === "cuidador" &&
      vinculo.permite_marcar_dose === true;
    const familiarAutorizado =
      vinculo.tipo_vinculo === "familiar" &&
      chamador?.tipo_perfil === "familiar" &&
      (await resolverModoDecisao(vinculo.idoso_id)) === "familiar";
    if (!cuidadorAutorizado && !familiarAutorizado) return res.status(403).json({ error: MSG_403_DOSE });

    await registrarDose(req, res, vinculo.idoso_id);
  } catch (e) {
    next(e);
  }
});

export default router;
