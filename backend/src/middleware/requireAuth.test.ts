import express from "express";
import request from "supertest";

const verifyIdToken = jest.fn();
const findFirst = jest.fn();

jest.mock("../lib/firebaseAdmin", () => ({ auth: { verifyIdToken: (...args: unknown[]) => verifyIdToken(...args) } }));
jest.mock("../lib/prisma", () => ({ prisma: { usuario: { findFirst: (...args: unknown[]) => findFirst(...args) } } }));

import { requireAuth } from "./requireAuth";

function buildApp() {
  const app = express();
  app.get("/protegida", requireAuth, (req, res) => {
    res.status(200).json({ usuarioId: req.usuarioId });
  });
  return app;
}

describe("requireAuth", () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
    findFirst.mockReset();
  });

  it("retorna 401 sem header Authorization", async () => {
    const res = await request(buildApp()).get("/protegida");

    expect(res.status).toBe(401);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it("retorna 401 com header malformado (sem prefixo Bearer)", async () => {
    const res = await request(buildApp()).get("/protegida").set("Authorization", "token-sem-bearer");

    expect(res.status).toBe(401);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it("retorna 401 com token inválido", async () => {
    verifyIdToken.mockRejectedValue(Object.assign(new Error("bad"), { code: "auth/argument-error" }));

    const res = await request(buildApp()).get("/protegida").set("Authorization", "Bearer token-invalido");

    expect(res.status).toBe(401);
  });

  it("retorna 401 com token expirado", async () => {
    verifyIdToken.mockRejectedValue(Object.assign(new Error("expired"), { code: "auth/id-token-expired" }));

    const res = await request(buildApp()).get("/protegida").set("Authorization", "Bearer token-expirado");

    expect(res.status).toBe(401);
  });

  it("retorna 403 com token válido mas sem Usuario correspondente", async () => {
    verifyIdToken.mockResolvedValue({ uid: "firebase-uid-sem-usuario" });
    findFirst.mockResolvedValue(null);

    const res = await request(buildApp()).get("/protegida").set("Authorization", "Bearer token-valido");

    expect(res.status).toBe(403);
  });

  it("chama next() e define req.usuarioId com token válido e Usuario existente", async () => {
    verifyIdToken.mockResolvedValue({ uid: "firebase-uid-existente" });
    findFirst.mockResolvedValue({ id: 42, firebase_uid: "firebase-uid-existente" });

    const res = await request(buildApp()).get("/protegida").set("Authorization", "Bearer token-valido");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ usuarioId: 42 });
  });
});
