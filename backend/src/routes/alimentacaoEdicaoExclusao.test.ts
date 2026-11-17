import { inspect } from "node:util";
import request from "supertest";
import { BODY_OK, CAMPOS_FORJADOS, CASOS_201, CASOS_400, type DadosCreate } from "../testSupport/alimentacaoCasosCorpo";

// Fase 11 (11.1): PATCH e DELETE de refeição, por /alimentacao/:id (idoso) e /alimentacao/idoso/:idosoId/:id (vínculo).
// Autoridade de editar e excluir = a de CRIAR (item 7.1): idoso só o próprio; familiar exige tipo_vinculo E tipo_perfil
// 'familiar' E modo_decisao efetivo 'familiar' (via resolver); cuidador NUNCA, com qualquer vínculo e flags, e o resolver
// nunca é chamado para ele. Todos os ids e valores são FICTÍCIOS.

const verifyIdToken = jest.fn();
const findFirstUsuario = jest.fn();
const findUniqueUsuario = jest.fn();
const updateUsuario = jest.fn();
const findFirstVinculo = jest.fn();
const countVinculo = jest.fn();
const findFirstRegistro = jest.fn();
const updateRegistro = jest.fn();
const deleteManyRegistro = jest.fn();
const resolverModoDecisaoMock = jest.fn();

jest.mock("../lib/firebaseAdmin", () => ({
  auth: { verifyIdToken: (...args: unknown[]) => verifyIdToken(...args) },
}));
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
    registroAlimentar: {
      findFirst: (...args: unknown[]) => findFirstRegistro(...args),
      update: (...args: unknown[]) => updateRegistro(...args),
      deleteMany: (...args: unknown[]) => deleteManyRegistro(...args),
    },
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
const REG = 100;
const MSG_403_EDICAO = "Sem permissão para editar refeição.";
const MSG_403_EXCLUSAO = "Sem permissão para excluir refeição.";
const MSG_404 = { error: "Registro não encontrado." };

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
// As 8 combinações das 3 flags (inclui as 3 falsas e as 3 verdadeiras).
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

// findUnique serve a dois chamadores: o perfil do chamador (select.tipo_perfil) e o resolver real (select de modo_decisao).
function fakeUsuarios() {
  findUniqueUsuario.mockImplementation(
    async ({ where, select }: { where: { id: number }; select: Record<string, boolean> }) => {
      if (select?.tipo_perfil) return perfis[where.id] ? { tipo_perfil: perfis[where.id] } : null;
      return estadoModo;
    },
  );
}

type RegistroFake = {
  id: number;
  idoso_id: number;
  registrado_por_id: number;
  refeicao: string;
  descricao: string;
  data_hora: Date;
  editado_por_id: number | null;
  created_at: Date;
  updated_at: Date;
};

function registro(over: Partial<RegistroFake> = {}): RegistroFake {
  return {
    id: REG,
    idoso_id: IDOSO_A,
    registrado_por_id: IDOSO_A,
    refeicao: "almoco",
    descricao: "Descricao Ficticia Original",
    data_hora: new Date("2026-10-10T12:00:00Z"),
    editado_por_id: null,
    created_at: new Date("2026-10-05T12:00:00Z"),
    updated_at: new Date("2026-10-05T12:00:00Z"),
    ...over,
  };
}

// Armazém em memória: findFirst, update e deleteMany filtram de verdade pelo where (valor undefined é ignorado, como no
// Prisma). Assim o 404 colapsado e o acesso cruzado não passam por vacuidade, e "a linha some" é observável.
let registros: RegistroFake[] = [];
const casa = (r: RegistroFake, where: Record<string, unknown>) =>
  Object.entries(where).every(([k, v]) => v === undefined || (r as Record<string, unknown>)[k] === v);

function fakeRegistros(linhas: RegistroFake[]) {
  registros = linhas;
  findFirstRegistro.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
    return registros.find((r) => casa(r, where)) ?? null;
  });
  updateRegistro.mockImplementation(async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => {
    const i = registros.findIndex((r) => r.id === where.id);
    registros[i] = { ...registros[i], ...data, updated_at: new Date("2026-10-11T12:00:00Z") } as RegistroFake;
    return registros[i];
  });
  deleteManyRegistro.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
    const antes = registros.length;
    registros = registros.filter((r) => !casa(r, where));
    return { count: antes - registros.length };
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
const patchIdoso = (id: number | string, body: unknown = BODY_OK) =>
  auth(request(app).patch(`/alimentacao/${id}`)).send(body as object);
