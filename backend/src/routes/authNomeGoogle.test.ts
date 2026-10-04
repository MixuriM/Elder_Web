import express from "express";
import request from "supertest";

// Pendência "nome vazio em /auth/sync vence o decoded.name do Google": nome do corpo em branco (vazio ou só
// espaços) não conta como nome informado; vale o do token. Nome do corpo preenchido continua vencendo.
const verifyIdToken = jest.fn();
const findFirst = jest.fn();
const findMany = jest.fn();
const create = jest.fn();

jest.mock("../lib/firebaseAdmin", () => ({
  auth: { verifyIdToken: (...args: unknown[]) => verifyIdToken(...args) },
}));
jest.mock("../lib/prisma", () => ({
  prisma: {
    usuario: {
      findFirst: (...args: unknown[]) => findFirst(...args),
      findMany: (...args: unknown[]) => findMany(...args),
      create: (...args: unknown[]) => create(...args),
      update: jest.fn(),
    },
    vinculo: { create: jest.fn(), updateMany: jest.fn() },
  },
}));

import authRouter from "./auth";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/auth", authRouter);
  return app;
}

beforeEach(() => {
  [verifyIdToken, findFirst, findMany, create].forEach((m) => m.mockReset());
  findFirst.mockResolvedValue(null);
  findMany.mockResolvedValue([]);
  create.mockResolvedValue({ id: 1, tipo_perfil: "idoso" });
});

const sync = (body: object) => request(buildApp()).post("/auth/sync").set("Authorization", "Bearer x").send(body);

describe("nome em /auth/sync: corpo em branco não vence o nome do token", () => {
  it.each(["", "   ", "\t \n"])("nome %p no corpo com decoded.name do Google: cria com o nome do Google", async (nome) => {
    verifyIdToken.mockResolvedValue({ uid: "uid-g", email: "g@a.com", name: "Nome Do Google" });
    const res = await sync({ tipo_perfil: "idoso", nome });
    expect(res.status).toBe(201);
    expect(create.mock.calls[0][0].data.nome).toBe("Nome Do Google");
  });

  it("nome do corpo preenchido (com espaços nas pontas) continua vencendo, aparado", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-g", email: "g@a.com", name: "Nome Do Google" });
    const res = await sync({ tipo_perfil: "idoso", nome: "  Ana  " });
    expect(res.status).toBe(201);
    expect(create.mock.calls[0][0].data.nome).toBe("Ana");
  });

  it("sem nome no corpo, usa o do Google (comportamento já existente)", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-g", email: "g@a.com", name: "Nome Do Google" });
    const res = await sync({ tipo_perfil: "idoso" });
    expect(res.status).toBe(201);
    expect(create.mock.calls[0][0].data.nome).toBe("Nome Do Google");
  });

  it("nome em branco no corpo e sem nome no token: 400 de nome obrigatório, sem create", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-e", email: "e@a.com" });
    const res = await sync({ tipo_perfil: "idoso", nome: "   " });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/nome/i);
    expect(create).not.toHaveBeenCalled();
  });

  it("nome do token só com espaços não vira nome: 400", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-e", email: "e@a.com", name: "   " });
    const res = await sync({ tipo_perfil: "idoso" });
    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("nome do token acima de 150 caracteres: 400 de limite, sem create", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-e", email: "e@a.com", name: "a".repeat(151) });
    const res = await sync({ tipo_perfil: "idoso" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/150/);
    expect(create).not.toHaveBeenCalled();
  });
});
