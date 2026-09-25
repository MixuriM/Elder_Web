import { inspect } from "node:util";
import request from "supertest";
import { Prisma } from "@prisma/client";

const verifyIdToken = jest.fn();
const findFirstUsuario = jest.fn();
const findUniqueUsuario = jest.fn();
const updateUsuario = jest.fn();
const findFirstVinculo = jest.fn();
const countVinculo = jest.fn();
const createRegistro = jest.fn();
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
    registroSaude: { create: (...args: unknown[]) => createRegistro(...args) },
  },
}));
// Só resolverModoDecisao é trocada: o resto de vinculo.ts (router, resolverEstadoModoDecisao) segue real.
jest.mock("./vinculo", () => ({
  __esModule: true,
  ...jest.requireActual("./vinculo"),
  resolverModoDecisao: (...args: unknown[]) => resolverModoDecisaoMock(...args),
}));

import app from "../app";
const resolverReal: (id: number) => Promise<"idoso" | "familiar"> =
  jest.requireActual("./vinculo").resolverModoDecisao;

// Todos os ids e valores abaixo são FICTÍCIOS, só para teste.
const CUIDADOR = 10;
const FAMILIAR = 20;
const FAMILIAR_2 = 21;
const IDOSO_A = 5;
const IDOSO_B = 6;
const BODY_OK = { tipo_medicao: "pressao", valor_1: 120, valor_2: 80, unidade: "mmHg" };
const MSG_403 = "Sem permissão para registrar leitura de saúde.";

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

// Fake que FILTRA de verdade pelo where recebido, para o acesso cruzado não passar por vacuidade.
function fakeVinculos(linhas: VinculoFake[]) {
  findFirstVinculo.mockImplementation(
    async ({ where }: { where: { idoso_id: number; vinculado_id: number; status: string } }) =>
      linhas.find(
        (v) => v.idoso_id === where.idoso_id && v.vinculado_id === where.vinculado_id && v.status === where.status,
      ) ?? null,
  );
}

