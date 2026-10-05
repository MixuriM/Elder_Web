import { inspect } from "node:util";
import request from "supertest";
import { Prisma } from "@prisma/client";
import {
  BODY_OK,
  CAMPOS_FORJADOS,
  CASOS_201,
  CASOS_400,
  CASOS_ORDEM_CORPO,
  CHAVES_CREATE,
  type DadosCreate,
} from "../testSupport/alimentacaoCasosCorpo";

// Item 7.1 (RF-018): POST /alimentacao, idoso registra refeição (ou plano alimentar) na própria alimentação.
// A descrição pode revelar dieta e condição de saúde: tratada como dado sensível (RNF-001 por analogia).
// Todos os ids e valores abaixo são FICTÍCIOS, só para teste.

const verifyIdToken = jest.fn();
const findFirstUsuario = jest.fn();
const findUniqueUsuario = jest.fn();
const createRegistro = jest.fn();

jest.mock("../lib/firebaseAdmin", () => ({
  auth: { verifyIdToken: (...args: unknown[]) => verifyIdToken(...args) },
}));
jest.mock("../lib/prisma", () => ({
  prisma: {
    usuario: {
      findFirst: (...args: unknown[]) => findFirstUsuario(...args),
      findUnique: (...args: unknown[]) => findUniqueUsuario(...args),
    },
    registroAlimentar: { create: (...args: unknown[]) => createRegistro(...args) },
  },
}));

import app from "../app";

const ID = 42;
const MSG_403 = "Sem permissão para registrar refeição.";
const CAMPOS_RESPOSTA = [
  "created_at",
  "data_hora",
  "descricao",
  "editado_por_id",
  "id",
  "idoso_id",
  "refeicao",
  "registrado_por_id",
  "updated_at",
];

// O fake de findUnique filtra pelo where: só o id logado tem perfil.
function logadoComo(tipo: "idoso" | "cuidador" | "familiar") {
  verifyIdToken.mockResolvedValue({ uid: `uid-${ID}` });
  findFirstUsuario.mockResolvedValue({ id: ID, firebase_uid: `uid-${ID}` });
  findUniqueUsuario.mockImplementation(async ({ where }: { where: { id: number } }) =>
    where.id === ID ? { tipo_perfil: tipo } : null,
  );
}

function post(body: unknown = BODY_OK, caminho = "/alimentacao") {
  return request(app)
    .post(caminho)
    .set("Authorization", "Bearer x")
    .send(body as object);
}

function dadosDoCreate(): DadosCreate & Record<string, unknown> {
  return createRegistro.mock.calls[0][0].data;
}

function expectNaoCriou(res: request.Response, status: number) {
  expect(res.status).toBe(status);
  expect(createRegistro).not.toHaveBeenCalled();
}

beforeEach(() => {
  [verifyIdToken, findFirstUsuario, findUniqueUsuario, createRegistro].forEach((m) => m.mockReset());
  // Devolve o que recebeu, como o banco faria, mais id e timestamps do servidor.
  createRegistro.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 1,
    ...data,
    created_at: new Date("2026-10-05T12:00:00Z"),
    updated_at: new Date("2026-10-05T12:00:00Z"),
  }));
});

