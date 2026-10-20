import express from "express";
import type { Request, Response } from "express";
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

  it("retorna 503 quando o Firebase está indisponível (erro sem código auth/*)", async () => {
    verifyIdToken.mockRejectedValue(new Error("network timeout"));

    const res = await request(buildApp()).get("/protegida").set("Authorization", "Bearer token-qualquer");

    expect(res.status).toBe(503);
    expect(findFirst).not.toHaveBeenCalled();
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

  it.each([
    [{ uid: "u", email_verified: true }, true],
    [{ uid: "u", email_verified: false }, false],
    [{ uid: "u" }, false],
  ])("expõe req.emailVerificado (%j -> %s)", async (decoded, esperado) => {
    verifyIdToken.mockResolvedValue(decoded);
    findFirst.mockResolvedValue({ id: 42, firebase_uid: "u" });
    const app = express();
    app.get("/p", requireAuth, (req, res) => {
      res.json({ emailVerificado: req.emailVerificado });
    });

    const res = await request(app).get("/p").set("Authorization", "Bearer t");

    expect(res.body).toEqual({ emailVerificado: esperado });
  });

  // Chama o middleware direto, sem rota Express: os testes abaixo só precisam do resultado do requireAuth, e uma rota de teste
  // sem limite de taxa dispara o alerta js/missing-rate-limiting do CodeQL (o limitador do projeto é próprio).
  async function executar() {
    const req = { headers: { authorization: "Bearer t" } } as unknown as Request;
    const res = {
      statusCode: 200,
      corpo: undefined as unknown,
      status(codigo: number) {
        this.statusCode = codigo;
        return this;
      },
      json(corpo: unknown) {
        this.corpo = corpo;
        return this;
      },
    };
    const next = jest.fn();
    await requireAuth(req, res as unknown as Response, next);
    return { req, res, next };
  }

  // Auditoria de segurança (2026-10-20): o ID Token emitido antes da exclusão segue válido por até 1 h no Firebase (sem
  // checkRevoked) e a linha anonimizada continua com o firebase_uid. Sem este bloqueio, o token antigo escreveria dado de
  // saúde numa conta que ninguém consegue mais apagar.
  it("conta já excluída (e-mail anonimizado): 401 igual ao de token inválido, e a rota não roda", async () => {
    verifyIdToken.mockResolvedValue({ uid: "u" });
    findFirst.mockResolvedValue({ id: 42, email: "excluido-42@excluido.invalid" });

    const { res, next } = await executar();

    expect(res.statusCode).toBe(401);
    expect(res.corpo).toEqual({ error: "Token inválido ou expirado." });
    expect(next).not.toHaveBeenCalled();
  });

  it.each([["pessoa@exemplo.test"], [null], [undefined], ["excluido-42@excluido.invalid.exemplo.test"]])(
    "e-mail %p não é conta excluída: segue",
    async (email) => {
      verifyIdToken.mockResolvedValue({ uid: "u" });
      findFirst.mockResolvedValue({ id: 42, email });

      const { res, next } = await executar();

      expect(res.statusCode).toBe(200);
      expect(next).toHaveBeenCalledTimes(1);
    },
  );

  it("busca só id e e-mail do usuário (nunca a foto)", async () => {
    verifyIdToken.mockResolvedValue({ uid: "u" });
    findFirst.mockResolvedValue({ id: 42, email: "a@b.test" });
    await executar();
    expect(findFirst.mock.calls[0][0].select).toEqual({ id: true, email: true });
  });

  // Exclusão de conta (2026-10-20): auth_time (segundos) diz quando o login foi feito; só número vale, o resto é ausente.
  it.each([
    [{ uid: "u", auth_time: 1_800_000_000 }, 1_800_000_000],
    [{ uid: "u", auth_time: "1800000000" }, undefined],
    [{ uid: "u", auth_time: null }, undefined],
    [{ uid: "u", auth_time: Number.NaN }, undefined],
    [{ uid: "u" }, undefined],
  ])("expõe req.authTime (%j -> %s)", async (decoded, esperado) => {
    verifyIdToken.mockResolvedValue(decoded);
    findFirst.mockResolvedValue({ id: 42, firebase_uid: "u" });

    const { req, next } = await executar();

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.authTime).toBe(esperado);
  });

  it.each([
    [{ uid: "u", email: "Pessoa.Ficticia@exemplo.test" }, "Pessoa.Ficticia@exemplo.test"],
    [{ uid: "u" }, undefined],
    [{ uid: "u", email: 123 }, undefined],
  ])("expõe req.emailDoToken só quando o e-mail do token é texto (%j -> %s)", async (decoded, esperado) => {
    verifyIdToken.mockResolvedValue(decoded);
    findFirst.mockResolvedValue({ id: 42, firebase_uid: "u" });
    const app = express();
    app.get("/p", requireAuth, (req, res) => {
      res.json({ emailDoToken: req.emailDoToken ?? null });
    });

    const res = await request(app).get("/p").set("Authorization", "Bearer t");

    expect(res.body).toEqual({ emailDoToken: esperado ?? null });
  });

  it("repassa erro do Prisma ao errorHandler: 500 genérico, sem valor sensível em console.*", async () => {
    const SEGREDO = "valor-ficticio-nao-logar";
    verifyIdToken.mockResolvedValue({ uid: "u" });
    findFirst.mockRejectedValue(new Error(`falha do banco ${SEGREDO}`));
    const espioes = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    );
    try {
      const app = express();
      app.get("/p", requireAuth, (_req, res) => {
        res.status(200).json({});
      });
      app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(500).json({ error: "Erro interno." });
      });

      // timeout curto: sem a correção a requisição não é respondida e o teste falha limpo.
      const res = await request(app).get("/p").set("Authorization", "Bearer t").timeout(1000);

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: "Erro interno." });
      expect(JSON.stringify(espioes.flatMap((s) => s.mock.calls))).not.toContain(SEGREDO);
    } finally {
      espioes.forEach((s) => s.mockRestore());
    }
  });
});
