import { inspect } from "node:util";
import request from "supertest";
import { Prisma } from "@prisma/client";

// Item 5.2 (RF-012): POST /remedios/idoso/:idosoId/:medicamentoId/doses. Cuidador só com
// permite_marcar_dose=true (as outras duas flags não abrem esta porta). Familiar aprovado só com
// modo_decisao efetivo 'familiar' (via resolver, como no 5.1). Dose e medicamento são dado sensível (RNF-001). Todos os ids e valores
// abaixo são FICTÍCIOS, só para teste.

const verifyIdToken = jest.fn();
const findFirstUsuario = jest.fn();
const findUniqueUsuario = jest.fn();
const updateUsuario = jest.fn();
const findFirstVinculo = jest.fn();
const countVinculo = jest.fn();
const findFirstMedicamento = jest.fn();
const createDose = jest.fn();
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
    medicamento: { findFirst: (...args: unknown[]) => findFirstMedicamento(...args) },
    registroDoseMedicamento: { create: (...args: unknown[]) => createDose(...args) },
  },
}));
// Só resolverModoDecisao é trocada: o resto de vinculo.ts segue real (o bloco do resolver real a usa).
jest.mock("./vinculo", () => ({
  __esModule: true,
  ...jest.requireActual("./vinculo"),
  resolverModoDecisao: (...args: unknown[]) => resolverModoDecisaoMock(...args),
}));

import app from "../app";
const resolverReal: (id: number) => Promise<"idoso" | "familiar"> =
  jest.requireActual("./vinculo").resolverModoDecisao;

type Perfil = "idoso" | "cuidador" | "familiar";

const CUIDADOR = 10;
const FAMILIAR = 20;
const FAMILIAR_2 = 21;
const IDOSO_A = 5;
const IDOSO_B = 6;
const MED_A = 100;
const MED_B = 200;
const MED_INATIVO = 101;
const NOW = new Date("2026-10-02T12:00:00.000Z");
const MSG_403 = "Sem permissão para registrar dose.";
const MSG_404 = "Medicamento não encontrado.";
const MSG_409 = "Medicamento inativo.";
const CAMPOS_RESPOSTA = [
  "created_at",
  "data_hora_administracao",
  "id",
  "medicamento_id",
  "observacoes",
  "registrado_por_id",
  "status_administracao",
];

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

const COM_DOSE = { permite_marcar_dose: true };

// Fakes que FILTRAM de verdade pelo where recebido (chave undefined não filtra, como no Prisma):
// sem isso o teste de acesso cruzado passaria por vacuidade.
function fakeVinculos(linhas: VinculoFake[]) {
  findFirstVinculo.mockImplementation(
    async ({ where }: { where: { idoso_id: number; vinculado_id: number; status: string } }) =>
      linhas.find(
        (v) => v.idoso_id === where.idoso_id && v.vinculado_id === where.vinculado_id && v.status === where.status,
      ) ?? null,
  );
}

type MedFake = { id: number; idoso_id: number; ativo: boolean; nome: string };
const MEDICAMENTOS: MedFake[] = [
  { id: MED_A, idoso_id: IDOSO_A, ativo: true, nome: "Remedio Ficticio A" },
  { id: MED_INATIVO, idoso_id: IDOSO_A, ativo: false, nome: "Remedio Ficticio Inativo" },
  { id: MED_B, idoso_id: IDOSO_B, ativo: true, nome: "Remedio Ficticio B" },
];

