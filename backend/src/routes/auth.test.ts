import express from "express";
import request from "supertest";

const verifyIdToken = jest.fn();
const findFirst = jest.fn();
const create = jest.fn();

jest.mock("../lib/firebaseAdmin", () => ({
  auth: {
    verifyIdToken: (...args: unknown[]) => verifyIdToken(...args),
  },
}));
jest.mock("../lib/prisma", () => ({
  prisma: {
    usuario: {
      findFirst: (...args: unknown[]) => findFirst(...args),
      create: (...args: unknown[]) => create(...args),
    },
  },
}));

import authRouter from "./auth";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/auth", authRouter);
  app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: "Erro interno." });
  });
  return app;
}

describe("POST /auth/sync — email_convite_familiar (RF-024)", () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
    findFirst.mockReset();
    create.mockReset();
    verifyIdToken.mockResolvedValue({ uid: "uid-novo", email: "idoso@a.com" });
    findFirst.mockResolvedValue(null); // cadastro, não login
  });

  it("idoso com email_convite_familiar preenchido: persiste o campo", async () => {
    create.mockResolvedValue({ id: 1, tipo_perfil: "idoso", email_convite_familiar: "familiar@a.com" });

    const res = await request(buildApp())
      .post("/auth/sync")
      .set("Authorization", "Bearer x")
      .send({ tipo_perfil: "idoso", nome: "Ana", email_convite_familiar: "familiar@a.com" });

    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email_convite_familiar: "familiar@a.com" }),
      })
    );
  });

  it("idoso sem email_convite_familiar: campo não é enviado ao Prisma", async () => {
    create.mockResolvedValue({ id: 1, tipo_perfil: "idoso" });

    const res = await request(buildApp())
      .post("/auth/sync")
      .set("Authorization", "Bearer x")
      .send({ tipo_perfil: "idoso", nome: "Ana" });

    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email_convite_familiar: undefined }),
      })
    );
  });

  it("cuidador mandando email_convite_familiar: retorna 400 e não chega a criar", async () => {
    const res = await request(buildApp())
      .post("/auth/sync")
      .set("Authorization", "Bearer x")
      .send({ tipo_perfil: "cuidador", nome: "João", email_convite_familiar: "familiar@a.com" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email_convite_familiar/i);
    expect(create).not.toHaveBeenCalled();
  });

  it("familiar mandando email_convite_familiar: retorna 400 e não chega a criar", async () => {
    const res = await request(buildApp())
      .post("/auth/sync")
      .set("Authorization", "Bearer x")
      .send({ tipo_perfil: "familiar", nome: "Carla", email_convite_familiar: "familiar@a.com" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email_convite_familiar/i);
    expect(create).not.toHaveBeenCalled();
  });

  it("idoso com email_convite_familiar em formato inválido: retorna 400", async () => {
    const res = await request(buildApp())
      .post("/auth/sync")
      .set("Authorization", "Bearer x")
      .send({ tipo_perfil: "idoso", nome: "Ana", email_convite_familiar: "nao-e-email" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/formato inválido/i);
    expect(create).not.toHaveBeenCalled();
  });
});