const patchOutro = (idoso: number | string, id: number | string, body: unknown = BODY_OK) =>
  auth(request(app).patch(`/alimentacao/idoso/${idoso}/${id}`)).send(body as object);
const delIdoso = (id: number | string) => auth(request(app).delete(`/alimentacao/${id}`));
const delOutro = (idoso: number | string, id: number | string) => auth(request(app).delete(`/alimentacao/idoso/${idoso}/${id}`));

function dadosDoUpdate(): DadosCreate & Record<string, unknown> {
  return updateRegistro.mock.calls[0][0].data;
}

function expectNaoEditou(res: request.Response, status: number) {
  expect(res.status).toBe(status);
  expect(updateRegistro).not.toHaveBeenCalled();
  expect(registros.find((r) => r.id === REG)?.descricao).toBe("Descricao Ficticia Original");
}

function expectNaoApagou(res: request.Response, status: number) {
  expect(res.status).toBe(status);
  expect(deleteManyRegistro).not.toHaveBeenCalled();
  expect(registros.some((r) => r.id === REG)).toBe(true);
}

function expectApagou(res: request.Response) {
  expect(res.status).toBe(204);
  expect(res.text).toBe("");
  expect(deleteManyRegistro).toHaveBeenCalledTimes(1);
  expect(registros.some((r) => r.id === REG)).toBe(false);
}

beforeEach(() => {
  [
    verifyIdToken,
    findFirstUsuario,
    findUniqueUsuario,
    updateUsuario,
    findFirstVinculo,
    countVinculo,
    findFirstRegistro,
    updateRegistro,
    deleteManyRegistro,
    resolverModoDecisaoMock,
  ].forEach((m) => m.mockReset());
  Object.keys(perfis).forEach((k) => delete perfis[Number(k)]);
  estadoModo = ESTADO_NEUTRO;
  fakeUsuarios();
  fakeRegistros([registro()]);
});

