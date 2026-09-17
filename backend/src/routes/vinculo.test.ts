import express from "express";
import request from "supertest";

const verifyIdToken = jest.fn();
const findFirstUsuario = jest.fn();
const findUniqueUsuario = jest.fn();
const findManyVinculo = jest.fn();
const findFirstVinculo = jest.fn();
const createVinculo = jest.fn();
const findUniqueVinculo = jest.fn();
const updateVinculo = jest.fn();

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
      findUnique: (...args: unknown[]) => findUniqueVinculo(...args),
      update: (...args: unknown[]) => updateVinculo(...args),
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
const FAMILIAR = { id: 1, tipo_perfil: "familiar" };

type FindFirstUsuarioArgs = { where: { firebase_uid?: string; tipo_perfil?: string } };

function post(body: Record<string, unknown>) {
  return request(buildApp()).post("/vinculo/solicitar-cuidador").set("Authorization", "Bearer x").send(body);
}

function postFamiliar(body: Record<string, unknown>) {
  return request(buildApp()).post("/vinculo/solicitar-familiar").set("Authorization", "Bearer x").send(body);
}

function responder(id: number, acao: "aprovar" | "recusar") {
  return request(buildApp()).post(`/vinculo/${id}/${acao}`).set("Authorization", "Bearer x").send();
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

describe("POST /vinculo/solicitar-familiar", () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
    findFirstUsuario.mockReset();
    findUniqueUsuario.mockReset();
    findFirstVinculo.mockReset();
    createVinculo.mockReset();
    verifyIdToken.mockResolvedValue({ uid: "uid-1" });
    findFirstUsuario.mockResolvedValue(FAMILIAR); // requireAuth resolve caller
    findUniqueUsuario.mockResolvedValue(FAMILIAR);
  });

  it("403 quando chamador não é familiar", async () => {
    findUniqueUsuario.mockResolvedValue({ id: 1, tipo_perfil: "cuidador" });
    const res = await postFamiliar({ email: "idoso@a.com" });
    expect(res.status).toBe(403);
  });

  it("sucesso: cria vínculo pendente com origem solicitacao_familiar", async () => {
    findFirstUsuario.mockImplementation((args: FindFirstUsuarioArgs) =>
      args.where.firebase_uid ? FAMILIAR : { id: 10, tipo_perfil: "idoso" },
    );
    findFirstVinculo.mockResolvedValue(null);
    createVinculo.mockResolvedValue({ id: 200, idoso_id: 10, vinculado_id: 1, status: "pendente" });

    const res = await postFamiliar({ email: "idoso@a.com" });

    expect(res.status).toBe(201);
    expect(createVinculo).toHaveBeenCalledWith({
      data: expect.objectContaining({
        idoso_id: 10,
        vinculado_id: 1,
        tipo_vinculo: "familiar",
        origem: "solicitacao_familiar",
        status: "pendente",
      }),
    });
  });

  it("404 quando e-mail não encontra idoso nenhum", async () => {
    findFirstUsuario.mockImplementation((args: FindFirstUsuarioArgs) => (args.where.firebase_uid ? FAMILIAR : null));

    const res = await postFamiliar({ email: "ninguem@a.com" });

    expect(res.status).toBe(404);
  });

  it("404 genérico quando e-mail pertence a conta que não é idoso", async () => {
    // findFirst já filtra tipo_perfil='idoso' na query — uma conta de outro tipo com
    // esse e-mail nunca bate no where, então resolve null igual a "não encontrado".
    // Não revela a que tipo de conta o e-mail pertence (mesmo padrão da tarefa 2.1).
    findFirstUsuario.mockImplementation((args: FindFirstUsuarioArgs) => (args.where.firebase_uid ? FAMILIAR : null));

    const res = await postFamiliar({ email: "cuidador@a.com" });

    expect(res.status).toBe(404);
  });

  it("409 quando já existe solicitação pendente", async () => {
    findFirstUsuario.mockImplementation((args: FindFirstUsuarioArgs) =>
      args.where.firebase_uid ? FAMILIAR : { id: 10, tipo_perfil: "idoso" },
    );
    findFirstVinculo.mockResolvedValue({ status: "pendente" });

    const res = await postFamiliar({ email: "idoso@a.com" });

    expect(res.status).toBe(409);
  });

  it("409 quando já vinculados (aprovado)", async () => {
    findFirstUsuario.mockImplementation((args: FindFirstUsuarioArgs) =>
      args.where.firebase_uid ? FAMILIAR : { id: 10, tipo_perfil: "idoso" },
    );
    findFirstVinculo.mockResolvedValue({ status: "aprovado" });

    const res = await postFamiliar({ email: "idoso@a.com" });

    expect(res.status).toBe(409);
  });

  it("409 quando colide com vínculo já criado pelo Fluxo A (origem convite_idoso)", async () => {
    // Fluxo A (tarefa 2.5) já criou Vinculo pendente/aprovado com origem='convite_idoso'
    // pro mesmo par idoso/familiar — o índice único (idoso_id, vinculado_id, tipo_vinculo)
    // filtrado por status não distingue origem, então a checagem de duplicidade em
    // aplicação (findFirst) já pega esse caso antes de tentar o create. Comportamento
    // correto: não duplicar vínculo, não é bug.
    findFirstUsuario.mockImplementation((args: FindFirstUsuarioArgs) =>
      args.where.firebase_uid ? FAMILIAR : { id: 10, tipo_perfil: "idoso" },
    );
    findFirstVinculo.mockResolvedValue({ status: "aprovado", origem: "convite_idoso" });

    const res = await postFamiliar({ email: "idoso@a.com" });

    expect(res.status).toBe(409);
  });

  it("permite nova solicitação quando único registro existente foi recusado", async () => {
    findFirstUsuario.mockImplementation((args: FindFirstUsuarioArgs) =>
      args.where.firebase_uid ? FAMILIAR : { id: 10, tipo_perfil: "idoso" },
    );
    findFirstVinculo.mockResolvedValue(null); // findFirst já filtra status in [pendente, aprovado]
    createVinculo.mockResolvedValue({ id: 201, idoso_id: 10, vinculado_id: 1, status: "pendente" });

    const res = await postFamiliar({ email: "idoso@a.com" });

    expect(res.status).toBe(201);
  });
});

