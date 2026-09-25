import { inspect } from "node:util";
import request from "supertest";
import { Prisma } from "@prisma/client";

const verifyIdToken = jest.fn();
const findFirstUsuario = jest.fn();
const findUniqueUsuario = jest.fn();
const updateUsuario = jest.fn();
const findFirstVinculo = jest.fn();
const countVinculo = jest.fn();
const findUniqueRegistro = jest.fn();
const updateRegistro = jest.fn();
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
    registroSaude: {
      findUnique: (...args: unknown[]) => findUniqueRegistro(...args),
      update: (...args: unknown[]) => updateRegistro(...args),
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

// Todos os ids e valores abaixo são FICTÍCIOS, só para teste.
const IDOSO_A = 5;
const IDOSO_B = 6;
const CUIDADOR = 10;
const CUIDADOR_2 = 11;
const FAMILIAR = 20;
const FAMILIAR_2 = 21;
const REG = 100;
const BODY_OK = { tipo_medicao: "pressao", valor_1: 130, valor_2: 85, unidade: "mmHg" };
const MSG_403 = "Sem permissão para editar registro de saúde.";

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
    vinculado_id: CUIDADOR,
    tipo_vinculo: "cuidador",
    status: "aprovado",
    permite_registrar_saude: true,
    permite_marcar_dose: false,
    permite_criar_evento_cuidado: false,
    ...over,
  };
}

function fakeVinculos(linhas: VinculoFake[]) {
  findFirstVinculo.mockImplementation(
    async ({ where }: { where: { idoso_id: number; vinculado_id: number; status: string } }) =>
      linhas.find(
        (v) => v.idoso_id === where.idoso_id && v.vinculado_id === where.vinculado_id && v.status === where.status,
      ) ?? null,
  );
}

type RegistroFake = {
  id: number;
  idoso_id: number;
  registrado_por_id: number;
  editado_por_id: number;
  tipo_medicao: string;
  valor_1: Prisma.Decimal;
  valor_2: Prisma.Decimal | null;
  unidade: string;
  data_hora: Date;
  observacoes: string | null;
  created_at: Date;
  updated_at: Date;
};

function registro(over: Partial<RegistroFake> = {}): RegistroFake {
  return {
    id: REG,
    idoso_id: IDOSO_A,
    registrado_por_id: CUIDADOR,
    editado_por_id: CUIDADOR,
    tipo_medicao: "pressao",
    valor_1: new Prisma.Decimal("120"),
    valor_2: new Prisma.Decimal("80"),
    unidade: "mmHg",
    data_hora: new Date("2026-09-24T12:00:00Z"),
    observacoes: null,
    created_at: new Date("2026-09-24T12:00:00Z"),
    updated_at: new Date("2026-09-24T12:00:00Z"),
    ...over,
  };
}

// Armazém em memória: findUnique filtra pelo where, update aplica o data de verdade.
// Assim 404/403 não passam por vacuidade e o último editor é observável.
let registros: RegistroFake[] = [];
function fakeRegistros(linhas: RegistroFake[]) {
  registros = linhas;
  findUniqueRegistro.mockImplementation(async ({ where }: { where: { id: number } }) => {
    return registros.find((r) => r.id === where.id) ?? null;
  });
  updateRegistro.mockImplementation(async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => {
    const i = registros.findIndex((r) => r.id === where.id);
    const novo = {
      ...registros[i],
      ...data,
      valor_1: new Prisma.Decimal(String(data.valor_1)),
      valor_2: data.valor_2 === null || data.valor_2 === undefined ? null : new Prisma.Decimal(String(data.valor_2)),
    } as RegistroFake;
    registros[i] = novo;
    return novo;
  });
}

function logadoComo(id: number) {
  verifyIdToken.mockResolvedValue({ uid: `uid-${id}` });
  findFirstUsuario.mockResolvedValue({ id, firebase_uid: `uid-${id}` });
}

