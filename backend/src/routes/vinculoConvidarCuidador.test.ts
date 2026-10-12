import express from "express";
import request from "supertest";

// POST /vinculo/convidar-cuidador: o idoso convida um cuidador que JÁ tem conta; nasce Vinculo pendente que só o
// cuidador aceita. Todos os ids, e-mails e uids abaixo são FICTÍCIOS, só para teste.
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

function convidar(body: unknown) {
  return request(buildApp()).post("/vinculo/convidar-cuidador").set("Authorization", "Bearer x").send(body as object);
}

const IDOSO = 10;
const CUIDADOR = 30;
const EMAIL = "cuidador.ficticio@exemplo.test";
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

type Where = { firebase_uid?: string; tipo_perfil?: string; email?: string };
type Conta = { id: number; tipo_perfil: string; email: string };
type LinhaVinculo = {
  id?: number;
  idoso_id: number;
  vinculado_id: number;
  tipo_vinculo: string;
  status: string;
  origem?: string;
  data_solicitacao?: Date;
};

// Contas existentes no banco fake. O findFirst filtra de verdade por tipo_perfil e e-mail (senão o teste do
// filtro de tipo passaria por vacuidade).
function contasNoBanco(contas: Conta[]) {
  findFirstUsuario.mockImplementation(async ({ where }: { where: Where }) => {
    if (where.firebase_uid) return { id: IDOSO };
    return (
      contas.find((c) => (where.tipo_perfil === undefined || c.tipo_perfil === where.tipo_perfil) && c.email === where.email) ??
      null
    );
  });
}

// Vínculos do banco fake, também filtrados de verdade pelo where da rota.
function vinculosNoBanco(linhas: LinhaVinculo[]) {
  findFirstVinculo.mockImplementation(
    async ({ where }: { where: Partial<LinhaVinculo> & { status?: { in: string[] } } }) => {
      const achou = linhas.find(
        (l) =>
          l.idoso_id === where.idoso_id &&
          l.vinculado_id === where.vinculado_id &&
          l.tipo_vinculo === where.tipo_vinculo &&
          (where.status?.in ?? []).includes(l.status),
      );
      return achou
        ? {
            id: achou.id ?? 1,
            status: achou.status,
            origem: achou.origem ?? "convite_idoso",
            data_solicitacao: achou.data_solicitacao ?? new Date(),
          }
        : null;
    },
  );
  // updateMany também filtra de verdade (id e status): vínculo de outro par nunca é tocado.
  updateManyVinculo.mockImplementation(
    async ({ where, data }: { where: { id: number; status: string }; data: Partial<LinhaVinculo> }) => {
      const alvos = linhas.filter((l) => l.id === where.id && l.status === where.status);
      alvos.forEach((l) => Object.assign(l, data));
      return { count: alvos.length };
    },
  );
}

// 1ª chamada de usuario.findUnique: a rota lê o próprio perfil; a 2ª lê o modo de decisão.
function comoIdoso(modo: string | null = null) {
  findFirstUsuario.mockImplementation(async ({ where }: { where: Where }) => (where.firebase_uid ? { id: IDOSO } : null));
  findUniqueUsuario
    .mockResolvedValueOnce({ id: IDOSO, tipo_perfil: "idoso", email: "idoso.ficticio@exemplo.test" })
    .mockResolvedValueOnce({ ...SEM_PEDIDO, modo_decisao: modo });
}

const CONSOLES = ["log", "info", "warn", "error", "debug"] as const;
let espioes: jest.SpyInstance[] = [];

beforeEach(() => {
  jest.resetAllMocks();
  verifyIdToken.mockResolvedValue({ uid: "uid-1" });
  createVinculo.mockResolvedValue({ id: 99 });
  findFirstVinculo.mockResolvedValue(null);
  updateManyVinculo.mockResolvedValue({ count: 1 });
  transacao.mockImplementation(async (operacoes: Promise<unknown>[]) => Promise.all(operacoes));
  espioes = CONSOLES.map((m) => jest.spyOn(console, m).mockImplementation(() => undefined));
});

