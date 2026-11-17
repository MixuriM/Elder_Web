import { inspect } from "node:util";
import request from "supertest";

// Fase 11 (11.1): PATCH e DELETE de medicamento, por /remedios/:medicamentoId (idoso) e
// /remedios/idoso/:idosoId/:medicamentoId (vínculo). Autoridade de editar e excluir = a de CRIAR (item 5.1): idoso só o
// próprio; familiar exige tipo_vinculo E tipo_perfil 'familiar' E modo_decisao efetivo 'familiar' (via resolver); cuidador
// NUNCA, com qualquer vínculo e flags, e o resolver nunca é chamado para ele. Excluir apaga as doses junto, na MESMA
// transação (doses primeiro). Todos os ids e valores são FICTÍCIOS.

const verifyIdToken = jest.fn();
const findFirstUsuario = jest.fn();
const findUniqueUsuario = jest.fn();
const updateUsuario = jest.fn();
const findFirstVinculo = jest.fn();
const countVinculo = jest.fn();
const findFirstMed = jest.fn();
const updateMed = jest.fn();
const transacao = jest.fn();
const resolverModoDecisaoMock = jest.fn();

jest.mock("../lib/firebaseAdmin", () => ({
  auth: { verifyIdToken: (...args: unknown[]) => verifyIdToken(...args) },
}));
// Sem registroDoseMedicamento no nível de cima de propósito: apagar dose fora da transação vira TypeError (500).
jest.mock("../lib/prisma", () => ({
  prisma: {
    usuario: {
      findFirst: (...args: unknown[]) => findFirstUsuario(...args),
      findUnique: (...args: unknown[]) => findUniqueUsuario(...args),
      update: (...args: unknown[]) => updateUsuario(...args),
    },
    vinculo: {
      findFirst: (...args: unknown[]) => findFirstVinculo(...args),
      count: (...args: unknown[]) => countVinculo(...args),
    },
    medicamento: {
      findFirst: (...args: unknown[]) => findFirstMed(...args),
      update: (...args: unknown[]) => updateMed(...args),
    },
    $transaction: (...args: unknown[]) => transacao(...args),
  },
}));
// Só resolverModoDecisao é trocada: o resto de vinculo.ts segue real.
jest.mock("./vinculo", () => ({
  __esModule: true,
  ...jest.requireActual("./vinculo"),
  resolverModoDecisao: (...args: unknown[]) => resolverModoDecisaoMock(...args),
}));

import app from "../app";
const resolverReal: (id: number) => Promise<"idoso" | "familiar"> = jest.requireActual("./vinculo").resolverModoDecisao;

type Perfil = "idoso" | "cuidador" | "familiar";

const IDOSO_A = 5;
const IDOSO_B = 6;
const CUIDADOR = 10;
const FAMILIAR = 20;
const MED = 100;
const NOME_ORIGINAL = "Remedio Ficticio Original";
const MSG_403_EDICAO = "Sem permissão para editar medicamento.";
const MSG_403_EXCLUSAO = "Sem permissão para excluir medicamento.";
const MSG_404 = { error: "Medicamento não encontrado." };

type VinculoFake = {
  id: number;
  idoso_id: number;
  vinculado_id: number;
  tipo_vinculo: "cuidador" | "familiar";
  status: "pendente" | "aprovado" | "recusado";
  permite_registrar_saude: boolean;
  permite_marcar_dose: boolean;
  permite_criar_evento_cuidado: boolean;
};

function vinculo(over: Partial<VinculoFake> = {}): VinculoFake {
  return {
    id: 1,
    idoso_id: IDOSO_A,
    vinculado_id: FAMILIAR,
    tipo_vinculo: "familiar",
    status: "aprovado",
    permite_registrar_saude: false,
    permite_marcar_dose: false,
    permite_criar_evento_cuidado: false,
    ...over,
  };
}

function vinculoCuidador(over: Partial<VinculoFake> = {}): VinculoFake {
  return vinculo({ vinculado_id: CUIDADOR, tipo_vinculo: "cuidador", ...over });
}

const FLAGS = ["permite_registrar_saude", "permite_marcar_dose", "permite_criar_evento_cuidado"] as const;
const COMBINACOES_FLAGS = Array.from({ length: 8 }, (_, i) =>
  Object.fromEntries(FLAGS.map((f, bit) => [f, Boolean(i & (1 << bit))])),
) as Record<(typeof FLAGS)[number], boolean>[];

function fakeVinculos(linhas: VinculoFake[]) {
  findFirstVinculo.mockImplementation(
    async ({ where }: { where: { idoso_id: number; vinculado_id: number; status: string } }) =>
      linhas.find(
        (v) => v.idoso_id === where.idoso_id && v.vinculado_id === where.vinculado_id && v.status === where.status,
      ) ?? null,
  );
}

const ESTADO_NEUTRO = {
  modo_decisao: null,
  modo_decisao_solicitado: null,
  modo_decisao_solicitado_por_id: null,
  modo_decisao_solicitado_em: null,
  modo_decisao_expira_em: null,
  modo_decisao_segunda_confirmacao_id: null,
  modo_decisao_alterado_por_id: null,
  modo_decisao_alterado_em: null,
  modo_decisao_motivo: null,
};

