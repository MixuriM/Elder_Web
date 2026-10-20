import express from "express";
import request from "supertest";

// Fechamento do 9.5 (F1): o ID Token emitido antes da exclusão segue válido por até 1 h no Firebase, e /auth/sync não passa
// pelo requireAuth. Sem este guard, o sync achava a linha anonimizada pelo firebase_uid, gravava ultimo_login_em nela e
// respondia 200 como se a conta existisse. Aqui: 401 igual ao do requireAuth, ANTES de qualquer escrita. Ids, uids e
// e-mails FICTÍCIOS, só para teste.

const verifyIdToken = jest.fn();
const findFirst = jest.fn();
const findManyUsuario = jest.fn();
const create = jest.fn();
const updateUsuario = jest.fn();
const createVinculo = jest.fn();
const updateManyVinculo = jest.fn();

jest.mock("../lib/firebaseAdmin", () => ({
  auth: { verifyIdToken: (...args: unknown[]) => verifyIdToken(...args) },
}));
jest.mock("../lib/prisma", () => ({
  prisma: {
    usuario: {
      findFirst: (...args: unknown[]) => findFirst(...args),
      findMany: (...args: unknown[]) => findManyUsuario(...args),
      create: (...args: unknown[]) => create(...args),
      update: (...args: unknown[]) => updateUsuario(...args),
    },
    vinculo: {
      create: (...args: unknown[]) => createVinculo(...args),
      updateMany: (...args: unknown[]) => updateManyVinculo(...args),
    },
  },
}));

import authRouter from "./auth";
import { comAceiteValido } from "../testSupport/aceiteDocumentosTeste";
import { MSG_TOKEN_INVALIDO } from "../lib/contaExcluida";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(comAceiteValido);
  app.use("/auth", authRouter);
  app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: "Erro interno." });
  });
  return app;
}

const SYNC = (corpo: object = {}) => request(buildApp()).post("/auth/sync").set("Authorization", "Bearer t").send(corpo);
const EXCLUIDO = "excluido-7@excluido.invalid";

beforeEach(() => {
  for (const m of [verifyIdToken, findFirst, findManyUsuario, create, updateUsuario, createVinculo, updateManyVinculo]) m.mockReset();
  findManyUsuario.mockResolvedValue([]);
  updateUsuario.mockImplementation(async ({ where }: { where: { id: number } }) => ({ id: where.id, nome: "Pessoa Ficticia" }));
});

describe("POST /auth/sync: token de conta excluída", () => {
  it.each([
    ["idoso", { email_verified: true }],
    ["familiar com e-mail verificado (promoveria vínculo pendente)", { email_verified: true, email: EXCLUIDO }],
    ["cuidador", {}],
  ])("%s: 401 igual ao do requireAuth e nenhuma escrita", async (tipo, claims) => {
    const tipoPerfil = tipo.startsWith("familiar") ? "familiar" : tipo === "cuidador" ? "cuidador" : "idoso";
    verifyIdToken.mockResolvedValue({ uid: "uid-7", ...claims });
    findFirst.mockResolvedValue({ id: 7, tipo_perfil: tipoPerfil, email: EXCLUIDO, modo_decisao_solicitado: "familiar" });

    const res = await SYNC();

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Token inválido ou expirado." });
    expect(res.body.error).toBe(MSG_TOKEN_INVALIDO);
    expect(updateUsuario).not.toHaveBeenCalled(); // inclui ultimo_login_em e o cancelamento de solicitação
    expect(updateManyVinculo).not.toHaveBeenCalled(); // inclui a promoção de vínculo do familiar
    expect(create).not.toHaveBeenCalled();
    expect(createVinculo).not.toHaveBeenCalled();
  });

  it("a linha lida traz o e-mail (o guard precisa dele)", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-7" });
    findFirst.mockResolvedValue({ id: 7, tipo_perfil: "idoso", email: EXCLUIDO, modo_decisao_solicitado: null });
    await SYNC();
    expect(findFirst.mock.calls[0][0].select).toMatchObject({ id: true, email: true });
  });

  it("e-mail que só parece o marcador não é conta excluída: segue o login normal (200)", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-7" });
    findFirst.mockResolvedValue({ id: 7, tipo_perfil: "idoso", email: "excluido-7@excluido.invalid.exemplo.test", modo_decisao_solicitado: null });
    const res = await SYNC();
    expect(res.status).toBe(200);
    expect(updateUsuario).toHaveBeenCalledTimes(1);
  });

  it.each([[null], [undefined], ["pessoa@exemplo.test"]])("e-mail %p: login normal (200) com ultimo_login_em", async (email) => {
    verifyIdToken.mockResolvedValue({ uid: "uid-7" });
    findFirst.mockResolvedValue({ id: 7, tipo_perfil: "idoso", email, modo_decisao_solicitado: null });
    const res = await SYNC();
    expect(res.status).toBe(200);
    expect(res.body.criado).toBe(false);
    expect(updateUsuario.mock.calls[0][0].data).toEqual({ ultimo_login_em: expect.any(Date) });
  });
});

// Fechamento do 9.5 (F3): o e-mail do marcador não pode entrar por aqui nem como e-mail da conta nem como convite.
describe("POST /auth/sync: e-mail do marcador na criação", () => {
  it("token com e-mail do marcador: 400 E-mail inválido., sem consultar nem criar (igual com ou sem conta morta)", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-novo", email: EXCLUIDO, email_verified: true, name: "Pessoa Ficticia" });
    findFirst.mockResolvedValue(null);
    const res = await SYNC({ tipo_perfil: "idoso" });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "E-mail inválido." });
    expect(create).not.toHaveBeenCalled();
    expect(updateUsuario).not.toHaveBeenCalled(); // inclui o anexo do firebase_uid a idoso sem login
    // Só a consulta por firebase_uid acontece; a busca por e-mail (colisão) não chega a rodar.
    expect(findFirst.mock.calls.filter(([a]) => a?.where?.email !== undefined)).toEqual([]);
  });

  it("email_convite_familiar do marcador: 400 formato inválido, nenhum vínculo", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-novo", email: "pessoa@exemplo.test", name: "Pessoa Ficticia" });
    findFirst.mockResolvedValue(null);
    const res = await SYNC({ tipo_perfil: "idoso", email_convite_familiar: EXCLUIDO });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "email_convite_familiar em formato inválido." });
    expect(create).not.toHaveBeenCalled();
    expect(createVinculo).not.toHaveBeenCalled();
  });
});

describe("POST /auth/sync: o ramo de criação não muda", () => {
  it("uid novo e o MESMO e-mail real da conta que foi excluída: cria linha nova (a antiga já não tem esse e-mail)", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-novo", email: "pessoa@exemplo.test", email_verified: false, name: "Pessoa Ficticia" });
    findFirst.mockResolvedValue(null); // nem por uid nem por e-mail: a linha antiga virou excluido-<id>@excluido.invalid
    create.mockResolvedValue({ id: 99, nome: "Pessoa Ficticia", tipo_perfil: "idoso" });

    const res = await SYNC({ tipo_perfil: "idoso" });

    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data).toMatchObject({ firebase_uid: "uid-novo", email: "pessoa@exemplo.test" });
  });
});