function modoDoIdoso(modo: "idoso" | "familiar") {
  resolverModoDecisaoMock.mockResolvedValue(modo);
}

function patchIdoso(id: number | string, body: unknown = BODY_OK) {
  return request(app)
    .patch(`/saude/${id}`)
    .set("Authorization", "Bearer x")
    .send(body as object);
}

function patchOutro(idoso: number | string, id: number | string, body: unknown = BODY_OK) {
  return request(app)
    .patch(`/saude/idoso/${idoso}/${id}`)
    .set("Authorization", "Bearer x")
    .send(body as object);
}

function expectNaoEditou(res: request.Response, status: number) {
  expect(res.status).toBe(status);
  expect(updateRegistro).not.toHaveBeenCalled();
}

beforeEach(() => {
  [
    verifyIdToken,
    findFirstUsuario,
    findUniqueUsuario,
    updateUsuario,
    findFirstVinculo,
    countVinculo,
    findUniqueRegistro,
    updateRegistro,
    resolverModoDecisaoMock,
  ].forEach((m) => m.mockReset());
  fakeRegistros([registro({ registrado_por_id: IDOSO_A, editado_por_id: IDOSO_A })]);
});

describe("PATCH /saude/:id, idoso edita o próprio registro (RF-009, RNF-006, item 4.3)", () => {
  it("200: aplica o corpo e grava editado_por_id do idoso", async () => {
    logadoComo(IDOSO_A);
    fakeRegistros([registro({ registrado_por_id: CUIDADOR, editado_por_id: CUIDADOR })]);
    const res = await patchIdoso(REG);
    expect(res.status).toBe(200);
    expect(updateRegistro).toHaveBeenCalledTimes(1);
    const { where, data } = updateRegistro.mock.calls[0][0];
    expect(where).toEqual({ id: REG });
    expect(data.editado_por_id).toBe(IDOSO_A);
    expect(data.valor_1).toBe(130);
    expect(data.valor_2).toBe(85);
    expect(res.body.id).toBe(REG);
    expect(res.body.editado_por_id).toBe(IDOSO_A);
    expect(res.body.valor_1).toBe(130);
    expect(res.body.valor_2).toBe(85);
  });

  it("idoso não consulta vínculo nem modo_decisao", async () => {
    logadoComo(IDOSO_A);
    expect((await patchIdoso(REG)).status).toBe(200);
    expect(findFirstVinculo).not.toHaveBeenCalled();
    expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
  });

  it("registro de outro idoso e registro inexistente: resposta idêntica (404), sem vazar a existência", async () => {
    logadoComo(IDOSO_B);
    const deOutro = await patchIdoso(REG);
    const inexistente = await patchIdoso(999);
    expectNaoEditou(deOutro, 404);
    expect(deOutro.status).toBe(inexistente.status);
    expect(deOutro.body).toEqual(inexistente.body);
    expect(deOutro.body).toEqual({ error: "Registro não encontrado." });
  });

  it("controle positivo do acesso cruzado: o dono edita o mesmo registro", async () => {
    logadoComo(IDOSO_B);
    expectNaoEditou(await patchIdoso(REG), 404);
    logadoComo(IDOSO_A);
    expect((await patchIdoso(REG)).status).toBe(200);
  });

  it("404 quando o registro não existe", async () => {
    logadoComo(IDOSO_A);
    expectNaoEditou(await patchIdoso(999), 404);
  });

  it("401 sem token e com token inválido", async () => {
    expectNaoEditou(await request(app).patch(`/saude/${REG}`).send(BODY_OK), 401);
    verifyIdToken.mockRejectedValue(Object.assign(new Error("bad"), { code: "auth/argument-error" }));
    expectNaoEditou(await patchIdoso(REG), 401);
  });

  it.each(["abc", "1.5", "-3", "0"])("400 com id de registro inválido (%s), sem consultar o banco", async (id) => {
    logadoComo(IDOSO_A);
    expectNaoEditou(await patchIdoso(id), 400);
    expect(findUniqueRegistro).not.toHaveBeenCalled();
  });

  it("404 antes de 400: outro idoso com corpo inválido responde 404", async () => {
    logadoComo(IDOSO_B);
    expectNaoEditou(await patchIdoso(REG, { tipo_medicao: "", valor_1: -1 }), 404);
  });

  it("404 antes de 400: registro inexistente com corpo inválido responde 404", async () => {
    logadoComo(IDOSO_A);
    expectNaoEditou(await patchIdoso(999, { tipo_medicao: "", valor_1: -1 }), 404);
  });

  it("400 de corpo só depois de confirmada a autoria", async () => {
    logadoComo(IDOSO_A);
    expectNaoEditou(await patchIdoso(REG, { tipo_medicao: "", valor_1: -1 }), 400);
  });

  it("ignora id, idoso_id, registrado_por_id e editado_por_id forjados no body", async () => {
    logadoComo(IDOSO_A);
    const res = await patchIdoso(REG, {
      ...BODY_OK,
      id: 999,
      idoso_id: IDOSO_B,
      registrado_por_id: 77,
      editado_por_id: 77,
    });
    expect(res.status).toBe(200);
    const { where, data } = updateRegistro.mock.calls[0][0];
    expect(where).toEqual({ id: REG });
    expect(data.editado_por_id).toBe(IDOSO_A);
    expect(data).not.toHaveProperty("id");
    expect(data).not.toHaveProperty("idoso_id");
    expect(data).not.toHaveProperty("registrado_por_id");
    expect(registros[0].registrado_por_id).toBe(IDOSO_A);
  });

  describe("privacidade", () => {
    const SEGREDO = "segredo-clinico-ficticio";

    it("corpo do 404 e do 400 não traz o valor enviado", async () => {
      logadoComo(IDOSO_B);
      const r404 = await patchIdoso(REG, { ...BODY_OK, observacoes: SEGREDO });
      logadoComo(IDOSO_A);
      const r400 = await patchIdoso(REG, { ...BODY_OK, valor_1: 1.234, observacoes: SEGREDO });
      expect(r404.status).toBe(404);
      expect(r400.status).toBe(400);
      for (const r of [r404, r400]) {
        const texto = JSON.stringify(r.body);
        expect(texto).not.toContain(SEGREDO);
        expect(texto).not.toContain("1.234");
      }
    });

    it("erro do Prisma no update: 500 genérico e nenhum valor de saúde em console.*", async () => {
      const VALOR = "123.45";
      logadoComo(IDOSO_A);
      updateRegistro.mockRejectedValue(
        new Prisma.PrismaClientValidationError(
          `Invalid invocation: data: { valor_1: ${VALOR}, observacoes: '${SEGREDO}' }`,
          { clientVersion: "5.22.0" },
        ),
      );
      const consoles = ["log", "info", "warn", "error", "debug"] as const;
      const espioes = consoles.map((m) => jest.spyOn(console, m).mockImplementation(() => undefined));
      try {
        const res = await patchIdoso(REG, { tipo_medicao: "peso", valor_1: 123.45, unidade: "kg", observacoes: SEGREDO });
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: "Erro interno." });
        const tudo = inspect(espioes.flatMap((s) => s.mock.calls), { depth: 8 });
        expect(tudo).not.toContain(VALOR);
        expect(tudo).not.toContain(SEGREDO);
      } finally {
        espioes.forEach((s) => s.mockRestore());
      }
    });
  });
});