const perfis: Record<number, Perfil> = {};
let estadoModo: Record<string, unknown> = ESTADO_NEUTRO;

function fakeUsuarios() {
  findUniqueUsuario.mockImplementation(
    async ({ where, select }: { where: { id: number }; select: Record<string, boolean> }) => {
      if (select?.tipo_perfil) return perfis[where.id] ? { tipo_perfil: perfis[where.id] } : null;
      return estadoModo;
    },
  );
}

type MedFake = {
  id: number;
  idoso_id: number;
  criado_por_id: number;
  nome: string;
  dosagem: string;
  frequencia: string;
  data_inicio: Date;
  data_fim: Date | null;
  observacoes: string | null;
  ativo: boolean;
  editado_por_id: number | null;
  created_at: Date;
  updated_at: Date;
};

type DoseFake = { id: number; medicamento_id: number };

function medicamento(over: Partial<MedFake> = {}): MedFake {
  return {
    id: MED,
    idoso_id: IDOSO_A,
    criado_por_id: IDOSO_A,
    nome: NOME_ORIGINAL,
    dosagem: "10 mg",
    frequencia: "1x ao dia",
    data_inicio: new Date("2026-10-01T00:00:00Z"),
    data_fim: new Date("2026-10-31T00:00:00Z"),
    observacoes: "Observacao Ficticia",
    ativo: true,
    editado_por_id: null,
    created_at: new Date("2026-10-01T12:00:00Z"),
    updated_at: new Date("2026-10-01T12:00:00Z"),
    ...over,
  };
}

// Armazéns em memória: tudo filtra de verdade pelo where (undefined é ignorado, como no Prisma). A transação é de
// verdade no fake: tira um retrato dos dois armazéns, roda a função e, se ela lançar, restaura o retrato.
let meds: MedFake[] = [];
let doses: DoseFake[] = [];
let operacoes: string[] = [];
let wheres: Record<string, unknown> = {};
let falharNoMedicamento: Error | null = null;
const casa = (linha: object, where: Record<string, unknown>) =>
  Object.entries(where).every(([k, v]) => v === undefined || (linha as Record<string, unknown>)[k] === v);

function fakeArmazens(m: MedFake[], d: DoseFake[] = []) {
  meds = m;
  doses = d;
  operacoes = [];
  wheres = {};
  falharNoMedicamento = null;
  findFirstMed.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => meds.find((x) => casa(x, where)) ?? null);
  updateMed.mockImplementation(async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => {
    const i = meds.findIndex((x) => x.id === where.id);
    meds[i] = { ...meds[i], ...data, updated_at: new Date("2026-10-11T12:00:00Z") } as MedFake;
    return meds[i];
  });
  const tx = {
    registroDoseMedicamento: {
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        operacoes.push("doses");
        wheres.doses = where;
        const antes = doses.length;
        doses = doses.filter((x) => !casa(x, where));
        return { count: antes - doses.length };
      },
    },
    medicamento: {
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        operacoes.push("medicamento");
        wheres.medicamento = where;
        if (falharNoMedicamento) throw falharNoMedicamento;
        const antes = meds.length;
        meds = meds.filter((x) => !casa(x, where));
        return { count: antes - meds.length };
      },
    },
  };
  transacao.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => {
    const retratoMeds = [...meds];
    const retratoDoses = [...doses];
    try {
      return await fn(tx);
    } catch (e) {
      meds = retratoMeds;
      doses = retratoDoses;
      throw e;
    }
  });
}

function logadoComo(id: number, perfil: Perfil) {
  perfis[id] = perfil;
  verifyIdToken.mockResolvedValue({ uid: `uid-${id}` });
  findFirstUsuario.mockResolvedValue({ id, firebase_uid: `uid-${id}` });
}

function modoDoIdoso(modo: "idoso" | "familiar") {
  resolverModoDecisaoMock.mockResolvedValue(modo);
}

const auth = (r: request.Test) => r.set("Authorization", "Bearer x");
const patchIdoso = (id: number | string, body: unknown = { dosagem: "20 mg" }) =>
  auth(request(app).patch(`/remedios/${id}`)).send(body as object);
const patchOutro = (idoso: number | string, id: number | string, body: unknown = { dosagem: "20 mg" }) =>
  auth(request(app).patch(`/remedios/idoso/${idoso}/${id}`)).send(body as object);
const delIdoso = (id: number | string) => auth(request(app).delete(`/remedios/${id}`));
const delOutro = (idoso: number | string, id: number | string) => auth(request(app).delete(`/remedios/idoso/${idoso}/${id}`));

const DOSES_DO_MED: DoseFake[] = [
  { id: 1, medicamento_id: MED },
  { id: 2, medicamento_id: MED },
];
const DOSE_DE_OUTRO: DoseFake = { id: 3, medicamento_id: 999 };

