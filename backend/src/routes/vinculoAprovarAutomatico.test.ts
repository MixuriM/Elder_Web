import express from "express";
import request from "supertest";

// Vínculo de origem automática (convite_idoso, cadastro_familiar) é aprovado pela confirmação de posse do
// e-mail (login com email_verified), nunca por clique de aprovar. Recusar continua permitido. Ids fictícios.
const verifyIdToken = jest.fn();
const findFirstUsuario = jest.fn();
const findUniqueUsuario = jest.fn();
const findFirstVinculo = jest.fn();
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
      findFirst: (...args: unknown[]) => findFirstVinculo(...args),
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

function responder(id: number, acao: "aprovar" | "recusar") {
  return request(buildApp()).post(`/vinculo/${id}/${acao}`).set("Authorization", "Bearer x").send();
}

const pendente = (origem: string) => ({ id: 5, idoso_id: 10, status: "pendente", tipo_vinculo: "familiar", origem });

describe("aprovar e recusar vínculo de origem automática", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    verifyIdToken.mockResolvedValue({ uid: "uid-1" });
    findFirstUsuario.mockResolvedValue({ id: 10 }); // o próprio idoso, modo idoso
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "idoso" });
    updateVinculo.mockResolvedValue({ id: 5 });
  });

  it.each(["convite_idoso", "cadastro_familiar"])("aprovar origem %s pendente dá 409 e não grava", async (origem) => {
    findUniqueVinculo.mockResolvedValue(pendente(origem));

    const res = await responder(5, "aprovar");

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/confirmar o e-mail/i);
    expect(updateVinculo).not.toHaveBeenCalled();
  });

  it.each(["convite_idoso", "cadastro_familiar"])("recusar origem %s pendente continua permitido", async (origem) => {
    findUniqueVinculo.mockResolvedValue(pendente(origem));

    const res = await responder(5, "recusar");

    expect(res.status).toBe(200);
    expect(updateVinculo).toHaveBeenCalledWith({
      where: { id: 5 },
      data: expect.objectContaining({ status: "recusado", aprovador_id: 10 }),
    });
  });

  it("aprovar origem manual (solicitacao_familiar) segue funcionando", async () => {
    findUniqueVinculo.mockResolvedValue(pendente("solicitacao_familiar"));

    const res = await responder(5, "aprovar");

    expect(res.status).toBe(200);
    expect(updateVinculo).toHaveBeenCalledWith({
      where: { id: 5 },
      data: expect.objectContaining({ status: "aprovado" }),
    });
  });

  it("sem autoridade o 403 vem antes do 409 (não revela a origem a quem não decide)", async () => {
    findFirstUsuario.mockResolvedValue({ id: 99 });
    findUniqueVinculo.mockResolvedValue(pendente("convite_idoso"));

    const res = await responder(5, "aprovar");

    expect(res.status).toBe(403);
    expect(res.body.error).not.toMatch(/e-mail/i);
    expect(updateVinculo).not.toHaveBeenCalled();
  });
});