function registroDevolvido(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    idoso_id: IDOSO_A,
    registrado_por_id: FAMILIAR,
    editado_por_id: FAMILIAR,
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

function logadoComo(id: number) {
  verifyIdToken.mockResolvedValue({ uid: `uid-${id}` });
  findFirstUsuario.mockResolvedValue({ id, firebase_uid: `uid-${id}` });
}

function modoDoIdoso(modo: "idoso" | "familiar") {
  resolverModoDecisaoMock.mockResolvedValue(modo);
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

function post(idoso: number | string, body: unknown = BODY_OK) {
  return request(app)
    .post(`/saude/idoso/${idoso}`)
    .set("Authorization", "Bearer x")
    .send(body as object);
}

function expectNaoCriou(res: request.Response, status: number) {
  expect(res.status).toBe(status);
  expect(createRegistro).not.toHaveBeenCalled();
}

beforeEach(() => {
  [
    verifyIdToken,
    findFirstUsuario,
    findUniqueUsuario,
    updateUsuario,
    findFirstVinculo,
    countVinculo,
    createRegistro,
    resolverModoDecisaoMock,
  ].forEach((m) => m.mockReset());
  createRegistro.mockResolvedValue(registroDevolvido());
});

describe("POST /saude/idoso/:idosoId, familiar (RF-007, RF-009, item 4.2b)", () => {
  describe("matriz modo_decisao x vínculo (resolver mockado)", () => {
    it("201 com modo 'familiar' e vínculo aprovado: autoria do familiar, idoso_id do vínculo", async () => {
      logadoComo(FAMILIAR);
      fakeVinculos([vinculo()]);
      modoDoIdoso("familiar");
      const res = await post(IDOSO_A);
      expect(res.status).toBe(201);
      expect(resolverModoDecisaoMock).toHaveBeenCalledWith(IDOSO_A);
      expect(createRegistro).toHaveBeenCalledTimes(1);
      const { data } = createRegistro.mock.calls[0][0];
      expect(data.idoso_id).toBe(IDOSO_A);
      expect(data.registrado_por_id).toBe(FAMILIAR);
      expect(data.editado_por_id).toBe(FAMILIAR);
    });

    it("403 com modo 'idoso' e vínculo aprovado", async () => {
      logadoComo(FAMILIAR);
      fakeVinculos([vinculo()]);
      modoDoIdoso("idoso");
      const res = await post(IDOSO_A);
      expectNaoCriou(res, 403);
      expect(res.body).toEqual({ error: MSG_403 });
    });

    it.each(["pendente", "recusado"] as const)("403 com modo 'familiar' e vínculo %s", async (status) => {
      logadoComo(FAMILIAR);
      fakeVinculos([vinculo({ status })]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A), 403);
    });

    it("403 com modo 'familiar' e vínculo inexistente (resolver nem é consultado)", async () => {
      logadoComo(FAMILIAR);
      fakeVinculos([]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A), 403);
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
    });

    it("403 no acesso cruzado: aprovado só com o idoso A, chamada com o idoso B", async () => {
      logadoComo(FAMILIAR);
      fakeVinculos([vinculo({ idoso_id: IDOSO_A })]);
      modoDoIdoso("familiar");
      // Controle positivo: o mesmo fake libera o idoso A.
      expect((await post(IDOSO_A)).status).toBe(201);
      createRegistro.mockClear();
      expectNaoCriou(await post(IDOSO_B), 403);
    });

    it("dois familiares aprovados do mesmo idoso: cada um escreve com a própria autoria", async () => {
      fakeVinculos([vinculo({ id: 1, vinculado_id: FAMILIAR }), vinculo({ id: 2, vinculado_id: FAMILIAR_2 })]);
      modoDoIdoso("familiar");
      for (const quem of [FAMILIAR, FAMILIAR_2]) {
        logadoComo(quem);
        createRegistro.mockClear();
        expect((await post(IDOSO_A)).status).toBe(201);
        const { data } = createRegistro.mock.calls[0][0];
        expect(data.registrado_por_id).toBe(quem);
        expect(data.editado_por_id).toBe(quem);
        expect(data.idoso_id).toBe(IDOSO_A);
      }
    });
  });

  describe("resolver real (NULL e transferência)", () => {
    beforeEach(() => {
      resolverModoDecisaoMock.mockImplementation((id: number) => resolverReal(id));
    });

    it("403 com modo_decisao NULL: vale 'idoso'", async () => {
      logadoComo(FAMILIAR);
      fakeVinculos([vinculo()]);
      findUniqueUsuario.mockResolvedValue({ ...ESTADO_NEUTRO, modo_decisao: null });
      expectNaoCriou(await post(IDOSO_A), 403);
    });

    it("403 com modo_decisao 'idoso' explícito lido pelo resolver real", async () => {
      logadoComo(FAMILIAR);
      fakeVinculos([vinculo()]);
      findUniqueUsuario.mockResolvedValue({ ...ESTADO_NEUTRO, modo_decisao: "idoso" });
      expectNaoCriou(await post(IDOSO_A), 403);
    });

    it("201 quando a transferência venceu e o resolver real efetiva 'familiar' (1 familiar aprovado)", async () => {
      logadoComo(FAMILIAR);
      fakeVinculos([vinculo()]);
      findUniqueUsuario.mockResolvedValue({
        ...ESTADO_NEUTRO,
        modo_decisao: "idoso",
        modo_decisao_solicitado: "familiar",
        modo_decisao_solicitado_por_id: FAMILIAR,
        modo_decisao_expira_em: new Date(Date.now() - 60_000),
      });
      countVinculo.mockResolvedValue(1);
      updateUsuario.mockResolvedValue({ ...ESTADO_NEUTRO, modo_decisao: "familiar" });
      const res = await post(IDOSO_A);
      expect(res.status).toBe(201);
      expect(updateUsuario).toHaveBeenCalledTimes(1);
      expect(createRegistro.mock.calls[0][0].data.registrado_por_id).toBe(FAMILIAR);
    });

    it("403 quando venceu com 2+ familiares e sem segunda confirmação: solicitação lapsa, não efetiva", async () => {
      logadoComo(FAMILIAR);
      fakeVinculos([vinculo()]);
      findUniqueUsuario.mockResolvedValue({
        ...ESTADO_NEUTRO,
        modo_decisao: "idoso",
        modo_decisao_solicitado: "familiar",
        modo_decisao_solicitado_por_id: FAMILIAR,
        modo_decisao_expira_em: new Date(Date.now() - 60_000),
      });
      countVinculo.mockResolvedValue(2);
      updateUsuario.mockResolvedValue({ ...ESTADO_NEUTRO, modo_decisao: "idoso" });
      expectNaoCriou(await post(IDOSO_A), 403);
    });

    it("403 com transferência em curso ainda não vencida: segue 'idoso'", async () => {
      logadoComo(FAMILIAR);
      fakeVinculos([vinculo()]);
      findUniqueUsuario.mockResolvedValue({
        ...ESTADO_NEUTRO,
        modo_decisao: "idoso",
        modo_decisao_solicitado: "familiar",
        modo_decisao_solicitado_por_id: FAMILIAR,
        modo_decisao_expira_em: new Date(Date.now() + 3 * 24 * 3600 * 1000),
      });
      expectNaoCriou(await post(IDOSO_A), 403);
      expect(updateUsuario).not.toHaveBeenCalled();
    });
  });

  describe("sem regressão do cuidador (4.2)", () => {
    it("cuidador com a flag ativa continua 201, sem consultar modo_decisao", async () => {
      logadoComo(CUIDADOR);
      fakeVinculos([vinculo({ vinculado_id: CUIDADOR, tipo_vinculo: "cuidador", permite_registrar_saude: true })]);
      modoDoIdoso("idoso");
      const res = await post(IDOSO_A);
      expect(res.status).toBe(201);
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
      expect(createRegistro.mock.calls[0][0].data.registrado_por_id).toBe(CUIDADOR);
    });

    it("cuidador com a flag falsa continua 403 mesmo com modo 'familiar' no idoso", async () => {
      logadoComo(CUIDADOR);
      fakeVinculos([vinculo({ vinculado_id: CUIDADOR, tipo_vinculo: "cuidador", permite_registrar_saude: false })]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A), 403);
    });
  });

  describe("autenticação, ordem e corpo", () => {
    it("401 sem token e com token inválido", async () => {
      expectNaoCriou(await request(app).post(`/saude/idoso/${IDOSO_A}`).send(BODY_OK), 401);
      verifyIdToken.mockRejectedValue(Object.assign(new Error("bad"), { code: "auth/argument-error" }));
      expectNaoCriou(await post(IDOSO_A), 401);
    });

    it("400 com idosoId não numérico, sem consultar vínculo nem resolver", async () => {
      logadoComo(FAMILIAR);
      expectNaoCriou(await post("abc"), 400);
      expect(findFirstVinculo).not.toHaveBeenCalled();
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
    });

    it("403 antes de 400: modo 'idoso' e corpo inválido responde 403", async () => {
      logadoComo(FAMILIAR);
      fakeVinculos([vinculo()]);
      modoDoIdoso("idoso");
      expectNaoCriou(await post(IDOSO_A, { tipo_medicao: "", valor_1: -1 }), 403);
    });

    it("400 de corpo só depois de autorizado (modo 'familiar')", async () => {
      logadoComo(FAMILIAR);
      fakeVinculos([vinculo()]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A, { tipo_medicao: "", valor_1: -1 }), 400);
    });

    it("ignora autoria, idoso_id e id forjados no body", async () => {
      logadoComo(FAMILIAR);
      fakeVinculos([vinculo()]);
      modoDoIdoso("familiar");
      const res = await post(IDOSO_A, {
        ...BODY_OK,
        id: 999,
        idoso_id: IDOSO_B,
        registrado_por_id: 77,
        editado_por_id: 77,
      });
      expect(res.status).toBe(201);
      const { data } = createRegistro.mock.calls[0][0];
      expect(data.idoso_id).toBe(IDOSO_A);
      expect(data.registrado_por_id).toBe(FAMILIAR);
      expect(data.editado_por_id).toBe(FAMILIAR);
      expect(data).not.toHaveProperty("id");
    });

    it("idoso_id gravado vem da linha do vínculo, não do path (mock que ignora o where)", async () => {
      logadoComo(FAMILIAR);
      findFirstVinculo.mockResolvedValue(vinculo({ idoso_id: IDOSO_A }));
      modoDoIdoso("familiar");
      expect((await post(IDOSO_B)).status).toBe(201);
      expect(createRegistro.mock.calls[0][0].data.idoso_id).toBe(IDOSO_A);
      expect(resolverModoDecisaoMock).toHaveBeenCalledWith(IDOSO_A);
    });
  });

  describe("privacidade", () => {
    const SEGREDO = "segredo-clinico-ficticio";

    it("corpo do 403 e do 400 não traz o valor enviado nem cita modo_decisao", async () => {
      logadoComo(FAMILIAR);
      fakeVinculos([vinculo()]);
      modoDoIdoso("idoso");
      const r403 = await post(IDOSO_A, { ...BODY_OK, observacoes: SEGREDO });
      modoDoIdoso("familiar");
      const r400 = await post(IDOSO_A, { ...BODY_OK, valor_1: 1.234, observacoes: SEGREDO });
      expect(r403.status).toBe(403);
      expect(r400.status).toBe(400);
      for (const r of [r403, r400]) {
        const texto = JSON.stringify(r.body);
        expect(texto).not.toContain(SEGREDO);
        expect(texto).not.toContain("1.234");
        expect(texto).not.toMatch(/modo_decisao/i);
      }
    });

    it("erro do Prisma no create: 500 genérico e nenhum valor de saúde em console.*", async () => {
      const VALOR = "123.45";
      logadoComo(FAMILIAR);
      fakeVinculos([vinculo()]);
      modoDoIdoso("familiar");
      createRegistro.mockRejectedValue(
        new Prisma.PrismaClientValidationError(
          `Invalid invocation: data: { valor_1: ${VALOR}, observacoes: '${SEGREDO}' }`,
          { clientVersion: "5.22.0" },
        ),
      );
      const consoles = ["log", "info", "warn", "error", "debug"] as const;
      const espioes = consoles.map((m) => jest.spyOn(console, m).mockImplementation(() => undefined));
      try {
        const res = await post(IDOSO_A, { tipo_medicao: "peso", valor_1: 123.45, unidade: "kg", observacoes: SEGREDO });
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