function dadosDoUpdate(): Record<string, unknown> {
  return updateMed.mock.calls[0][0].data;
}

function expectNaoEditou(res: request.Response, status: number) {
  expect(res.status).toBe(status);
  expect(updateMed).not.toHaveBeenCalled();
  expect(meds.find((m) => m.id === MED)?.dosagem).toBe("10 mg");
}

function expectIntacto(res: request.Response, status: number) {
  expect(res.status).toBe(status);
  expect(transacao).not.toHaveBeenCalled();
  expect(meds.some((m) => m.id === MED)).toBe(true);
  expect(doses.filter((d) => d.medicamento_id === MED)).toHaveLength(2);
}

function expectApagou(res: request.Response) {
  expect(res.status).toBe(204);
  expect(res.text).toBe("");
  expect(transacao).toHaveBeenCalledTimes(1);
  expect(meds.some((m) => m.id === MED)).toBe(false);
  expect(doses.filter((d) => d.medicamento_id === MED)).toHaveLength(0);
  expect(doses).toContainEqual(DOSE_DE_OUTRO);
}

beforeEach(() => {
  [
    verifyIdToken,
    findFirstUsuario,
    findUniqueUsuario,
    updateUsuario,
    findFirstVinculo,
    countVinculo,
    findFirstMed,
    updateMed,
    transacao,
    resolverModoDecisaoMock,
  ].forEach((m) => m.mockReset());
  Object.keys(perfis).forEach((k) => delete perfis[Number(k)]);
  estadoModo = ESTADO_NEUTRO;
  fakeUsuarios();
  fakeArmazens([medicamento()], [...DOSES_DO_MED, DOSE_DE_OUTRO]);
});

