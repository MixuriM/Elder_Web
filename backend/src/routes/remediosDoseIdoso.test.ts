import { inspect } from "node:util";
import request from "supertest";
import { Prisma } from "@prisma/client";

// Item 5.2 (RF-012): POST /remedios/:medicamentoId/doses, o idoso marca dose do PRÓPRIO medicamento.
// Qualquer outro perfil recebe 403. Dose e medicamento são dado sensível (RNF-001). Todos os ids e
// valores abaixo são FICTÍCIOS, só para teste. A matriz completa de status, data e observacoes está em
// remediosDoseVinculado.test.ts; aqui ficam os casos próprios da rota do idoso.

const verifyIdToken = jest.fn();
const findFirstUsuario = jest.fn();
const findUniqueUsuario = jest.fn();
const findFirstMedicamento = jest.fn();
const createDose = jest.fn();

jest.mock("../lib/firebaseAdmin", () => ({
  auth: { verifyIdToken: (...args: unknown[]) => verifyIdToken(...args) },
}));
jest.mock("../lib/prisma", () => ({
  prisma: {
    usuario: {
      findFirst: (...args: unknown[]) => findFirstUsuario(...args),
      findUnique: (...args: unknown[]) => findUniqueUsuario(...args),
    },
    medicamento: { findFirst: (...args: unknown[]) => findFirstMedicamento(...args) },
    registroDoseMedicamento: { create: (...args: unknown[]) => createDose(...args) },
  },
}));

import app from "../app";

type Perfil = "idoso" | "cuidador" | "familiar";

const IDOSO_A = 5;
const IDOSO_B = 6;
const CUIDADOR = 10;
const FAMILIAR = 20;
const MED_A = 100;
const MED_INATIVO = 101;
const MED_B = 200;
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

type MedFake = { id: number; idoso_id: number; ativo: boolean };
const MEDICAMENTOS: MedFake[] = [
  { id: MED_A, idoso_id: IDOSO_A, ativo: true },
  { id: MED_INATIVO, idoso_id: IDOSO_A, ativo: false },
  { id: MED_B, idoso_id: IDOSO_B, ativo: true },
];

// Filtra de verdade pelo where (chave undefined não filtra, como no Prisma).
function fakeMedicamentos() {
  findFirstMedicamento.mockImplementation(async ({ where }: { where: Partial<MedFake> }) =>
    MEDICAMENTOS.find((m) => (Object.keys(where) as (keyof MedFake)[]).every((k) => where[k] === undefined || m[k] === where[k])) ?? null,
  );
}

const perfis: Record<number, Perfil> = {};

function logadoComo(id: number, perfil: Perfil) {
  perfis[id] = perfil;
  verifyIdToken.mockResolvedValue({ uid: `uid-${id}` });
  findFirstUsuario.mockResolvedValue({ id, firebase_uid: `uid-${id}` });
}

function post(med: number | string = MED_A, body: unknown = { status_administracao: "administrado" }) {
  return request(app)
    .post(`/remedios/${med}/doses`)
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
  [verifyIdToken, findFirstUsuario, findUniqueUsuario, findFirstMedicamento, createDose].forEach((m) => m.mockReset());
  Object.keys(perfis).forEach((k) => delete perfis[Number(k)]);
  findUniqueUsuario.mockImplementation(async ({ where }: { where: { id: number } }) =>
    perfis[where.id] ? { tipo_perfil: perfis[where.id] } : null,
  );
  fakeMedicamentos();
  createDose.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 900,
    created_at: new Date(NOW),
    ...data,
  }));
});

afterEach(() => jest.useRealTimers());

