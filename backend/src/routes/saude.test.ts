import express from "express";
import request from "supertest";
import { Prisma } from "@prisma/client";

const verifyIdToken = jest.fn();
const findFirst = jest.fn();
const findUnique = jest.fn();
const createRegistro = jest.fn();

jest.mock("../lib/firebaseAdmin", () => ({
  auth: { verifyIdToken: (...args: unknown[]) => verifyIdToken(...args) },
}));
jest.mock("../lib/prisma", () => ({
  prisma: {
    usuario: {
      findFirst: (...args: unknown[]) => findFirst(...args),
      findUnique: (...args: unknown[]) => findUnique(...args),
    },
    registroSaude: { create: (...args: unknown[]) => createRegistro(...args) },
  },
}));

import saudeRouter from "./saude";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/saude", saudeRouter);
  app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: "Erro interno." });
  });
  return app;
}

const ID = 42;
const BODY_OK = { tipo_medicao: "pressao", valor_1: 120, valor_2: 80, unidade: "mmHg" };

function logadoComo(tipo: "idoso" | "cuidador" | "familiar") {
  verifyIdToken.mockResolvedValue({ uid: "uid-42" });
  findFirst.mockResolvedValue({ id: ID, firebase_uid: "uid-42" });
  findUnique.mockResolvedValue({ tipo_perfil: tipo });
}

function post(body: unknown) {
  return request(buildApp()).post("/saude").set("Authorization", "Bearer x").send(body as object);
}

function registroDevolvido(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    idoso_id: ID,
    registrado_por_id: ID,
    editado_por_id: ID,
    tipo_medicao: "pressao",
    valor_1: new Prisma.Decimal("120"),
    valor_2: new Prisma.Decimal("80"),
    unidade: "mmHg",
    data_hora: new Date("2026-09-23T12:00:00Z"),
    observacoes: null,
    created_at: new Date("2026-09-23T12:00:00Z"),
    updated_at: new Date("2026-09-23T12:00:00Z"),
    ...over,
  };
}

beforeEach(() => {
  verifyIdToken.mockReset();
  findFirst.mockReset();
  findUnique.mockReset();
  createRegistro.mockReset();
  createRegistro.mockResolvedValue(registroDevolvido());
});