describe("PATCH /remedios/:medicamentoId, idoso edita o próprio medicamento (Fase 11)", () => {
  beforeEach(() => logadoComo(IDOSO_A, "idoso"));

  it("200: aplica o corpo, editado_por_id do token, devolve o medicamento serializado sem doses", async () => {
    const res = await patchIdoso(MED, {
      nome: "  Novo Nome  ",
      dosagem: "20 mg",
      frequencia: "2x ao dia",
      data_inicio: "2026-10-02",
      data_fim: "2026-11-30",
      observacoes: "  Nova Obs  ",
    });
    expect(res.status).toBe(200);
    const { where, data } = updateMed.mock.calls[0][0];
    expect(where).toEqual({ id: MED });
    expect(Object.keys(data).sort()).toEqual(
      ["data_fim", "data_inicio", "dosagem", "editado_por_id", "frequencia", "nome", "observacoes"],
    );
    expect(data.editado_por_id).toBe(IDOSO_A);
    expect(res.body).toMatchObject({
      id: MED,
      idoso_id: IDOSO_A,
      criado_por_id: IDOSO_A,
      nome: "Novo Nome",
      dosagem: "20 mg",
      frequencia: "2x ao dia",
      data_inicio: "2026-10-02",
      data_fim: "2026-11-30",
      observacoes: "Nova Obs",
      ativo: true,
      editado_por_id: IDOSO_A,
    });
    expect(res.body).not.toHaveProperty("doses");
  });

  it("edição parcial: campo ausente mantém o valor atual", async () => {
    const res = await patchIdoso(MED, { dosagem: "20 mg" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      nome: NOME_ORIGINAL,
      dosagem: "20 mg",
      frequencia: "1x ao dia",
      data_inicio: "2026-10-01",
      data_fim: "2026-10-31",
      observacoes: "Observacao Ficticia",
    });
  });

  it("null explícito limpa só os campos opcionais (data_fim e observacoes)", async () => {
    const res = await patchIdoso(MED, { data_fim: null, observacoes: null });
    expect(res.status).toBe(200);
    expect(dadosDoUpdate().data_fim).toBeNull();
    expect(dadosDoUpdate().observacoes).toBeNull();
    expect(res.body).toMatchObject({ data_fim: null, observacoes: null, nome: NOME_ORIGINAL });
  });

  it.each([
    ["nome", "nome inválido."],
    ["dosagem", "dosagem inválida."],
    ["frequencia", "frequencia inválida."],
    ["data_inicio", "data_inicio inválida."],
  ])("null explícito em %s (obrigatório) dá 400, não limpa", async (campo, msg) => {
    const res = await patchIdoso(MED, { [campo]: null });
    expectNaoEditou(res, 400);
    expect(res.body).toEqual({ error: msg });
  });

  it.each([
    ["data_inicio depois da data_fim atual", { data_inicio: "2026-11-15" }],
    ["data_fim antes da data_inicio atual", { data_fim: "2026-09-30" }],
  ])("%s: 400 data_fim inválida, mesmo validador do POST", async (_rotulo, corpo) => {
    const res = await patchIdoso(MED, corpo);
    expectNaoEditou(res, 400);
    expect(res.body).toEqual({ error: "data_fim inválida." });
  });

  it("data_fim igual à data_inicio é aceita (como no POST)", async () => {
    expect((await patchIdoso(MED, { data_fim: "2026-10-01" })).status).toBe(200);
  });

  it.each([["corpo vazio", {}], ["só campos forjados", { id: 1, idoso_id: IDOSO_B, ativo: false }], ["array", []]])(
    "400 sem nenhum campo de medicamento (%s)",
    async (_rotulo, corpo) => {
      const res = await patchIdoso(MED, corpo);
      expectNaoEditou(res, 400);
      expect(res.body).toEqual({ error: "Nenhum campo de medicamento informado." });
    },
  );

  it.each([
    ["nome com 151", { nome: "a".repeat(151) }, "nome inválido."],
    ["nome só espaços", { nome: "   " }, "nome inválido."],
    ["nome número", { nome: 5 }, "nome inválido."],
    ["dosagem com 51", { dosagem: "a".repeat(51) }, "dosagem inválida."],
    ["frequencia com 101", { frequencia: "a".repeat(101) }, "frequencia inválida."],
    ["data_inicio 30/02", { data_inicio: "2026-02-30" }, "data_inicio inválida."],
    ["data_inicio com horário", { data_inicio: "2026-10-01T00:00:00Z" }, "data_inicio inválida."],
    ["data_fim 31/04", { data_fim: "2026-04-31" }, "data_fim inválida."],
    ["observacoes com 501", { observacoes: "a".repeat(501) }, "observacoes inválidas."],
    ["observacoes número", { observacoes: 7 }, "observacoes inválidas."],
  ])("mesma regra e mensagem do POST: %s", async (_rotulo, corpo, msg) => {
    const res = await patchIdoso(MED, corpo);
    expectNaoEditou(res, 400);
    expect(res.body).toEqual({ error: msg });
  });

  it("limites aceitos no POST também são aceitos aqui (150, 50, 100 e 500 caracteres)", async () => {
    const res = await patchIdoso(MED, {
      nome: "a".repeat(150),
      dosagem: "a".repeat(50),
      frequencia: "a".repeat(100),
      observacoes: "a".repeat(500),
    });
    expect(res.status).toBe(200);
  });

  it("ativo, autoria e dono do corpo são ignorados: nunca entram no update", async () => {
    fakeArmazens([medicamento({ ativo: true })]);
    const res = await patchIdoso(MED, {
      dosagem: "20 mg",
      ativo: false,
      idoso_id: IDOSO_B,
      criado_por_id: 77,
      editado_por_id: 77,
      id: 999,
      created_at: "2000-01-01T00:00:00Z",
    });
    expect(res.status).toBe(200);
    const data = dadosDoUpdate();
    expect(data.editado_por_id).toBe(IDOSO_A);
    for (const k of ["ativo", "idoso_id", "criado_por_id", "id", "created_at", "updated_at"]) expect(data).not.toHaveProperty(k);
    expect(meds[0]).toMatchObject({ ativo: true, idoso_id: IDOSO_A, criado_por_id: IDOSO_A });
    expect(res.body.ativo).toBe(true);
  });

  it("não consulta vínculo nem modo_decisao", async () => {
    expect((await patchIdoso(MED)).status).toBe(200);
    expect(findFirstVinculo).not.toHaveBeenCalled();
    expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
  });

  it("medicamento de outro idoso e inexistente: 404 idêntico, mesmo com corpo inválido, e nada muda", async () => {
    logadoComo(IDOSO_B, "idoso");
    const deOutro = await patchIdoso(MED, { nome: "" });
    const inexistente = await patchIdoso(999, { nome: "" });
    expectNaoEditou(deOutro, 404);
    expect(inexistente.status).toBe(404);
    expect(deOutro.body).toEqual(MSG_404);
    expect(inexistente.body).toEqual(MSG_404);
    expect(findFirstMed.mock.calls[0][0].where).toEqual({ id: MED, idoso_id: IDOSO_B });
  });

  it.each(["abc", "1.5", "-3", "0", "1e3", "99999999999"])("400 com id inválido (%s), sem consultar o banco", async (id) => {
    const res = await patchIdoso(id);
    expect(res.status).toBe(400);
    expect(findFirstMed).not.toHaveBeenCalled();
    expect(updateMed).not.toHaveBeenCalled();
  });

  it("401 sem token", async () => {
    expectNaoEditou(await request(app).patch(`/remedios/${MED}`).send({ dosagem: "20 mg" }), 401);
  });

  it.each([
    ["cuidador", CUIDADOR],
    ["familiar", FAMILIAR],
  ] as const)("%s pela rota própria: 404, mesmo com vínculo aprovado e tudo liberado", async (perfil, id) => {
    fakeVinculos([vinculoCuidador(COMBINACOES_FLAGS[7]), vinculo()]);
    modoDoIdoso("familiar");
    logadoComo(id, perfil);
    expectNaoEditou(await patchIdoso(MED), 404);
  });
});

