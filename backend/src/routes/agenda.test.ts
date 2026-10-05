import { inspect } from "node:util";
import request from "supertest";
import { Prisma } from "@prisma/client";
import {
  BODY_OK,
  CAMPOS_FORJADOS,
  CASOS_201,
  CASOS_400_CAMPOS,
  CASOS_400_TIPO,
  type DadosCreate,
} from "../testSupport/agendaCasosCorpo";

// Item 6.1 (RF-015): POST /agenda, idoso cria compromisso (Evento 'pessoal' ou 'medico') na própria agenda.
// Evento 'medico' pode carregar dado de saúde no título: tratado como dado sensível (RNF-001).
// Todos os ids e valores abaixo são FICTÍCIOS, só para teste.

const verifyIdToken = jest.fn();
const findFirstUsuario = jest.fn();
const findUniqueUsuario = jest.fn();
const createEvento = jest.fn();

jest.mock("../lib/firebaseAdmin", () => ({
  auth: { verifyIdToken: (...args: unknown[]) => verifyIdToken(...args) },
}));
jest.mock("../lib/prisma", () => ({
  prisma: {
    usuario: {
      findFirst: (...args: unknown[]) => findFirstUsuario(...args),
      findUnique: (...args: unknown[]) => findUniqueUsuario(...args),
    },
    evento: { create: (...args: unknown[]) => createEvento(...args) },
  },
}));

import app from "../app";

const ID = 42;
const MSG_403 = "Sem permissão para criar compromisso.";
const CAMPOS_RESPOSTA = [
  "created_at",
  "criado_por_id",
  "data_hora_fim",
  "data_hora_inicio",
  "descricao",
  "editado_por_id",
  "id",
  "idoso_id",
  "tipo_evento",
  "titulo",
  "updated_at",
];

function logadoComo(tipo: "idoso" | "cuidador" | "familiar") {
  verifyIdToken.mockResolvedValue({ uid: `uid-${ID}` });
  findFirstUsuario.mockResolvedValue({ id: ID, firebase_uid: `uid-${ID}` });
  findUniqueUsuario.mockResolvedValue({ tipo_perfil: tipo });
}

function post(body: unknown = BODY_OK) {
  return request(app)
    .post("/agenda")
    .set("Authorization", "Bearer x")
    .send(body as object);
}

function dadosDoCreate(): DadosCreate {
  return createEvento.mock.calls[0][0].data;
}

function expectNaoCriou(res: request.Response, status: number) {
  expect(res.status).toBe(status);
  expect(createEvento).not.toHaveBeenCalled();
}

beforeEach(() => {
  [verifyIdToken, findFirstUsuario, findUniqueUsuario, createEvento].forEach((m) => m.mockReset());
  // Devolve o que recebeu, como o banco faria, mais id e timestamps do servidor.
  createEvento.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 1,
    ...data,
    created_at: new Date("2026-10-04T12:00:00Z"),
    updated_at: new Date("2026-10-04T12:00:00Z"),
  }));
});