afterEach(() => {
  espioes.forEach((e) => e.mockRestore());
});

describe("POST /vinculo/convidar-cuidador", () => {
  it.each(["cuidador", "familiar"])("403 para perfil %s, sem escrita", async (perfil) => {
    findFirstUsuario.mockResolvedValue({ id: 1 });
    findUniqueUsuario.mockResolvedValueOnce({ id: 1, tipo_perfil: perfil, email: "x@exemplo.test" });
    const res = await convidar({ email: EMAIL });
    expect(res.status).toBe(403);
    expect(createVinculo).not.toHaveBeenCalled();
  });

  it.each([{}, { email: 5 }, { email: "   " }, { email: "sem-arroba" }, { email: `${"a".repeat(251)}@b.co` }])(
    "400 para e-mail inválido %j, sem escrita",
    async (corpo) => {
      comoIdoso();
      const res = await convidar(corpo);
      expect(res.status).toBe(400);
      expect(createVinculo).not.toHaveBeenCalled();
    },
  );

  it("403 quando a decisão está com a família, sem citar modo_decisao", async () => {
    comoIdoso("familiar");
    const res = await convidar({ email: EMAIL });
    expect(res.status).toBe(403);
    expect(res.body.error).not.toMatch(/modo_decisao/);
    expect(createVinculo).not.toHaveBeenCalled();
  });

  it("400 ao convidar o próprio e-mail", async () => {
    comoIdoso();
    const res = await convidar({ email: "Idoso.Ficticio@exemplo.test" });
    expect(res.status).toBe(400);
    expect(createVinculo).not.toHaveBeenCalled();
  });

  it("201 com conta de cuidador: cria o vínculo pendente de convite_idoso com o idoso do chamador", async () => {
    comoIdoso();
    contasNoBanco([{ id: CUIDADOR, tipo_perfil: "cuidador", email: EMAIL }]);
    const res = await convidar({ email: `  ${EMAIL}  `, idoso_id: 999, vinculado_id: 888, status: "aprovado" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ registrado: true });
    expect(createVinculo).toHaveBeenCalledTimes(1);
    expect(createVinculo).toHaveBeenCalledWith({
      data: {
        idoso_id: IDOSO,
        vinculado_id: CUIDADOR,
        tipo_vinculo: "cuidador",
        origem: "convite_idoso",
        status: "pendente",
        data_solicitacao: expect.any(Date),
      },
    });
  });

  it("201 sem conta: não cria nada", async () => {
    comoIdoso();
    contasNoBanco([]);
    const res = await convidar({ email: EMAIL });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ registrado: true });
    expect(createVinculo).not.toHaveBeenCalled();
  });

  it("resposta idêntica byte a byte com e sem conta (sem oráculo de enumeração)", async () => {
    comoIdoso();
    contasNoBanco([{ id: CUIDADOR, tipo_perfil: "cuidador", email: EMAIL }]);
    const com = await convidar({ email: EMAIL });

    jest.clearAllMocks();
    comoIdoso();
    contasNoBanco([]);
    const sem = await convidar({ email: EMAIL });

    expect(com.status).toBe(sem.status);
    expect(com.text).toBe(sem.text);
    expect(com.text).toBe(JSON.stringify({ registrado: true }));
    expect(com.headers["content-length"]).toBe(sem.headers["content-length"]);
  });

  it.each(["familiar", "idoso"])("conta de %s com o mesmo e-mail não gera vínculo", async (tipo) => {
    comoIdoso();
    contasNoBanco([{ id: 77, tipo_perfil: tipo, email: EMAIL }]);
    const res = await convidar({ email: EMAIL });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ registrado: true });
    expect(createVinculo).not.toHaveBeenCalled();
  });

  it.each(["pendente", "aprovado"])("409 se já existe vínculo %s de cuidador com a pessoa, sem escrita", async (status) => {
    comoIdoso();
    contasNoBanco([{ id: CUIDADOR, tipo_perfil: "cuidador", email: EMAIL }]);
    vinculosNoBanco([{ idoso_id: IDOSO, vinculado_id: CUIDADOR, tipo_vinculo: "cuidador", status }]);
    const res = await convidar({ email: EMAIL });

    expect(res.status).toBe(409);
    expect(createVinculo).not.toHaveBeenCalled();
  });

  it("201 de novo depois de um vínculo recusado", async () => {
    comoIdoso();
    contasNoBanco([{ id: CUIDADOR, tipo_perfil: "cuidador", email: EMAIL }]);
    vinculosNoBanco([{ idoso_id: IDOSO, vinculado_id: CUIDADOR, tipo_vinculo: "cuidador", status: "recusado" }]);
    const res = await convidar({ email: EMAIL });

    expect(res.status).toBe(201);
    expect(createVinculo).toHaveBeenCalledTimes(1);
  });

  it("vínculo de familiar com a mesma pessoa não bloqueia o convite de cuidador", async () => {
    comoIdoso();
    contasNoBanco([{ id: CUIDADOR, tipo_perfil: "cuidador", email: EMAIL }]);
    vinculosNoBanco([{ idoso_id: IDOSO, vinculado_id: CUIDADOR, tipo_vinculo: "familiar", status: "aprovado" }]);
    const res = await convidar({ email: EMAIL });

    expect(res.status).toBe(201);
    expect(createVinculo).toHaveBeenCalledTimes(1);
  });

  it("corrida: o índice único rejeita o create e vira 409", async () => {
    comoIdoso();
    contasNoBanco([{ id: CUIDADOR, tipo_perfil: "cuidador", email: EMAIL }]);
    createVinculo.mockRejectedValue(new Error("Violation of UNIQUE KEY constraint"));
    const res = await convidar({ email: EMAIL });
    expect(res.status).toBe(409);
  });

  it("erro inesperado vira 500 genérico, sem vazar a mensagem", async () => {
    comoIdoso();
    contasNoBanco([{ id: CUIDADOR, tipo_perfil: "cuidador", email: EMAIL }]);
    createVinculo.mockRejectedValue(new Error("SEGREDO-do-banco"));
    const res = await convidar({ email: EMAIL });
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("SEGREDO-do-banco");
  });

  it("nenhum console.* é chamado em nenhum caminho", async () => {
    comoIdoso();
    contasNoBanco([{ id: CUIDADOR, tipo_perfil: "cuidador", email: EMAIL }]);
    await convidar({ email: EMAIL });
    comoIdoso();
    contasNoBanco([]);
    await convidar({ email: EMAIL });
    comoIdoso();
    await convidar({ email: "sem-arroba" });
    espioes.forEach((e) => expect(e).not.toHaveBeenCalled());
  });
});

