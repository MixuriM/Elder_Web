import { inspect } from "node:util";
import request from "supertest";
import { Prisma } from "@prisma/client";

// Item 5.1 (RF-011): POST /remedios, idoso cadastra o próprio medicamento. Medicamento é dado de saúde
// sensível (LGPD Art. 5º, XI, RNF-001). Todos os ids e valores abaixo são FICTÍCIOS, só para teste.

const verifyIdToken = jest.fn();
const findFirstUsuario = jest.fn();
const findUniqueUsuario = jest.fn();
const createMedicamento = jest.fn();

jest.mock("../lib/firebaseAdmin", () => ({
  auth: { verifyIdToken: (...args: unknown[]) => verifyIdToken(...args) },
}));
jest.mock("../lib/prisma", () => ({
  prisma: {
    usuario: {
      findFirst: (...args: unknown[]) => findFirstUsuario(...args),
      findUnique: (...args: unknown[]) => findUniqueUsuario(...args),
    },
    medicamento: { create: (...args: unknown[]) => createMedicamento(...args) },
  },
}));

import app from "../app";

const ID = 42;
const BODY_OK = { nome: "Remedio Ficticio", dosagem: "10 mg", frequencia: "2x ao dia", data_inicio: "2026-10-01" };
const MSG_403 = "Sem permissão para cadastrar medicamento.";
const CAMPOS_RESPOSTA = [
  "ativo",
  "created_at",
  "criado_por_id",
  "data_fim",
  "data_inicio",
  "dosagem",
  "editado_por_id",
  "frequencia",
  "id",
  "idoso_id",
  "nome",
  "observacoes",
  "updated_at",
];

function logadoComo(tipo: "idoso" | "cuidador" | "familiar") {
  verifyIdToken.mockResolvedValue({ uid: `uid-${ID}` });
  findFirstUsuario.mockResolvedValue({ id: ID, firebase_uid: `uid-${ID}` });
  findUniqueUsuario.mockResolvedValue({ tipo_perfil: tipo });
}

function post(body: unknown = BODY_OK) {
  return request(app)
    .post("/remedios")
    .set("Authorization", "Bearer x")
    .send(body as object);
}

function medicamentoDevolvido(over: Record<string, unknown> = {}) {
  const d = new Date("2026-10-01T12:00:00Z");
  return {
    id: 1,
    idoso_id: ID,
    criado_por_id: ID,
    nome: "Remedio Ficticio",
    dosagem: "10 mg",
    frequencia: "2x ao dia",
    data_inicio: new Date("2026-10-01T00:00:00.000Z"),
    data_fim: null,
    observacoes: null,
    ativo: true,
    editado_por_id: null,
    created_at: d,
    updated_at: d,
    ...over,
  };
}

function expectNaoCriou(res: request.Response, status: number) {
  expect(res.status).toBe(status);
  expect(createMedicamento).not.toHaveBeenCalled();
}

function dadosDoCreate() {
  return createMedicamento.mock.calls[0][0].data;
}

beforeEach(() => {
  [verifyIdToken, findFirstUsuario, findUniqueUsuario, createMedicamento].forEach((m) => m.mockReset());
  createMedicamento.mockResolvedValue(medicamentoDevolvido());
});

