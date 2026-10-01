import { Router } from "express";
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

export default router;
