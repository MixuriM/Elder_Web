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

// Estado "sem transferência de decisão em curso" — retorno default de
// resolverEstadoModoDecisao (tarefa 2.9, RF-033) quando nada foi solicitado ainda.
const MODO_DECISAO_NEUTRO = {
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
    // GET /usuario/me chama prisma.usuario.findUnique duas vezes, em sequência: 1ª
    // dentro de resolverEstadoModoDecisao (routes/vinculo.ts), 2ª pros campos de
    // perfil — mockResolvedValueOnce encadeado respeita essa ordem.
    findUnique
      .mockResolvedValueOnce(MODO_DECISAO_NEUTRO)
      .mockResolvedValueOnce({ id: 42, nome: "Ana", email: "a@a.com", telefone: "123", tipo_perfil: "idoso" });

    const res = await request(buildApp()).get("/usuario/me").set("Authorization", "Bearer x");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 42,
      nome: "Ana",
      email: "a@a.com",
      telefone: "123",
      tipo_perfil: "idoso",
      ...MODO_DECISAO_NEUTRO,
    });
  });

  it("inclui campos de modo_decisao_solicitado quando há transferência em curso", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-42" });
    findFirst.mockResolvedValue(USUARIO_LOGADO);
    findUnique
      .mockResolvedValueOnce({
        ...MODO_DECISAO_NEUTRO,
        modo_decisao_solicitado: "familiar",
        modo_decisao_solicitado_por_id: 7,
        modo_decisao_solicitado_em: new Date("2026-09-18T00:00:00Z"),
        modo_decisao_expira_em: new Date("2026-09-25T00:00:00Z"),
        modo_decisao_motivo: "Facilita o dia a dia",
      })
      .mockResolvedValueOnce({ id: 42, nome: "Ana", email: "a@a.com", telefone: "123", tipo_perfil: "idoso" });

    const res = await request(buildApp()).get("/usuario/me").set("Authorization", "Bearer x");

    expect(res.status).toBe(200);
    expect(res.body.modo_decisao_solicitado).toBe("familiar");
    expect(res.body.modo_decisao_solicitado_por_id).toBe(7);
    expect(res.body.modo_decisao_motivo).toBe("Facilita o dia a dia");
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