describe("PATCH /alimentacao/:id, idoso edita a própria refeição (Fase 11)", () => {
  beforeEach(() => logadoComo(IDOSO_A, "idoso"));

  it("200: aplica o corpo, editado_por_id do token, e devolve o registro serializado", async () => {
    const res = await patchIdoso(REG, { refeicao: "jantar", descricao: "  Sopa Ficticia  ", data_hora: "2026-10-11T19:00:00Z" });
    expect(res.status).toBe(200);
    const { where, data } = updateRegistro.mock.calls[0][0];
    expect(where).toEqual({ id: REG });
    expect(Object.keys(data).sort()).toEqual(["data_hora", "descricao", "editado_por_id", "refeicao"]);
    expect(data.editado_por_id).toBe(IDOSO_A);
    expect(res.body).toMatchObject({
      id: REG,
      idoso_id: IDOSO_A,
      registrado_por_id: IDOSO_A,
      refeicao: "jantar",
      descricao: "Sopa Ficticia",
      data_hora: "2026-10-11T19:00:00.000Z",
      editado_por_id: IDOSO_A,
    });
  });

  it("edição parcial: campo ausente mantém o valor atual", async () => {
    const res = await patchIdoso(REG, { descricao: "So a descricao" });
    expect(res.status).toBe(200);
    expect(dadosDoUpdate().refeicao).toBe("almoco");
    expect(dadosDoUpdate().data_hora.toISOString()).toBe("2026-10-10T12:00:00.000Z");
    expect(res.body.descricao).toBe("So a descricao");
    expect(res.body.refeicao).toBe("almoco");
  });

  it.each([
    ["refeicao", { refeicao: null }, "refeicao inválida."],
    ["descricao", { descricao: null }, "descricao inválida."],
    ["data_hora", { data_hora: null }, "data_hora inválida."],
  ])("null explícito em %s (obrigatório) dá 400, não limpa", async (_campo, corpo, msg) => {
    const res = await patchIdoso(REG, corpo);
    expectNaoEditou(res, 400);
    expect(res.body).toEqual({ error: msg });
  });

  it.each([["corpo vazio", {}], ["só campos forjados", { id: 1, idoso_id: IDOSO_B, registrado_por_id: IDOSO_B }], ["array", []]])(
    "400 sem nenhum campo de refeição (%s)",
    async (_rotulo, corpo) => {
      const res = await patchIdoso(REG, corpo);
      expectNaoEditou(res, 400);
      expect(res.body).toEqual({ error: "Nenhum campo de refeição informado." });
    },
  );

  it.each(CASOS_201)("mesma regra do POST, aceita: %s", async (_rotulo, over, checar) => {
    const res = await patchIdoso(REG, { ...BODY_OK, ...over });
    expect(res.status).toBe(200);
    checar(dadosDoUpdate());
  });

  it.each(CASOS_400.filter(([, over]) => Object.values(over).every((v) => v !== undefined)))(
    "mesma regra e mensagem do POST, recusa: %s",
    async (_rotulo, over, msg) => {
      const res = await patchIdoso(REG, { ...BODY_OK, ...over });
      expectNaoEditou(res, 400);
      expect(res.body).toEqual({ error: msg });
    },
  );

  it("campos forjados no corpo são ignorados: autoria e dono não mudam", async () => {
    const res = await patchIdoso(REG, { ...BODY_OK, ...CAMPOS_FORJADOS });
    expect(res.status).toBe(200);
    const data = dadosDoUpdate();
    expect(data.editado_por_id).toBe(IDOSO_A);
    for (const k of ["id", "idoso_id", "registrado_por_id", "created_at", "updated_at"]) expect(data).not.toHaveProperty(k);
    expect(registros[0].idoso_id).toBe(IDOSO_A);
    expect(registros[0].registrado_por_id).toBe(IDOSO_A);
  });

  it("não consulta vínculo nem modo_decisao", async () => {
    expect((await patchIdoso(REG)).status).toBe(200);
    expect(findFirstVinculo).not.toHaveBeenCalled();
    expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
  });

  it("registro de outro idoso e registro inexistente: 404 idêntico, mesmo com corpo inválido, e nada muda", async () => {
    logadoComo(IDOSO_B, "idoso");
    const deOutro = await patchIdoso(REG, { refeicao: "x" });
    const inexistente = await patchIdoso(999, { refeicao: "x" });
    expectNaoEditou(deOutro, 404);
    expect(inexistente.status).toBe(404);
    expect(deOutro.body).toEqual(MSG_404);
    expect(inexistente.body).toEqual(MSG_404);
    expect(findFirstRegistro.mock.calls[0][0].where).toEqual({ id: REG, idoso_id: IDOSO_B });
  });

  it.each(["abc", "1.5", "-3", "0", "1e3", "99999999999"])("400 com id inválido (%s), sem consultar o banco", async (id) => {
    const res = await patchIdoso(id);
    expect(res.status).toBe(400);
    expect(findFirstRegistro).not.toHaveBeenCalled();
    expect(updateRegistro).not.toHaveBeenCalled();
  });

  it("401 sem token", async () => {
    const res = await request(app).patch(`/alimentacao/${REG}`).send(BODY_OK);
    expectNaoEditou(res, 401);
  });

  it.each([
    ["cuidador", CUIDADOR],
    ["familiar", FAMILIAR],
  ] as const)("%s pela rota própria: 404, mesmo com vínculo aprovado e tudo liberado", async (perfil, id) => {
    fakeVinculos([vinculoCuidador({ permite_registrar_saude: true, permite_marcar_dose: true, permite_criar_evento_cuidado: true }), vinculo()]);
    modoDoIdoso("familiar");
    logadoComo(id, perfil);
    expectNaoEditou(await patchIdoso(REG), 404);
  });
});