describe("POST /saude (RF-007, item 4.1)", () => {
  describe("autenticação e autorização", () => {
    it("401 sem token", async () => {
      const res = await request(buildApp()).post("/saude").send(BODY_OK);
      expect(res.status).toBe(401);
      expect(createRegistro).not.toHaveBeenCalled();
    });

    it("401 com token inválido", async () => {
      verifyIdToken.mockRejectedValue(Object.assign(new Error("bad"), { code: "auth/argument-error" }));
      const res = await post(BODY_OK);
      expect(res.status).toBe(401);
      expect(createRegistro).not.toHaveBeenCalled();
    });

    it.each(["cuidador", "familiar"] as const)("403 para %s", async (tipo) => {
      logadoComo(tipo);
      const res = await post(BODY_OK);
      expect(res.status).toBe(403);
      expect(createRegistro).not.toHaveBeenCalled();
    });
  });

  describe("sucesso", () => {
    it("201: idoso_id, registrado_por_id e editado_por_id vêm de req.usuarioId", async () => {
      logadoComo("idoso");
      const res = await post(BODY_OK);
      expect(res.status).toBe(201);
      expect(createRegistro).toHaveBeenCalledTimes(1);
      const { data } = createRegistro.mock.calls[0][0];
      expect(data.idoso_id).toBe(ID);
      expect(data.registrado_por_id).toBe(ID);
      expect(data.editado_por_id).toBe(ID);
    });

    it("ignora id, idoso_id, registrado_por_id, editado_por_id e created_at forjados no body", async () => {
      logadoComo("idoso");
      const res = await post({
        ...BODY_OK,
        id: 999,
        idoso_id: 7,
        registrado_por_id: 7,
        editado_por_id: 7,
        created_at: "2000-01-01T00:00:00Z",
        updated_at: "2000-01-01T00:00:00Z",
      });
      expect(res.status).toBe(201);
      const { data } = createRegistro.mock.calls[0][0];
      expect(data.idoso_id).toBe(ID);
      expect(data.registrado_por_id).toBe(ID);
      expect(data.editado_por_id).toBe(ID);
      expect(data).not.toHaveProperty("id");
      expect(data).not.toHaveProperty("created_at");
      expect(data).not.toHaveProperty("updated_at");
    });

    it("valor_2 omitido vira null no create", async () => {
      logadoComo("idoso");
      await post({ tipo_medicao: "peso", valor_1: 70.5, unidade: "kg" });
      expect(createRegistro.mock.calls[0][0].data.valor_2).toBeNull();
    });

    it("data_hora omitida usa a hora do servidor", async () => {
      jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "setTimeout"] });
      jest.setSystemTime(new Date("2026-09-23T15:00:00Z"));
      try {
        logadoComo("idoso");
        await post(BODY_OK);
        expect(createRegistro.mock.calls[0][0].data.data_hora).toEqual(new Date("2026-09-23T15:00:00Z"));
      } finally {
        jest.useRealTimers();
      }
    });

    it("grava tipo_medicao, unidade e observacoes com trim, sem mudar a caixa", async () => {
      logadoComo("idoso");
      await post({ ...BODY_OK, tipo_medicao: "  Pressao ", unidade: " mmHg  ", observacoes: "  Em jejum " });
      const { data } = createRegistro.mock.calls[0][0];
      expect(data.tipo_medicao).toBe("Pressao");
      expect(data.unidade).toBe("mmHg");
      expect(data.observacoes).toBe("Em jejum");
    });

    it.each(["", "   "])("observacoes %j vira null", async (obs) => {
      logadoComo("idoso");
      await post({ ...BODY_OK, observacoes: obs });
      expect(createRegistro.mock.calls[0][0].data.observacoes).toBeNull();
    });

    it("observacoes: trim antes de medir; 300 caracteres úteis com espaços em volta são aceitos", async () => {
      logadoComo("idoso");
      const res = await post({ ...BODY_OK, observacoes: `   ${"x".repeat(300)}   ` });
      expect(res.status).toBe(201);
      expect(createRegistro.mock.calls[0][0].data.observacoes).toBe("x".repeat(300));
    });

    it("observacoes: 301 caracteres úteis são rejeitados mesmo com espaços em volta", async () => {
      logadoComo("idoso");
      const res = await post({ ...BODY_OK, observacoes: `  ${"x".repeat(301)}  ` });
      expect(res.status).toBe(400);
      expect(createRegistro).not.toHaveBeenCalled();
    });

    it("valor 0 é aceito", async () => {
      logadoComo("idoso");
      const res = await post({ ...BODY_OK, valor_1: 0 });
      expect(res.status).toBe(201);
    });

    it("5.68 aceito (2 casas)", async () => {
      logadoComo("idoso");
      const res = await post({ ...BODY_OK, valor_1: 5.68 });
      expect(res.status).toBe(201);
    });

    it("9999.99 aceito (limite do decimal(6,2))", async () => {
      logadoComo("idoso");
      const res = await post({ ...BODY_OK, valor_1: 9999.99 });
      expect(res.status).toBe(201);
    });
  });

  describe("resposta", () => {
    it("valor_1 e valor_2 saem como number", async () => {
      logadoComo("idoso");
      createRegistro.mockResolvedValue(
        registroDevolvido({ valor_1: new Prisma.Decimal("120.50"), valor_2: new Prisma.Decimal("80") })
      );
      const res = await post(BODY_OK);
      expect(res.body.valor_1).toBe(120.5);
      expect(res.body.valor_2).toBe(80);
      expect(typeof res.body.valor_1).toBe("number");
    });

    it("valor_2 null sai null, nunca 0", async () => {
      logadoComo("idoso");
      createRegistro.mockResolvedValue(registroDevolvido({ valor_2: null }));
      const res = await post({ tipo_medicao: "peso", valor_1: 70, unidade: "kg" });
      expect(res.body.valor_2).toBeNull();
    });

    it("traz o registro com id e os 3 campos de autoria", async () => {
      logadoComo("idoso");
      const res = await post(BODY_OK);
      expect(res.body).toMatchObject({
        id: 1,
        idoso_id: ID,
        registrado_por_id: ID,
        editado_por_id: ID,
        tipo_medicao: "pressao",
        unidade: "mmHg",
      });
    });
  });

  describe("data_hora", () => {
    beforeEach(() => {
      jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "setTimeout"] });
      jest.setSystemTime(new Date("2026-09-23T15:00:00Z"));
    });
    afterEach(() => jest.useRealTimers());

    it("aceita ISO com Z", async () => {
      logadoComo("idoso");
      const res = await post({ ...BODY_OK, data_hora: "2026-09-23T14:00:00Z" });
      expect(res.status).toBe(201);
      expect(createRegistro.mock.calls[0][0].data.data_hora).toEqual(new Date("2026-09-23T14:00:00Z"));
    });

    it("aceita ISO com offset explícito", async () => {
      logadoComo("idoso");
      const res = await post({ ...BODY_OK, data_hora: "2026-09-23T11:00:00-03:00" });
      expect(res.status).toBe(201);
      expect(createRegistro.mock.calls[0][0].data.data_hora).toEqual(new Date("2026-09-23T14:00:00Z"));
    });

    it("rejeita sem fuso", async () => {
      logadoComo("idoso");
      const res = await post({ ...BODY_OK, data_hora: "2026-09-23T10:00" });
      expect(res.status).toBe(400);
      expect(createRegistro).not.toHaveBeenCalled();
    });

    it("aceita futuro dentro da tolerância de 5 minutos", async () => {
      logadoComo("idoso");
      const res = await post({ ...BODY_OK, data_hora: "2026-09-23T15:04:00Z" });
      expect(res.status).toBe(201);
    });

    it("rejeita futuro além da tolerância", async () => {
      logadoComo("idoso");
      const res = await post({ ...BODY_OK, data_hora: "2026-09-23T15:06:00Z" });
      expect(res.status).toBe(400);
      expect(createRegistro).not.toHaveBeenCalled();
    });
  });

  describe("400 de validação", () => {
    const casos: [string, Record<string, unknown>][] = [
      ["tipo_medicao ausente", { tipo_medicao: undefined }],
      ["tipo_medicao vazio", { tipo_medicao: "" }],
      ["tipo_medicao só espaço", { tipo_medicao: "   " }],
      ["tipo_medicao acima de 50", { tipo_medicao: "x".repeat(51) }],
      ["tipo_medicao não string", { tipo_medicao: 5 }],
      ["valor_1 ausente", { valor_1: undefined }],
      ["valor_1 string", { valor_1: "120" }],
      ["valor_1 NaN", { valor_1: "NaN-marcador" }],
      ["valor_1 negativo", { valor_1: -1 }],
      ["valor_1 acima do limite", { valor_1: 10000 }],
      ["valor_1 com 3 casas", { valor_1: 5.678 }],
      ["valor_2 string", { valor_2: "80" }],
      ["valor_2 negativo", { valor_2: -0.5 }],
      ["valor_2 acima do limite", { valor_2: 10000 }],
      ["valor_2 com 3 casas", { valor_2: 5.678 }],
      ["unidade ausente", { unidade: undefined }],
      ["unidade vazia", { unidade: "  " }],
      ["unidade acima de 20", { unidade: "x".repeat(21) }],
      ["observacoes acima de 300", { observacoes: "x".repeat(301) }],
      ["observacoes não string", { observacoes: 5 }],
      ["data_hora inválida", { data_hora: "não é data" }],
      ["data_hora não string", { data_hora: 1700000000000 }],
    ];

    it.each(casos)("%s", async (_nome, over) => {
      logadoComo("idoso");
      // NaN e Infinity não existem em JSON: valor_1 "NaN-marcador" cobre string não numérica.
      const res = await post({ ...BODY_OK, ...over });
      expect(res.status).toBe(400);
      expect(typeof res.body.error).toBe("string");
      expect(createRegistro).not.toHaveBeenCalled();
    });
  });

  describe("privacidade", () => {
    it("400 não reproduz o valor enviado", async () => {
      logadoComo("idoso");
      const res = await post({ ...BODY_OK, valor_1: 5.6789, observacoes: "x".repeat(301) });
      const texto = JSON.stringify(res.body);
      expect(res.status).toBe(400);
      expect(texto).not.toContain("5.6789");
      expect(texto).not.toContain("xxxxxxxx");
    });

    it("nenhuma chamada a console.* recebe valores de saúde", async () => {
      logadoComo("idoso");
      const espioes = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
        jest.spyOn(console, m).mockImplementation(() => undefined)
      );
      try {
        await post({ ...BODY_OK, valor_1: 123.45, observacoes: "segredo-clinico" });
        await post({ ...BODY_OK, valor_1: 5.6789, observacoes: "segredo-clinico" });
        const tudo = JSON.stringify(espioes.flatMap((s) => s.mock.calls));
        expect(tudo).not.toContain("123.45");
        expect(tudo).not.toContain("5.6789");
        expect(tudo).not.toContain("segredo-clinico");
      } finally {
        espioes.forEach((s) => s.mockRestore());
      }
    });
  });
});