// Convite vencido (mais de 7 dias, sem job) continua `pendente` no banco e bloquearia novo convite pelo 409 e pelo
// índice único filtrado. Só o convite do idoso (cuidador, convite_idoso) vencido é substituído, numa só transação.
describe("POST /vinculo/convidar-cuidador: convite vencido do mesmo par", () => {
  const AGORA = new Date("2026-10-12T12:00:00.000Z").getTime();
  const DIA = 24 * 60 * 60 * 1000;
  const HORA = 60 * 60 * 1000;
  const VELHO = 7;
  let relogio: jest.SpyInstance;

  const linha = (extra: Partial<LinhaVinculo> = {}): LinhaVinculo => ({
    id: VELHO,
    idoso_id: IDOSO,
    vinculado_id: CUIDADOR,
    tipo_vinculo: "cuidador",
    status: "pendente",
    origem: "convite_idoso",
    data_solicitacao: new Date(AGORA - 7 * DIA - 1),
    ...extra,
  });

  beforeEach(() => {
    relogio = jest.spyOn(Date, "now").mockReturnValue(AGORA);
    comoIdoso();
    contasNoBanco([{ id: CUIDADOR, tipo_perfil: "cuidador", email: EMAIL }]);
  });
  afterEach(() => relogio.mockRestore());

  it("com 7 dias e 1 ms: substitui numa só transação (updateMany recusado + create) e responde igual", async () => {
    const banco = [linha()];
    vinculosNoBanco(banco);
    const res = await convidar({ email: EMAIL });

    expect(res.status).toBe(201);
    expect(res.text).toBe(JSON.stringify({ registrado: true }));
    expect(transacao).toHaveBeenCalledTimes(1);
    expect(transacao.mock.calls[0][0]).toHaveLength(2);
    expect(updateManyVinculo).toHaveBeenCalledTimes(1);
    expect(updateManyVinculo).toHaveBeenCalledWith({
      where: { id: VELHO, status: "pendente" },
      data: { status: "recusado", aprovador_id: IDOSO, data_resposta: expect.any(Date) },
    });
    expect(createVinculo).toHaveBeenCalledTimes(1);
    expect(createVinculo).toHaveBeenCalledWith({
      data: {
        idoso_id: IDOSO,
        vinculado_id: CUIDADOR,
        tipo_vinculo: "cuidador",
        origem: "convite_idoso",
        status: "pendente",
        data_solicitacao: expect.any(Date),
      },
    });
    expect(banco[0].status).toBe("recusado");
  });

  it.each([
    ["6 dias e 23 horas", 6 * DIA + 23 * HORA],
    ["exatamente 7 dias", 7 * DIA],
  ])("convite com %s ainda vale: 409, sem escrita", async (_nome, idade) => {
    vinculosNoBanco([linha({ data_solicitacao: new Date(AGORA - idade) })]);
    const res = await convidar({ email: EMAIL });

    expect(res.status).toBe(409);
    expect(transacao).not.toHaveBeenCalled();
    expect(updateManyVinculo).not.toHaveBeenCalled();
    expect(createVinculo).not.toHaveBeenCalled();
  });

  it("pendente de solicitacao_cuidador, mesmo antigo, continua dando 409 e não é tocado", async () => {
    const banco = [linha({ origem: "solicitacao_cuidador", data_solicitacao: new Date(AGORA - 30 * DIA) })];
    vinculosNoBanco(banco);
    const res = await convidar({ email: EMAIL });

    expect(res.status).toBe(409);
    expect(transacao).not.toHaveBeenCalled();
    expect(updateManyVinculo).not.toHaveBeenCalled();
    expect(banco[0].status).toBe("pendente");
  });

  it("vínculo aprovado, mesmo antigo, continua dando 409", async () => {
    const banco = [linha({ status: "aprovado", data_solicitacao: new Date(AGORA - 30 * DIA) })];
    vinculosNoBanco(banco);
    const res = await convidar({ email: EMAIL });

    expect(res.status).toBe(409);
    expect(transacao).not.toHaveBeenCalled();
    expect(banco[0].status).toBe("aprovado");
  });

  it("convites vencidos de outro idoso ou de outro cuidador não são tocados", async () => {
    const velho = new Date(AGORA - 30 * DIA);
    const banco = [
      linha({ data_solicitacao: velho }),
      linha({ id: 8, idoso_id: 99, data_solicitacao: velho }),
      linha({ id: 9, vinculado_id: 77, data_solicitacao: velho }),
    ];
    vinculosNoBanco(banco);
    const res = await convidar({ email: EMAIL });

    expect(res.status).toBe(201);
    expect(updateManyVinculo).toHaveBeenCalledTimes(1);
    expect(updateManyVinculo.mock.calls[0][0].where).toEqual({ id: VELHO, status: "pendente" });
    expect(banco.map((l) => l.status)).toEqual(["recusado", "pendente", "pendente"]);
  });

  it("corrida: a transação rejeitada pelo índice único vira 409", async () => {
    vinculosNoBanco([linha()]);
    transacao.mockRejectedValue(new Error("Violation of UNIQUE KEY constraint"));
    const res = await convidar({ email: EMAIL });
    expect(res.status).toBe(409);
  });

  it("erro inesperado na transação vira 500 genérico, sem vazar a mensagem", async () => {
    vinculosNoBanco([linha()]);
    transacao.mockRejectedValue(new Error("SEGREDO-do-banco"));
    const res = await convidar({ email: EMAIL });
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("SEGREDO-do-banco");
  });
});
