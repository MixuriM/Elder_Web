import { inspect } from "node:util";
import request from "supertest";
import { Prisma } from "@prisma/client";

const verifyIdToken = jest.fn();
const findFirst = jest.fn();
const findUnique = jest.fn();
const createRegistro = jest.fn();

jest.mock("./lib/firebaseAdmin", () => ({
  auth: { verifyIdToken: (...args: unknown[]) => verifyIdToken(...args) },
}));
jest.mock("./lib/prisma", () => ({
  prisma: {
    usuario: {
      findFirst: (...args: unknown[]) => findFirst(...args),
      findUnique: (...args: unknown[]) => findUnique(...args),
    },
    registroSaude: { create: (...args: unknown[]) => createRegistro(...args) },
  },
}));

import app from "./app";

// Valores de saúde conhecidos: nenhum pode aparecer em NENHUMA chamada a console.*.
const VALOR = "123.45";
const SEGREDO = "segredo-clinico";
const BODY = { tipo_medicao: "peso", valor_1: 123.45, unidade: "kg", observacoes: SEGREDO };
const MENSAGEM_COM_ARGS = `Invalid \`prisma.registroSaude.create()\` invocation: data: { valor_1: ${VALOR}, observacoes: '${SEGREDO}' }`;

const CONSOLES = ["log", "info", "warn", "error", "debug"] as const;

function chamarRotaComFalha(erro: unknown) {
  verifyIdToken.mockResolvedValue({ uid: "uid-42" });
  findFirst.mockResolvedValue({ id: 42, firebase_uid: "uid-42" });
  findUnique.mockResolvedValue({ tipo_perfil: "idoso" });
  createRegistro.mockRejectedValue(erro);
  return request(app).post("/saude?filtro=segredo-na-query").set("Authorization", "Bearer x").send(BODY);
}

async function comConsoleEspiado(fn: () => Promise<void>) {
  const espioes = CONSOLES.map((m) => jest.spyOn(console, m).mockImplementation(() => undefined));
  try {
    await fn();
    // util.inspect inclui message, stack, meta e propriedades do erro (JSON.stringify não incluiria).
    return {
      tudo: inspect(espioes.flatMap((s) => s.mock.calls), { depth: 8 }),
      erros: espioes[CONSOLES.indexOf("error")].mock.calls,
    };
  } finally {
    espioes.forEach((s) => s.mockRestore());
  }
}

beforeEach(() => {
  verifyIdToken.mockReset();
  findFirst.mockReset();
  findUnique.mockReset();
  createRegistro.mockReset();
});

describe("errorHandler (item 4.5, parcial): não registra o erro inteiro", () => {
  const erros: [string, () => unknown, string, string | undefined][] = [
    [
      "PrismaClientKnownRequestError",
      () =>
        new Prisma.PrismaClientKnownRequestError(MENSAGEM_COM_ARGS, {
          code: "P2002",
          clientVersion: "5.22.0",
          meta: { valor: VALOR, observacoes: SEGREDO },
        }),
      "PrismaClientKnownRequestError",
      "P2002",
    ],
    [
      "PrismaClientValidationError",
      () => new Prisma.PrismaClientValidationError(MENSAGEM_COM_ARGS, { clientVersion: "5.22.0" }),
      "PrismaClientValidationError",
      undefined,
    ],
  ];

  it.each(erros)("%s: resposta 500 inalterada e nenhum valor de saúde em console.*", async (_n, criar, name, code) => {
    let res!: request.Response;
    const { tudo, erros: chamadasError } = await comConsoleEspiado(async () => {
      res = await chamarRotaComFalha(criar());
    });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Erro interno." });

    expect(tudo).not.toContain(VALOR);
    expect(tudo).not.toContain(SEGREDO);
    expect(tudo).not.toContain("segredo-na-query"); // req.query nunca é logado
    expect(tudo).not.toContain("invocation"); // nem a mensagem nem o stack do erro

    // Só name, code (quando existe), método e path.
    expect(chamadasError).toHaveLength(1);
    const registrado = inspect(chamadasError[0], { depth: 8 });
    expect(registrado).toContain(name);
    if (code) expect(registrado).toContain(code);
    expect(registrado).toContain("POST");
    expect(registrado).toContain("/saude");
  });

  it.each([
    ["string", `${MENSAGEM_COM_ARGS}`],
    ["objeto que não é Error", { valor_1: VALOR, observacoes: SEGREDO, code: "X1" }],
  ])("valor lançado que não é Error (%s): 500 inalterado, handler não quebra, sem valores em console.*", async (_n, lancado) => {
    let res!: request.Response;
    const { tudo, erros: chamadasError } = await comConsoleEspiado(async () => {
      res = await chamarRotaComFalha(lancado);
    });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Erro interno." });
    expect(tudo).not.toContain(VALOR);
    expect(tudo).not.toContain(SEGREDO);
    expect(chamadasError).toHaveLength(1);
  });
});