describe("PATCH /saude/idoso/:idosoId/:id, cuidador/familiar (RF-009, RNF-006, item 4.3)", () => {
  describe("cuidador", () => {
    it("200 na flag ativa e registro criado por ele mesmo", async () => {
      logadoComo(CUIDADOR);
      fakeVinculos([vinculo()]);
      fakeRegistros([registro({ registrado_por_id: CUIDADOR })]);
      const res = await patchOutro(IDOSO_A, REG);
      expect(res.status).toBe(200);
      const { where, data } = updateRegistro.mock.calls[0][0];
      expect(where).toEqual({ id: REG });
      expect(data.editado_por_id).toBe(CUIDADOR);
      expect(res.body.editado_por_id).toBe(CUIDADOR);
      expect(res.body.registrado_por_id).toBe(CUIDADOR);
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
    });

    it.each([
      ["o idoso", IDOSO_A],
      ["outro cuidador", CUIDADOR_2],
      ["um familiar", FAMILIAR],
    ])("403 com a flag ativa em registro criado por %s", async (_nome, autor) => {
      logadoComo(CUIDADOR);
      fakeVinculos([vinculo()]);
      fakeRegistros([registro({ registrado_por_id: autor })]);
      const res = await patchOutro(IDOSO_A, REG);
      expectNaoEditou(res, 403);
      expect(res.body).toEqual({ error: MSG_403 });
    });

    it("403 com a flag inativa, mesmo em registro próprio", async () => {
      logadoComo(CUIDADOR);
      fakeVinculos([vinculo({ permite_registrar_saude: false })]);
      fakeRegistros([registro({ registrado_por_id: CUIDADOR })]);
      expectNaoEditou(await patchOutro(IDOSO_A, REG), 403);
    });

    it("permite_marcar_dose e permite_criar_evento_cuidado não bastam", async () => {
      logadoComo(CUIDADOR);
      fakeVinculos([
        vinculo({ permite_registrar_saude: false, permite_marcar_dose: true, permite_criar_evento_cuidado: true }),
      ]);
      fakeRegistros([registro({ registrado_por_id: CUIDADOR })]);
      expectNaoEditou(await patchOutro(IDOSO_A, REG), 403);
    });
  });

  describe("familiar", () => {
    beforeEach(() => {
      logadoComo(FAMILIAR);
      fakeVinculos([vinculo({ vinculado_id: FAMILIAR, tipo_vinculo: "familiar", permite_registrar_saude: false })]);
    });

    it.each([
      ["o idoso", IDOSO_A],
      ["um cuidador", CUIDADOR],
      ["outro familiar", FAMILIAR_2],
      ["ele mesmo", FAMILIAR],
    ])("200 com modo 'familiar' em registro criado por %s", async (_nome, autor) => {
      modoDoIdoso("familiar");
      fakeRegistros([registro({ registrado_por_id: autor })]);
      const res = await patchOutro(IDOSO_A, REG);
      expect(res.status).toBe(200);
      expect(resolverModoDecisaoMock).toHaveBeenCalledWith(IDOSO_A);
      expect(updateRegistro.mock.calls[0][0].data.editado_por_id).toBe(FAMILIAR);
      expect(res.body.registrado_por_id).toBe(autor);
    });

    it("403 com modo 'idoso'", async () => {
      modoDoIdoso("idoso");
      fakeRegistros([registro({ registrado_por_id: FAMILIAR })]);
      const res = await patchOutro(IDOSO_A, REG);
      expectNaoEditou(res, 403);
      expect(res.body).toEqual({ error: MSG_403 });
      expect(JSON.stringify(res.body)).not.toMatch(/modo_decisao/i);
    });
  });

  describe("vínculo", () => {
    it.each(["pendente", "recusado"] as const)("403 com vínculo %s", async (status) => {
      logadoComo(CUIDADOR);
      fakeVinculos([vinculo({ status })]);
      expectNaoEditou(await patchOutro(IDOSO_A, REG), 403);
    });

    it("403 sem vínculo algum", async () => {
      logadoComo(CUIDADOR);
      fakeVinculos([]);
      expectNaoEditou(await patchOutro(IDOSO_A, REG), 403);
    });

    it("403 no acesso cruzado: vínculo só com o idoso A, chamada com o idoso B", async () => {
      logadoComo(CUIDADOR);
      fakeVinculos([vinculo({ idoso_id: IDOSO_A })]);
      fakeRegistros([registro({ idoso_id: IDOSO_B, registrado_por_id: CUIDADOR })]);
      expectNaoEditou(await patchOutro(IDOSO_B, REG), 403);
    });
  });

  describe("registro", () => {
    beforeEach(() => {
      logadoComo(CUIDADOR);
      fakeVinculos([vinculo()]);
    });

    it("404 quando o registro não existe", async () => {
      expectNaoEditou(await patchOutro(IDOSO_A, 999), 404);
    });

    it("404 quando o registro é de outro idoso, com a mesma mensagem do inexistente", async () => {
      fakeRegistros([registro({ idoso_id: IDOSO_B, registrado_por_id: CUIDADOR })]);
      const outro = await patchOutro(IDOSO_A, REG);
      const inexistente = await patchOutro(IDOSO_A, 999);
      expectNaoEditou(outro, 404);
      expect(outro.body).toEqual(inexistente.body);
    });

    it.each(["abc", "1.5", "-3", "0"])("400 com id de registro inválido (%s), sem consultar registro", async (id) => {
      expectNaoEditou(await patchOutro(IDOSO_A, id), 400);
      expect(findUniqueRegistro).not.toHaveBeenCalled();
    });
  });

  describe("autenticação e ordem", () => {
    it("401 sem token e com token inválido", async () => {
      expectNaoEditou(await request(app).patch(`/saude/idoso/${IDOSO_A}/${REG}`).send(BODY_OK), 401);
      verifyIdToken.mockRejectedValue(Object.assign(new Error("bad"), { code: "auth/argument-error" }));
      expectNaoEditou(await patchOutro(IDOSO_A, REG), 401);
    });

    it("400 com idosoId não numérico, sem consultar vínculo", async () => {
      logadoComo(CUIDADOR);
      expectNaoEditou(await patchOutro("abc", REG), 400);
      expect(findFirstVinculo).not.toHaveBeenCalled();
    });

    it("403 de vínculo antes do 400 de id de registro", async () => {
      logadoComo(CUIDADOR);
      fakeVinculos([]);
      expectNaoEditou(await patchOutro(IDOSO_A, "abc"), 403);
    });

    it("400 de id de registro antes do 404", async () => {
      logadoComo(CUIDADOR);
      fakeVinculos([vinculo()]);
      expectNaoEditou(await patchOutro(IDOSO_A, "abc"), 400);
    });

    it("404 antes do 403 de autoridade: registro inexistente responde 404 mesmo sem flag", async () => {
      logadoComo(CUIDADOR);
      fakeVinculos([vinculo({ permite_registrar_saude: false })]);
      expectNaoEditou(await patchOutro(IDOSO_A, 999), 404);
    });

    it("403 de autoridade antes do 400 de corpo", async () => {
      logadoComo(CUIDADOR);
      fakeVinculos([vinculo()]);
      fakeRegistros([registro({ registrado_por_id: IDOSO_A })]);
      expectNaoEditou(await patchOutro(IDOSO_A, REG, { tipo_medicao: "", valor_1: -1 }), 403);
    });

    it("400 de corpo só depois de autorizado", async () => {
      logadoComo(CUIDADOR);
      fakeVinculos([vinculo()]);
      fakeRegistros([registro({ registrado_por_id: CUIDADOR })]);
      expectNaoEditou(await patchOutro(IDOSO_A, REG, { tipo_medicao: "", valor_1: -1 }), 400);
    });
  });

  describe("editado_por_id e corpo forjado", () => {
    it("dois updates por atores diferentes: editado_por_id reflete o último e nunca fica nulo", async () => {
      fakeVinculos([
        vinculo({ vinculado_id: CUIDADOR }),
        vinculo({ id: 2, vinculado_id: FAMILIAR, tipo_vinculo: "familiar", permite_registrar_saude: false }),
      ]);
      modoDoIdoso("familiar");
      fakeRegistros([registro({ registrado_por_id: CUIDADOR, editado_por_id: CUIDADOR })]);

      logadoComo(IDOSO_A);
      expect((await patchIdoso(REG)).status).toBe(200);
      expect(registros[0].editado_por_id).toBe(IDOSO_A);

      logadoComo(FAMILIAR);
      expect((await patchOutro(IDOSO_A, REG)).status).toBe(200);
      expect(registros[0].editado_por_id).toBe(FAMILIAR);

      logadoComo(CUIDADOR);
      expect((await patchOutro(IDOSO_A, REG)).status).toBe(200);
      expect(registros[0].editado_por_id).toBe(CUIDADOR);

      expect(registros[0].editado_por_id).not.toBeNull();
      expect(registros[0].registrado_por_id).toBe(CUIDADOR);
      expect(registros[0].idoso_id).toBe(IDOSO_A);
    });

    it("ignora id, idoso_id, registrado_por_id e editado_por_id forjados no body", async () => {
      logadoComo(CUIDADOR);
      fakeVinculos([vinculo()]);
      fakeRegistros([registro({ registrado_por_id: CUIDADOR })]);
      const res = await patchOutro(IDOSO_A, REG, {
        ...BODY_OK,
        id: 999,
        idoso_id: IDOSO_B,
        registrado_por_id: 77,
        editado_por_id: 77,
      });
      expect(res.status).toBe(200);
      const { where, data } = updateRegistro.mock.calls[0][0];
      expect(where).toEqual({ id: REG });
      expect(data.editado_por_id).toBe(CUIDADOR);
      expect(data).not.toHaveProperty("id");
      expect(data).not.toHaveProperty("idoso_id");
      expect(data).not.toHaveProperty("registrado_por_id");
      expect(registros[0].idoso_id).toBe(IDOSO_A);
      expect(registros[0].registrado_por_id).toBe(CUIDADOR);
    });
  });

  describe("privacidade", () => {
    const SEGREDO = "segredo-clinico-ficticio";

    it("corpo do 403 e do 400 não traz o valor enviado nem cita modo_decisao", async () => {
      logadoComo(FAMILIAR);
      fakeVinculos([vinculo({ vinculado_id: FAMILIAR, tipo_vinculo: "familiar" })]);
      fakeRegistros([registro({ registrado_por_id: FAMILIAR })]);
      modoDoIdoso("idoso");
      const r403 = await patchOutro(IDOSO_A, REG, { ...BODY_OK, observacoes: SEGREDO });
      modoDoIdoso("familiar");
      const r400 = await patchOutro(IDOSO_A, REG, { ...BODY_OK, valor_1: 1.234, observacoes: SEGREDO });
      expect(r403.status).toBe(403);
      expect(r400.status).toBe(400);
      for (const r of [r403, r400]) {
        const texto = JSON.stringify(r.body);
        expect(texto).not.toContain(SEGREDO);
        expect(texto).not.toContain("1.234");
        expect(texto).not.toMatch(/modo_decisao/i);
      }
    });

    it("erro do Prisma no update: 500 genérico e nenhum valor de saúde em console.*", async () => {
      const VALOR = "123.45";
      logadoComo(CUIDADOR);
      fakeVinculos([vinculo()]);
      fakeRegistros([registro({ registrado_por_id: CUIDADOR })]);
      updateRegistro.mockRejectedValue(
        new Prisma.PrismaClientValidationError(
          `Invalid invocation: data: { valor_1: ${VALOR}, observacoes: '${SEGREDO}' }`,
          { clientVersion: "5.22.0" },
        ),
      );
      const consoles = ["log", "info", "warn", "error", "debug"] as const;
      const espioes = consoles.map((m) => jest.spyOn(console, m).mockImplementation(() => undefined));
      try {
        const res = await patchOutro(IDOSO_A, REG, {
          tipo_medicao: "peso",
          valor_1: 123.45,
          unidade: "kg",
          observacoes: SEGREDO,
        });
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: "Erro interno." });
        const tudo = inspect(espioes.flatMap((s) => s.mock.calls), { depth: 8 });
        expect(tudo).not.toContain(VALOR);
        expect(tudo).not.toContain(SEGREDO);
      } finally {
        espioes.forEach((s) => s.mockRestore());
      }
    });
  });
});

