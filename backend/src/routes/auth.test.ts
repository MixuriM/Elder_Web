import express from "express";
import request from "supertest";

const verifyIdToken = jest.fn();
const findFirst = jest.fn();
const findManyUsuario = jest.fn();
const create = jest.fn();
const updateUsuario = jest.fn();
const createVinculo = jest.fn();
const updateManyVinculo = jest.fn();

jest.mock("../lib/firebaseAdmin", () => ({
  auth: {
    verifyIdToken: (...args: unknown[]) => verifyIdToken(...args),
  },
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

describe("POST /auth/sync — vínculo automático Familiar↔Idoso (RF-025)", () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
    findFirst.mockReset();
    findManyUsuario.mockReset();
    create.mockReset();
    updateUsuario.mockReset();
    createVinculo.mockReset();
    updateManyVinculo.mockReset();
    createVinculo.mockResolvedValue({ id: 999 });
    updateManyVinculo.mockResolvedValue({ count: 0 });
    updateUsuario.mockImplementation((args: { where: { id: number }; data: Record<string, unknown> }) => ({
      id: args.where.id,
      ...args.data,
    }));
  });

  it("cadastro de familiar com e-mail correspondente cria Vinculo pendente", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-fam", email: "familiar@a.com", email_verified: false });
    findFirst.mockResolvedValueOnce(null); // não é login
    create.mockResolvedValue({ id: 10, tipo_perfil: "familiar" });
    findManyUsuario.mockResolvedValue([{ id: 1 }]);

    const res = await request(buildApp())
      .post("/auth/sync")
      .set("Authorization", "Bearer x")
      .send({ tipo_perfil: "familiar", nome: "Carla" });

    expect(res.status).toBe(201);
    expect(findManyUsuario).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tipo_perfil: "idoso", email_convite_familiar: "familiar@a.com" } })
    );
    expect(createVinculo).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          idoso_id: 1,
          vinculado_id: 10,
          tipo_vinculo: "familiar",
          origem: "convite_idoso",
          status: "pendente",
        }),
      })
    );
  });

  it("cadastro de familiar já com email_verified=true cria Vinculo direto aprovado", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-fam", email: "familiar@a.com", email_verified: true });
    findFirst.mockResolvedValueOnce(null);
    create.mockResolvedValue({ id: 10, tipo_perfil: "familiar" });
    findManyUsuario.mockResolvedValue([{ id: 1 }]);

    const res = await request(buildApp())
      .post("/auth/sync")
      .set("Authorization", "Bearer x")
      .send({ tipo_perfil: "familiar", nome: "Carla" });

    expect(res.status).toBe(201);
    expect(createVinculo).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "aprovado", confirmado_em: expect.any(Date) }),
      })
    );
  });

  it("cadastro de familiar sem e-mail correspondente não cria nada", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-fam", email: "familiar@a.com", email_verified: false });
    findFirst.mockResolvedValueOnce(null);
    create.mockResolvedValue({ id: 10, tipo_perfil: "familiar" });
    findManyUsuario.mockResolvedValue([]);

    const res = await request(buildApp())
      .post("/auth/sync")
      .set("Authorization", "Bearer x")
      .send({ tipo_perfil: "familiar", nome: "Carla" });

    expect(res.status).toBe(201);
    expect(createVinculo).not.toHaveBeenCalled();
  });

  it("e-mail correspondendo a mais de um idoso cria um Vinculo por idoso", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-fam", email: "familiar@a.com", email_verified: false });
    findFirst.mockResolvedValueOnce(null);
    create.mockResolvedValue({ id: 10, tipo_perfil: "familiar" });
    findManyUsuario.mockResolvedValue([{ id: 1 }, { id: 2 }]);

    const res = await request(buildApp())
      .post("/auth/sync")
      .set("Authorization", "Bearer x")
      .send({ tipo_perfil: "familiar", nome: "Carla" });

    expect(res.status).toBe(201);
    expect(createVinculo).toHaveBeenCalledTimes(2);
  });

  it("cadastro de idoso com email_convite_familiar batendo familiar existente cria Vinculo pendente", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-idoso", email: "idoso@a.com", email_verified: false });
    findFirst
      .mockResolvedValueOnce(null) // não é login
      .mockResolvedValueOnce({ id: 20 }); // familiar encontrado pelo e-mail
    create.mockResolvedValue({ id: 1, tipo_perfil: "idoso" });

    const res = await request(buildApp())
      .post("/auth/sync")
      .set("Authorization", "Bearer x")
      .send({ tipo_perfil: "idoso", nome: "Ana", email_convite_familiar: "familiar@a.com" });

    expect(res.status).toBe(201);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tipo_perfil: "familiar", email: "familiar@a.com" } })
    );
    expect(createVinculo).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          idoso_id: 1,
          vinculado_id: 20,
          tipo_vinculo: "familiar",
          origem: "convite_idoso",
          status: "pendente",
        }),
      })
    );
  });

  it("cadastro de idoso com email_convite_familiar sem familiar correspondente não cria nada", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-idoso", email: "idoso@a.com", email_verified: false });
    findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    create.mockResolvedValue({ id: 1, tipo_perfil: "idoso" });

    const res = await request(buildApp())
      .post("/auth/sync")
      .set("Authorization", "Bearer x")
      .send({ tipo_perfil: "idoso", nome: "Ana", email_convite_familiar: "familiar@a.com" });

    expect(res.status).toBe(201);
    expect(createVinculo).not.toHaveBeenCalled();
  });

  it("login de familiar com email_verified=true promove vínculos pendentes a aprovado", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-fam", email: "familiar@a.com", email_verified: true });
    findFirst.mockResolvedValueOnce({ id: 10, tipo_perfil: "familiar" });

    const res = await request(buildApp()).post("/auth/sync").set("Authorization", "Bearer x").send({});

    expect(res.status).toBe(200);
    expect(updateManyVinculo).toHaveBeenCalledWith({
      where: {
        vinculado_id: 10,
        tipo_vinculo: "familiar",
        origem: { in: ["convite_idoso", "cadastro_familiar"] },
        status: "pendente",
      },
      data: { status: "aprovado", confirmado_em: expect.any(Date) },
    });
  });

  it("login de familiar promove só origens da lista (convite_idoso, cadastro_familiar), nunca solicitacao_familiar", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-fam", email: "familiar@a.com", email_verified: true });
    findFirst.mockResolvedValueOnce({ id: 10, tipo_perfil: "familiar" });

    await request(buildApp()).post("/auth/sync").set("Authorization", "Bearer x").send({});

    const origem = updateManyVinculo.mock.calls[0][0].where.origem;
    expect(origem).toEqual({ in: ["convite_idoso", "cadastro_familiar"] });
    expect(origem.in).not.toContain("solicitacao_familiar");
  });

  it("login de familiar com email_verified=false não promove nada", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-fam", email: "familiar@a.com", email_verified: false });
    findFirst.mockResolvedValueOnce({ id: 10, tipo_perfil: "familiar" });

    const res = await request(buildApp()).post("/auth/sync").set("Authorization", "Bearer x").send({});

    expect(res.status).toBe(200);
    expect(updateManyVinculo).not.toHaveBeenCalled();
  });

  it("login de familiar sem vínculo pendente não quebra", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-fam", email: "familiar@a.com", email_verified: true });
    findFirst.mockResolvedValueOnce({ id: 10, tipo_perfil: "familiar" });
    updateManyVinculo.mockResolvedValue({ count: 0 });

    const res = await request(buildApp()).post("/auth/sync").set("Authorization", "Bearer x").send({});

    expect(res.status).toBe(200);
  });

  it("login repetido não duplica nem falha", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-fam", email: "familiar@a.com", email_verified: true });
    findFirst.mockResolvedValue({ id: 10, tipo_perfil: "familiar" });

    const app = buildApp();
    const res1 = await request(app).post("/auth/sync").set("Authorization", "Bearer x").send({});
    const res2 = await request(app).post("/auth/sync").set("Authorization", "Bearer x").send({});

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(updateManyVinculo).toHaveBeenCalledTimes(2);
  });

  it("login de idoso ou cuidador não tenta promover vínculo", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-idoso", email: "idoso@a.com", email_verified: true });
    findFirst.mockResolvedValueOnce({ id: 1, tipo_perfil: "idoso" });

    const res = await request(buildApp()).post("/auth/sync").set("Authorization", "Bearer x").send({});

    expect(res.status).toBe(200);
    expect(updateManyVinculo).not.toHaveBeenCalled();
  });
});