describe("DELETE /remedios/:medicamentoId, idoso exclui o próprio medicamento (Fase 11)", () => {
  beforeEach(() => logadoComo(IDOSO_A, "idoso"));

  it("204 sem corpo: apaga as doses dele e o medicamento, e só eles, na mesma transação, doses primeiro", async () => {
    expectApagou(await delIdoso(MED));
    expect(operacoes).toEqual(["doses", "medicamento"]);
  });

  it("transação interativa: nenhuma exclusão fora de $transaction", async () => {
    await delIdoso(MED);
    expect(transacao).toHaveBeenCalledTimes(1);
    expect(typeof transacao.mock.calls[0][0]).toBe("function");
  });

  it("os deletes levam medicamento_id (doses) e id com idoso_id (medicamento) no where", async () => {
    await delIdoso(MED);
    expect(wheres).toEqual({ doses: { medicamento_id: MED }, medicamento: { id: MED, idoso_id: IDOSO_A } });
  });

  it("medicamento sem doses também é apagado", async () => {
    fakeArmazens([medicamento()], [DOSE_DE_OUTRO]);
    const res = await delIdoso(MED);
    expect(res.status).toBe(204);
    expect(meds).toEqual([]);
    expect(doses).toEqual([DOSE_DE_OUTRO]);
  });

  it("se a segunda operação (medicamento) falha, nada é apagado: as doses voltam e a resposta é 500 genérico", async () => {
    falharNoMedicamento = new Error("falha simulada no segundo delete");
    const res = await delIdoso(MED);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Erro interno." });
    expect(operacoes).toEqual(["doses", "medicamento"]);
    expect(meds.some((m) => m.id === MED)).toBe(true);
    expect(doses.filter((d) => d.medicamento_id === MED)).toHaveLength(2);
    expect(doses).toContainEqual(DOSE_DE_OUTRO);
  });

  it("medicamento inativo também pode ser excluído", async () => {
    fakeArmazens([medicamento({ ativo: false })], [...DOSES_DO_MED, DOSE_DE_OUTRO]);
    expectApagou(await delIdoso(MED));
  });

  it("não consulta vínculo nem modo_decisao", async () => {
    expectApagou(await delIdoso(MED));
    expect(findFirstVinculo).not.toHaveBeenCalled();
    expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
  });

  it("medicamento de outro idoso e inexistente: 404 idêntico, sem abrir transação, e as doses do outro permanecem", async () => {
    logadoComo(IDOSO_B, "idoso");
    const deOutro = await delIdoso(MED);
    const inexistente = await delIdoso(999);
    expectIntacto(deOutro, 404);
    expect(inexistente.status).toBe(404);
    expect(deOutro.body).toEqual(MSG_404);
    expect(inexistente.body).toEqual(MSG_404);
  });

  it("segundo DELETE do mesmo medicamento dá 404", async () => {
    expect((await delIdoso(MED)).status).toBe(204);
    const segundo = await delIdoso(MED);
    expect(segundo.status).toBe(404);
    expect(segundo.body).toEqual(MSG_404);
  });

  it("apagado por outra chamada entre a leitura e a transação: 404, não 500", async () => {
    findFirstMed.mockResolvedValueOnce(medicamento());
    meds = [];
    const res = await delIdoso(MED);
    expect(res.status).toBe(404);
    expect(res.body).toEqual(MSG_404);
  });

  it.each(["abc", "1.5", "-3", "0", "1e3"])("400 com id inválido (%s), sem consultar o banco", async (id) => {
    const res = await delIdoso(id);
    expect(res.status).toBe(400);
    expect(findFirstMed).not.toHaveBeenCalled();
    expect(transacao).not.toHaveBeenCalled();
  });

  it("401 sem token", async () => {
    expectIntacto(await request(app).delete(`/remedios/${MED}`), 401);
  });

  it.each([
    ["cuidador", CUIDADOR],
    ["familiar", FAMILIAR],
  ] as const)("%s pela rota própria: 404 e nada é apagado", async (perfil, id) => {
    fakeVinculos([vinculoCuidador(COMBINACOES_FLAGS[7]), vinculo()]);
    modoDoIdoso("familiar");
    logadoComo(id, perfil);
    expectIntacto(await delIdoso(MED), 404);
  });
});

