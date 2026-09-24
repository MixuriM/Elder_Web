import { inspect } from "node:util";
import request from "supertest";
import { Prisma } from "@prisma/client";

const verifyIdToken = jest.fn();
const findFirstUsuario = jest.fn();
const findFirstVinculo = jest.fn();
const createRegistro = jest.fn();

jest.mock("../lib/firebaseAdmin", () => ({
  auth: { verifyIdToken: (...args: unknown[]) => verifyIdToken(...args) },
}));
jest.mock("../lib/prisma", () => ({
  prisma: {
    usuario: { findFirst: (...args: unknown[]) => findFirstUsuario(...args), findUnique: jest.fn() },
    vinculo: { findFirst: (...args: unknown[]) => findFirstVinculo(...args) },
    registroSaude: { create: (...args: unknown[]) => createRegistro(...args) },
  },
}));

import app from "../app";

// Todos os ids e valores abaixo são FICTÍCIOS, só para teste.
const CUIDADOR = 10;
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
    vinculado_id: CUIDADOR,
    tipo_vinculo: "cuidador",
    status: "aprovado",
    permite_registrar_saude: true,
    permite_marcar_dose: false,
    permite_criar_evento_cuidado: false,
    ...over,
  };
}

// Fake que FILTRA de verdade pelo where recebido, para o teste de acesso cruzado não passar por vacuidade.
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

function logadoComoCuidador(id = CUIDADOR) {
  verifyIdToken.mockResolvedValue({ uid: `uid-${id}` });
  findFirstUsuario.mockResolvedValue({ id, firebase_uid: `uid-${id}` });
}

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
  verifyIdToken.mockReset();
  findFirstUsuario.mockReset();
  findFirstVinculo.mockReset();
  createRegistro.mockReset();
  createRegistro.mockResolvedValue(registroDevolvido());
});