describe("POST /remedios/:medicamentoId/doses (RF-012, item 5.2, idoso)", () => {
  it("201: registrado_por_id é o idoso e o where do medicamento leva o idoso logado", async () => {
    logadoComo(IDOSO_A, "idoso");
    const res = await post();
    expect(res.status).toBe(201);
    expect(findFirstMedicamento).toHaveBeenCalledWith({ where: { id: MED_A, idoso_id: IDOSO_A } });
    const { data } = createDose.mock.calls[0][0];
    expect(data.registrado_por_id).toBe(IDOSO_A);
    expect(data.medicamento_id).toBe(MED_A);
    expect(Object.keys(res.body).sort()).toEqual(CAMPOS_RESPOSTA);
    expect(res.body).toMatchObject({ registrado_por_id: IDOSO_A, medicamento_id: MED_A, status_administracao: "administrado" });
    expect(res.body.data_hora_administracao).toBe(NOW.toISOString());
  });

  it.each(["administrado", "pulado", "atrasado"])("201 com status '%s'", async (status) => {
    logadoComo(IDOSO_A, "idoso");
    expect((await post(MED_A, { status_administracao: status })).status).toBe(201);
  });

  it.each([
    ["inválido", { status_administracao: "tomado" }],
    ["vazio", { status_administracao: "" }],
    ["número", { status_administracao: 1 }],
    ["null", { status_administracao: null }],
    ["ausente", {}],
    ["caixa diferente", { status_administracao: "ADMINISTRADO" }],
  ])("400 com status %s", async (_n, body) => {
    logadoComo(IDOSO_A, "idoso");
    const res = await post(MED_A, body);
    expectNaoCriou(res, 400);
    expect(res.body).toEqual({ error: "status_administracao inválido." });
  });

  it("data_hora_administracao: ISO com fuso aceito; sem fuso e futura além de 5 minutos são 400; limite exato aceito", async () => {
    logadoComo(IDOSO_A, "idoso");
    const base = { status_administracao: "pulado" };
    expect((await post(MED_A, { ...base, data_hora_administracao: "2026-10-02T08:30:00-03:00" })).status).toBe(201);
    createDose.mockClear();
    const limite = new Date(NOW.getTime() + 5 * 60 * 1000);
    expect((await post(MED_A, { ...base, data_hora_administracao: limite.toISOString() })).status).toBe(201);
    createDose.mockClear();
    expectNaoCriou(await post(MED_A, { ...base, data_hora_administracao: new Date(limite.getTime() + 1).toISOString() }), 400);
    expectNaoCriou(await post(MED_A, { ...base, data_hora_administracao: "2026-10-02T08:30:00" }), 400);
    expectNaoCriou(await post(MED_A, { ...base, data_hora_administracao: "ontem" }), 400);
  });

  it("observacoes: 300 aceitas, 301 é 400, trim, vazio vira null, null aceito, tipo errado é 400", async () => {
    logadoComo(IDOSO_A, "idoso");
    const corpo = (observacoes: unknown) => ({ status_administracao: "administrado", observacoes });
    expect((await post(MED_A, corpo("o".repeat(300)))).status).toBe(201);
    createDose.mockClear();
    expectNaoCriou(await post(MED_A, corpo("o".repeat(301))), 400);
    expect((await post(MED_A, corpo("  nota  "))).status).toBe(201);
    expect(createDose.mock.calls[0][0].data.observacoes).toBe("nota");
    createDose.mockClear();
    expect((await post(MED_A, corpo("   "))).status).toBe(201);
    expect(createDose.mock.calls[0][0].data.observacoes).toBeNull();
    createDose.mockClear();
    expect((await post(MED_A, corpo(null))).status).toBe(201);
    createDose.mockClear();
    expectNaoCriou(await post(MED_A, corpo(123)), 400);
  });

  it("ignora autoria e campos forjados no body", async () => {
    logadoComo(IDOSO_A, "idoso");
    const res = await post(MED_A, {
      status_administracao: "administrado",
      registrado_por_id: 77,
      medicamento_id: MED_B,
      idoso_id: IDOSO_B,
      created_at: "2000-01-01T00:00:00Z",
      id: 999,
    });
    expect(res.status).toBe(201);
    const { data } = createDose.mock.calls[0][0];
    expect(data.registrado_por_id).toBe(IDOSO_A);
    expect(data.medicamento_id).toBe(MED_A);
    expect(data).not.toHaveProperty("id");
    expect(data).not.toHaveProperty("created_at");
    expect(data).not.toHaveProperty("idoso_id");
  });

  describe("perfil", () => {
    it("403 para cuidador, mesmo com a flag no vínculo (esta rota é só do idoso)", async () => {
      logadoComo(CUIDADOR, "cuidador");
      const res = await post();
      expectNaoCriou(res, 403);
      expect(res.body).toEqual({ error: MSG_403 });
      expect(findFirstMedicamento).not.toHaveBeenCalled();
    });

    it("403 para familiar", async () => {
      logadoComo(FAMILIAR, "familiar");
      const res = await post();
      expectNaoCriou(res, 403);
      expect(res.body).toEqual({ error: MSG_403 });
      expect(findFirstMedicamento).not.toHaveBeenCalled();
    });

    it("403 quando o perfil do chamador não é encontrado", async () => {
      verifyIdToken.mockResolvedValue({ uid: "uid-1" });
      findFirstUsuario.mockResolvedValue({ id: 1, firebase_uid: "uid-1" });
      expectNaoCriou(await post(), 403);
    });
  });

  describe("ordem e autenticação", () => {
    it("401 sem token e com token inválido", async () => {
      expectNaoCriou(await request(app).post(`/remedios/${MED_A}/doses`).send({ status_administracao: "administrado" }), 401);
      verifyIdToken.mockRejectedValue(Object.assign(new Error("bad"), { code: "auth/argument-error" }));
      expectNaoCriou(await post(), 401);
    });

    it("403 antes de 400: cuidador com medicamentoId e corpo inválidos responde 403", async () => {
      logadoComo(CUIDADOR, "cuidador");
      expectNaoCriou(await post("abc", { status_administracao: "xx" }), 403);
    });

    it("400 do medicamentoId vem antes do 400 do corpo", async () => {
      logadoComo(IDOSO_A, "idoso");
      const res = await post("abc", { status_administracao: "xx" });
      expectNaoCriou(res, 400);
      expect(findFirstMedicamento).not.toHaveBeenCalled();
    });

    it("400 do corpo vem antes do 404", async () => {
      logadoComo(IDOSO_A, "idoso");
      expectNaoCriou(await post(99999, { status_administracao: "xx" }), 400);
      expect(findFirstMedicamento).not.toHaveBeenCalled();
    });
  });

  describe("medicamento", () => {
    beforeEach(() => logadoComo(IDOSO_A, "idoso"));

    it.each(["abc", "0", "-1", "1.5", "1e2", "2147483648"])("400 com medicamentoId %s", async (med) => {
      expectNaoCriou(await post(med), 400);
      expect(findFirstMedicamento).not.toHaveBeenCalled();
    });

    it("404 inexistente, mensagem fixa", async () => {
      const res = await post(99999);
      expectNaoCriou(res, 404);
      expect(res.body).toEqual({ error: MSG_404 });
    });

    it("404 com medicamento de outro idoso, idêntico ao inexistente (status e corpo), com controle positivo", async () => {
      expect((await post(MED_A)).status).toBe(201);
      createDose.mockClear();
      const alheio = await post(MED_B);
      const inexistente = await post(99999);
      expectNaoCriou(alheio, 404);
      expect(alheio.status).toBe(inexistente.status);
      expect(alheio.body).toEqual(inexistente.body);
    });

    it("o idoso B alcança o próprio medicamento e não o do A (simetria do filtro)", async () => {
      logadoComo(IDOSO_B, "idoso");
      expect((await post(MED_B)).status).toBe(201);
      createDose.mockClear();
      expectNaoCriou(await post(MED_A), 404);
    });

    it("409 com medicamento inativo, mensagem fixa", async () => {
      const res = await post(MED_INATIVO);
      expectNaoCriou(res, 409);
      expect(res.body).toEqual({ error: MSG_409 });
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

    it("400 com status e observacoes sigilosos não repete o valor em corpo, headers nem saídas", async () => {
      logadoComo(IDOSO_A, "idoso");
      const { res, saidas } = await capturando(() =>
        post(MED_A, { status_administracao: SENT_STATUS, observacoes: SENT_OBS }),
      );
      expect(res.status).toBe(400);
      semSentinelas(visivel(res, saidas));
      const { res: r2, saidas: s2 } = await capturando(() =>
        post(MED_A, { status_administracao: "administrado", observacoes: SENT_OBS + "x".repeat(300) }),
      );
      expect(r2.status).toBe(400);
      semSentinelas(visivel(r2, s2));
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
        logadoComo(IDOSO_A, "idoso");
        injetar(criar());
        const { res, saidas } = await capturando(() =>
          post(MED_A, { status_administracao: "administrado", observacoes: SENT_OBS }),
        );
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: "Erro interno." });
        semSentinelas(visivel(res, saidas));
      });
    });

    it("o errorHandler registra só name, code, método e path (e o erro foi mesmo registrado)", async () => {
      logadoComo(IDOSO_A, "idoso");
      createDose.mockRejectedValue(erroKnown());
      const { res, saidas } = await capturando(() => post(MED_A, { status_administracao: "administrado" }));
      expect(res.status).toBe(500);
      expect(saidas).toContain("PrismaClientKnownRequestError");
      expect(saidas).toContain("P2002");
      semSentinelas(saidas);
    });
  });
});