function fakeMedicamentos() {
  findFirstMedicamento.mockImplementation(async ({ where }: { where: Partial<MedFake> }) =>
    MEDICAMENTOS.find((m) => (Object.keys(where) as (keyof MedFake)[]).every((k) => where[k] === undefined || m[k] === where[k])) ?? null,
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

// findUnique serve a dois chamadores: o perfil do chamador (select.tipo_perfil) e o resolver real
// (select de modo_decisao). O fake os separa pelo select.
function fakeUsuarios() {
  findUniqueUsuario.mockImplementation(
    async ({ where, select }: { where: { id: number }; select: Record<string, boolean> }) => {
      if (select?.tipo_perfil) return perfis[where.id] ? { tipo_perfil: perfis[where.id] } : null;
      return estadoModo;
    },
  );
}

function modoDoIdoso(modo: "idoso" | "familiar") {
  resolverModoDecisaoMock.mockResolvedValue(modo);
}

function logadoComo(id: number, perfil: Perfil) {
  perfis[id] = perfil;
  verifyIdToken.mockResolvedValue({ uid: `uid-${id}` });
  findFirstUsuario.mockResolvedValue({ id, firebase_uid: `uid-${id}` });
}

function post(idoso: number | string, med: number | string = MED_A, body: unknown = { status_administracao: "administrado" }) {
  return request(app)
    .post(`/remedios/idoso/${idoso}/${med}/doses`)
    .set("Authorization", "Bearer x")
    .send(body as object);
}

function expectNaoCriou(res: request.Response, status: number) {
  expect(res.status).toBe(status);
  expect(createDose).not.toHaveBeenCalled();
}

const consoles = ["log", "info", "warn", "error", "debug"] as const;

async function capturando<T>(fn: () => Promise<T>) {
  const espioes = consoles.map((m) => jest.spyOn(console, m).mockImplementation(() => undefined));
  const out = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  const err = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  try {
    const res = await fn();
    const saidas = inspect([...espioes.map((s) => s.mock.calls), out.mock.calls, err.mock.calls], {
      depth: 12,
      maxStringLength: Infinity,
      maxArrayLength: null,
    });
    return { res, saidas };
  } finally {
    espioes.forEach((s) => s.mockRestore());
    out.mockRestore();
    err.mockRestore();
  }
}

function visivel(res: request.Response, saidas: string) {
  return inspect([res.body, res.text, res.headers], { depth: 10, maxStringLength: Infinity }) + saidas;
}

beforeEach(() => {
  // Só Date é congelada: timers e I/O reais seguem funcionando para o supertest.
  jest.useFakeTimers({
    now: NOW,
    doNotFake: [
      "nextTick",
      "setImmediate",
      "clearImmediate",
      "setInterval",
      "clearInterval",
      "setTimeout",
      "clearTimeout",
      "queueMicrotask",
      "performance",
      "hrtime",
    ],
  });
  [
    verifyIdToken,
    findFirstUsuario,
    findUniqueUsuario,
    findFirstVinculo,
    findFirstMedicamento,
    createDose,
    resolverModoDecisaoMock,
    updateUsuario,
    countVinculo,
  ].forEach((m) => m.mockReset());
  Object.keys(perfis).forEach((k) => delete perfis[Number(k)]);
  estadoModo = ESTADO_NEUTRO;
  // Default dos testes que não tratam de modo_decisao: o familiar tem a caneta.
  modoDoIdoso("familiar");
  fakeUsuarios();
  fakeMedicamentos();
  createDose.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 900,
    created_at: new Date(NOW),
    ...data,
  }));
});

afterEach(() => jest.useRealTimers());

