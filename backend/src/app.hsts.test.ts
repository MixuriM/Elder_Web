import request from "supertest";

// Item 9.2 (RNF-002): HSTS só em produção, em TODA resposta (inclusive 4xx, 5xx, preflight de CORS).
// O redirecionamento HTTP para HTTPS é do Render (D3); aqui só o header. Valores fictícios.
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
import { HSTS_VALOR } from "./middleware/hsts";

const HEADER = "strict-transport-security";

beforeEach(() => {
  verifyIdToken.mockReset();
  findFirst.mockReset();
  findUnique.mockReset();
  createRegistro.mockReset();
});

async function comNodeEnv<T>(valor: string | undefined, fn: () => Promise<T>) {
  const original = process.env.NODE_ENV;
  try {
    if (valor === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = valor;
    return await fn();
  } finally {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  }
}

async function comConsoleMudo<T>(fn: () => Promise<T>) {
  const espiao = jest.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    return await fn();
  } finally {
    espiao.mockRestore();
  }
}

describe("HSTS_VALOR", () => {
  it("é exatamente max-age de 1 ano, sem includeSubDomains nem preload", () => {
    expect(HSTS_VALOR).toBe("max-age=31536000");
  });
});

describe("HSTS em produção (NODE_ENV=production)", () => {
  const casos: [string, () => Promise<request.Response>, number][] = [
    ["GET /health (200)", () => request(app).get("/health"), 200],
    ["rota inexistente (404)", () => request(app).get("/nao-existe"), 404],
    ["rota protegida sem token (401)", () => request(app).get("/usuario/me"), 401],
    [
      "JSON malformado (400)",
      () => request(app).post("/saude").set("Content-Type", "application/json").send("{ruim"),
      400,
    ],
    [
      "corpo acima do limite (413)",
      () =>
        request(app)
          .post("/saude")
          .set("Content-Type", "application/json")
          .send(JSON.stringify({ x: "a".repeat(200_000) })),
      413,
    ],
    [
      "erro não tratado (500)",
      () => {
        verifyIdToken.mockResolvedValue({ uid: "uid-42" });
        findFirst.mockResolvedValue({ id: 42, firebase_uid: "uid-42" });
        findUnique.mockResolvedValue({ tipo_perfil: "idoso" });
        createRegistro.mockRejectedValue(new Error("falha"));
        return request(app)
          .post("/saude")
          .set("Authorization", "Bearer x")
          .send({ tipo_medicao: "peso", valor_1: 70, unidade: "kg" });
      },
      500,
    ],
  ];

  it.each(casos)("%s traz o header com valor exato", async (_n, chamar, status) => {
    const res = await comNodeEnv("production", () => comConsoleMudo(chamar));
    expect(res.status).toBe(status);
    expect(res.headers[HEADER]).toBe(HSTS_VALOR);
  });

  // O cors com origem fixa (string) sempre devolve a origem configurada, nunca ecoa a do pedido.
  const origemPermitida = process.env.FRONTEND_URL ?? "http://localhost:5173";

  it("origem do frontend: CORS libera e o header está presente", async () => {
    const res = await comNodeEnv("production", () => request(app).get("/health").set("Origin", origemPermitida));
    expect(res.headers["access-control-allow-origin"]).toBe(origemPermitida);
    expect(res.headers[HEADER]).toBe(HSTS_VALOR);
  });

  it("origem estranha: CORS não libera essa origem e o header está presente", async () => {
    const res = await comNodeEnv("production", () =>
      request(app).get("/health").set("Origin", "https://outro.exemplo"),
    );
    expect(res.headers["access-control-allow-origin"]).not.toBe("https://outro.exemplo");
    expect(res.headers[HEADER]).toBe(HSTS_VALOR);
  });

  it.each([origemPermitida, "https://outro.exemplo"])("preflight OPTIONS com Origin %s: header presente", async (origem) => {
    const res = await comNodeEnv("production", () =>
      request(app)
        .options("/saude")
        .set("Origin", origem)
        .set("Access-Control-Request-Method", "POST"),
    );
    expect(res.status).toBe(204);
    expect(res.headers[HEADER]).toBe(HSTS_VALOR);
  });
});

describe("sem HSTS fora de produção", () => {
  it.each<[string, string | undefined]>([
    ["test", "test"],
    ["development", "development"],
    ["indefinida", undefined],
  ])("NODE_ENV %s: header ausente", async (_n, valor) => {
    const res = await comNodeEnv(valor, () => request(app).get("/health"));
    expect(res.status).toBe(200);
    expect(res.headers[HEADER]).toBeUndefined();
  });

  it("é avaliado a cada requisição, não no import", async () => {
    const dev = await comNodeEnv("development", () => request(app).get("/health"));
    const prod = await comNodeEnv("production", () => request(app).get("/health"));
    expect(dev.headers[HEADER]).toBeUndefined();
    expect(prod.headers[HEADER]).toBe(HSTS_VALOR);
  });
});
