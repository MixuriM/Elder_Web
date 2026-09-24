import express from "express";
import request from "supertest";

const findFirstVinculo = jest.fn();

jest.mock("../lib/prisma", () => ({
  prisma: { vinculo: { findFirst: (...args: unknown[]) => findFirstVinculo(...args) } },
}));

import { requireVinculoAprovado } from "./requireVinculoAprovado";

const VINCULADO_ID = 10;

function buildApp() {
  const app = express();
  // requireAuth simulado: só injeta req.usuarioId, sem depender de Firebase.
  app.use((req, _res, next) => {
    req.usuarioId = VINCULADO_ID;
    next();
  });
  app.get("/_test/idoso/:idosoId", requireVinculoAprovado("idosoId"), (req, res) => {
    res.status(200).json({ vinculoAprovado: req.vinculoAprovado });
  });
  return app;
}

function get(idosoId: number | string) {
  return request(buildApp()).get(`/_test/idoso/${idosoId}`);
}

describe("requireVinculoAprovado", () => {
  beforeEach(() => {
    findFirstVinculo.mockReset();
  });

  it("chama next() com vínculo aprovado tipo cuidador", async () => {
    const vinculo = { id: 1, idoso_id: 5, vinculado_id: VINCULADO_ID, tipo_vinculo: "cuidador", status: "aprovado" };
    findFirstVinculo.mockResolvedValue(vinculo);

    const res = await get(5);

    expect(res.status).toBe(200);
    expect(res.body.vinculoAprovado).toEqual(vinculo);
    expect(findFirstVinculo).toHaveBeenCalledWith({
      where: { idoso_id: 5, vinculado_id: VINCULADO_ID, status: "aprovado" },
    });
  });

  it("chama next() com vínculo aprovado tipo familiar", async () => {
    const vinculo = { id: 2, idoso_id: 5, vinculado_id: VINCULADO_ID, tipo_vinculo: "familiar", status: "aprovado" };
    findFirstVinculo.mockResolvedValue(vinculo);

    const res = await get(5);

    expect(res.status).toBe(200);
    expect(res.body.vinculoAprovado).toEqual(vinculo);
  });

  it("retorna 403 quando vínculo está pendente", async () => {
    findFirstVinculo.mockResolvedValue(null);

    const res = await get(5);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Vínculo aprovado não encontrado para este idoso." });
  });

  it("retorna 403 quando vínculo está recusado", async () => {
    findFirstVinculo.mockResolvedValue(null);

    const res = await get(5);

    expect(res.status).toBe(403);
  });

  it("retorna 403 quando não existe vínculo entre os usuários", async () => {
    findFirstVinculo.mockResolvedValue(null);

    const res = await get(5);

    expect(res.status).toBe(403);
  });

  it("retorna 401 sem req.usuarioId (requireAuth não rodou antes) e não consulta o Prisma", async () => {
    const app = express();
    app.get("/_test/idoso/:idosoId", requireVinculoAprovado("idosoId"), (req, res) => {
      res.status(200).json({ vinculoAprovado: req.vinculoAprovado });
    });

    const res = await request(app).get("/_test/idoso/5");

    expect(res.status).toBe(401);
    expect(findFirstVinculo).not.toHaveBeenCalled();
  });

  it("retorna 403 quando vínculo aprovado existe mas para outro idoso", async () => {
    // findFirst já filtra por idoso_id na query — outro idoso nunca bate no where.
    findFirstVinculo.mockResolvedValue(null);

    const res = await get(999);

    expect(res.status).toBe(403);
    expect(findFirstVinculo).toHaveBeenCalledWith({
      where: { idoso_id: 999, vinculado_id: VINCULADO_ID, status: "aprovado" },
    });
  });

  it("repassa erro do Prisma ao errorHandler: 500 genérico, sem valor sensível em console.*", async () => {
    const SEGREDO = "valor-ficticio-nao-logar";
    findFirstVinculo.mockRejectedValue(new Error(`falha do banco ${SEGREDO}`));
    const espioes = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    );
    try {
      const app = express();
      app.use((req, _res, next) => {
        req.usuarioId = VINCULADO_ID;
        next();
      });
      app.get("/_test/idoso/:idosoId", requireVinculoAprovado("idosoId"), (_req, res) => {
        res.status(200).json({});
      });
      app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(500).json({ error: "Erro interno." });
      });

      // timeout curto: sem a correção a requisição não é respondida e o teste falha limpo.
      const res = await request(app).get("/_test/idoso/5").timeout(1000);

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: "Erro interno." });
      expect(JSON.stringify(espioes.flatMap((s) => s.mock.calls))).not.toContain(SEGREDO);
    } finally {
      espioes.forEach((s) => s.mockRestore());
    }
  });
});
