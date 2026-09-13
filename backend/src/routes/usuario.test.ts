import express from "express";
import request from "supertest";

const verifyIdToken = jest.fn();
const findFirst = jest.fn();
const findUnique = jest.fn();
const findUniqueOrThrow = jest.fn();
const update = jest.fn();
const updateUser = jest.fn();

jest.mock("../lib/firebaseAdmin", () => ({
  auth: {
    verifyIdToken: (...args: unknown[]) => verifyIdToken(...args),
    updateUser: (...args: unknown[]) => updateUser(...args),
  },
}));
jest.mock("../lib/prisma", () => ({
  prisma: {
    usuario: {
      findFirst: (...args: unknown[]) => findFirst(...args),
      findUnique: (...args: unknown[]) => findUnique(...args),
      findUniqueOrThrow: (...args: unknown[]) => findUniqueOrThrow(...args),
      update: (...args: unknown[]) => update(...args),
    },
  },
}));

import usuarioRouter from "./usuario";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/usuario", usuarioRouter);
  app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: "Erro interno." });
  });
  return app;
}

const USUARIO_LOGADO = { id: 42, firebase_uid: "uid-42", email: "a@a.com", telefone: "123" };

describe("GET /usuario/me", () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
    findFirst.mockReset();
    findUnique.mockReset();
  });

  it("retorna 401 sem token", async () => {
    const res = await request(buildApp()).get("/usuario/me");
    expect(res.status).toBe(401);
  });

  it("retorna 401 com token inválido", async () => {
    verifyIdToken.mockRejectedValue(Object.assign(new Error("bad"), { code: "auth/argument-error" }));
    const res = await request(buildApp()).get("/usuario/me").set("Authorization", "Bearer x");
    expect(res.status).toBe(401);
  });

  it("retorna dados do usuário autenticado", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-42" });
    findFirst.mockResolvedValue(USUARIO_LOGADO);
    findUnique.mockResolvedValue({ id: 42, nome: "Ana", email: "a@a.com", telefone: "123", tipo_perfil: "idoso" });

    const res = await request(buildApp()).get("/usuario/me").set("Authorization", "Bearer x");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 42, nome: "Ana", email: "a@a.com", telefone: "123", tipo_perfil: "idoso" });
  });
});

describe("PATCH /usuario/me", () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
    findFirst.mockReset();
    findUniqueOrThrow.mockReset();
    update.mockReset();
    updateUser.mockReset();
    verifyIdToken.mockResolvedValue({ uid: "uid-42" });
    findFirst.mockResolvedValue(USUARIO_LOGADO);
  });

  it("bloqueia email e telefone nulos ao mesmo tempo com mensagem clara", async () => {
    findUniqueOrThrow.mockResolvedValue({ email: "a@a.com", telefone: "123", firebase_uid: "uid-42" });

    const res = await request(buildApp())
      .patch("/usuario/me")
      .set("Authorization", "Bearer x")
      .send({ email: "", telefone: "" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/e-mail ou telefone/i);
    expect(update).not.toHaveBeenCalled();
  });

  it("sincroniza email novo com Firebase Auth via updateUser", async () => {
    findUniqueOrThrow.mockResolvedValue({ email: "a@a.com", telefone: "123", firebase_uid: "uid-42" });
    updateUser.mockResolvedValue(undefined);
    update.mockResolvedValue({ id: 42, nome: "Ana", email: "novo@a.com", telefone: "123", tipo_perfil: "idoso" });

    const res = await request(buildApp())
      .patch("/usuario/me")
      .set("Authorization", "Bearer x")
      .send({ email: "novo@a.com" });

    expect(res.status).toBe(200);
    expect(updateUser).toHaveBeenCalledWith("uid-42", { email: "novo@a.com" });
    expect(res.body.email).toBe("novo@a.com");
  });

  it("trata colisão de email já em uso com mensagem tratada, não erro cru", async () => {
    findUniqueOrThrow.mockResolvedValue({ email: "a@a.com", telefone: "123", firebase_uid: "uid-42" });
    updateUser.mockResolvedValue(undefined);
    update.mockRejectedValue(new Error("Violation of UNIQUE KEY constraint 'Usuario_email_key'"));

    const res = await request(buildApp())
      .patch("/usuario/me")
      .set("Authorization", "Bearer x")
      .send({ email: "duplicado@a.com" });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/já está em uso/i);
  });
});