describe("POST /saude/idoso/:idosoId (RF-008, item 4.2)", () => {
  describe("autenticação e vínculo", () => {
    it("401 sem token", async () => {
      const res = await request(app).post(`/saude/idoso/${IDOSO_A}`).send(BODY_OK);
      expectNaoCriou(res, 401);
      expect(findFirstVinculo).not.toHaveBeenCalled();
    });

    it("401 com token inválido", async () => {
      verifyIdToken.mockRejectedValue(Object.assign(new Error("bad"), { code: "auth/argument-error" }));
      const res = await post(IDOSO_A);
      expectNaoCriou(res, 401);
    });

    it("400 com idosoId não numérico, sem tocar o Prisma de vínculo", async () => {
      logadoComoCuidador();
      const res = await post("abc");
      expectNaoCriou(res, 400);
      expect(findFirstVinculo).not.toHaveBeenCalled();
    });

    it("403 sem vínculo, e findFirst recebe idoso do path, chamador e status aprovado", async () => {
      logadoComoCuidador();
      fakeVinculos([]);
      const res = await post(IDOSO_A);
      expectNaoCriou(res, 403);
      expect(res.body).toEqual({ error: "Vínculo aprovado não encontrado para este idoso." });
      expect(findFirstVinculo).toHaveBeenCalledWith({
        where: { idoso_id: IDOSO_A, vinculado_id: CUIDADOR, status: "aprovado" },
      });
    });

    it.each(["pendente", "recusado"] as const)("403 com vínculo %s do mesmo par", async (status) => {
      logadoComoCuidador();
      fakeVinculos([vinculo({ status })]);
      const res = await post(IDOSO_A);
      expectNaoCriou(res, 403);
    });

    it("403 no acesso cruzado: vínculo aprovado só com o idoso A, chamada com o id do idoso B", async () => {
      logadoComoCuidador();
      fakeVinculos([vinculo({ idoso_id: IDOSO_A })]);
      // Controle positivo: o mesmo fake libera o idoso A.
      expect((await post(IDOSO_A)).status).toBe(201);
      createRegistro.mockClear();
      const res = await post(IDOSO_B);
      expectNaoCriou(res, 403);
    });

    it("403 quando o idoso chama a rota com o próprio id (não existe vínculo consigo mesmo)", async () => {
      logadoComoCuidador(IDOSO_A);
      fakeVinculos([vinculo()]);
      const res = await post(IDOSO_A);
      expectNaoCriou(res, 403);
    });
  });

  describe("autorização do cuidador (permite_registrar_saude)", () => {
    it("403 com permite_registrar_saude=false", async () => {
      logadoComoCuidador();
      fakeVinculos([vinculo({ permite_registrar_saude: false })]);
      const res = await post(IDOSO_A);
      expectNaoCriou(res, 403);
      expect(res.body).toEqual({ error: MSG_403 });
    });

    it("403 com só a flag de saúde falsa e as outras duas verdadeiras (a flag certa decide)", async () => {
      logadoComoCuidador();
      fakeVinculos([
        vinculo({ permite_registrar_saude: false, permite_marcar_dose: true, permite_criar_evento_cuidado: true }),
      ]);
      const res = await post(IDOSO_A);
      expectNaoCriou(res, 403);
      expect(res.body).toEqual({ error: MSG_403 });
    });

    it("403 para vínculo aprovado de familiar com a flag verdadeira (dado artificial)", async () => {
      // A regra do familiar (modo_decisao) é o item 4.2b, não adiantada aqui.
      logadoComoCuidador();
      fakeVinculos([vinculo({ tipo_vinculo: "familiar", permite_registrar_saude: true })]);
      const res = await post(IDOSO_A);
      expectNaoCriou(res, 403);
      expect(res.body).toEqual({ error: MSG_403 });
    });

    it("403 antes de 400: sem permissão e corpo inválido responde 403", async () => {
      logadoComoCuidador();
      fakeVinculos([vinculo({ permite_registrar_saude: false })]);
      const res = await post(IDOSO_A, { tipo_medicao: "", valor_1: -1 });
      expectNaoCriou(res, 403);
    });
  });

  describe("sucesso", () => {
    it("201: idoso_id do vínculo; registrado_por_id e editado_por_id do cuidador", async () => {
      logadoComoCuidador();
      fakeVinculos([vinculo()]);
      const res = await post(IDOSO_A);
      expect(res.status).toBe(201);
      expect(createRegistro).toHaveBeenCalledTimes(1);
      const { data } = createRegistro.mock.calls[0][0];
      expect(data.idoso_id).toBe(IDOSO_A);
      expect(data.registrado_por_id).toBe(CUIDADOR);
      expect(data.editado_por_id).toBe(CUIDADOR);
    });

    it("ignora id, autoria e timestamps forjados no body", async () => {
      logadoComoCuidador();
      fakeVinculos([vinculo()]);
      const res = await post(IDOSO_A, {
        ...BODY_OK,
        id: 999,
        idoso_id: IDOSO_B,
        registrado_por_id: 77,
        editado_por_id: 77,
        created_at: "2000-01-01T00:00:00Z",
        updated_at: "2000-01-01T00:00:00Z",
      });
      expect(res.status).toBe(201);
      const { data } = createRegistro.mock.calls[0][0];
      expect(data.idoso_id).toBe(IDOSO_A);
      expect(data.registrado_por_id).toBe(CUIDADOR);
      expect(data.editado_por_id).toBe(CUIDADOR);
      expect(data).not.toHaveProperty("id");
      expect(data).not.toHaveProperty("created_at");
      expect(data).not.toHaveProperty("updated_at");
    });

    it("idoso_id gravado vem da linha do vínculo, não do path (mock que ignora o where, defesa em profundidade)", async () => {
      logadoComoCuidador();
      findFirstVinculo.mockResolvedValue(vinculo({ idoso_id: IDOSO_A }));
      const res = await post(IDOSO_B);
      expect(res.status).toBe(201);
      expect(createRegistro.mock.calls[0][0].data.idoso_id).toBe(IDOSO_A);
    });

    it("valor_2 ausente sai null (não 0) e valores saem como number", async () => {
      logadoComoCuidador();
      fakeVinculos([vinculo()]);
      createRegistro.mockResolvedValue(registroDevolvido({ valor_1: new Prisma.Decimal("70.5"), valor_2: null }));
      const res = await post(IDOSO_A, { tipo_medicao: "peso", valor_1: 70.5, unidade: "kg" });
      expect(res.status).toBe(201);
      expect(res.body.valor_1).toBe(70.5);
      expect(res.body.valor_2).toBeNull();
      const { data } = createRegistro.mock.calls[0][0];
      expect(data.valor_2).toBeNull();

      createRegistro.mockResolvedValue(registroDevolvido());
      const comDois = await post(IDOSO_A);
      expect(typeof comDois.body.valor_1).toBe("number");
      expect(typeof comDois.body.valor_2).toBe("number");
    });
  });

  describe("corpo inválido com permissão (validação compartilhada com o 4.1)", () => {
    const SEGREDO = "segredo-clinico-ficticio";
    const futuro = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    it.each([
      ["tipo_medicao ausente", { valor_1: 1, unidade: "kg" }],
      ["valor_1 negativo", { ...BODY_OK, valor_1: -1 }],
      ["valor_1 com 3 casas", { ...BODY_OK, valor_1: 1.234 }],
      ["unidade vazia", { ...BODY_OK, unidade: "  " }],
      ["data_hora sem fuso", { ...BODY_OK, data_hora: "2026-09-24T10:00:00" }],
      ["data_hora futura além de 5 minutos", { ...BODY_OK, data_hora: futuro }],
      ["observacoes com mais de 300 caracteres", { ...BODY_OK, observacoes: SEGREDO + "x".repeat(300) }],
    ])("400 com %s, sem criar e sem repetir o valor enviado", async (_n, corpo) => {
      logadoComoCuidador();
      fakeVinculos([vinculo()]);
      const res = await post(IDOSO_A, corpo);
      expectNaoCriou(res, 400);
      expect(JSON.stringify(res.body)).not.toContain(SEGREDO);
      expect(JSON.stringify(res.body)).not.toContain(String((corpo as { valor_1?: number }).valor_1 ?? "@@"));
    });
  });

  describe("privacidade", () => {
    it("erro do Prisma no create: 500 genérico e nenhum valor de saúde em console.*", async () => {
      const VALOR = "123.45";
      const SEGREDO = "segredo-clinico-ficticio";
      logadoComoCuidador();
      fakeVinculos([vinculo()]);
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