describe("POST /remedios/idoso/:idosoId/:medicamentoId/doses (RF-012, item 5.2)", () => {
  describe("cuidador: só com permite_marcar_dose", () => {
    it("403 com permite_marcar_dose=false e as outras duas flags true (critério de pronto do plano)", async () => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador({ permite_registrar_saude: true, permite_criar_evento_cuidado: true })]);
      const res = await post(IDOSO_A);
      expectNaoCriou(res, 403);
      expect(res.body).toEqual({ error: MSG_403 });
    });

    it("201 com permite_marcar_dose=true: registrado_por_id é o cuidador (critério de pronto do plano)", async () => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador(COM_DOSE)]);
      const res = await post(IDOSO_A);
      expect(res.status).toBe(201);
      expect(createDose).toHaveBeenCalledTimes(1);
      const { data } = createDose.mock.calls[0][0];
      expect(data.registrado_por_id).toBe(CUIDADOR);
      expect(data.medicamento_id).toBe(MED_A);
      expect(data.status_administracao).toBe("administrado");
      expect(res.body.registrado_por_id).toBe(CUIDADOR);
    });

    it.each(["permite_registrar_saude", "permite_criar_evento_cuidado"])(
      "403 com só a flag %s verdadeira e a de dose falsa",
      async (flag) => {
        logadoComo(CUIDADOR, "cuidador");
        fakeVinculos([vinculoCuidador({ [flag]: true })]);
        expectNaoCriou(await post(IDOSO_A), 403);
      },
    );

    it("403 com as 3 flags falsas", async () => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador()]);
      expectNaoCriou(await post(IDOSO_A), 403);
    });

    it.each(["pendente", "recusado"] as const)("403 com vínculo %s mesmo com a flag", async (status) => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador({ ...COM_DOSE, status })]);
      expectNaoCriou(await post(IDOSO_A), 403);
    });

    it("403 sem vínculo algum", async () => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([]);
      expectNaoCriou(await post(IDOSO_A), 403);
    });

    it("403 no acesso cruzado: vínculo só com o idoso A, chamada com o idoso B (controle positivo no A)", async () => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador({ ...COM_DOSE, idoso_id: IDOSO_A })]);
      expect((await post(IDOSO_A)).status).toBe(201);
      createDose.mockClear();
      expectNaoCriou(await post(IDOSO_B, MED_B), 403);
    });

    it("403 com tipo_vinculo 'familiar' e tipo_perfil 'cuidador'", async () => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculo({ vinculado_id: CUIDADOR, tipo_vinculo: "familiar", ...COM_DOSE })]);
      expectNaoCriou(await post(IDOSO_A), 403);
    });

    it("403 com tipo_vinculo 'cuidador' e tipo_perfil 'familiar', mesmo com a flag", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculoCuidador({ vinculado_id: FAMILIAR, ...COM_DOSE })]);
      expectNaoCriou(await post(IDOSO_A), 403);
    });

    it("403 com tipo_vinculo 'cuidador' e tipo_perfil 'idoso'", async () => {
      logadoComo(IDOSO_A, "idoso");
      fakeVinculos([vinculoCuidador({ vinculado_id: IDOSO_A, ...COM_DOSE })]);
      expectNaoCriou(await post(IDOSO_A), 403);
    });

    it("403 explícito se req.vinculoAprovado vier sem a flag como booleano true (valor truthy não basta)", async () => {
      logadoComo(CUIDADOR, "cuidador");
      findFirstVinculo.mockResolvedValue({ ...vinculoCuidador(), permite_marcar_dose: 1 });
      expectNaoCriou(await post(IDOSO_A), 403);
    });
  });

  describe("familiar: matriz modo_decisao x vínculo (resolver mockado)", () => {
    it("201 com modo 'familiar' e vínculo aprovado: autoria do familiar, resolver chamado com o idoso do vínculo", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
      modoDoIdoso("familiar");
      const res = await post(IDOSO_A);
      expect(res.status).toBe(201);
      expect(resolverModoDecisaoMock).toHaveBeenCalledWith(IDOSO_A);
      expect(createDose.mock.calls[0][0].data.registrado_por_id).toBe(FAMILIAR);
    });

    it("403 com modo 'idoso' e vínculo aprovado, mensagem fixa sem citar modo_decisao", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
      modoDoIdoso("idoso");
      const res = await post(IDOSO_A);
      expectNaoCriou(res, 403);
      expect(res.body).toEqual({ error: MSG_403 });
    });

    it.each(["pendente", "recusado"] as const)("403 com modo 'familiar' e vínculo %s, sem consultar o resolver", async (status) => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo({ status })]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A), 403);
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
    });

    it("403 com vínculo inexistente, sem consultar o resolver", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([]);
      expectNaoCriou(await post(IDOSO_A), 403);
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
    });

    it("403 no acesso cruzado: aprovado só com o idoso A, chamada com o idoso B (controle positivo no A)", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo({ idoso_id: IDOSO_A })]);
      expect((await post(IDOSO_A)).status).toBe(201);
      createDose.mockClear();
      expectNaoCriou(await post(IDOSO_B, MED_B), 403);
    });

    it("dois familiares aprovados com modo 'familiar': cada um grava com a própria autoria", async () => {
      fakeVinculos([vinculo({ id: 1, vinculado_id: FAMILIAR }), vinculo({ id: 2, vinculado_id: FAMILIAR_2 })]);
      modoDoIdoso("familiar");
      for (const quem of [FAMILIAR, FAMILIAR_2]) {
        logadoComo(quem, "familiar");
        createDose.mockClear();
        expect((await post(IDOSO_A)).status).toBe(201);
        expect(createDose.mock.calls[0][0].data.registrado_por_id).toBe(quem);
      }
    });

    it("dois familiares aprovados com modo 'idoso': nenhum grava", async () => {
      fakeVinculos([vinculo({ id: 1, vinculado_id: FAMILIAR }), vinculo({ id: 2, vinculado_id: FAMILIAR_2 })]);
      modoDoIdoso("idoso");
      for (const quem of [FAMILIAR, FAMILIAR_2]) {
        logadoComo(quem, "familiar");
        expectNaoCriou(await post(IDOSO_A), 403);
      }
    });
  });

  describe("familiar: resolver real (NULL e transferência)", () => {
    beforeEach(() => {
      resolverModoDecisaoMock.mockImplementation((id: number) => resolverReal(id));
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
    });

    it("403 com modo_decisao NULL: vale 'idoso'", async () => {
      estadoModo = { ...ESTADO_NEUTRO, modo_decisao: null };
      expectNaoCriou(await post(IDOSO_A), 403);
    });

    it("403 com modo_decisao 'idoso' explícito lido pelo resolver real", async () => {
      estadoModo = { ...ESTADO_NEUTRO, modo_decisao: "idoso" };
      expectNaoCriou(await post(IDOSO_A), 403);
    });

    it("201 com modo_decisao 'familiar' lido pelo resolver real", async () => {
      estadoModo = { ...ESTADO_NEUTRO, modo_decisao: "familiar" };
      expect((await post(IDOSO_A)).status).toBe(201);
    });

    it("201 quando a transferência venceu e o resolver real efetiva 'familiar'", async () => {
      estadoModo = {
        ...ESTADO_NEUTRO,
        modo_decisao: "idoso",
        modo_decisao_solicitado: "familiar",
        modo_decisao_solicitado_por_id: FAMILIAR,
        modo_decisao_expira_em: new Date(Date.now() - 60_000),
      };
      countVinculo.mockResolvedValue(1);
      updateUsuario.mockResolvedValue({ ...ESTADO_NEUTRO, modo_decisao: "familiar" });
      const res = await post(IDOSO_A);
      expect(res.status).toBe(201);
      expect(updateUsuario).toHaveBeenCalledTimes(1);
      expect(createDose.mock.calls[0][0].data.registrado_por_id).toBe(FAMILIAR);
    });

    it("403 com transferência em curso ainda não vencida: segue 'idoso'", async () => {
      estadoModo = {
        ...ESTADO_NEUTRO,
        modo_decisao: "idoso",
        modo_decisao_solicitado: "familiar",
        modo_decisao_solicitado_por_id: FAMILIAR,
        modo_decisao_expira_em: new Date(Date.now() + 3 * 24 * 3600 * 1000),
      };
      expectNaoCriou(await post(IDOSO_A), 403);
      expect(updateUsuario).not.toHaveBeenCalled();
    });
  });

  describe("ator recusado antes do resolver; cuidador e idoso sem regressão", () => {
    it("tipo_vinculo 'familiar' com tipo_perfil 'cuidador' (com a flag): 403 e o resolver não é chamado", async () => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculo({ vinculado_id: CUIDADOR, tipo_vinculo: "familiar", ...COM_DOSE })]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A), 403);
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
    });

    it("tipo_vinculo 'familiar' com tipo_perfil 'idoso': 403 e o resolver não é chamado", async () => {
      logadoComo(IDOSO_A, "idoso");
      fakeVinculos([vinculo({ vinculado_id: IDOSO_A })]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A), 403);
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
    });

    it.each(["idoso", "familiar"] as const)(
      "cuidador com a flag segue 201 com modo '%s' (modo_decisao não o afeta) e o resolver não é chamado",
      async (modo) => {
        logadoComo(CUIDADOR, "cuidador");
        fakeVinculos([vinculoCuidador(COM_DOSE)]);
        modoDoIdoso(modo);
        const res = await post(IDOSO_A);
        expect(res.status).toBe(201);
        expect(createDose.mock.calls[0][0].data.registrado_por_id).toBe(CUIDADOR);
        expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
      },
    );

    it("cuidador sem a flag segue 403 mesmo com modo 'familiar'", async () => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador()]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A), 403);
    });

    it("403 antes de 400: familiar com modo 'idoso' e corpo inválido responde 403", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
      modoDoIdoso("idoso");
      expectNaoCriou(await post(IDOSO_A, "abc", { status_administracao: "xx" }), 403);
    });
  });

  describe("autenticação, ordem e idoso alvo", () => {
    it("401 sem token e com token inválido", async () => {
      expectNaoCriou(
        await request(app).post(`/remedios/idoso/${IDOSO_A}/${MED_A}/doses`).send({ status_administracao: "administrado" }),
        401,
      );
      verifyIdToken.mockRejectedValue(Object.assign(new Error("bad"), { code: "auth/argument-error" }));
      expectNaoCriou(await post(IDOSO_A), 401);
    });

    it("400 com idosoId não numérico, sem consultar vínculo", async () => {
      logadoComo(FAMILIAR, "familiar");
      expectNaoCriou(await post("abc"), 400);
      expect(findFirstVinculo).not.toHaveBeenCalled();
    });

    it("403 antes de 400: cuidador sem a flag com medicamentoId e corpo inválidos responde 403", async () => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador()]);
      expectNaoCriou(await post(IDOSO_A, "abc", { status_administracao: "xx" }), 403);
    });

    it("403 antes de 400: sem vínculo e corpo inválido responde 403", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([]);
      expectNaoCriou(await post(IDOSO_A, MED_A, {}), 403);
    });

    it("400 do medicamentoId vem antes do 400 do corpo e antes de consultar o medicamento", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
      const res = await post(IDOSO_A, "abc", { status_administracao: "xx" });
      expectNaoCriou(res, 400);
      expect(findFirstMedicamento).not.toHaveBeenCalled();
    });

    it("400 do corpo vem antes do 404 do medicamento", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
      expectNaoCriou(await post(IDOSO_A, 99999, { status_administracao: "xx" }), 400);
      expect(findFirstMedicamento).not.toHaveBeenCalled();
    });

    it("idoso_id do where do medicamento vem da linha do vínculo, não do path (mock que ignora o where do vínculo)", async () => {
      logadoComo(FAMILIAR, "familiar");
      findFirstVinculo.mockResolvedValue(vinculo({ idoso_id: IDOSO_A }));
      // Path aponta para o idoso B e o medicamento é do B: com o idoso do vínculo (A) tem que dar 404.
      const res = await post(IDOSO_B, MED_B);
      expectNaoCriou(res, 404);
      expect(findFirstMedicamento).toHaveBeenCalledWith({ where: { id: MED_B, idoso_id: IDOSO_A } });
    });
  });

  describe("medicamento", () => {
    beforeEach(() => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
    });

    it.each(["abc", "0", "-1", "1.5", "1e2", "%20", "2147483648"])("400 com medicamentoId %s", async (med) => {
      expectNaoCriou(await post(IDOSO_A, med), 400);
      expect(findFirstMedicamento).not.toHaveBeenCalled();
    });

    it("404 com medicamento inexistente, mensagem fixa", async () => {
      const res = await post(IDOSO_A, 99999);
      expectNaoCriou(res, 404);
      expect(res.body).toEqual({ error: MSG_404 });
    });

    it("404 com medicamento de outro idoso, idêntico ao inexistente (status e corpo), com controle positivo", async () => {
      expect((await post(IDOSO_A, MED_A)).status).toBe(201);
      createDose.mockClear();
      const alheio = await post(IDOSO_A, MED_B);
      const inexistente = await post(IDOSO_A, 99999);
      expectNaoCriou(alheio, 404);
      expect(alheio.status).toBe(inexistente.status);
      expect(alheio.body).toEqual(inexistente.body);
    });

    it("o where do medicamento leva id e idoso_id do vínculo", async () => {
      await post(IDOSO_A, MED_A);
      expect(findFirstMedicamento).toHaveBeenCalledWith({ where: { id: MED_A, idoso_id: IDOSO_A } });
    });

    it("409 com medicamento inativo, mensagem fixa", async () => {
      const res = await post(IDOSO_A, MED_INATIVO);
      expectNaoCriou(res, 409);
      expect(res.body).toEqual({ error: MSG_409 });
    });

    it("não valida janela data_inicio/data_fim: medicamento ativo sem consulta a datas segue 201", async () => {
      expect((await post(IDOSO_A, MED_A)).status).toBe(201);
    });
  });

  describe("status_administracao", () => {
    beforeEach(() => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
    });

    it.each(["administrado", "pulado", "atrasado"])("201 com '%s'", async (status) => {
      const res = await post(IDOSO_A, MED_A, { status_administracao: status });
      expect(res.status).toBe(201);
      expect(createDose.mock.calls[0][0].data.status_administracao).toBe(status);
    });

    it.each([
      ["valor inválido", { status_administracao: "tomado" }],
      ["vazio", { status_administracao: "" }],
      ["número", { status_administracao: 1 }],
      ["null", { status_administracao: null }],
      ["ausente", {}],
      ["caixa diferente", { status_administracao: "ADMINISTRADO" }],
      ["com espaço", { status_administracao: " administrado" }],
      ["array", { status_administracao: ["administrado"] }],
    ])("400 com %s", async (_n, body) => {
      const res = await post(IDOSO_A, MED_A, body);
      expectNaoCriou(res, 400);
      expect(res.body).toEqual({ error: "status_administracao inválido." });
    });
  });

  describe("data_hora_administracao", () => {
    beforeEach(() => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
    });

    const corpo = (extra: Record<string, unknown>) => ({ status_administracao: "administrado", ...extra });

    it("omitida: grava o relógio do servidor", async () => {
      const res = await post(IDOSO_A);
      expect(res.status).toBe(201);
      expect(createDose.mock.calls[0][0].data.data_hora_administracao).toEqual(NOW);
      expect(res.body.data_hora_administracao).toBe(NOW.toISOString());
    });

    it("ISO com Z aceita", async () => {
      const res = await post(IDOSO_A, MED_A, corpo({ data_hora_administracao: "2026-10-02T08:30:00Z" }));
      expect(res.status).toBe(201);
      expect(res.body.data_hora_administracao).toBe("2026-10-02T08:30:00.000Z");
    });

    it("ISO com offset aceita e converte para UTC", async () => {
      const res = await post(IDOSO_A, MED_A, corpo({ data_hora_administracao: "2026-10-02T08:30:00-03:00" }));
      expect(res.status).toBe(201);
      expect(res.body.data_hora_administracao).toBe("2026-10-02T11:30:00.000Z");
    });

    it.each([
      ["sem fuso", "2026-10-02T08:30:00"],
      ["só data", "2026-10-02"],
      ["string inválida", "ontem"],
      ["mês impossível", "2026-13-02T08:30:00Z"],
      ["número", 1760000000000],
      ["null", null],
      ["vazia", ""],
    ])("400 com %s", async (_n, valor) => {
      const res = await post(IDOSO_A, MED_A, corpo({ data_hora_administracao: valor }));
      expectNaoCriou(res, 400);
      expect(res.body).toEqual({ error: "data_hora_administracao inválida." });
    });

    it("limite exato de 5 minutos no futuro é aceito; 1 ms além é 400", async () => {
      const limite = new Date(NOW.getTime() + 5 * 60 * 1000);
      expect((await post(IDOSO_A, MED_A, corpo({ data_hora_administracao: limite.toISOString() }))).status).toBe(201);
      createDose.mockClear();
      const alem = new Date(limite.getTime() + 1);
      expectNaoCriou(await post(IDOSO_A, MED_A, corpo({ data_hora_administracao: alem.toISOString() })), 400);
    });

    it("passado distante é aceito (registro retroativo)", async () => {
      expect((await post(IDOSO_A, MED_A, corpo({ data_hora_administracao: "2026-01-01T00:00:00Z" }))).status).toBe(201);
    });
  });

  describe("observacoes", () => {
    beforeEach(() => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
    });

    const corpo = (observacoes: unknown) => ({ status_administracao: "administrado", observacoes });

    it("300 caracteres exatos aceitos, 301 é 400", async () => {
      expect((await post(IDOSO_A, MED_A, corpo("o".repeat(300)))).status).toBe(201);
      createDose.mockClear();
      const res = await post(IDOSO_A, MED_A, corpo("o".repeat(301)));
      expectNaoCriou(res, 400);
      expect(res.body).toEqual({ error: "observacoes inválidas." });
    });

    it("trim: 300 caracteres com espaços nas pontas é aceito e gravado sem os espaços", async () => {
      const res = await post(IDOSO_A, MED_A, corpo(`  ${"o".repeat(300)}  `));
      expect(res.status).toBe(201);
      expect(createDose.mock.calls[0][0].data.observacoes).toBe("o".repeat(300));
    });

    it("vazio ou só espaços vira null", async () => {
      await post(IDOSO_A, MED_A, corpo("   "));
      expect(createDose.mock.calls[0][0].data.observacoes).toBeNull();
    });

    it("null explícito aceito; omitida também vira null", async () => {
      expect((await post(IDOSO_A, MED_A, corpo(null))).status).toBe(201);
      expect(createDose.mock.calls[0][0].data.observacoes).toBeNull();
      createDose.mockClear();
      expect((await post(IDOSO_A)).status).toBe(201);
      expect(createDose.mock.calls[0][0].data.observacoes).toBeNull();
    });

    it.each([[123], [true], [["a"]], [{ a: 1 }]])("400 com tipo errado %j", async (valor) => {
      expectNaoCriou(await post(IDOSO_A, MED_A, corpo(valor)), 400);
    });
  });

  describe("gravação e resposta", () => {
    beforeEach(() => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
    });

    it("ignora autoria e campos forjados no body", async () => {
      const res = await post(IDOSO_A, MED_A, {
        status_administracao: "pulado",
        registrado_por_id: 77,
        medicamento_id: MED_B,
        idoso_id: IDOSO_B,
        created_at: "2000-01-01T00:00:00Z",
        id: 999,
      });
      expect(res.status).toBe(201);
      const { data } = createDose.mock.calls[0][0];
      expect(data.registrado_por_id).toBe(FAMILIAR);
      expect(data.medicamento_id).toBe(MED_A);
      expect(data).not.toHaveProperty("id");
      expect(data).not.toHaveProperty("created_at");
      expect(data).not.toHaveProperty("idoso_id");
    });

    it("201 serializa exatamente os 7 campos do contrato", async () => {
      const res = await post(IDOSO_A, MED_A, { status_administracao: "atrasado", observacoes: "  nota  " });
      expect(res.status).toBe(201);
      expect(Object.keys(res.body).sort()).toEqual(CAMPOS_RESPOSTA);
      expect(res.body).toMatchObject({
        id: 900,
        medicamento_id: MED_A,
        registrado_por_id: FAMILIAR,
        status_administracao: "atrasado",
        observacoes: "nota",
      });
    });

    it("sem idempotência: duas doses idênticas seguidas são aceitas (limitação documentada)", async () => {
      expect((await post(IDOSO_A)).status).toBe(201);
      expect((await post(IDOSO_A)).status).toBe(201);
      expect(createDose).toHaveBeenCalledTimes(2);
    });
  });

  describe("privacidade (RNF-001)", () => {
    const SENT_OBS = "SENT_DOSE_OBS";
    const SENT_STATUS = "SENT_DOSE_STATUS";
    const SENT_ERR = "SENT_DOSE_ERR";
    const SENT_META = "SENT_DOSE_META";
    const TODOS = [SENT_OBS, SENT_STATUS, SENT_ERR, SENT_META];
    const MSG_COM_ARGS = `Invalid invocation: data: { observacoes: '${SENT_OBS}', status_administracao: '${SENT_STATUS}', detalhe: '${SENT_ERR}' }`;

    function semSentinelas(texto: string) {
      for (const s of TODOS) expect(texto).not.toContain(s);
    }

    it("controle positivo: a captura enxerga console.*, stdout e stderr", async () => {
      const { saidas } = await capturando(async () => {
        console.error("CONTROLE_CONSOLE");
        process.stdout.write("CONTROLE_STDOUT");
        process.stderr.write("CONTROLE_STDERR");
      });
      expect(saidas).toContain("CONTROLE_CONSOLE");
      expect(saidas).toContain("CONTROLE_STDOUT");
      expect(saidas).toContain("CONTROLE_STDERR");
    });

    it("400 e 403 nunca repetem o valor enviado nem citam modo_decisao ou flags", async () => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador(COM_DOSE)]);
      const { res: r400, saidas: s1 } = await capturando(() =>
        post(IDOSO_A, MED_A, { status_administracao: SENT_STATUS, observacoes: SENT_OBS }),
      );
      fakeVinculos([vinculoCuidador()]);
      const { res: r403, saidas: s2 } = await capturando(() =>
        post(IDOSO_A, MED_A, { status_administracao: "administrado", observacoes: SENT_OBS }),
      );
      const { res: r400b, saidas: s3 } = await capturando(() =>
        post(IDOSO_A, "abc", { status_administracao: "administrado", observacoes: SENT_OBS }),
      );
      expect(r400.status).toBe(400);
      expect(r403.status).toBe(403);
      expect(r400b.status).toBe(403);
      for (const [r, s] of [[r400, s1], [r403, s2], [r400b, s3]] as const) {
        const texto = visivel(r, s);
        semSentinelas(texto);
        expect(texto).not.toMatch(/modo_decisao|permite_/i);
      }
    });

    const erroKnown = () =>
      new Prisma.PrismaClientKnownRequestError(MSG_COM_ARGS, {
        code: "P2002",
        clientVersion: "5.22.0",
        meta: { valor: SENT_META, observacoes: SENT_OBS },
      });
    const ERROS: [string, () => unknown][] = [
      ["PrismaClientKnownRequestError", erroKnown],
      ["PrismaClientValidationError", () => new Prisma.PrismaClientValidationError(MSG_COM_ARGS, { clientVersion: "5.22.0" })],
      ["Error genérico", () => new Error(MSG_COM_ARGS)],
      ["string lançada", () => MSG_COM_ARGS],
      ["objeto lançado", () => ({ observacoes: SENT_OBS, status_administracao: SENT_STATUS, detalhe: SENT_META })],
    ];
    const PONTOS: [string, (e: unknown) => void][] = [
      ["medicamento.findFirst", (e) => findFirstMedicamento.mockRejectedValue(e)],
      ["registroDoseMedicamento.create", (e) => createDose.mockRejectedValue(e)],
    ];

    describe.each(PONTOS)("falha em %s", (_ponto, injetar) => {
      it.each(ERROS)("%s: 500 genérico sem sentinela em corpo, headers, console.*, stdout e stderr", async (_t, criar) => {
        logadoComo(FAMILIAR, "familiar");
        fakeVinculos([vinculo()]);
        injetar(criar());
        const { res, saidas } = await capturando(() =>
          post(IDOSO_A, MED_A, { status_administracao: "administrado", observacoes: SENT_OBS }),
        );
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: "Erro interno." });
        semSentinelas(visivel(res, saidas));
      });
    });

    it("o errorHandler registra só name, code, método e path (e o erro foi mesmo registrado)", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
      createDose.mockRejectedValue(erroKnown());
      const { res, saidas } = await capturando(() => post(IDOSO_A, MED_A, { status_administracao: "administrado" }));
      expect(res.status).toBe(500);
      expect(saidas).toContain("PrismaClientKnownRequestError");
      expect(saidas).toContain("P2002");
      semSentinelas(saidas);
    });
  });
});
