import express from "express";
import request from "supertest";

// POST /vinculo/solicitar-cuidador com um convite do idoso (cuidador, convite_idoso) vencido ainda `pendente` no banco:
// o convite vencido não pode travar o pedido do próprio cuidador (o caminho alternativo ao convite). Só o convite vencido
// é substituído; convite válido, pedido do cuidador e vínculo aprovado seguem dando 409. Fake de Prisma que filtra pelo
// where. Todos os ids, e-mails e uids abaixo são FICTÍCIOS, só para teste.
const verifyIdToken = jest.fn();
const findFirstUsuario = jest.fn();
const findUniqueUsuario = jest.fn();
const findFirstVinculo = jest.fn();
const createVinculo = jest.fn();
const updateManyVinculo = jest.fn();
const transacao = jest.fn();

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
      create: (...args: unknown[]) => createVinculo(...args),
      updateMany: (...args: unknown[]) => updateManyVinculo(...args),
    },
    $transaction: (...args: unknown[]) => transacao(...args),
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

const CUIDADOR = 30;
const IDOSO = 10;
const EMAIL_IDOSO = "idoso.ficticio@exemplo.test";
const AGORA = new Date("2026-10-12T12:00:00.000Z").getTime();
const DIA = 24 * 60 * 60 * 1000;

type Linha = {
  id: number;
  idoso_id: number;
  vinculado_id: number;
  tipo_vinculo: string;
  status: string;
  origem: string;
  data_solicitacao: Date;
};

const linha = (extra: Partial<Linha> = {}): Linha => ({
  id: 7,
  idoso_id: IDOSO,
  vinculado_id: CUIDADOR,
  tipo_vinculo: "cuidador",
  status: "pendente",
  origem: "convite_idoso",
  data_solicitacao: new Date(AGORA - 7 * DIA - 1),
  ...extra,
});

let banco: Linha[];
let relogio: jest.SpyInstance;

function solicitar() {
  return request(buildApp())
    .post("/vinculo/solicitar-cuidador")
    .set("Authorization", "Bearer x")
    .send({ email: EMAIL_IDOSO });
}

beforeEach(() => {
  jest.resetAllMocks();
  relogio = jest.spyOn(Date, "now").mockReturnValue(AGORA);
  verifyIdToken.mockResolvedValue({ uid: "uid-cuidador" });
  findFirstUsuario.mockImplementation(async ({ where }: { where: { firebase_uid?: string; tipo_perfil?: string; email?: string } }) => {
    if (where.firebase_uid) return { id: CUIDADOR };
    return where.tipo_perfil === "idoso" && where.email === EMAIL_IDOSO ? { id: IDOSO, nome: "Idoso Ficticio" } : null;
  });
  findUniqueUsuario.mockResolvedValue({ id: CUIDADOR, tipo_perfil: "cuidador" });
  banco = [];
  findFirstVinculo.mockImplementation(
    async ({ where }: { where: { idoso_id: number; vinculado_id: number; tipo_vinculo: string; status: { in: string[] } } }) =>
      banco.find(
        (l) =>
          l.idoso_id === where.idoso_id &&
          l.vinculado_id === where.vinculado_id &&
          l.tipo_vinculo === where.tipo_vinculo &&
          where.status.in.includes(l.status),
      ) ?? null,
  );
  updateManyVinculo.mockImplementation(
    async ({ where, data }: { where: { id: number; status: string }; data: Partial<Linha> }) => {
      const alvos = banco.filter((l) => l.id === where.id && l.status === where.status);
      alvos.forEach((l) => Object.assign(l, data));
      return { count: alvos.length };
    },
  );
  createVinculo.mockImplementation(async ({ data }: { data: Partial<Linha> }) => ({ id: 99, ...data }));
  transacao.mockImplementation(async (operacoes: Promise<unknown>[]) => Promise.all(operacoes));
});

afterEach(() => relogio.mockRestore());

