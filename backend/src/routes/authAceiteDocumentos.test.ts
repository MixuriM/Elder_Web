import express from "express";
import request from "supertest";

// D9 (2026-10-14): o aceite dos Termos, da Política de Privacidade e o consentimento de saúde passam a ser gravados
// (LGPD art. 8, par. 2: o ônus da prova do consentimento é do controlador). Só na criação da conta e no anexo do
// idoso cadastrado por familiar (item 3.3); login de conta existente não pede nada. O horário é sempre o do servidor.
// Dados FICTÍCIOS, só para teste.

const verifyIdToken = jest.fn();
const findFirst = jest.fn();
const create = jest.fn();
const updateUsuario = jest.fn();

jest.mock("../lib/firebaseAdmin", () => ({
  auth: { verifyIdToken: (...args: unknown[]) => verifyIdToken(...args) },
}));
jest.mock("../lib/prisma", () => ({
  prisma: {
    usuario: {
      findFirst: (...args: unknown[]) => findFirst(...args),
      findMany: async () => [],
      create: (...args: unknown[]) => create(...args),
      update: (...args: unknown[]) => updateUsuario(...args),
    },
    vinculo: { create: async () => ({}), updateMany: async () => ({ count: 0 }) },
  },
}));

import authRouter from "./auth";

const MSG = "Aceite dos termos e do consentimento de saúde é obrigatório.";
const ACEITE = { versao: "1.1", termos_privacidade: true, consentimento_saude: true };

function app() {
  const a = express();
  a.use(express.json());
  a.use("/auth", authRouter);
  a.use((_e: unknown, _q: express.Request, r: express.Response, _n: express.NextFunction) => r.status(500).json({}));
  return a;
}

const sync = (body: object) => request(app()).post("/auth/sync").set("Authorization", "Bearer token-ficticio").send(body);
const cadastro = (extra: object) => sync({ tipo_perfil: "cuidador", nome: "Pessoa Ficticia", ...extra });

type Where = { where: { firebase_uid?: string; email?: string } };

beforeEach(() => {
  verifyIdToken.mockReset().mockResolvedValue({ uid: "uid-ficticio", email: "ficticio@teste.invalid", email_verified: true });
  findFirst.mockReset().mockResolvedValue(null);
  create.mockReset().mockImplementation(async ({ data }: { data: object }) => ({ id: 1, ...data }));
  updateUsuario.mockReset().mockImplementation(async ({ data }: { data: object }) => ({ id: 7, ...data }));
});

describe("criação de conta exige o aceite", () => {
  it.each([
    ["sem aceite_documentos", {}],
    ["aceite_documentos nulo", { aceite_documentos: null }],
    ["aceite_documentos texto", { aceite_documentos: "sim" }],
    ["aceite_documentos lista", { aceite_documentos: [ACEITE] }],
    ["termos falso", { aceite_documentos: { ...ACEITE, termos_privacidade: false } }],
    ["consentimento ausente", { aceite_documentos: { versao: "1.1", termos_privacidade: true } }],
    ["consentimento como texto", { aceite_documentos: { ...ACEITE, consentimento_saude: "true" } }],
    ["termos como 1", { aceite_documentos: { ...ACEITE, termos_privacidade: 1 } }],
    ["versão ausente", { aceite_documentos: { termos_privacidade: true, consentimento_saude: true } }],
    ["versão vazia", { aceite_documentos: { ...ACEITE, versao: "" } }],
    ["versão número", { aceite_documentos: { ...ACEITE, versao: 1.1 } }],
    ["versão com 21 caracteres", { aceite_documentos: { ...ACEITE, versao: "1".repeat(21) } }],
    ["versão com caractere fora da lista", { aceite_documentos: { ...ACEITE, versao: "1.1;x" } }],
    ["versão como operador do Prisma", { aceite_documentos: { ...ACEITE, versao: { set: "1.1" } } }],
  ])("%s: 400 fixo, não cria", async (_caso, extra) => {
    const res = await cadastro(extra);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: MSG });
    expect(create).not.toHaveBeenCalled();
  });

  it("versão com 20 caracteres de [0-9A-Za-z.-] é aceita", async () => {
    const res = await cadastro({ aceite_documentos: { ...ACEITE, versao: "v1.2-rc.3-ABCDEFGHIJ".slice(0, 20) } });
    expect(res.status).toBe(201);
  });

  it("grava versão e horário do SERVIDOR (o mesmo nos dois campos), ignorando horário mandado pelo cliente", async () => {
    const antes = Date.now();
    const res = await cadastro({
      aceite_documentos: { ...ACEITE, aceite_documentos_em: "2000-01-01T00:00:00Z", em: "2000-01-01T00:00:00Z" },
      aceite_documentos_em: "2000-01-01T00:00:00Z",
      consentimento_saude_em: "2000-01-01T00:00:00Z",
    });
    const depois = Date.now();
    expect(res.status).toBe(201);
    const data = create.mock.calls[0][0].data;
    expect(data.aceite_documentos_versao).toBe("1.1");
    expect(data.aceite_documentos_em).toBeInstanceOf(Date);
    expect(data.aceite_documentos_em.getTime()).toBeGreaterThanOrEqual(antes);
    expect(data.aceite_documentos_em.getTime()).toBeLessThanOrEqual(depois);
    expect(data.consentimento_saude_em).toEqual(data.aceite_documentos_em);
  });
});

describe("anexo do idoso cadastrado por familiar (3.3)", () => {
  beforeEach(() => {
    findFirst.mockImplementation(async ({ where }: Where) =>
      where.email ? { id: 7, firebase_uid: null, cadastrado_por_id: 3 } : null,
    );
  });

  it("sem aceite: 400 e não anexa", async () => {
    const res = await sync({ tipo_perfil: "idoso" });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: MSG });
    expect(updateUsuario).not.toHaveBeenCalled();
  });

  it("com aceite: anexa e grava o aceite com o horário do servidor", async () => {
    const antes = Date.now();
    const res = await sync({ tipo_perfil: "idoso", aceite_documentos: ACEITE });
    expect(res.status).toBe(200);
    const data = updateUsuario.mock.calls[0][0].data;
    expect(data).toMatchObject({ firebase_uid: "uid-ficticio", aceite_documentos_versao: "1.1" });
    expect(data.aceite_documentos_em.getTime()).toBeGreaterThanOrEqual(antes);
    expect(data.consentimento_saude_em).toEqual(data.aceite_documentos_em);
  });
});

describe("login de conta existente não pede nem grava aceite", () => {
  it("200 sem aceite_documentos e o update do login não toca nos campos de aceite", async () => {
    findFirst.mockImplementation(async ({ where }: Where) =>
      where.firebase_uid ? { id: 1, tipo_perfil: "cuidador", email: "ficticio@teste.invalid", modo_decisao_solicitado: null } : null,
    );
    const res = await sync({});
    expect(res.status).toBe(200);
    const data = updateUsuario.mock.calls[0][0].data;
    expect(Object.keys(data)).toEqual(["ultimo_login_em"]);
  });
});