// Edição parcial: campo ausente mantém o valor atual do registro, nunca vira default.
describe.each([
  ["PATCH /saude/:id (idoso)", IDOSO_A, () => fakeVinculos([]), (b: unknown) => patchIdoso(REG, b)],
  [
    "PATCH /saude/idoso/:idosoId/:id (cuidador)",
    CUIDADOR,
    () => fakeVinculos([vinculo()]),
    (b: unknown) => patchOutro(IDOSO_A, REG, b),
  ],
] as const)("%s: edição parcial", (_nome, quem, preparar, enviar) => {
  const ORIGINAL = registro({
    registrado_por_id: quem,
    editado_por_id: quem,
    observacoes: "obs original",
    data_hora: new Date("2026-09-24T12:00:00Z"),
  });

  beforeEach(() => {
    logadoComo(quem);
    preparar();
    fakeRegistros([ORIGINAL]);
  });

  it("só valor_1: preserva data_hora, tipo, valor_2, unidade e observações originais", async () => {
    const res = await enviar({ valor_1: 150 });
    expect(res.status).toBe(200);
    const { data } = updateRegistro.mock.calls[0][0];
    expect(data.valor_1).toBe(150);
    expect(data.data_hora).toEqual(new Date("2026-09-24T12:00:00Z"));
    expect(data.tipo_medicao).toBe("pressao");
    expect(data.valor_2).toBe(80);
    expect(data.unidade).toBe("mmHg");
    expect(data.observacoes).toBe("obs original");
    expect(data.editado_por_id).toBe(quem);
    expect(res.body.data_hora).toBe("2026-09-24T12:00:00.000Z");
  });

  it("só observacoes: os demais campos ficam como estavam", async () => {
    expect((await enviar({ observacoes: "nova" })).status).toBe(200);
    const { data } = updateRegistro.mock.calls[0][0];
    expect(data.observacoes).toBe("nova");
    expect(data.valor_1).toBe(120);
    expect(data.data_hora).toEqual(new Date("2026-09-24T12:00:00Z"));
  });

  it("valor_2 e observacoes null explícitos limpam o campo", async () => {
    expect((await enviar({ valor_2: null, observacoes: null })).status).toBe(200);
    const { data } = updateRegistro.mock.calls[0][0];
    expect(data.valor_2).toBeNull();
    expect(data.observacoes).toBeNull();
  });

  it("data_hora enviada substitui a original", async () => {
    expect((await enviar({ data_hora: "2026-09-25T08:00:00Z" })).status).toBe(200);
    expect(updateRegistro.mock.calls[0][0].data.data_hora).toEqual(new Date("2026-09-25T08:00:00Z"));
  });

  it("400 com campo enviado inválido, mesmo sendo edição parcial", async () => {
    const res = await enviar({ valor_1: -5 });
    expectNaoEditou(res, 400);
    expect(res.body).toEqual({ error: "valor_1 inválido." });
  });

  it.each([[{}], [{ id: 999, idoso_id: IDOSO_B, editado_por_id: 77 }]])(
    "400 sem nenhum campo de leitura no corpo (%j), sem update",
    async (corpo) => {
      const res = await enviar(corpo);
      expectNaoEditou(res, 400);
      expect(res.body).toEqual({ error: "Nenhum campo de leitura informado." });
    },
  );
});