describe("PATCH /remedios/idoso/:idosoId/:medicamentoId, cuidador e familiar (Fase 11)", () => {
  describe("cuidador: NUNCA edita (regra fixa de ator)", () => {
    beforeEach(() => logadoComo(CUIDADOR, "cuidador"));

    it.each(COMBINACOES_FLAGS)("vínculo aprovado com flags %o: 403, nada muda e sem resolver", async (flags) => {
      fakeVinculos([vinculoCuidador(flags)]);
      modoDoIdoso("familiar");
      const res = await patchOutro(IDOSO_A, MED);
      expectNaoEditou(res, 403);
      expect(res.body).toEqual({ error: MSG_403_EDICAO });
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
      expect(await findFirstVinculo.mock.results[0].value).not.toBeNull();
      expect(await findFirstMed.mock.results[0].value).not.toBeNull();
    });

    it("medicamento criado pelo próprio cuidador: segue 403 (autoria não abre a porta)", async () => {
      fakeVinculos([vinculoCuidador(COMBINACOES_FLAGS[7])]);
      fakeArmazens([medicamento({ criado_por_id: CUIDADOR })], DOSES_DO_MED);
      expectNaoEditou(await patchOutro(IDOSO_A, MED), 403);
    });

    it("perfil cuidador com tipo_vinculo familiar na linha: 403 (o perfil também conta)", async () => {
      fakeVinculos([vinculo({ vinculado_id: CUIDADOR, tipo_vinculo: "familiar" })]);
      modoDoIdoso("familiar");
      expectNaoEditou(await patchOutro(IDOSO_A, MED), 403);
    });

    it("corpo inválido com cuidador dá 403, não 400 (autorização antes do corpo)", async () => {
      fakeVinculos([vinculoCuidador(COMBINACOES_FLAGS[7])]);
      expectNaoEditou(await patchOutro(IDOSO_A, MED, { nome: "" }), 403);
    });
  });

  describe("familiar", () => {
    beforeEach(() => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
    });

    it("200 com modo 'familiar': editado_por_id do familiar, criado_por_id e idoso_id intactos", async () => {
      modoDoIdoso("familiar");
      const res = await patchOutro(IDOSO_A, MED, { nome: "Nome Novo" });
      expect(res.status).toBe(200);
      expect(updateMed.mock.calls[0][0].where).toEqual({ id: MED });
      expect(dadosDoUpdate().editado_por_id).toBe(FAMILIAR);
      expect(res.body).toMatchObject({ id: MED, idoso_id: IDOSO_A, criado_por_id: IDOSO_A, editado_por_id: FAMILIAR, nome: "Nome Novo" });
      expect(resolverModoDecisaoMock).toHaveBeenCalledWith(IDOSO_A);
    });

    it("idoso_id, criado_por_id, editado_por_id e ativo do corpo são ignorados", async () => {
      modoDoIdoso("familiar");
      const res = await patchOutro(IDOSO_A, MED, { dosagem: "20 mg", idoso_id: IDOSO_B, criado_por_id: 77, editado_por_id: 77, ativo: false });
      expect(res.status).toBe(200);
      const data = dadosDoUpdate();
      expect(data.editado_por_id).toBe(FAMILIAR);
      for (const k of ["ativo", "idoso_id", "criado_por_id"]) expect(data).not.toHaveProperty(k);
      expect(meds[0]).toMatchObject({ ativo: true, idoso_id: IDOSO_A, criado_por_id: IDOSO_A });
    });

    it("403 com modo 'idoso', genérico, sem citar modo_decisao", async () => {
      modoDoIdoso("idoso");
      const res = await patchOutro(IDOSO_A, MED);
      expectNaoEditou(res, 403);
      expect(res.body).toEqual({ error: MSG_403_EDICAO });
      expect(JSON.stringify(res.body)).not.toMatch(/modo_decisao|permite_/i);
    });

    it("403 com modo_decisao NULL (resolver real: NULL vale 'idoso')", async () => {
      resolverModoDecisaoMock.mockImplementation((id: number) => resolverReal(id));
      estadoModo = ESTADO_NEUTRO;
      expectNaoEditou(await patchOutro(IDOSO_A, MED), 403);
      estadoModo = { ...ESTADO_NEUTRO, modo_decisao: "familiar" };
      expect((await patchOutro(IDOSO_A, MED)).status).toBe(200);
    });

    it("403 com tipo_vinculo cuidador na linha e perfil familiar (os dois precisam ser 'familiar')", async () => {
      fakeVinculos([vinculo({ tipo_vinculo: "cuidador" })]);
      modoDoIdoso("familiar");
      expectNaoEditou(await patchOutro(IDOSO_A, MED), 403);
    });

    it("403 com perfil cuidador e tipo_vinculo familiar na linha", async () => {
      logadoComo(FAMILIAR, "cuidador");
      modoDoIdoso("familiar");
      expectNaoEditou(await patchOutro(IDOSO_A, MED), 403);
    });

    it("sem autoridade, corpo inválido dá 403, não 400", async () => {
      modoDoIdoso("idoso");
      expectNaoEditou(await patchOutro(IDOSO_A, MED, { nome: "" }), 403);
    });

    it("com autoridade, corpo inválido dá 400 com a mensagem do POST", async () => {
      modoDoIdoso("familiar");
      const res = await patchOutro(IDOSO_A, MED, { nome: "" });
      expectNaoEditou(res, 400);
      expect(res.body).toEqual({ error: "nome inválido." });
    });
  });

  describe("vínculo, registro e ordem", () => {
    beforeEach(() => logadoComo(FAMILIAR, "familiar"));

    it.each(["pendente", "recusado"] as const)("403 com vínculo %s", async (status) => {
      fakeVinculos([vinculo({ status })]);
      modoDoIdoso("familiar");
      expectNaoEditou(await patchOutro(IDOSO_A, MED), 403);
    });

    it("403 no acesso cruzado: vínculo só com o idoso A, chamada com o idoso B", async () => {
      fakeVinculos([vinculo()]);
      modoDoIdoso("familiar");
      fakeArmazens([medicamento({ idoso_id: IDOSO_B })]);
      const res = await patchOutro(IDOSO_B, MED);
      expect(res.status).toBe(403);
      expect(updateMed).not.toHaveBeenCalled();
    });

    it("404 para inexistente e para medicamento de outro idoso: idênticos, sem consultar o resolver", async () => {
      fakeVinculos([vinculo()]);
      modoDoIdoso("familiar");
      fakeArmazens([medicamento({ idoso_id: IDOSO_B })]);
      const outro = await patchOutro(IDOSO_A, MED);
      const inexistente = await patchOutro(IDOSO_A, 999);
      expect(outro.status).toBe(404);
      expect(inexistente.status).toBe(404);
      expect(outro.body).toEqual(MSG_404);
      expect(inexistente.body).toEqual(MSG_404);
      expect(updateMed).not.toHaveBeenCalled();
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
      expect(findFirstMed.mock.calls[0][0].where).toEqual({ id: MED, idoso_id: IDOSO_A });
    });

    it("cuidador com medicamento inexistente recebe 404 (o 404 vem antes do 403 de ator)", async () => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador()]);
      expect((await patchOutro(IDOSO_A, 999)).status).toBe(404);
    });

    it.each(["abc", "1.5", "-3", "0"])("400 com id inválido (%s), sem consultar medicamento", async (id) => {
      fakeVinculos([vinculo()]);
      const res = await patchOutro(IDOSO_A, id);
      expect(res.status).toBe(400);
      expect(findFirstMed).not.toHaveBeenCalled();
    });

    it("400 com idosoId não numérico, sem consultar vínculo", async () => {
      const res = await patchOutro("abc", MED);
      expect(res.status).toBe(400);
      expect(findFirstVinculo).not.toHaveBeenCalled();
    });

    it("sem vínculo, id inválido dá 403 (o vínculo vem antes do 400 do id)", async () => {
      fakeVinculos([]);
      expect((await patchOutro(IDOSO_A, "abc")).status).toBe(403);
    });

    it("401 sem token", async () => {
      expectNaoEditou(await request(app).patch(`/remedios/idoso/${IDOSO_A}/${MED}`).send({ dosagem: "20 mg" }), 401);
    });
  });
});