describe("POST /auth/sync — login sempre cancela transferência de modo_decisao em curso (RF-033)", () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
    findFirst.mockReset();
    updateUsuario.mockReset();
    updateUsuario.mockImplementation((args: { where: { id: number }; data: Record<string, unknown> }) => ({
      id: args.where.id,
      ...args.data,
    }));
  });

  it("login do idoso com solicitação pendente cancela os 4 campos e registra ultimo_login_em", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-idoso" });
    findFirst.mockResolvedValueOnce({
      id: 1,
      tipo_perfil: "idoso",
      modo_decisao_solicitado: "familiar",
    });

    const res = await request(buildApp()).post("/auth/sync").set("Authorization", "Bearer x").send({});

    expect(res.status).toBe(200);
    expect(updateUsuario).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        ultimo_login_em: expect.any(Date),
        modo_decisao_solicitado: null,
        modo_decisao_solicitado_por_id: null,
        modo_decisao_solicitado_em: null,
        modo_decisao_expira_em: null,
        modo_decisao_segunda_confirmacao_id: null,
        modo_decisao_motivo: null,
      },
    });
  });

  it("login do idoso sem solicitação pendente só registra ultimo_login_em", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-idoso" });
    findFirst.mockResolvedValueOnce({ id: 1, tipo_perfil: "idoso", modo_decisao_solicitado: null });

    const res = await request(buildApp()).post("/auth/sync").set("Authorization", "Bearer x").send({});

    expect(res.status).toBe(200);
    expect(updateUsuario).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { ultimo_login_em: expect.any(Date) },
    });
  });

  it("login de conta não-idoso nunca cancela modo_decisao_solicitado (guard é por tipo_perfil='idoso')", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-familiar", email_verified: false });
    findFirst.mockResolvedValueOnce({
      id: 10,
      tipo_perfil: "familiar",
      modo_decisao_solicitado: "familiar",
    });

    const res = await request(buildApp()).post("/auth/sync").set("Authorization", "Bearer x").send({});

    expect(res.status).toBe(200);
    expect(updateUsuario).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { ultimo_login_em: expect.any(Date) },
    });
  });
});
