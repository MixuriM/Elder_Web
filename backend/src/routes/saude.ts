import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requireVinculoAprovado } from "../middleware/requireVinculoAprovado";
import { resolverModoDecisao } from "./vinculo";
import type { Vinculo } from "@prisma/client";

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

// Autoridade de escrita sobre saúde de um idoso, dado o vínculo aprovado do chamador.
// Cuidador: flag do vínculo (4.2). Familiar: só quando Usuario.modo_decisao efetivo é
// 'familiar' (4.2b), via resolver (nunca a coluna direto, para pegar transferência vencida).
// Reaproveitável pela edição (4.3).
async function podeEscreverSaude(v: Vinculo): Promise<boolean> {
  if (v.tipo_vinculo === "cuidador") return v.permite_registrar_saude === true;
  return (await resolverModoDecisao(v.idoso_id)) === "familiar";
}

// Itens 4.2 e 4.2b (RF-008, RF-007, RF-009, RNF-003): cuidador (com permite_registrar_saude)
// ou familiar (com modo_decisao='familiar') registra leitura do idoso vinculado. Edição (4.3)
// e histórico (4.4) ficam de fora. 403 genérico. Ordem: 401, 400 (id), 403, 400 (corpo).
router.post("/idoso/:idosoId", requireAuth, requireVinculoAprovado("idosoId"), async (req, res, next) => {
  try {
    const vinculo = req.vinculoAprovado;
    if (!vinculo || !(await podeEscreverSaude(vinculo))) {
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

// Autoridade de EDIÇÃO (item 4.3). Separada de podeEscreverSaude porque o cuidador só edita
// registro que ele mesmo criou, e só enquanto permite_registrar_saude estiver ativa (regra do
// grupo). Familiar: mesma regra de escrita (modo_decisao efetivo 'familiar'), sem checar autoria.
async function podeEditarSaude(v: Vinculo, registro: { registrado_por_id: number }): Promise<boolean> {
  if (v.tipo_vinculo === "cuidador") {
    return v.permite_registrar_saude === true && registro.registrado_por_id === v.vinculado_id;
  }
  return (await resolverModoDecisao(v.idoso_id)) === "familiar";
}

const MSG_403_EDICAO = "Sem permissão para editar registro de saúde.";
const ID_MAX = 2147483647; // int do SQL Server: acima disso o Prisma erraria com 500

// Só inteiro decimal positivo: "abc", "1.5", "-3", "0" e "1e3" viram null (400, sem consultar o banco).
function parseIdRegistro(v: string): number | null {
  if (!/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n >= 1 && n <= ID_MAX ? n : null;
}

const CAMPOS_LEITURA = ["tipo_medicao", "valor_1", "valor_2", "unidade", "data_hora", "observacoes"] as const;

// Edição parcial (padrão de PATCH /usuario/me): campo ausente (undefined) mantém o valor atual do
// registro; valor_2/observacoes null explícito limpam. Monta o corpo completo a partir do registro
// e revalida com validarCorpoLeitura, então regras e mensagens são as mesmas do POST.
function validarCorpoEdicao(body: unknown, atual: RegistroCriado): { erro: string } | { dados: DadosLeitura } {
  const enviado = (body ?? {}) as Record<string, unknown>;
  if (CAMPOS_LEITURA.every((c) => enviado[c] === undefined)) {
    return { erro: "Nenhum campo de leitura informado." };
  }
  const mesclado: Record<string, unknown> = {
    tipo_medicao: atual.tipo_medicao,
    valor_1: Number(atual.valor_1),
    valor_2: atual.valor_2 === null ? null : Number(atual.valor_2),
    unidade: atual.unidade,
    data_hora: atual.data_hora.toISOString(),
    observacoes: atual.observacoes,
  };
  for (const c of CAMPOS_LEITURA) if (enviado[c] !== undefined) mesclado[c] = enviado[c];
  return validarCorpoLeitura(mesclado);
}

// RNF-006: o modelo guarda só o ÚLTIMO editor (editado_por_id); o valor sobrescrito numa edição
// se perde. Decisão do grupo: aceito como risco por ora, sem tabela de auditoria.
// Edição é parcial (validarCorpoEdicao): ao menos um campo de leitura é obrigatório.

// Item 4.3 (RF-009, RNF-006): idoso edita o próprio registro. Ordem: 401, 400 (id), 404 (inexistente OU
// de outro idoso), 400 (corpo). Dono = registro.idoso_id igual a req.usuarioId; sem vínculo, sem tipo_perfil.
router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = parseIdRegistro(req.params.id);
    if (id === null) return res.status(400).json({ error: "Id de registro inválido." });

    const registro = await prisma.registroSaude.findUnique({ where: { id } });
    // Inexistente e "de outro idoso" colapsam no mesmo 404: 403 vazaria que o id existe.
    if (!registro || registro.idoso_id !== req.usuarioId) {
      return res.status(404).json({ error: "Registro não encontrado." });
    }

    const validado = validarCorpoEdicao(req.body, registro);
    if ("erro" in validado) return res.status(400).json({ error: validado.erro });

    // idoso_id e registrado_por_id nunca entram no update; editado_por_id sempre do token.
    const r = await prisma.registroSaude.update({
      where: { id },
      data: { ...validado.dados, editado_por_id: req.usuarioId },
    });
    res.json(serializarRegistro(r));
  } catch (e) {
    next(e);
  }
});

// Item 4.3: cuidador ou familiar edita registro de um idoso vinculado. Ordem: 401, 400 (idosoId),
// 403 (vínculo), 400 (id), 404 (inexistente OU de outro idoso, mesma mensagem), 403 (autoridade), 400 (corpo).
router.patch("/idoso/:idosoId/:id", requireAuth, requireVinculoAprovado("idosoId"), async (req, res, next) => {
  try {
    const vinculo = req.vinculoAprovado;
    if (!vinculo) return res.status(403).json({ error: MSG_403_EDICAO });

    const id = parseIdRegistro(req.params.id);
    if (id === null) return res.status(400).json({ error: "Id de registro inválido." });

    const registro = await prisma.registroSaude.findUnique({ where: { id } });
    if (!registro || registro.idoso_id !== vinculo.idoso_id) {
      return res.status(404).json({ error: "Registro não encontrado." });
    }
    if (!(await podeEditarSaude(vinculo, registro))) {
      return res.status(403).json({ error: MSG_403_EDICAO });
    }

    const validado = validarCorpoEdicao(req.body, registro);
    if ("erro" in validado) return res.status(400).json({ error: validado.erro });

    const r = await prisma.registroSaude.update({
      where: { id },
      data: { ...validado.dados, editado_por_id: req.usuarioId },
    });
    res.json(serializarRegistro(r));
  } catch (e) {
    next(e);
  }
});

export default router;