describe("DELETE /remedios/idoso/:idosoId/:medicamentoId, cuidador e familiar (Fase 11)", () => {
  describe("cuidador: NUNCA exclui", () => {
    beforeEach(() => logadoComo(CUIDADOR, "cuidador"));

    it.each(COMBINACOES_FLAGS)("vínculo aprovado com flags %o: 403, nada apagado e sem resolver", async (flags) => {
      fakeVinculos([vinculoCuidador(flags)]);
      modoDoIdoso("familiar");
      const res = await delOutro(IDOSO_A, MED);
      expectIntacto(res, 403);
      expect(res.body).toEqual({ error: MSG_403_EXCLUSAO });
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
      expect(await findFirstMed.mock.results[0].value).not.toBeNull();
    });

    it("medicamento criado pelo próprio cuidador: segue 403", async () => {
      fakeVinculos([vinculoCuidador(COMBINACOES_FLAGS[7])]);
      fakeArmazens([medicamento({ criado_por_id: CUIDADOR })], DOSES_DO_MED);
      const res = await delOutro(IDOSO_A, MED);
      expect(res.status).toBe(403);
      expect(transacao).not.toHaveBeenCalled();
      expect(doses).toHaveLength(2);
    });
  });

  describe("familiar", () => {
    beforeEach(() => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
    });

    it("204 com modo 'familiar': apaga as doses e o medicamento do idoso do vínculo, na mesma transação", async () => {
      modoDoIdoso("familiar");
      expectApagou(await delOutro(IDOSO_A, MED));
      expect(operacoes).toEqual(["doses", "medicamento"]);
      expect(resolverModoDecisaoMock).toHaveBeenCalledWith(IDOSO_A);
    });

    it("se a segunda operação falha, nada é apagado e a resposta é 500 genérico", async () => {
      modoDoIdoso("familiar");
      falharNoMedicamento = new Error("falha simulada no segundo delete");
      const res = await delOutro(IDOSO_A, MED);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: "Erro interno." });
      expect(meds.some((m) => m.id === MED)).toBe(true);
      expect(doses.filter((d) => d.medicamento_id === MED)).toHaveLength(2);
    });

    it("403 com modo 'idoso', genérico", async () => {
      modoDoIdoso("idoso");
      const res = await delOutro(IDOSO_A, MED);
      expectIntacto(res, 403);
      expect(res.body).toEqual({ error: MSG_403_EXCLUSAO });
      expect(JSON.stringify(res.body)).not.toMatch(/modo_decisao|permite_/i);
    });

    it("403 com modo_decisao NULL (resolver real: NULL vale 'idoso')", async () => {
      resolverModoDecisaoMock.mockImplementation((id: number) => resolverReal(id));
      estadoModo = ESTADO_NEUTRO;
      expectIntacto(await delOutro(IDOSO_A, MED), 403);
    });

    it("403 com perfil cuidador mesmo com vínculo familiar e modo 'familiar'", async () => {
      logadoComo(FAMILIAR, "cuidador");
      modoDoIdoso("familiar");
      expectIntacto(await delOutro(IDOSO_A, MED), 403);
    });

    it("404 para inexistente e para medicamento de outro idoso: idênticos, e as doses do outro permanecem", async () => {
      modoDoIdoso("familiar");
      fakeArmazens([medicamento({ idoso_id: IDOSO_B })], [...DOSES_DO_MED, DOSE_DE_OUTRO]);
      const outro = await delOutro(IDOSO_A, MED);
      const inexistente = await delOutro(IDOSO_A, 999);
      expect(outro.status).toBe(404);
      expect(inexistente.status).toBe(404);
      expect(outro.body).toEqual(inexistente.body);
      expect(transacao).not.toHaveBeenCalled();
      expect(doses).toHaveLength(3);
      expect(meds).toHaveLength(1);
    });

    it("segundo DELETE dá 404", async () => {
      modoDoIdoso("familiar");
      expect((await delOutro(IDOSO_A, MED)).status).toBe(204);
      expect((await delOutro(IDOSO_A, MED)).status).toBe(404);
    });
  });

  describe("vínculo e ordem", () => {
    beforeEach(() => logadoComo(FAMILIAR, "familiar"));

    it.each(["pendente", "recusado"] as const)("403 com vínculo %s", async (status) => {
      fakeVinculos([vinculo({ status })]);
      modoDoIdoso("familiar");
      expectIntacto(await delOutro(IDOSO_A, MED), 403);
    });

    it("403 no acesso cruzado", async () => {
      fakeVinculos([vinculo()]);
      modoDoIdoso("familiar");
      fakeArmazens([medicamento({ idoso_id: IDOSO_B })]);
      const res = await delOutro(IDOSO_B, MED);
      expect(res.status).toBe(403);
      expect(transacao).not.toHaveBeenCalled();
    });

    it.each(["abc", "1.5", "-3", "0"])("400 com id inválido (%s)", async (id) => {
      fakeVinculos([vinculo()]);
      const res = await delOutro(IDOSO_A, id);
      expect(res.status).toBe(400);
      expect(transacao).not.toHaveBeenCalled();
    });

    it("401 sem token", async () => {
      expectIntacto(await request(app).delete(`/remedios/idoso/${IDOSO_A}/${MED}`), 401);
    });
  });
});

