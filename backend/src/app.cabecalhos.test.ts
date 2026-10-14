import request from "supertest";

// Cabeçalhos de segurança da API (decisão D2 de 2026-10-14), sem helmet: em toda resposta (200, 401, 404, JSON
// malformado, preflight de CORS) e sem X-Powered-By. Sem Cache-Control (item de desempenho: só o ETag do Express).
jest.mock("./lib/firebaseAdmin", () => ({
  auth: { verifyIdToken: async () => Promise.reject(Object.assign(new Error("x"), { code: "auth/argument-error" })) },
}));
jest.mock("./lib/prisma", () => ({ prisma: {} }));

import app from "./app";

const ESPERADOS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

const CASOS: [string, () => request.Test][] = [
  ["GET /health (200)", () => request(app).get("/health")],
  ["GET /usuario/me sem token (401)", () => request(app).get("/usuario/me")],
  ["rota inexistente (404)", () => request(app).get("/nao-existe")],
  ["JSON malformado (400)", () => request(app).post("/auth/sync").set("Content-Type", "application/json").send("{x")],
  ["preflight de CORS", () => request(app).options("/usuario/me").set("Origin", "http://localhost:5173").set("Access-Control-Request-Method", "PATCH")],
];

describe.each(CASOS)("%s", (_nome, chamar) => {
  it.each(Object.entries(ESPERADOS))("manda %s", async (cabecalho, valor) => {
    const recebido = (await chamar()).headers[cabecalho];
    // O 404 padrão do Express (finalhandler) troca a CSP pela dele, "default-src 'none'", igualmente restrita; o
    // X-Frame-Options DENY continua barrando o frame.
    if (_nome.includes("404") && cabecalho === "content-security-policy") expect(recebido).toBe("default-src 'none'");
    else expect(recebido).toBe(valor);
  });

  it("não manda X-Powered-By nem Cache-Control", async () => {
    const res = await chamar();
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["cache-control"]).toBeUndefined();
  });
});
