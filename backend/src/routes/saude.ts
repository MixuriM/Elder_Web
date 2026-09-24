import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requireVinculoAprovado } from "../middleware/requireVinculoAprovado";

const router = Router();

const LIMITE_DECIMAL = 9999.99; // decimal(6,2)
const TOLERANCIA_FUTURO_MS = 5 * 60 * 1000;
// ISO 8601 com Z ou offset explícito: sem fuso o servidor (UTC) leria a hora local como UTC.
const ISO_COM_FUSO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

// Mensagens fixas: nunca incluem o valor enviado (dado sensível, LGPD Art. 5º, XI).
function textoObrigatorio(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t && t.length <= max ? t : null;
}

// Regex sobre String(v), não multiplicação: evita erro de ponto flutuante nas casas decimais.
function valorValido(v: unknown): v is number {
  return (
    typeof v === "number" &&
    Number.isFinite(v) &&
    v >= 0 &&
    v <= LIMITE_DECIMAL &&
    /^\d+(\.\d{1,2})?$/.test(String(v))
  );
}

type DadosLeitura = {
  tipo_medicao: string;
  valor_1: number;
  valor_2: number | null;
  unidade: string;
  data_hora: Date;
  observacoes: string | null;
};

// Valida e normaliza o corpo de uma leitura (compartilhado por POST / e POST /idoso/:idosoId).
// Mensagens fixas: nunca incluem o valor enviado.
function validarCorpoLeitura(body: unknown): { erro: string } | { dados: DadosLeitura } {
  const { tipo_medicao, valor_1, valor_2, unidade, data_hora, observacoes } =
    (body ?? {}) as Record<string, unknown>;

  const tipoMedicao = textoObrigatorio(tipo_medicao, 50);
  if (!tipoMedicao) return { erro: "tipo_medicao inválido." };
  if (!valorValido(valor_1)) return { erro: "valor_1 inválido." };
  if (valor_2 !== undefined && valor_2 !== null && !valorValido(valor_2)) {
    return { erro: "valor_2 inválido." };
  }
  const unidadeValida = textoObrigatorio(unidade, 20);
  if (!unidadeValida) return { erro: "unidade inválida." };

  let obs: string | null = null;
  if (observacoes !== undefined && observacoes !== null) {
    if (typeof observacoes !== "string" || observacoes.trim().length > 300) {
      return { erro: "observacoes inválidas." };
    }
    obs = observacoes.trim() || null;
  }

  let dataHora = new Date();
  if (data_hora !== undefined) {
    const d = typeof data_hora === "string" && ISO_COM_FUSO.test(data_hora) ? new Date(data_hora) : null;
    if (!d || Number.isNaN(d.getTime()) || d.getTime() > Date.now() + TOLERANCIA_FUTURO_MS) {
      return { erro: "data_hora inválida." };
    }
    dataHora = d;
  }

  return {
    dados: {
      tipo_medicao: tipoMedicao,
      valor_1,
      valor_2: (valor_2 as number | null | undefined) ?? null,
      unidade: unidadeValida,
      data_hora: dataHora,
      observacoes: obs,
    },
  };
}

type RegistroCriado = Awaited<ReturnType<typeof prisma.registroSaude.create>>;

// Decimal do Prisma serializa como string: converte, mantendo valor_2 null (Number(null) = 0).
function serializarRegistro(r: RegistroCriado) {
  return {
    id: r.id,
    idoso_id: r.idoso_id,
    registrado_por_id: r.registrado_por_id,
    editado_por_id: r.editado_por_id,
    tipo_medicao: r.tipo_medicao,
    valor_1: Number(r.valor_1),
    valor_2: r.valor_2 === null ? null : Number(r.valor_2),
    unidade: r.unidade,
    data_hora: r.data_hora,
    observacoes: r.observacoes,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

// Item 4.1 (RF-007, RNF-006): só o idoso registra a própria leitura. Cuidador (4.2) e
// familiar (item futuro) recebem 403 por enquanto. Autoria sempre de req.usuarioId.
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const chamador = await prisma.usuario.findUnique({
      where: { id: req.usuarioId },
      select: { tipo_perfil: true },
    });
    if (chamador?.tipo_perfil !== "idoso") {
      return res.status(403).json({ error: "Sem permissão para registrar leitura de saúde." });
    }

    const validado = validarCorpoLeitura(req.body);
    if ("erro" in validado) return res.status(400).json({ error: validado.erro });

    const r = await prisma.registroSaude.create({
      data: {
        idoso_id: req.usuarioId,
        registrado_por_id: req.usuarioId,
        editado_por_id: req.usuarioId,
        ...validado.dados,
      },
    });

    res.status(201).json(serializarRegistro(r));
  } catch (e) {
    next(e);
  }
});

// Item 4.2 (RF-008, RNF-003): cuidador registra leitura do idoso vinculado, só com
// permite_registrar_saude. Familiar (4.2b, modo_decisao), edição (4.3) e histórico (4.4)
// ficam de fora: vínculo de familiar recebe 403 aqui. Ordem: 401, 400 (id), 403, 400 (corpo).
router.post("/idoso/:idosoId", requireAuth, requireVinculoAprovado("idosoId"), async (req, res, next) => {
  try {
    const vinculo = req.vinculoAprovado;
    if (!vinculo || vinculo.tipo_vinculo !== "cuidador" || vinculo.permite_registrar_saude !== true) {
      return res.status(403).json({ error: "Sem permissão para registrar leitura de saúde." });
    }

    const validado = validarCorpoLeitura(req.body);
    if ("erro" in validado) return res.status(400).json({ error: validado.erro });

    const r = await prisma.registroSaude.create({
      data: {
        idoso_id: vinculo.idoso_id,
        registrado_por_id: req.usuarioId,
        editado_por_id: req.usuarioId,
        ...validado.dados,
      },
    });

    res.status(201).json(serializarRegistro(r));
  } catch (e) {
    next(e);
  }
});

export default router;