describe("privacidade (RNF-001): nome e observações do medicamento", () => {
  const SEGREDO = "medicamento-controlado-ficticio";
  const consoles = ["log", "info", "warn", "error", "debug"] as const;

  async function comConsolesEspiados(fn: () => Promise<void>): Promise<string> {
    const espioes = consoles.map((m) => jest.spyOn(console, m).mockImplementation(() => undefined));
    try {
      await fn();
      return inspect(espioes.flatMap((s) => s.mock.calls), { depth: 8 });
    } finally {
      espioes.forEach((s) => s.mockRestore());
    }
  }

  function semVazamento(res: request.Response, logs: string) {
    expect(`${JSON.stringify(res.body)}${res.text}${logs}`).not.toContain(SEGREDO);
  }

  beforeEach(() => fakeArmazens([medicamento({ nome: SEGREDO, observacoes: SEGREDO })], DOSES_DO_MED));

  it("404, 403, 400 e 204: corpo e console sem nome nem observações", async () => {
    const respostas: request.Response[] = [];
    const logs = await comConsolesEspiados(async () => {
      logadoComo(IDOSO_B, "idoso");
      respostas.push(await patchIdoso(MED, { nome: SEGREDO }));
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador(COMBINACOES_FLAGS[7])]);
      respostas.push(await patchOutro(IDOSO_A, MED, { nome: SEGREDO }));
      respostas.push(await delOutro(IDOSO_A, MED));
      logadoComo(IDOSO_A, "idoso");
      respostas.push(await patchIdoso(MED, { nome: SEGREDO, data_inicio: "2026-02-30" }));
      respostas.push(await delIdoso(MED));
    });
    expect(respostas.map((r) => r.status)).toEqual([404, 403, 403, 400, 204]);
    for (const r of respostas) semVazamento(r, logs);
  });

  it("erro do Prisma no update e na transação: 500 genérico e nada do nome em console.*", async () => {
    logadoComo(IDOSO_A, "idoso");
    updateMed.mockRejectedValue(new Error(`Invalid invocation: data: { nome: '${SEGREDO}' }`));
    transacao.mockRejectedValue(new Error(`Invalid invocation: where: { nome: '${SEGREDO}' }`));
    const respostas: request.Response[] = [];
    const logs = await comConsolesEspiados(async () => {
      respostas.push(await patchIdoso(MED, { dosagem: "30 mg" }));
      respostas.push(await delIdoso(MED));
    });
    for (const r of respostas) {
      expect(r.status).toBe(500);
      expect(r.body).toEqual({ error: "Erro interno." });
      semVazamento(r, logs);
    }
  });
});
