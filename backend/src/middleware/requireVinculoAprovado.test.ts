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

  it("retorna 403 quando vínculo aprovado existe mas para outro idoso", async () => {
    // findFirst já filtra por idoso_id na query — outro idoso nunca bate no where.
    findFirstVinculo.mockResolvedValue(null);

    const res = await get(999);

    expect(res.status).toBe(403);
    expect(findFirstVinculo).toHaveBeenCalledWith({
      where: { idoso_id: 999, vinculado_id: VINCULADO_ID, status: "aprovado" },
    });
  });
});