describe("POST /remedios, idoso (RF-011, item 5.1)", () => {
  describe("sucesso", () => {
    it("201 com autoria do idoso, editado_por_id nulo, ativo true e lista explícita de campos", async () => {
      logadoComo("idoso");
      const res = await post();
      expect(res.status).toBe(201);
      expect(Object.keys(res.body).sort()).toEqual(CAMPOS_RESPOSTA);
      expect(res.body).toMatchObject({
        id: 1,
        idoso_id: ID,
        criado_por_id: ID,
        editado_por_id: null,
        ativo: true,
        data_fim: null,
        observacoes: null,
      });
      const data = dadosDoCreate();
      expect(data.idoso_id).toBe(ID);
      expect(data.criado_por_id).toBe(ID);
      expect(data.editado_por_id).toBeNull();
      expect(data.ativo).toBe(true);
    });

    it("datas: grava meia-noite UTC e devolve YYYY-MM-DD sem deslocar o dia", async () => {
      logadoComo("idoso");
      createMedicamento.mockResolvedValue(
        medicamentoDevolvido({
          data_inicio: new Date("2026-10-01T00:00:00.000Z"),
          data_fim: new Date("2026-12-31T00:00:00.000Z"),
        }),
      );
      const res = await post({ ...BODY_OK, data_fim: "2026-12-31" });
      expect(res.status).toBe(201);
      expect(dadosDoCreate().data_inicio.toISOString()).toBe("2026-10-01T00:00:00.000Z");
      expect(dadosDoCreate().data_fim.toISOString()).toBe("2026-12-31T00:00:00.000Z");
      expect(res.body.data_inicio).toBe("2026-10-01");
      expect(res.body.data_fim).toBe("2026-12-31");
    });

    it("limites exatos aceitos: nome 150, dosagem 50, frequencia 100, observacoes 500", async () => {
      logadoComo("idoso");
      const res = await post({
        nome: "n".repeat(150),
        dosagem: "d".repeat(50),
        frequencia: "f".repeat(100),
        data_inicio: "2026-10-01",
        observacoes: "o".repeat(500),
      });
      expect(res.status).toBe(201);
      expect(dadosDoCreate().nome).toHaveLength(150);
      expect(dadosDoCreate().observacoes).toHaveLength(500);
    });

    it("trim aplicado antes de medir e antes de gravar", async () => {
      logadoComo("idoso");
      const res = await post({
        nome: `  ${"n".repeat(150)}  `,
        dosagem: ` ${"d".repeat(50)} `,
        frequencia: ` ${"f".repeat(100)} `,
        data_inicio: "2026-10-01",
        observacoes: `  ${"o".repeat(500)}  `,
      });
      expect(res.status).toBe(201);
      const data = dadosDoCreate();
      expect(data.nome).toBe("n".repeat(150));
      expect(data.dosagem).toBe("d".repeat(50));
      expect(data.frequencia).toBe("f".repeat(100));
      expect(data.observacoes).toBe("o".repeat(500));
    });

    it("data_fim igual a data_inicio é aceita", async () => {
      logadoComo("idoso");
      expect((await post({ ...BODY_OK, data_fim: "2026-10-01" })).status).toBe(201);
    });

    it("data_fim ausente e data_fim null: aceitos, gravados como null", async () => {
      logadoComo("idoso");
      expect((await post()).status).toBe(201);
      expect(dadosDoCreate().data_fim).toBeNull();
      createMedicamento.mockClear();
      expect((await post({ ...BODY_OK, data_fim: null })).status).toBe(201);
      expect(dadosDoCreate().data_fim).toBeNull();
    });

    it.each([["só espaço", "   "], ["vazia", ""], ["null", null], ["ausente", undefined]])(
      "observacoes %s vira null",
      async (_rotulo, observacoes) => {
        logadoComo("idoso");
        expect((await post({ ...BODY_OK, observacoes })).status).toBe(201);
        expect(dadosDoCreate().observacoes).toBeNull();
      },
    );

    it("data_inicio no passado e no futuro é aceita", async () => {
      logadoComo("idoso");
      expect((await post({ ...BODY_OK, data_inicio: "2020-01-15" })).status).toBe(201);
      expect((await post({ ...BODY_OK, data_inicio: "2099-12-31" })).status).toBe(201);
    });
  });

  describe("autenticação e autorização", () => {
    it("401 sem token e com token inválido", async () => {
      expectNaoCriou(await request(app).post("/remedios").send(BODY_OK), 401);
      verifyIdToken.mockRejectedValue(Object.assign(new Error("bad"), { code: "auth/argument-error" }));
      expectNaoCriou(await post(), 401);
    });

    it.each(["cuidador", "familiar"] as const)("403 para %s, mensagem fixa", async (perfil) => {
      logadoComo(perfil);
      const res = await post();
      expectNaoCriou(res, 403);
      expect(res.body).toEqual({ error: MSG_403 });
    });

    it("403 quando o Usuario não é encontrado pelo findUnique", async () => {
      logadoComo("idoso");
      findUniqueUsuario.mockResolvedValue(null);
      expectNaoCriou(await post(), 403);
    });

    it("403 antes de 400: cuidador com corpo inválido responde 403", async () => {
      logadoComo("cuidador");
      expectNaoCriou(await post({ nome: "" }), 403);
    });
  });

  describe("campos controlados pelo servidor", () => {
    it("ignora id, autoria, ativo e timestamps forjados no body", async () => {
      logadoComo("idoso");
      const res = await post({
        ...BODY_OK,
        id: 999,
        idoso_id: 77,
        criado_por_id: 77,
        editado_por_id: 77,
        ativo: false,
        created_at: "2000-01-01T00:00:00Z",
        updated_at: "2000-01-01T00:00:00Z",
      });
      expect(res.status).toBe(201);
      const data = dadosDoCreate();
      expect(data.idoso_id).toBe(ID);
      expect(data.criado_por_id).toBe(ID);
      expect(data.editado_por_id).toBeNull();
      expect(data.ativo).toBe(true);
      expect(data).not.toHaveProperty("id");
      expect(data).not.toHaveProperty("created_at");
      expect(data).not.toHaveProperty("updated_at");
    });
  });

  describe("validação do corpo (400, mensagem fixa)", () => {
    const longo = (n: number) => "a".repeat(n);
    it.each([
      ["nome vazio", { nome: "" }],
      ["nome só espaço", { nome: "   " }],
      ["nome acima de 150", { nome: longo(151) }],
      ["nome não string", { nome: 123 }],
      ["nome ausente", { nome: undefined }],
      ["dosagem vazia", { dosagem: "" }],
      ["dosagem acima de 50", { dosagem: longo(51) }],
      ["dosagem não string", { dosagem: 10 }],
      ["frequencia vazia", { frequencia: "" }],
      ["frequencia acima de 100", { frequencia: longo(101) }],
      ["frequencia não string", { frequencia: 2 }],
      ["data_inicio ausente", { data_inicio: undefined }],
      ["data_inicio null", { data_inicio: null }],
      ["data_inicio formato errado", { data_inicio: "01/10/2026" }],
      ["data_inicio sem zero à esquerda", { data_inicio: "2026-1-1" }],
      ["data_inicio inexistente", { data_inicio: "2026-02-30" }],
      ["data_inicio com horário", { data_inicio: "2026-10-01T10:00:00Z" }],
      ["data_inicio não string", { data_inicio: 20261001 }],
      ["data_fim formato errado", { data_fim: "31/12/2026" }],
      ["data_fim inexistente", { data_fim: "2026-04-31" }],
      ["data_fim com horário", { data_fim: "2026-12-31T00:00:00Z" }],
      ["data_fim anterior a data_inicio", { data_fim: "2026-09-30" }],
      ["observacoes acima de 500", { observacoes: longo(501) }],
      ["observacoes não string", { observacoes: 5 }],
    ])("400: %s", async (_rotulo, over) => {
      logadoComo("idoso");
      const res = await post({ ...BODY_OK, ...over });
      expectNaoCriou(res, 400);
      expect(typeof res.body.error).toBe("string");
    });

    it("corpo ausente: 400", async () => {
      logadoComo("idoso");
      expectNaoCriou(await request(app).post("/remedios").set("Authorization", "Bearer x"), 400);
    });
  });

  describe("privacidade (RNF-001)", () => {
    const NOME = "nome-ficticio-sigiloso";
    const OBS = "obs-ficticia-sigilosa";
    const consoles = ["log", "info", "warn", "error", "debug"] as const;

    it("corpo do 400 e console.* não trazem o valor enviado", async () => {
      logadoComo("idoso");
      const espioes = consoles.map((m) => jest.spyOn(console, m).mockImplementation(() => undefined));
      try {
        const res = await post({ ...BODY_OK, nome: NOME, observacoes: OBS, dosagem: "d".repeat(51) });
        expect(res.status).toBe(400);
        const texto = JSON.stringify(res.body);
        expect(texto).not.toContain(NOME);
        expect(texto).not.toContain(OBS);
        const tudo = inspect(espioes.flatMap((s) => s.mock.calls), { depth: 8 });
        expect(tudo).not.toContain(NOME);
        expect(tudo).not.toContain(OBS);
      } finally {
        espioes.forEach((s) => s.mockRestore());
      }
    });

    it("erro do Prisma no create: 500 genérico e nenhum valor em corpo nem em console.*", async () => {
      logadoComo("idoso");
      createMedicamento.mockRejectedValue(
        new Prisma.PrismaClientValidationError(`Invalid invocation: data: { nome: '${NOME}', observacoes: '${OBS}' }`, {
          clientVersion: "5.22.0",
        }),
      );
      const espioes = consoles.map((m) => jest.spyOn(console, m).mockImplementation(() => undefined));
      try {
        const res = await post({ ...BODY_OK, nome: NOME, observacoes: OBS });
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: "Erro interno." });
        const tudo = inspect(espioes.flatMap((s) => s.mock.calls), { depth: 8 });
        expect(tudo).not.toContain(NOME);
        expect(tudo).not.toContain(OBS);
      } finally {
        espioes.forEach((s) => s.mockRestore());
      }
    });
  });
});
