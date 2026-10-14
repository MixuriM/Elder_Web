import type { Express } from "express";
import request from "supertest";

// trust proxy (decisão D1 de 2026-10-14): só em produção, com TRUST_PROXY_SALTOS de 0 a 3 (ausente ou inválido vale 1).
// Sem ele, atrás do proxy do Render, req.ip seria o do proxy e o limite por IP de /auth/sync juntaria todo mundo.

jest.mock("./lib/firebaseAdmin", () => ({
  auth: { verifyIdToken: async () => Promise.reject(Object.assign(new Error("x"), { code: "auth/argument-error" })) },
}));
jest.mock("./lib/prisma", () => ({ prisma: {} }));

const ambienteOriginal = { ...process.env };

afterEach(() => {
  process.env = { ...ambienteOriginal };
});

function carregar(env: Record<string, string | undefined>): { app: Express; limite: typeof import("./lib/limiteTaxa") } {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  let app!: Express;
  let limite!: typeof import("./lib/limiteTaxa");
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    app = require("./app").default;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    limite = require("./lib/limiteTaxa");
  });
  return { app, limite };
}

describe("saltosTrustProxy", () => {
  const { saltosTrustProxy } = jest.requireActual("./app") as typeof import("./app");
  it.each([
    ["0", 0],
    ["1", 1],
    ["2", 2],
    ["3", 3],
  ])("%s vale %i", (valor, esperado) => {
    expect(saltosTrustProxy(valor)).toBe(esperado);
  });
  it.each([undefined, "", "4", "-1", "1.5", "abc", " 2", "2 "])("%p inválido vale 1", (valor) => {
    expect(saltosTrustProxy(valor)).toBe(1);
  });
});

describe("app.set('trust proxy')", () => {
  it("em produção usa TRUST_PROXY_SALTOS", () => {
    expect(carregar({ NODE_ENV: "production", TRUST_PROXY_SALTOS: "2" }).app.get("trust proxy")).toBe(2);
  });

  it("em produção sem a variável usa 1", () => {
    expect(carregar({ NODE_ENV: "production", TRUST_PROXY_SALTOS: undefined }).app.get("trust proxy")).toBe(1);
  });

  it("fora de produção não confia em proxy", () => {
    expect(carregar({ NODE_ENV: "test", TRUST_PROXY_SALTOS: "2" }).app.get("trust proxy")).toBe(false);
  });

  it("em produção, o limite por IP de /auth/sync separa clientes pelo X-Forwarded-For", async () => {
    const { app, limite } = carregar({ NODE_ENV: "production", TRUST_PROXY_SALTOS: "1" });
    const sync = (ip: string) => request(app).post("/auth/sync").set("X-Forwarded-For", ip).set("Authorization", "Bearer x");
    for (let i = 0; i < 300; i++) expect((await sync("203.0.113.1")).status).toBe(401);
    expect((await sync("203.0.113.1")).status).toBe(429);
    expect((await sync("203.0.113.2")).status).toBe(401);
    limite.limparLimitadores();
  }, 30_000);

  it("fora de produção, X-Forwarded-For é ignorado (todos contam como o mesmo IP)", async () => {
    const { app, limite } = carregar({ NODE_ENV: "development", LIMITE_TAXA_DESLIGADO: undefined });
    const sync = (ip: string) => request(app).post("/auth/sync").set("X-Forwarded-For", ip).set("Authorization", "Bearer x");
    for (let i = 0; i < 300; i++) expect((await sync("203.0.113.1")).status).toBe(401);
    expect((await sync("203.0.113.2")).status).toBe(429);
    limite.limparLimitadores();
  }, 30_000);
});
