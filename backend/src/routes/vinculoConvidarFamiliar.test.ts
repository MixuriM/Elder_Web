import express from "express";
import request from "supertest";

// POST /vinculo/convidar-familiar: o idoso convida um familiar pelo e-mail (RF-024/RF-025 depois do cadastro).
// Todos os ids, e-mails e uids abaixo são FICTÍCIOS, só para teste.
const verifyIdToken = jest.fn();
const findFirstUsuario = jest.fn();
const findUniqueUsuario = jest.fn();
const updateUsuario = jest.fn();
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
      update: (...args: unknown[]) => updateUsuario(...args),
    },
    vinculo: {
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

function convidar(body: unknown) {
  return request(buildApp()).post("/vinculo/convidar-familiar").set("Authorization", "Bearer x").send(body as object);
}

const IDOSO = 10;
const FAMILIAR = 20;
const EMAIL = "familiar.ficticio@exemplo.test";
const SEM_PEDIDO = {
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

// 1ª chamada de usuario.findUnique: requireAuth resolve por findFirst; a rota lê o próprio perfil; a 2ª lê o modo de decisão.
function comoIdoso(modo: string | null = null) {
  findFirstUsuario.mockImplementation(async ({ where }: { where: { firebase_uid?: string; tipo_perfil?: string } }) =>
    where.firebase_uid ? { id: IDOSO } : null,
  );
  findUniqueUsuario
    .mockResolvedValueOnce({ id: IDOSO, tipo_perfil: "idoso", email: "idoso.ficticio@exemplo.test" })
    .mockResolvedValueOnce({ ...SEM_PEDIDO, modo_decisao: modo });
}

function familiarExiste(existe: boolean) {
  findFirstUsuario.mockImplementation(async ({ where }: { where: { firebase_uid?: string; tipo_perfil?: string } }) => {
    if (where.firebase_uid) return { id: IDOSO };
    return existe && where.tipo_perfil === "familiar" ? { id: FAMILIAR } : null;
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  verifyIdToken.mockResolvedValue({ uid: "uid-1" });
  updateUsuario.mockResolvedValue({ id: IDOSO });
  createVinculo.mockResolvedValue({ id: 99 });
  findFirstVinculo.mockResolvedValue(null);
});

describe("POST /vinculo/convidar-familiar", () => {
  it.each(["cuidador", "familiar"])("403 para perfil %s, sem escrita", async (perfil) => {
    findFirstUsuario.mockResolvedValue({ id: 1 });
    findUniqueUsuario.mockResolvedValueOnce({ id: 1, tipo_perfil: perfil, email: "x@exemplo.test" });
    const res = await convidar({ email: EMAIL });
    expect(res.status).toBe(403);
    expect(updateUsuario).not.toHaveBeenCalled();
    expect(createVinculo).not.toHaveBeenCalled();
  });

  it.each([{}, { email: 5 }, { email: "   " }, { email: "sem-arroba" }, { email: `${"a".repeat(251)}@b.co` }])(
    "400 para e-mail inválido %j, sem escrita",
    async (corpo) => {
      comoIdoso();
      const res = await convidar(corpo);
      expect(res.status).toBe(400);
      expect(updateUsuario).not.toHaveBeenCalled();
      expect(createVinculo).not.toHaveBeenCalled();
    },
  );

  it("403 quando a decisão está com a família (o idoso não adiciona familiar automático nesse período)", async () => {
    comoIdoso("familiar");
    const res = await convidar({ email: EMAIL });
    expect(res.status).toBe(403);
    expect(res.body.error).not.toMatch(/modo_decisao/);
    expect(updateUsuario).not.toHaveBeenCalled();
    expect(createVinculo).not.toHaveBeenCalled();
  });

  it("400 ao convidar o próprio e-mail", async () => {
    comoIdoso();
    const res = await convidar({ email: "Idoso.Ficticio@exemplo.test" });
    expect(res.status).toBe(400);
    expect(updateUsuario).not.toHaveBeenCalled();
  });

  it("familiar já cadastrado: guarda o convite e cria o vínculo pendente de origem convite_idoso", async () => {
    comoIdoso();
    familiarExiste(true);
    const res = await convidar({ email: `  ${EMAIL}  ` });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ registrado: true });
    expect(updateUsuario).toHaveBeenCalledWith({
      where: { id: IDOSO },
      data: { email_convite_familiar: EMAIL },
      select: { id: true },
    });
    expect(createVinculo).toHaveBeenCalledWith({
      data: expect.objectContaining({
        idoso_id: IDOSO,
        vinculado_id: FAMILIAR,
        tipo_vinculo: "familiar",
        origem: "convite_idoso",
        status: "pendente",
      }),
    });
    const data = createVinculo.mock.calls[0][0].data;
    expect(data.confirmado_em).toBeUndefined();
  });

  it("e-mail ainda sem conta (ou de outro tipo de conta): mesma resposta, só guarda o convite", async () => {
    comoIdoso();
    familiarExiste(false);
    const res = await convidar({ email: EMAIL });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ registrado: true });
    expect(updateUsuario).toHaveBeenCalledTimes(1);
    expect(createVinculo).not.toHaveBeenCalled();
  });

  it.each(["pendente", "aprovado"])("409 se já existe vínculo %s com esse familiar, sem escrita", async (status) => {
    comoIdoso();
    familiarExiste(true);
    findFirstVinculo.mockResolvedValue({ status });
    const res = await convidar({ email: EMAIL });

    expect(res.status).toBe(409);
    expect(findFirstVinculo).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          idoso_id: IDOSO,
          vinculado_id: FAMILIAR,
          tipo_vinculo: "familiar",
          status: { in: ["pendente", "aprovado"] },
        }),
      }),
    );
    expect(createVinculo).not.toHaveBeenCalled();
    expect(updateUsuario).not.toHaveBeenCalled();
  });

  it("corrida: o índice único rejeita o create e vira 409", async () => {
    comoIdoso();
    familiarExiste(true);
    createVinculo.mockRejectedValue(new Error("Violation of UNIQUE KEY constraint"));
    const res = await convidar({ email: EMAIL });
    expect(res.status).toBe(409);
  });

  it("erro inesperado vira 500 genérico, sem vazar a mensagem", async () => {
    comoIdoso();
    familiarExiste(true);
    createVinculo.mockRejectedValue(new Error("SEGREDO-do-banco"));
    const res = await convidar({ email: EMAIL });
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("SEGREDO-do-banco");
  });
});
