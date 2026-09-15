import express from "express";
import request from "supertest";

const verifyIdToken = jest.fn();
const findFirstUsuario = jest.fn();
const findUniqueUsuario = jest.fn();
const findManyVinculo = jest.fn();
const findFirstVinculo = jest.fn();
const createVinculo = jest.fn();

jest.mock("../lib/firebaseAdmin", () => ({
  auth: { verifyIdToken: (...args: unknown[]) => verifyIdToken(...args) },
}));
jest.mock("../lib/prisma", () => ({
  prisma: {
    usuario: {
      findFirst: (...args: unknown[]) => findFirstUsuario(...args),
      findUnique: (...args: unknown[]) => findUniqueUsuario(...args),
    },
    vinculo: {
      findMany: (...args: unknown[]) => findManyVinculo(...args),
      findFirst: (...args: unknown[]) => findFirstVinculo(...args),
      create: (...args: unknown[]) => createVinculo(...args),
    },
  },
}));

import vinculoRouter from "./vinculo";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/vinculo", vinculoRouter);
  app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: "Erro interno." });
  });
  return app;
}

const CUIDADOR = { id: 1, tipo_perfil: "cuidador" };

type FindFirstUsuarioArgs = { where: { firebase_uid?: string; tipo_perfil?: string } };

function post(body: Record<string, unknown>) {
  return request(buildApp()).post("/vinculo/solicitar-cuidador").set("Authorization", "Bearer x").send(body);
}

describe("POST /vinculo/solicitar-cuidador", () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
    findFirstUsuario.mockReset();
    findUniqueUsuario.mockReset();
    findManyVinculo.mockReset();
    findFirstVinculo.mockReset();
    createVinculo.mockReset();
    verifyIdToken.mockResolvedValue({ uid: "uid-1" });
    findFirstUsuario.mockResolvedValue(CUIDADOR); // requireAuth resolve caller
    findUniqueUsuario.mockResolvedValue(CUIDADOR);
  });

  it("403 quando chamador não é cuidador", async () => {
    findUniqueUsuario.mockResolvedValue({ id: 1, tipo_perfil: "familiar" });
    const res = await post({ email: "idoso@a.com" });
    expect(res.status).toBe(403);
  });

  it("sucesso via idoso direto", async () => {
    findFirstUsuario.mockImplementation((args: FindFirstUsuarioArgs) =>
      args.where.firebase_uid ? CUIDADOR : { id: 10, nome: "Zé", email: "idoso@a.com" },
    );
    findFirstVinculo.mockResolvedValue(null);
    createVinculo.mockResolvedValue({ id: 100, idoso_id: 10, vinculado_id: 1, status: "pendente" });

    const res = await post({ email: "idoso@a.com" });

    expect(res.status).toBe(201);
    expect(createVinculo).toHaveBeenCalledWith({
      data: expect.objectContaining({
        idoso_id: 10,
        vinculado_id: 1,
        tipo_vinculo: "cuidador",
        origem: "solicitacao_cuidador",
        status: "pendente",
      }),
    });
  });

  it("sucesso via familiar no controle (candidato único)", async () => {
    findFirstUsuario.mockImplementation((args: FindFirstUsuarioArgs) => {
      if (args.where.firebase_uid) return CUIDADOR;
      if (args.where.tipo_perfil === "idoso") return null;
      return { id: 20 }; // familiar
    });
    findManyVinculo.mockResolvedValue([{ idoso: { id: 30, nome: "Maria" } }]);
    findFirstVinculo.mockResolvedValue(null);
    createVinculo.mockResolvedValue({ id: 101, idoso_id: 30, vinculado_id: 1, status: "pendente" });

    const res = await post({ email: "familiar@a.com" });

    expect(res.status).toBe(201);
    expect(createVinculo).toHaveBeenCalledWith({
      data: expect.objectContaining({ idoso_id: 30, vinculado_id: 1 }),
    });
  });

  it("404 quando e-mail não encontrado", async () => {
    findFirstUsuario.mockImplementation((args: FindFirstUsuarioArgs) => (args.where.firebase_uid ? CUIDADOR : null));

    const res = await post({ email: "ninguem@a.com" });

    expect(res.status).toBe(404);
  });

  it("400 em auto-vínculo", async () => {
    findFirstUsuario.mockImplementation((args: FindFirstUsuarioArgs) =>
      args.where.firebase_uid ? CUIDADOR : { id: 1, nome: "Eu Mesmo", email: "eu@a.com" },
    );

    const res = await post({ email: "eu@a.com" });

    expect(res.status).toBe(400);
  });

  it("409 quando já existe solicitação pendente", async () => {
    findFirstUsuario.mockImplementation((args: FindFirstUsuarioArgs) =>
      args.where.firebase_uid ? CUIDADOR : { id: 10, nome: "Zé", email: "idoso@a.com" },
    );
    findFirstVinculo.mockResolvedValue({ status: "pendente" });

    const res = await post({ email: "idoso@a.com" });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/pendente/i);
  });

  it("409 quando já vinculados (aprovado)", async () => {
    findFirstUsuario.mockImplementation((args: FindFirstUsuarioArgs) =>
      args.where.firebase_uid ? CUIDADOR : { id: 10, nome: "Zé", email: "idoso@a.com" },
    );
    findFirstVinculo.mockResolvedValue({ status: "aprovado" });

    const res = await post({ email: "idoso@a.com" });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/já está vinculado/i);
  });

  it("422 com múltiplos idosos candidatos sem nome_idoso", async () => {
    findFirstUsuario.mockImplementation((args: FindFirstUsuarioArgs) => {
      if (args.where.firebase_uid) return CUIDADOR;
      if (args.where.tipo_perfil === "idoso") return null;
      return { id: 20 };
    });
    findManyVinculo.mockResolvedValue([
      { idoso: { id: 30, nome: "Maria" } },
      { idoso: { id: 31, nome: "João" } },
    ]);

    const res = await post({ email: "familiar@a.com" });

    expect(res.status).toBe(422);
    expect(res.body.candidatos).toHaveLength(2);
  });

  it("resolve múltiplos candidatos via nome_idoso", async () => {
    findFirstUsuario.mockImplementation((args: FindFirstUsuarioArgs) => {
      if (args.where.firebase_uid) return CUIDADOR;
      if (args.where.tipo_perfil === "idoso") return null;
      return { id: 20 };
    });
    findManyVinculo.mockResolvedValue([
      { idoso: { id: 30, nome: "Maria" } },
      { idoso: { id: 31, nome: "João" } },
    ]);
    findFirstVinculo.mockResolvedValue(null);
    createVinculo.mockResolvedValue({ id: 102, idoso_id: 31, vinculado_id: 1, status: "pendente" });

    const res = await post({ email: "familiar@a.com", nome_idoso: "joão" });

    expect(res.status).toBe(201);
    expect(createVinculo).toHaveBeenCalledWith({
      data: expect.objectContaining({ idoso_id: 31 }),
    });
  });
});