describe("POST /alimentacao, idoso (RF-018, item 7.1)", () => {
  describe("sucesso", () => {
    it("201: autoria e idoso_id do token, editado_por_id null, formato exato do contrato", async () => {
      logadoComo("idoso");
      const res = await post({ ...BODY_OK, data_hora: "2026-10-10T09:00:00-03:00" });
      expect(res.status).toBe(201);
      expect(Object.keys(res.body).sort()).toEqual(CAMPOS_RESPOSTA);
      expect(res.body).toEqual({
        id: 1,
        idoso_id: ID,
        registrado_por_id: ID,
        refeicao: "almoco",
        descricao: "Refeicao Ficticia",
        data_hora: "2026-10-10T12:00:00.000Z",
        editado_por_id: null,
        created_at: "2026-10-05T12:00:00.000Z",
        updated_at: "2026-10-05T12:00:00.000Z",
      });
      expect(dadosDoCreate()).toMatchObject({ idoso_id: ID, registrado_por_id: ID, editado_por_id: null });
      expect(findUniqueUsuario).toHaveBeenCalledWith(expect.objectContaining({ where: { id: ID } }));
    });

    it.each(CASOS_201)("201 e grava corretamente: %s", async (_rotulo, over, checar) => {
      logadoComo("idoso");
      const res = await post({ ...BODY_OK, ...over });
      expect(res.status).toBe(201);
      checar(dadosDoCreate());
    });

    it("duas criações iguais seguidas são aceitas (sem idempotência, limitação aceita)", async () => {
      logadoComo("idoso");
      expect((await post()).status).toBe(201);
      expect((await post()).status).toBe(201);
      expect(createRegistro).toHaveBeenCalledTimes(2);
    });
  });

  describe("autenticação e autorização", () => {
    it("401 sem token e com token inválido", async () => {
      expectNaoCriou(await request(app).post("/alimentacao").send(BODY_OK), 401);
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

    it("controle positivo: o mesmo corpo com perfil idoso cria", async () => {
      logadoComo("cuidador");
      expectNaoCriou(await post(), 403);
      logadoComo("idoso");
      expect((await post()).status).toBe(201);
    });
  });

  describe("campos controlados pelo servidor", () => {
    it("ignora id, autoria, editado_por_id e timestamps forjados no body (com controle positivo)", async () => {
      logadoComo("idoso");
      const res = await post({ ...BODY_OK, ...CAMPOS_FORJADOS, descricao: "Descricao valida" });
      expect(res.status).toBe(201);
      const data = dadosDoCreate();
      // Controle positivo: campo da whitelist chegou ao create.
      expect(data.descricao).toBe("Descricao valida");
      expect(data).toMatchObject({ idoso_id: ID, registrado_por_id: ID, editado_por_id: null });
      expect(data).not.toHaveProperty("id");
      expect(data).not.toHaveProperty("created_at");
      expect(data).not.toHaveProperty("updated_at");
      expect(res.body).toMatchObject({ id: 1, idoso_id: ID, registrado_por_id: ID, editado_por_id: null });
      expect(res.body.created_at).toBe("2026-10-05T12:00:00.000Z");
    });

    it("o create recebe só as chaves da whitelist mais as do servidor", async () => {
      logadoComo("idoso");
      await post({ ...BODY_OK, ...CAMPOS_FORJADOS, extra: "x", plano: true });
      expect(Object.keys(dadosDoCreate()).sort()).toEqual(CHAVES_CREATE);
    });

    it("idoso_id na query nunca vence o do token", async () => {
      logadoComo("idoso");
      const res = await post({ ...BODY_OK, idoso_id: 77 }, "/alimentacao?idoso_id=77");
      expect(res.status).toBe(201);
      expect(dadosDoCreate()).toMatchObject({ idoso_id: ID, registrado_por_id: ID });
    });
  });

  describe("validação do corpo (400, mensagem fixa por campo)", () => {
    it.each(CASOS_400)("400: %s", async (_rotulo, over, msg) => {
      logadoComo("idoso");
      const res = await post({ ...BODY_OK, ...over });
      expectNaoCriou(res, 400);
      expect(res.body).toEqual({ error: msg });
    });

    it.each(CASOS_ORDEM_CORPO)("ordem: %s", async (_rotulo, over, msg) => {
      logadoComo("idoso");
      const res = await post({ ...BODY_OK, ...over });
      expectNaoCriou(res, 400);
      expect(res.body).toEqual({ error: msg });
    });

    it("corpo ausente: 400", async () => {
      logadoComo("idoso");
      expectNaoCriou(await request(app).post("/alimentacao").set("Authorization", "Bearer x"), 400);
    });
  });

  describe("ordem de erros", () => {
    it("401 antes de 403 antes de 400", async () => {
      logadoComo("cuidador");
      expectNaoCriou(await request(app).post("/alimentacao").send({ refeicao: "outro" }), 401);
      expectNaoCriou(await post({ refeicao: "outro" }), 403);
    });

    it.each(["cuidador", "familiar"] as const)("403 de perfil (%s) antes do 400 de corpo", async (perfil) => {
      logadoComo(perfil);
      expectNaoCriou(await post({}), 403);
    });
  });

  describe("privacidade (RNF-001 por analogia)", () => {
    const DESC = "descricao-alimentar-ficticia-sigilosa";
    const SENT_META = "meta-ficticio-sigiloso";
    const SENT_REF = "refeicao-ficticia-sigilosa";
    const SENTINELAS = [DESC, SENT_META, SENT_REF];
    const CONSOLES = ["log", "info", "warn", "error", "debug"] as const;
    const MSG_COM_ARGS = `Invalid invocation: data: { descricao: '${DESC}' }`;

    // Captura console.*, stdout e stderr. util.inspect com depth alto inclui message, stack e meta.
    async function capturando<T>(fn: () => Promise<T>) {
      const espioes = CONSOLES.map((m) => jest.spyOn(console, m).mockImplementation(() => undefined));
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

    function semSentinelas(texto: string) {
      for (const s of SENTINELAS) expect(texto).not.toContain(s);
    }

    const corpoSigiloso = { ...BODY_OK, descricao: DESC };

    it("a captura enxerga console.*, stdout e stderr (controle positivo)", async () => {
      const { saidas } = await capturando(async () => {
        console.error("CONTROLE_CONSOLE");
        process.stdout.write("CONTROLE_STDOUT");
        process.stderr.write("CONTROLE_STDERR");
      });
      expect(saidas).toContain("CONTROLE_CONSOLE");
      expect(saidas).toContain("CONTROLE_STDOUT");
      expect(saidas).toContain("CONTROLE_STDERR");
    });

    it("sucesso: o 201 devolve a descrição (controle positivo) e nada vai para console.*, stdout e stderr", async () => {
      logadoComo("idoso");
      const { res, saidas } = await capturando(() => post(corpoSigiloso));
      expect(res.status).toBe(201);
      expect(res.body.descricao).toBe(DESC);
      semSentinelas(saidas);
    });

    it.each([
      ["400 de refeicao fora da lista", { ...corpoSigiloso, refeicao: SENT_REF }, 400],
      ["400 de data inválida", { ...corpoSigiloso, data_hora: "2026-02-30T10:00:00Z" }, 400],
      ["400 de descrição longa", { ...corpoSigiloso, descricao: DESC + "x".repeat(500) }, 400],
    ])("%s: erro nunca repete o valor enviado", async (_rotulo, corpo, status) => {
      logadoComo("idoso");
      const { res, saidas } = await capturando(() => post(corpo));
      expect(res.status).toBe(status);
      semSentinelas(visivel(res, saidas));
    });

    it.each(["cuidador", "familiar"] as const)("403 de perfil (%s) nunca repete o valor enviado nem cita motivo", async (perfil) => {
      logadoComo(perfil);
      const { res, saidas } = await capturando(() => post(corpoSigiloso));
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: MSG_403 });
      semSentinelas(visivel(res, saidas));
      expect(JSON.stringify(res.body)).not.toMatch(/modo_decisao|permite_|perfil|cuidador/i);
    });

    const erroKnown = () =>
      new Prisma.PrismaClientKnownRequestError(MSG_COM_ARGS, {
        code: "P2002",
        clientVersion: "5.22.0",
        meta: { valor: SENT_META, descricao: DESC },
      });
    const TIPOS_DE_ERRO: [string, () => unknown][] = [
      ["PrismaClientKnownRequestError com meta sigiloso", erroKnown],
      ["PrismaClientValidationError", () => new Prisma.PrismaClientValidationError(MSG_COM_ARGS, { clientVersion: "5.22.0" })],
      ["Error genérico com sentinela na message", () => new Error(MSG_COM_ARGS)],
      ["string lançada", () => MSG_COM_ARGS],
      ["objeto lançado que não é Error", () => ({ descricao: DESC, detalhe: SENT_META })],
    ];

    describe.each([
      ["usuario.findUnique", () => findUniqueUsuario],
      ["registroAlimentar.create", () => createRegistro],
    ])("falha injetada em %s", (_ponto, alvo) => {
      it.each(TIPOS_DE_ERRO)("%s: 500 exato e sem sentinela em lugar nenhum", async (_tipo, criar) => {
        logadoComo("idoso");
        alvo().mockImplementation(async () => {
          throw criar();
        });
        const { res, saidas } = await capturando(() => post(corpoSigiloso));
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: "Erro interno." });
        semSentinelas(visivel(res, saidas));
        // Controle positivo: o erro foi mesmo registrado (só name, code, método e path).
        expect(saidas).toContain("/alimentacao");
      });
    });
  });
});