describe("POST /agenda, idoso (RF-015, item 6.1)", () => {
  describe("sucesso", () => {
    it.each(["pessoal", "medico"])("201 para '%s': autoria e idoso_id do token, formato do contrato", async (tipo) => {
      logadoComo("idoso");
      const res = await post({ ...BODY_OK, tipo_evento: tipo, descricao: "Detalhe", data_hora_fim: "2026-10-10T13:00:00Z" });
      expect(res.status).toBe(201);
      expect(Object.keys(res.body).sort()).toEqual(CAMPOS_RESPOSTA);
      expect(res.body).toEqual({
        id: 1,
        idoso_id: ID,
        criado_por_id: ID,
        tipo_evento: tipo,
        titulo: "Compromisso Ficticio",
        descricao: "Detalhe",
        data_hora_inicio: "2026-10-10T12:00:00.000Z",
        data_hora_fim: "2026-10-10T13:00:00.000Z",
        editado_por_id: null,
        created_at: "2026-10-04T12:00:00.000Z",
        updated_at: "2026-10-04T12:00:00.000Z",
      });
      const data = dadosDoCreate();
      expect(data.tipo_evento).toBe(tipo);
      expect(data).toMatchObject({ idoso_id: ID, criado_por_id: ID, editado_por_id: null });
    });

    it("fim ausente: data_hora_fim null na resposta", async () => {
      logadoComo("idoso");
      const res = await post();
      expect(res.status).toBe(201);
      expect(res.body.data_hora_fim).toBeNull();
      expect(res.body.descricao).toBeNull();
    });

    it.each(CASOS_201)("201 e grava corretamente: %s", async (_rotulo, over, checar) => {
      logadoComo("idoso");
      const res = await post({ ...BODY_OK, ...over });
      expect(res.status).toBe(201);
      checar(dadosDoCreate());
    });

    it("duas criações iguais seguidas são aceitas (sem idempotência, limitação documentada)", async () => {
      logadoComo("idoso");
      expect((await post()).status).toBe(201);
      expect((await post()).status).toBe(201);
      expect(createEvento).toHaveBeenCalledTimes(2);
    });
  });

  describe("autenticação e autorização", () => {
    it("401 sem token e com token inválido", async () => {
      expectNaoCriou(await request(app).post("/agenda").send(BODY_OK), 401);
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

  describe("tipo_evento", () => {
    it("'cuidado' devolve 403 com mensagem fixa e o create não é chamado", async () => {
      logadoComo("idoso");
      const res = await post({ ...BODY_OK, tipo_evento: "cuidado" });
      expectNaoCriou(res, 403);
      expect(res.body).toEqual({ error: MSG_403 });
    });

    it.each(CASOS_400_TIPO)("400: %s", async (_rotulo, over) => {
      logadoComo("idoso");
      const res = await post({ ...BODY_OK, ...over });
      expectNaoCriou(res, 400);
      expect(typeof res.body.error).toBe("string");
    });

    it("'Cuidado' e 'CUIDADO' (caixa diferente) são 400, não 403", async () => {
      logadoComo("idoso");
      expectNaoCriou(await post({ ...BODY_OK, tipo_evento: "Cuidado" }), 400);
      expectNaoCriou(await post({ ...BODY_OK, tipo_evento: "CUIDADO" }), 400);
    });
  });

  describe("campos controlados pelo servidor", () => {
    it("ignora id, autoria e timestamps forjados no body (com controle positivo)", async () => {
      logadoComo("idoso");
      const res = await post({ ...BODY_OK, ...CAMPOS_FORJADOS, titulo: "Titulo valido" });
      expect(res.status).toBe(201);
      const data = dadosDoCreate();
      // Controle positivo: campos da whitelist chegaram ao create.
      expect(data.titulo).toBe("Titulo valido");
      expect(data).toMatchObject({ idoso_id: ID, criado_por_id: ID, editado_por_id: null });
      expect(data).not.toHaveProperty("id");
      expect(data).not.toHaveProperty("created_at");
      expect(data).not.toHaveProperty("updated_at");
      expect(res.body.id).toBe(1);
      expect(res.body.created_at).toBe("2026-10-04T12:00:00.000Z");
    });

    it("o create recebe só as chaves da whitelist mais as do servidor", async () => {
      logadoComo("idoso");
      await post({ ...BODY_OK, ...CAMPOS_FORJADOS, extra: "x" });
      expect(Object.keys(dadosDoCreate()).sort()).toEqual([
        "criado_por_id",
        "data_hora_fim",
        "data_hora_inicio",
        "descricao",
        "editado_por_id",
        "idoso_id",
        "tipo_evento",
        "titulo",
      ]);
    });
  });

  describe("validação do corpo (400, mensagem fixa)", () => {
    it.each(CASOS_400_CAMPOS)("400: %s", async (_rotulo, over) => {
      logadoComo("idoso");
      const res = await post({ ...BODY_OK, ...over });
      expectNaoCriou(res, 400);
      expect(typeof res.body.error).toBe("string");
    });

    it("corpo ausente: 400", async () => {
      logadoComo("idoso");
      expectNaoCriou(await request(app).post("/agenda").set("Authorization", "Bearer x"), 400);
    });
  });

  describe("ordem de erros", () => {
    it("401 antes de 403 antes de 400", async () => {
      logadoComo("cuidador");
      expectNaoCriou(await request(app).post("/agenda").send({ tipo_evento: "outro" }), 401);
      expectNaoCriou(await post({ tipo_evento: "outro" }), 403);
    });

    it("403 de perfil antes do 400 de corpo", async () => {
      logadoComo("familiar");
      expectNaoCriou(await post({}), 403);
    });

    it("tipo inválido (400) vem antes do 'cuidado' e dos demais campos", async () => {
      logadoComo("idoso");
      expectNaoCriou(await post({ tipo_evento: "outro", titulo: "" }), 400);
    });

    it("'cuidado' com título inválido responde 403, não 400", async () => {
      logadoComo("idoso");
      expectNaoCriou(await post({ ...BODY_OK, tipo_evento: "cuidado", titulo: "" }), 403);
      expectNaoCriou(await post({ ...BODY_OK, tipo_evento: "cuidado", data_hora_inicio: "xx" }), 403);
    });

    it("tipo válido com demais campos inválidos responde 400", async () => {
      logadoComo("idoso");
      expectNaoCriou(await post({ ...BODY_OK, titulo: "" }), 400);
    });
  });

  describe("privacidade (RNF-001)", () => {
    const TITULO = "titulo-ficticio-sigiloso";
    const DESC = "descricao-ficticia-sigilosa";
    const SENT_META = "meta-ficticio-sigiloso";
    const SENTINELAS = [TITULO, DESC, SENT_META];
    const CONSOLES = ["log", "info", "warn", "error", "debug"] as const;
    const MSG_COM_ARGS = `Invalid invocation: data: { titulo: '${TITULO}', descricao: '${DESC}' }`;

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

    const corpoSigiloso = { ...BODY_OK, tipo_evento: "medico", titulo: TITULO, descricao: DESC };

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

    it("sucesso: o 201 devolve o título (controle positivo) e nada vai para console.*, stdout e stderr", async () => {
      logadoComo("idoso");
      const { res, saidas } = await capturando(() => post(corpoSigiloso));
      expect(res.status).toBe(201);
      expect(res.body.titulo).toBe(TITULO);
      semSentinelas(saidas);
    });

    it.each([
      ["400 de validação (data inválida)", { ...corpoSigiloso, data_hora_inicio: "2026-02-30T10:00:00Z" }, 400],
      ["400 de validação (título longo com descrição sigilosa)", { ...corpoSigiloso, titulo: TITULO + "x".repeat(150) }, 400],
      ["400 de validação (descrição longa)", { ...corpoSigiloso, descricao: DESC + "x".repeat(500) }, 400],
      ["403 de 'cuidado'", { ...corpoSigiloso, tipo_evento: "cuidado" }, 403],
    ])("%s: erro nunca repete o valor enviado", async (_rotulo, corpo, status) => {
      logadoComo("idoso");
      const { res, saidas } = await capturando(() => post(corpo));
      expect(res.status).toBe(status);
      semSentinelas(visivel(res, saidas));
    });

    it("403 de perfil nunca repete o valor enviado nem cita modo_decisao", async () => {
      logadoComo("familiar");
      const { res, saidas } = await capturando(() => post(corpoSigiloso));
      expect(res.status).toBe(403);
      semSentinelas(visivel(res, saidas));
      expect(JSON.stringify(res.body)).not.toMatch(/modo_decisao|permite_/i);
    });

    const erroKnown = () =>
      new Prisma.PrismaClientKnownRequestError(MSG_COM_ARGS, {
        code: "P2002",
        clientVersion: "5.22.0",
        meta: { valor: SENT_META, titulo: TITULO },
      });
    const TIPOS_DE_ERRO: [string, () => unknown][] = [
      ["PrismaClientKnownRequestError com meta sigiloso", erroKnown],
      ["PrismaClientValidationError", () => new Prisma.PrismaClientValidationError(MSG_COM_ARGS, { clientVersion: "5.22.0" })],
      ["Error genérico com sentinela na message", () => new Error(MSG_COM_ARGS)],
      ["string lançada", () => MSG_COM_ARGS],
      ["objeto lançado que não é Error", () => ({ titulo: TITULO, descricao: DESC, detalhe: SENT_META })],
    ];

    describe.each([
      ["usuario.findUnique", () => findUniqueUsuario],
      ["evento.create", () => createEvento],
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
        expect(saidas).toContain("/agenda");
      });
    });
  });
});