describe("POST /vinculo/solicitar-cuidador com convite do idoso vencido", () => {
  it("convite vencido (7 dias e 1 ms): vira recusado e o pedido do cuidador é criado numa só transação", async () => {
    banco = [linha()];
    const res = await solicitar();

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 99, origem: "solicitacao_cuidador", status: "pendente", idoso_id: IDOSO });
    expect(transacao).toHaveBeenCalledTimes(1);
    expect(transacao.mock.calls[0][0]).toHaveLength(2);
    expect(updateManyVinculo).toHaveBeenCalledTimes(1);
    expect(updateManyVinculo).toHaveBeenCalledWith({
      where: { id: 7, status: "pendente" },
      data: { status: "recusado", aprovador_id: CUIDADOR, data_resposta: expect.any(Date) },
    });
    expect(createVinculo).toHaveBeenCalledWith({
      data: expect.objectContaining({
        idoso_id: IDOSO,
        vinculado_id: CUIDADOR,
        tipo_vinculo: "cuidador",
        origem: "solicitacao_cuidador",
        status: "pendente",
      }),
    });
    expect(banco[0].status).toBe("recusado");
  });

  it.each([
    ["6 dias e 23 horas", 6 * DIA + 23 * 60 * 60 * 1000],
    ["exatamente 7 dias", 7 * DIA],
  ])("convite com %s ainda vale: 409, sem escrita (o cuidador aceita ou recusa)", async (_nome, idade) => {
    banco = [linha({ data_solicitacao: new Date(AGORA - idade) })];
    const res = await solicitar();

    expect(res.status).toBe(409);
    expect(transacao).not.toHaveBeenCalled();
    expect(createVinculo).not.toHaveBeenCalled();
    expect(banco[0].status).toBe("pendente");
  });

  it("pedido pendente do próprio cuidador, mesmo antigo, continua dando 409 e não é tocado", async () => {
    banco = [linha({ origem: "solicitacao_cuidador", data_solicitacao: new Date(AGORA - 30 * DIA) })];
    const res = await solicitar();

    expect(res.status).toBe(409);
    expect(transacao).not.toHaveBeenCalled();
    expect(banco[0].status).toBe("pendente");
  });

  it("vínculo aprovado, mesmo antigo, continua dando 409", async () => {
    banco = [linha({ status: "aprovado", data_solicitacao: new Date(AGORA - 30 * DIA) })];
    const res = await solicitar();

    expect(res.status).toBe(409);
    expect(transacao).not.toHaveBeenCalled();
    expect(banco[0].status).toBe("aprovado");
  });

  it("convites vencidos de outro idoso ou de outro cuidador não são tocados", async () => {
    const velho = new Date(AGORA - 30 * DIA);
    banco = [
      linha({ data_solicitacao: velho }),
      linha({ id: 8, idoso_id: 99, data_solicitacao: velho }),
      linha({ id: 9, vinculado_id: 77, data_solicitacao: velho }),
    ];
    const res = await solicitar();

    expect(res.status).toBe(201);
    expect(updateManyVinculo).toHaveBeenCalledTimes(1);
    expect(updateManyVinculo.mock.calls[0][0].where).toEqual({ id: 7, status: "pendente" });
    expect(banco.map((l) => l.status)).toEqual(["recusado", "pendente", "pendente"]);
  });

  it("sem vínculo anterior segue criando o pedido direto, sem transação", async () => {
    const res = await solicitar();

    expect(res.status).toBe(201);
    expect(transacao).not.toHaveBeenCalled();
    expect(createVinculo).toHaveBeenCalledTimes(1);
  });

  it("corrida: a transação rejeitada pelo índice único vira 409", async () => {
    banco = [linha()];
    transacao.mockRejectedValue(new Error("Violation of UNIQUE KEY constraint"));
    const res = await solicitar();
    expect(res.status).toBe(409);
  });
});