describe("DELETE /alimentacao/:id, idoso exclui a própria refeição (Fase 11)", () => {
  beforeEach(() => logadoComo(IDOSO_A, "idoso"));

  it("204 sem corpo: a linha some e o delete leva id e idoso_id no where", async () => {
    expectApagou(await delIdoso(REG));
    expect(deleteManyRegistro.mock.calls[0][0]).toEqual({ where: { id: REG, idoso_id: IDOSO_A } });
  });

  it("idoso exclui refeição registrada por familiar (dono do dado é o idoso)", async () => {
    fakeRegistros([registro({ registrado_por_id: FAMILIAR })]);
    expectApagou(await delIdoso(REG));
  });

  it("não consulta vínculo nem modo_decisao", async () => {
    expectApagou(await delIdoso(REG));
    expect(findFirstVinculo).not.toHaveBeenCalled();
    expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
  });

  it("registro de outro idoso e inexistente: 404 idêntico, e a linha do outro permanece", async () => {
    logadoComo(IDOSO_B, "idoso");
    const deOutro = await delIdoso(REG);
    const inexistente = await delIdoso(999);
    expectNaoApagou(deOutro, 404);
    expect(inexistente.status).toBe(404);
    expect(deOutro.body).toEqual(MSG_404);
    expect(inexistente.body).toEqual(MSG_404);
  });

  it("segundo DELETE do mesmo registro dá 404", async () => {
    expect((await delIdoso(REG)).status).toBe(204);
    const segundo = await delIdoso(REG);
    expect(segundo.status).toBe(404);
    expect(segundo.body).toEqual(MSG_404);
  });

  it("apagado por outra chamada entre a leitura e o delete: 404, não 500", async () => {
    deleteManyRegistro.mockResolvedValue({ count: 0 });
    const res = await delIdoso(REG);
    expect(res.status).toBe(404);
    expect(res.body).toEqual(MSG_404);
  });

  it.each(["abc", "1.5", "-3", "0", "1e3"])("400 com id inválido (%s), sem consultar o banco", async (id) => {
    const res = await delIdoso(id);
    expect(res.status).toBe(400);
    expect(findFirstRegistro).not.toHaveBeenCalled();
    expect(deleteManyRegistro).not.toHaveBeenCalled();
  });

  it("401 sem token", async () => {
    expectNaoApagou(await request(app).delete(`/alimentacao/${REG}`), 401);
  });

  it.each([
    ["cuidador", CUIDADOR],
    ["familiar", FAMILIAR],
  ] as const)("%s pela rota própria: 404 e a linha permanece", async (perfil, id) => {
    fakeVinculos([vinculoCuidador(), vinculo()]);
    modoDoIdoso("familiar");
    logadoComo(id, perfil);
    expectNaoApagou(await delIdoso(REG), 404);
  });
});