describe("POST /vinculo/:id/aprovar e /recusar", () => {
  const VINCULO_PENDENTE = { id: 5, idoso_id: 10, status: "pendente", tipo_vinculo: "cuidador" };

  beforeEach(() => {
    verifyIdToken.mockReset();
    findFirstUsuario.mockReset();
    findUniqueUsuario.mockReset();
    findFirstVinculo.mockReset();
    findUniqueVinculo.mockReset();
    updateVinculo.mockReset();
    verifyIdToken.mockResolvedValue({ uid: "uid-1" });
  });

  it("aprova quando modo_decisao='idoso' e chamador é o idoso", async () => {
    findFirstUsuario.mockResolvedValue({ id: 10 });
    findUniqueVinculo.mockResolvedValue(VINCULO_PENDENTE);
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "idoso" });
    updateVinculo.mockResolvedValue({ ...VINCULO_PENDENTE, status: "aprovado", aprovador_id: 10 });

    const res = await responder(5, "aprovar");

    expect(res.status).toBe(200);
    expect(updateVinculo).toHaveBeenCalledWith({
      where: { id: 5 },
      data: expect.objectContaining({ status: "aprovado", aprovador_id: 10 }),
    });
  });

  it("recusa quando modo_decisao='idoso' e chamador é o idoso", async () => {
    findFirstUsuario.mockResolvedValue({ id: 10 });
    findUniqueVinculo.mockResolvedValue(VINCULO_PENDENTE);
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "idoso" });
    updateVinculo.mockResolvedValue({ ...VINCULO_PENDENTE, status: "recusado", aprovador_id: 10 });

    const res = await responder(5, "recusar");

    expect(res.status).toBe(200);
    expect(updateVinculo).toHaveBeenCalledWith({
      where: { id: 5 },
      data: expect.objectContaining({ status: "recusado" }),
    });
  });

  it("403 quando modo_decisao='idoso' e chamador não é o idoso", async () => {
    findFirstUsuario.mockResolvedValue({ id: 99 });
    findUniqueVinculo.mockResolvedValue(VINCULO_PENDENTE);
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "idoso" });

    const res = await responder(5, "aprovar");

    expect(res.status).toBe(403);
  });

  it("aprova quando modo_decisao='familiar' e chamador é familiar aprovado", async () => {
    findFirstUsuario.mockResolvedValue({ id: 20 });
    findUniqueVinculo.mockResolvedValue(VINCULO_PENDENTE);
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "familiar" });
    findFirstVinculo.mockResolvedValue({ id: 999 });
    updateVinculo.mockResolvedValue({ ...VINCULO_PENDENTE, status: "aprovado", aprovador_id: 20 });

    const res = await responder(5, "aprovar");

    expect(res.status).toBe(200);
    expect(findFirstVinculo).toHaveBeenCalledWith({
      where: { idoso_id: 10, vinculado_id: 20, tipo_vinculo: "familiar", status: "aprovado" },
      select: { id: true },
    });
  });

  it("recusa quando modo_decisao='familiar' e chamador é familiar aprovado", async () => {
    findFirstUsuario.mockResolvedValue({ id: 20 });
    findUniqueVinculo.mockResolvedValue(VINCULO_PENDENTE);
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "familiar" });
    findFirstVinculo.mockResolvedValue({ id: 999 });
    updateVinculo.mockResolvedValue({ ...VINCULO_PENDENTE, status: "recusado", aprovador_id: 20 });

    const res = await responder(5, "recusar");

    expect(res.status).toBe(200);
  });

  it("403 quando modo_decisao='familiar' e chamador é o próprio idoso", async () => {
    findFirstUsuario.mockResolvedValue({ id: 10 });
    findUniqueVinculo.mockResolvedValue(VINCULO_PENDENTE);
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "familiar" });

    const res = await responder(5, "aprovar");

    expect(res.status).toBe(403);
  });

  it("403 quando modo_decisao='familiar' e chamador é familiar sem vínculo aprovado", async () => {
    findFirstUsuario.mockResolvedValue({ id: 20 });
    findUniqueVinculo.mockResolvedValue(VINCULO_PENDENTE);
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "familiar" });
    findFirstVinculo.mockResolvedValue(null);

    const res = await responder(5, "aprovar");

    expect(res.status).toBe(403);
  });

  it("404 quando vínculo não existe", async () => {
    findFirstUsuario.mockResolvedValue({ id: 10 });
    findUniqueVinculo.mockResolvedValue(null);

    const res = await responder(999, "aprovar");

    expect(res.status).toBe(404);
  });

  it("409 quando vínculo já foi resolvido", async () => {
    findFirstUsuario.mockResolvedValue({ id: 10 });
    findUniqueVinculo.mockResolvedValue({ ...VINCULO_PENDENTE, status: "aprovado" });

    const res = await responder(5, "aprovar");

    expect(res.status).toBe(409);
  });
});
