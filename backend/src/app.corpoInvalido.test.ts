import { inspect } from "node:util";
import request from "supertest";

// Pendência "JSON malformado cai no errorHandler (500, não 400)": erro do body-parser (corpo ilegível ou
// grande demais) é erro do CLIENTE e responde 4xx fixo, sem eco do corpo e sem registrar nada (o corpo pode
// ter dado de saúde, RNF-001). Todos os valores abaixo são FICTÍCIOS.
const verifyIdToken = jest.fn();
const findFirst = jest.fn();

jest.mock("./lib/firebaseAdmin", () => ({
  auth: { verifyIdToken: (...args: unknown[]) => verifyIdToken(...args) },
}));
jest.mock("./lib/prisma", () => ({
  prisma: { usuario: { findFirst: (...args: unknown[]) => findFirst(...args), findUnique: jest.fn() } },
}));

import app from "./app";

const SEGREDO = "segredo-clinico-no-corpo";
const CONSOLES = ["log", "info", "warn", "error", "debug"] as const;

beforeEach(() => {
  verifyIdToken.mockReset();
  findFirst.mockReset();
  verifyIdToken.mockResolvedValue({ uid: "uid-42" });
  findFirst.mockResolvedValue({ id: 42, firebase_uid: "uid-42" });
});

async function comConsoleEspiado<T>(fn: () => Promise<T>) {
  const espioes = CONSOLES.map((m) => jest.spyOn(console, m).mockImplementation(() => undefined));
  try {
    const res = await fn();
    return { res, saidas: inspect(espioes.flatMap((s) => s.mock.calls), { depth: 8 }) };
  } finally {
    espioes.forEach((s) => s.mockRestore());
  }
}

describe("corpo da requisição inválido", () => {
  it.each(["/saude", "/auth/sync", "/remedios"])("JSON malformado em POST %s: 400 fixo, sem eco do corpo e sem log", async (rota) => {
    const { res, saidas } = await comConsoleEspiado(() =>
      request(app)
        .post(rota)
        .set("Authorization", "Bearer x")
        .set("Content-Type", "application/json")
        .send(`{"observacoes": "${SEGREDO}", `),
    );
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Corpo da requisição inválido." });
    expect(JSON.stringify(res.body) + res.text + JSON.stringify(res.headers)).not.toContain(SEGREDO);
    expect(saidas).not.toContain(SEGREDO);
    expect(saidas).toBe("[]"); // nada em console.*: erro de cliente não é erro do servidor
  });

  it("JSON malformado sem token também é 400 (o parse vem antes da autenticação)", async () => {
    const res = await request(app).post("/saude").set("Content-Type", "application/json").send("{ruim");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Corpo da requisição inválido." });
  });

  it("corpo acima do limite do express.json (100 kb): 413 fixo, sem eco e sem log", async () => {
    const grande = JSON.stringify({ observacoes: SEGREDO.repeat(10_000) });
    const { res, saidas } = await comConsoleEspiado(() =>
      request(app).post("/saude").set("Authorization", "Bearer x").set("Content-Type", "application/json").send(grande),
    );
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: "Corpo da requisição grande demais." });
    expect(res.text).not.toContain(SEGREDO);
    expect(saidas).toBe("[]");
  });

  it("JSON válido segue o fluxo normal (controle positivo: não vira 400 de corpo)", async () => {
    const res = await request(app).post("/saude").set("Authorization", "Bearer x").send({ foo: 1 });
    expect(res.body).not.toEqual({ error: "Corpo da requisição inválido." });
    expect(res.status).not.toBe(413);
  });

  it("erro 500 de verdade continua 500 genérico e continua sendo registrado", async () => {
    findFirst.mockRejectedValue(new Error("falha de banco"));
    const { res, saidas } = await comConsoleEspiado(() =>
      request(app).post("/saude").set("Authorization", "Bearer x").send({ foo: 1 }),
    );
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Erro interno." });
    expect(saidas).toContain("Erro não tratado");
  });
});