describe("PATCH /alimentacao/idoso/:idosoId/:id, cuidador e familiar (Fase 11)", () => {
  describe("cuidador: NUNCA edita (regra fixa de ator)", () => {
    beforeEach(() => logadoComo(CUIDADOR, "cuidador"));

    it.each(COMBINACOES_FLAGS)("vínculo aprovado com flags %o: 403, nada muda e sem resolver", async (flags) => {
      fakeVinculos([vinculoCuidador(flags)]);
      modoDoIdoso("familiar");
      const res = await patchOutro(IDOSO_A, REG);
      expectNaoEditou(res, 403);
      expect(res.body).toEqual({ error: MSG_403_EDICAO });
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
      // Controle positivo: o vínculo e o registro foram encontrados (o 403 é do ator, não do middleware nem do 404).
      expect(await findFirstVinculo.mock.results[0].value).not.toBeNull();
      expect(await findFirstRegistro.mock.results[0].value).not.toBeNull();
    });

    it("registro criado pelo próprio cuidador: segue 403 (autoria não abre a porta)", async () => {
      fakeVinculos([vinculoCuidador({ permite_registrar_saude: true, permite_marcar_dose: true, permite_criar_evento_cuidado: true })]);
      fakeRegistros([registro({ registrado_por_id: CUIDADOR })]);
      expectNaoEditou(await patchOutro(IDOSO_A, REG), 403);
    });

    it("com vínculo só de familiar na linha mas perfil cuidador: 403 (tipo_perfil também conta)", async () => {
      fakeVinculos([vinculo({ vinculado_id: CUIDADOR, tipo_vinculo: "familiar" })]);
      modoDoIdoso("familiar");
      expectNaoEditou(await patchOutro(IDOSO_A, REG), 403);
    });

    it("corpo inválido com cuidador dá 403, não 400 (autorização antes do corpo)", async () => {
      fakeVinculos([vinculoCuidador(COMBINACOES_FLAGS[7])]);
      expectNaoEditou(await patchOutro(IDOSO_A, REG, { refeicao: "x" }), 403);
    });
  });

  describe("familiar", () => {
    beforeEach(() => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
    });

    it("200 com modo 'familiar': editado_por_id do familiar, registrado_por_id e idoso_id intactos", async () => {
      modoDoIdoso("familiar");
      const res = await patchOutro(IDOSO_A, REG, { descricao: "Nova Descricao" });
      expect(res.status).toBe(200);
      expect(updateRegistro.mock.calls[0][0].where).toEqual({ id: REG });
      expect(dadosDoUpdate().editado_por_id).toBe(FAMILIAR);
      expect(res.body).toMatchObject({ id: REG, idoso_id: IDOSO_A, registrado_por_id: IDOSO_A, editado_por_id: FAMILIAR, descricao: "Nova Descricao" });
      expect(resolverModoDecisaoMock).toHaveBeenCalledWith(IDOSO_A);
    });

    it("idoso_id, registrado_por_id e editado_por_id do corpo são ignorados", async () => {
      modoDoIdoso("familiar");
      const res = await patchOutro(IDOSO_A, REG, { ...BODY_OK, ...CAMPOS_FORJADOS });
      expect(res.status).toBe(200);
      const data = dadosDoUpdate();
      expect(data.editado_por_id).toBe(FAMILIAR);
      for (const k of ["id", "idoso_id", "registrado_por_id", "created_at", "updated_at"]) expect(data).not.toHaveProperty(k);
      expect(registros[0].idoso_id).toBe(IDOSO_A);
    });

    it("403 com modo 'idoso', genérico, sem citar modo_decisao", async () => {
      modoDoIdoso("idoso");
      const res = await patchOutro(IDOSO_A, REG);
      expectNaoEditou(res, 403);
      expect(res.body).toEqual({ error: MSG_403_EDICAO });
      expect(JSON.stringify(res.body)).not.toMatch(/modo_decisao|permite_/i);
    });

    it("403 com modo_decisao NULL (resolver real: NULL vale 'idoso')", async () => {
      resolverModoDecisaoMock.mockImplementation((id: number) => resolverReal(id));
      estadoModo = ESTADO_NEUTRO;
      expectNaoEditou(await patchOutro(IDOSO_A, REG), 403);
      estadoModo = { ...ESTADO_NEUTRO, modo_decisao: "familiar" };
      expect((await patchOutro(IDOSO_A, REG)).status).toBe(200);
    });

    it("403 com tipo_vinculo cuidador na linha e perfil familiar (os dois precisam ser 'familiar')", async () => {
      fakeVinculos([vinculo({ tipo_vinculo: "cuidador" })]);
      modoDoIdoso("familiar");
      expectNaoEditou(await patchOutro(IDOSO_A, REG), 403);
    });

    it("403 com perfil cuidador e tipo_vinculo familiar na linha", async () => {
      logadoComo(FAMILIAR, "cuidador");
      modoDoIdoso("familiar");
      expectNaoEditou(await patchOutro(IDOSO_A, REG), 403);
    });

    it("sem autoridade, corpo inválido dá 403, não 400", async () => {
      modoDoIdoso("idoso");
      expectNaoEditou(await patchOutro(IDOSO_A, REG, { refeicao: "x" }), 403);
    });

    it("com autoridade, corpo inválido dá 400 com a mensagem do POST", async () => {
      modoDoIdoso("familiar");
      const res = await patchOutro(IDOSO_A, REG, { refeicao: "Almoco" });
      expectNaoEditou(res, 400);
      expect(res.body).toEqual({ error: "refeicao inválida." });
    });
  });

  describe("vínculo, registro e ordem", () => {
    it.each(["pendente", "recusado"] as const)("403 com vínculo %s", async (status) => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo({ status })]);
      modoDoIdoso("familiar");
      expectNaoEditou(await patchOutro(IDOSO_A, REG), 403);
    });

    it("403 no acesso cruzado: vínculo só com o idoso A, chamada com o idoso B", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
      modoDoIdoso("familiar");
      fakeRegistros([registro({ idoso_id: IDOSO_B })]);
      const res = await patchOutro(IDOSO_B, REG);
      expect(res.status).toBe(403);
      expect(updateRegistro).not.toHaveBeenCalled();
    });

    it("404 para inexistente e para registro de outro idoso: idênticos, sem consultar o resolver", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
      modoDoIdoso("familiar");
      fakeRegistros([registro({ idoso_id: IDOSO_B })]);
      const outro = await patchOutro(IDOSO_A, REG);
      const inexistente = await patchOutro(IDOSO_A, 999);
      expect(outro.status).toBe(404);
      expect(inexistente.status).toBe(404);
      expect(outro.body).toEqual(MSG_404);
      expect(inexistente.body).toEqual(MSG_404);
      expect(updateRegistro).not.toHaveBeenCalled();
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
      expect(findFirstRegistro.mock.calls[0][0].where).toEqual({ id: REG, idoso_id: IDOSO_A });
    });

    it("cuidador com registro inexistente recebe 404 (o 404 vem antes do 403 de ator)", async () => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador()]);
      expect((await patchOutro(IDOSO_A, 999)).status).toBe(404);
    });

    it.each(["abc", "1.5", "-3", "0"])("400 com id inválido (%s), sem consultar registro", async (id) => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
      const res = await patchOutro(IDOSO_A, id);
      expect(res.status).toBe(400);
      expect(findFirstRegistro).not.toHaveBeenCalled();
    });

    it("400 com idosoId não numérico, sem consultar vínculo", async () => {
      logadoComo(FAMILIAR, "familiar");
      const res = await patchOutro("abc", REG);
      expect(res.status).toBe(400);
      expect(findFirstVinculo).not.toHaveBeenCalled();
    });

    it("sem vínculo, id inválido dá 403 (o vínculo vem antes do 400 do id)", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([]);
      expect((await patchOutro(IDOSO_A, "abc")).status).toBe(403);
    });

    it("401 sem token", async () => {
      expectNaoEditou(await request(app).patch(`/alimentacao/idoso/${IDOSO_A}/${REG}`).send(BODY_OK), 401);
    });
  });
});

describe("DELETE /alimentacao/idoso/:idosoId/:id, cuidador e familiar (Fase 11)", () => {
  describe("cuidador: NUNCA exclui", () => {
    beforeEach(() => logadoComo(CUIDADOR, "cuidador"));

    it.each(COMBINACOES_FLAGS)("vínculo aprovado com flags %o: 403, a linha permanece e sem resolver", async (flags) => {
      fakeVinculos([vinculoCuidador(flags)]);
      modoDoIdoso("familiar");
      const res = await delOutro(IDOSO_A, REG);
      expectNaoApagou(res, 403);
      expect(res.body).toEqual({ error: MSG_403_EXCLUSAO });
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
      expect(await findFirstRegistro.mock.results[0].value).not.toBeNull();
    });

    it("registro criado pelo próprio cuidador: segue 403", async () => {
      fakeVinculos([vinculoCuidador(COMBINACOES_FLAGS[7])]);
      fakeRegistros([registro({ registrado_por_id: CUIDADOR })]);
      expectNaoApagou(await delOutro(IDOSO_A, REG), 403);
    });
  });

  describe("familiar", () => {
    beforeEach(() => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
    });

    it.each([
      ["o idoso", IDOSO_A],
      ["um cuidador", CUIDADOR],
      ["ele mesmo", FAMILIAR],
    ])("204 com modo 'familiar' em registro criado por %s", async (_nome, autor) => {
      modoDoIdoso("familiar");
      fakeRegistros([registro({ registrado_por_id: autor })]);
      expectApagou(await delOutro(IDOSO_A, REG));
      expect(deleteManyRegistro.mock.calls[0][0]).toEqual({ where: { id: REG, idoso_id: IDOSO_A } });
      expect(resolverModoDecisaoMock).toHaveBeenCalledWith(IDOSO_A);
    });

    it("403 com modo 'idoso', genérico", async () => {
      modoDoIdoso("idoso");
      const res = await delOutro(IDOSO_A, REG);
      expectNaoApagou(res, 403);
      expect(res.body).toEqual({ error: MSG_403_EXCLUSAO });
      expect(JSON.stringify(res.body)).not.toMatch(/modo_decisao|permite_/i);
    });

    it("403 com modo_decisao NULL (resolver real: NULL vale 'idoso')", async () => {
      resolverModoDecisaoMock.mockImplementation((id: number) => resolverReal(id));
      estadoModo = ESTADO_NEUTRO;
      expectNaoApagou(await delOutro(IDOSO_A, REG), 403);
    });

    it("403 com perfil cuidador mesmo com vínculo familiar e modo 'familiar'", async () => {
      logadoComo(FAMILIAR, "cuidador");
      modoDoIdoso("familiar");
      expectNaoApagou(await delOutro(IDOSO_A, REG), 403);
    });

    it("404 para inexistente e para registro de outro idoso: idênticos, a linha do outro permanece", async () => {
      modoDoIdoso("familiar");
      fakeRegistros([registro({ idoso_id: IDOSO_B })]);
      const outro = await delOutro(IDOSO_A, REG);
      const inexistente = await delOutro(IDOSO_A, 999);
      expectNaoApagou(outro, 404);
      expect(inexistente.status).toBe(404);
      expect(outro.body).toEqual(inexistente.body);
    });

    it("segundo DELETE dá 404", async () => {
      modoDoIdoso("familiar");
      expect((await delOutro(IDOSO_A, REG)).status).toBe(204);
      expect((await delOutro(IDOSO_A, REG)).status).toBe(404);
    });
  });

  describe("vínculo e ordem", () => {
    it.each(["pendente", "recusado"] as const)("403 com vínculo %s", async (status) => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo({ status })]);
      modoDoIdoso("familiar");
      expectNaoApagou(await delOutro(IDOSO_A, REG), 403);
    });

    it("403 no acesso cruzado", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
      modoDoIdoso("familiar");
      fakeRegistros([registro({ idoso_id: IDOSO_B })]);
      const res = await delOutro(IDOSO_B, REG);
      expect(res.status).toBe(403);
      expect(deleteManyRegistro).not.toHaveBeenCalled();
    });

    it.each(["abc", "1.5", "-3", "0"])("400 com id inválido (%s)", async (id) => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
      const res = await delOutro(IDOSO_A, id);
      expect(res.status).toBe(400);
      expect(deleteManyRegistro).not.toHaveBeenCalled();
    });

    it("401 sem token", async () => {
      expectNaoApagou(await request(app).delete(`/alimentacao/idoso/${IDOSO_A}/${REG}`), 401);
    });
  });
});

describe("privacidade (RNF-001 por analogia): descricao de refeição", () => {
  const SEGREDO = "dieta-sem-gluten-ficticia";
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
    const tudo = `${JSON.stringify(res.body)}${res.text}${logs}`;
    expect(tudo).not.toContain(SEGREDO);
  }

  beforeEach(() => fakeRegistros([registro({ descricao: SEGREDO })]));

  it("404, 403, 400 e 204: corpo e console sem a descricao", async () => {
    const respostas: request.Response[] = [];
    const logs = await comConsolesEspiados(async () => {
      logadoComo(IDOSO_B, "idoso");
      respostas.push(await patchIdoso(REG, { descricao: SEGREDO }));
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador(COMBINACOES_FLAGS[7])]);
      respostas.push(await patchOutro(IDOSO_A, REG, { descricao: SEGREDO }));
      respostas.push(await delOutro(IDOSO_A, REG));
      logadoComo(IDOSO_A, "idoso");
      respostas.push(await patchIdoso(REG, { refeicao: "Almoco", descricao: SEGREDO }));
      respostas.push(await delIdoso(REG));
    });
    expect(respostas.map((r) => r.status)).toEqual([404, 403, 403, 400, 204]);
    for (const r of respostas) semVazamento(r, logs);
  });

  it("erro do Prisma no update e no delete: 500 genérico e nada da descricao em console.*", async () => {
    logadoComo(IDOSO_A, "idoso");
    const erro = () => new Error(`Invalid invocation: data: { descricao: '${SEGREDO}' }`);
    updateRegistro.mockRejectedValue(erro());
    deleteManyRegistro.mockRejectedValue(erro());
    const respostas: request.Response[] = [];
    const logs = await comConsolesEspiados(async () => {
      respostas.push(await patchIdoso(REG, { descricao: SEGREDO }));
      respostas.push(await delIdoso(REG));
    });
    for (const r of respostas) {
      expect(r.status).toBe(500);
      expect(r.body).toEqual({ error: "Erro interno." });
      semVazamento(r, logs);
    }
  });
});
