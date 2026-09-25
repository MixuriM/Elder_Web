import express from "express";
import request from "supertest";

const verifyIdToken = jest.fn();
const findFirstUsuario = jest.fn();
const findUniqueUsuario = jest.fn();
const updateUsuario = jest.fn();
const findManyVinculo = jest.fn();
const findFirstVinculo = jest.fn();
const createVinculo = jest.fn();
const findUniqueVinculo = jest.fn();
const updateVinculo = jest.fn();
const countVinculo = jest.fn();
const transaction = jest.fn();

jest.mock("../lib/firebaseAdmin", () => ({
  auth: { verifyIdToken: (...args: unknown[]) => verifyIdToken(...args) },
}));
jest.mock("../lib/prisma", () => ({
  prisma: {
    $transaction: (...args: unknown[]) => transaction(...args),
    usuario: {
      findFirst: (...args: unknown[]) => findFirstUsuario(...args),
      findUnique: (...args: unknown[]) => findUniqueUsuario(...args),
      update: (...args: unknown[]) => updateUsuario(...args),
    },
    vinculo: {
      findMany: (...args: unknown[]) => findManyVinculo(...args),
      findFirst: (...args: unknown[]) => findFirstVinculo(...args),
      create: (...args: unknown[]) => createVinculo(...args),
      findUnique: (...args: unknown[]) => findUniqueVinculo(...args),
      update: (...args: unknown[]) => updateVinculo(...args),
      count: (...args: unknown[]) => countVinculo(...args),
    },
  },
}));

import vinculoRouter from "./vinculo";
import { requireAuth } from "../middleware/requireAuth";
import { requireVinculoAprovado } from "../middleware/requireVinculoAprovado";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/vinculo", vinculoRouter);
  app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: "Erro interno." });
  });
  return app;
}

const CUIDADOR = { id: 1, tipo_perfil: "cuidador" };
const FAMILIAR = { id: 1, tipo_perfil: "familiar" };

type FindFirstUsuarioArgs = { where: { firebase_uid?: string; tipo_perfil?: string } };

function post(body: Record<string, unknown>) {
  return request(buildApp()).post("/vinculo/solicitar-cuidador").set("Authorization", "Bearer x").send(body);
}

function postFamiliar(body: Record<string, unknown>) {
  return request(buildApp()).post("/vinculo/solicitar-familiar").set("Authorization", "Bearer x").send(body);
}

function responder(id: number, acao: "aprovar" | "recusar") {
  return request(buildApp()).post(`/vinculo/${id}/${acao}`).set("Authorization", "Bearer x").send();
}

function definirPermissoes(id: number, body: Record<string, unknown>) {
  return request(buildApp())
    .patch(`/vinculo/${id}/definir-permissoes`)
    .set("Authorization", "Bearer x")
    .send(body);
}

function solicitarTransferencia(id: number, body: Record<string, unknown> = {}) {
  return request(buildApp())
    .post(`/vinculo/${id}/solicitar-transferencia-decisao`)
    .set("Authorization", "Bearer x")
    .send(body);
}

function confirmarTransferencia(id: number) {
  return request(buildApp())
    .post(`/vinculo/${id}/confirmar-transferencia-decisao`)
    .set("Authorization", "Bearer x")
    .send();
}

describe("POST /vinculo/solicitar-cuidador", () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
    findFirstUsuario.mockReset();
    findUniqueUsuario.mockReset();
    findManyVinculo.mockReset();
    findFirstVinculo.mockReset();
    createVinculo.mockReset();
    verifyIdToken.mockResolvedValue({ uid: "uid-1" });
    findFirstUsuario.mockResolvedValue(CUIDADOR); // requireAuth resolve caller
    findUniqueUsuario.mockResolvedValue(CUIDADOR);
  });

  it("403 quando chamador não é cuidador", async () => {
    findUniqueUsuario.mockResolvedValue({ id: 1, tipo_perfil: "familiar" });
    const res = await post({ email: "idoso@a.com" });
    expect(res.status).toBe(403);
  });

  it("sucesso via idoso direto", async () => {
    findFirstUsuario.mockImplementation((args: FindFirstUsuarioArgs) =>
      args.where.firebase_uid ? CUIDADOR : { id: 10, nome: "Zé", email: "idoso@a.com" },
    );
    findFirstVinculo.mockResolvedValue(null);
    createVinculo.mockResolvedValue({ id: 100, idoso_id: 10, vinculado_id: 1, status: "pendente" });

    const res = await post({ email: "idoso@a.com" });

    expect(res.status).toBe(201);
    expect(createVinculo).toHaveBeenCalledWith({
      data: expect.objectContaining({
        idoso_id: 10,
        vinculado_id: 1,
        tipo_vinculo: "cuidador",
        origem: "solicitacao_cuidador",
        status: "pendente",
      }),
    });
  });

  it("sucesso via familiar no controle (candidato único)", async () => {
    findFirstUsuario.mockImplementation((args: FindFirstUsuarioArgs) => {
      if (args.where.firebase_uid) return CUIDADOR;
      if (args.where.tipo_perfil === "idoso") return null;
      return { id: 20 }; // familiar
    });
    findManyVinculo.mockResolvedValue([{ idoso: { id: 30, nome: "Maria" } }]);
    findFirstVinculo.mockResolvedValue(null);
    createVinculo.mockResolvedValue({ id: 101, idoso_id: 30, vinculado_id: 1, status: "pendente" });

    const res = await post({ email: "familiar@a.com" });

    expect(res.status).toBe(201);
    expect(createVinculo).toHaveBeenCalledWith({
      data: expect.objectContaining({ idoso_id: 30, vinculado_id: 1 }),
    });
  });

  it("404 quando e-mail não encontrado", async () => {
    findFirstUsuario.mockImplementation((args: FindFirstUsuarioArgs) => (args.where.firebase_uid ? CUIDADOR : null));

    const res = await post({ email: "ninguem@a.com" });

    expect(res.status).toBe(404);
  });

  it("400 em auto-vínculo", async () => {
    findFirstUsuario.mockImplementation((args: FindFirstUsuarioArgs) =>
      args.where.firebase_uid ? CUIDADOR : { id: 1, nome: "Eu Mesmo", email: "eu@a.com" },
    );

    const res = await post({ email: "eu@a.com" });

    expect(res.status).toBe(400);
  });

  it("409 quando já existe solicitação pendente", async () => {
    findFirstUsuario.mockImplementation((args: FindFirstUsuarioArgs) =>
      args.where.firebase_uid ? CUIDADOR : { id: 10, nome: "Zé", email: "idoso@a.com" },
    );
    findFirstVinculo.mockResolvedValue({ status: "pendente" });

    const res = await post({ email: "idoso@a.com" });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/pendente/i);
  });

  it("409 quando já vinculados (aprovado)", async () => {
    findFirstUsuario.mockImplementation((args: FindFirstUsuarioArgs) =>
      args.where.firebase_uid ? CUIDADOR : { id: 10, nome: "Zé", email: "idoso@a.com" },
    );
    findFirstVinculo.mockResolvedValue({ status: "aprovado" });

    const res = await post({ email: "idoso@a.com" });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/já está vinculado/i);
  });

  it("422 com múltiplos idosos candidatos sem nome_idoso", async () => {
    findFirstUsuario.mockImplementation((args: FindFirstUsuarioArgs) => {
      if (args.where.firebase_uid) return CUIDADOR;
      if (args.where.tipo_perfil === "idoso") return null;
      return { id: 20 };
    });
    findManyVinculo.mockResolvedValue([
      { idoso: { id: 30, nome: "Maria" } },
      { idoso: { id: 31, nome: "João" } },
    ]);

    const res = await post({ email: "familiar@a.com" });

    expect(res.status).toBe(422);
    expect(res.body.candidatos).toHaveLength(2);
  });

  it("resolve múltiplos candidatos via nome_idoso", async () => {
    findFirstUsuario.mockImplementation((args: FindFirstUsuarioArgs) => {
      if (args.where.firebase_uid) return CUIDADOR;
      if (args.where.tipo_perfil === "idoso") return null;
      return { id: 20 };
    });
    findManyVinculo.mockResolvedValue([
      { idoso: { id: 30, nome: "Maria" } },
      { idoso: { id: 31, nome: "João" } },
    ]);
    findFirstVinculo.mockResolvedValue(null);
    createVinculo.mockResolvedValue({ id: 102, idoso_id: 31, vinculado_id: 1, status: "pendente" });

    const res = await post({ email: "familiar@a.com", nome_idoso: "joão" });

    expect(res.status).toBe(201);
    expect(createVinculo).toHaveBeenCalledWith({
      data: expect.objectContaining({ idoso_id: 31 }),
    });
  });
});

describe("POST /vinculo/solicitar-familiar", () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
    findFirstUsuario.mockReset();
    findUniqueUsuario.mockReset();
    findFirstVinculo.mockReset();
    createVinculo.mockReset();
    verifyIdToken.mockResolvedValue({ uid: "uid-1" });
    findFirstUsuario.mockResolvedValue(FAMILIAR); // requireAuth resolve caller
    findUniqueUsuario.mockResolvedValue(FAMILIAR);
  });

  it("403 quando chamador não é familiar", async () => {
    findUniqueUsuario.mockResolvedValue({ id: 1, tipo_perfil: "cuidador" });
    const res = await postFamiliar({ email: "idoso@a.com" });
    expect(res.status).toBe(403);
  });

  it("sucesso: cria vínculo pendente com origem solicitacao_familiar", async () => {
    findFirstUsuario.mockImplementation((args: FindFirstUsuarioArgs) =>
      args.where.firebase_uid ? FAMILIAR : { id: 10, tipo_perfil: "idoso" },
    );
    findFirstVinculo.mockResolvedValue(null);
    createVinculo.mockResolvedValue({ id: 200, idoso_id: 10, vinculado_id: 1, status: "pendente" });

    const res = await postFamiliar({ email: "idoso@a.com" });

    expect(res.status).toBe(201);
    expect(createVinculo).toHaveBeenCalledWith({
      data: expect.objectContaining({
        idoso_id: 10,
        vinculado_id: 1,
        tipo_vinculo: "familiar",
        origem: "solicitacao_familiar",
        status: "pendente",
      }),
    });
  });

  it("404 quando e-mail não encontra idoso nenhum", async () => {
    findFirstUsuario.mockImplementation((args: FindFirstUsuarioArgs) => (args.where.firebase_uid ? FAMILIAR : null));

    const res = await postFamiliar({ email: "ninguem@a.com" });

    expect(res.status).toBe(404);
  });

  it("404 genérico quando e-mail pertence a conta que não é idoso", async () => {
    // findFirst já filtra tipo_perfil='idoso' na query — uma conta de outro tipo com
    // esse e-mail nunca bate no where, então resolve null igual a "não encontrado".
    // Não revela a que tipo de conta o e-mail pertence (mesmo padrão da tarefa 2.1).
    findFirstUsuario.mockImplementation((args: FindFirstUsuarioArgs) => (args.where.firebase_uid ? FAMILIAR : null));

    const res = await postFamiliar({ email: "cuidador@a.com" });

    expect(res.status).toBe(404);
  });

  it("409 quando já existe solicitação pendente", async () => {
    findFirstUsuario.mockImplementation((args: FindFirstUsuarioArgs) =>
      args.where.firebase_uid ? FAMILIAR : { id: 10, tipo_perfil: "idoso" },
    );
    findFirstVinculo.mockResolvedValue({ status: "pendente" });

    const res = await postFamiliar({ email: "idoso@a.com" });

    expect(res.status).toBe(409);
  });

  it("409 quando já vinculados (aprovado)", async () => {
    findFirstUsuario.mockImplementation((args: FindFirstUsuarioArgs) =>
      args.where.firebase_uid ? FAMILIAR : { id: 10, tipo_perfil: "idoso" },
    );
    findFirstVinculo.mockResolvedValue({ status: "aprovado" });

    const res = await postFamiliar({ email: "idoso@a.com" });

    expect(res.status).toBe(409);
  });

  it("409 quando colide com vínculo já criado pelo Fluxo A (origem convite_idoso)", async () => {
    // Fluxo A (tarefa 2.5) já criou Vinculo pendente/aprovado com origem='convite_idoso'
    // pro mesmo par idoso/familiar — o índice único (idoso_id, vinculado_id, tipo_vinculo)
    // filtrado por status não distingue origem, então a checagem de duplicidade em
    // aplicação (findFirst) já pega esse caso antes de tentar o create. Comportamento
    // correto: não duplicar vínculo, não é bug.
    findFirstUsuario.mockImplementation((args: FindFirstUsuarioArgs) =>
      args.where.firebase_uid ? FAMILIAR : { id: 10, tipo_perfil: "idoso" },
    );
    findFirstVinculo.mockResolvedValue({ status: "aprovado", origem: "convite_idoso" });

    const res = await postFamiliar({ email: "idoso@a.com" });

    expect(res.status).toBe(409);
  });

  it("permite nova solicitação quando único registro existente foi recusado", async () => {
    findFirstUsuario.mockImplementation((args: FindFirstUsuarioArgs) =>
      args.where.firebase_uid ? FAMILIAR : { id: 10, tipo_perfil: "idoso" },
    );
    findFirstVinculo.mockResolvedValue(null); // findFirst já filtra status in [pendente, aprovado]
    createVinculo.mockResolvedValue({ id: 201, idoso_id: 10, vinculado_id: 1, status: "pendente" });

    const res = await postFamiliar({ email: "idoso@a.com" });

    expect(res.status).toBe(201);
  });
});

describe("POST /vinculo/:id/aprovar e /recusar", () => {
  const VINCULO_PENDENTE = { id: 5, idoso_id: 10, status: "pendente", tipo_vinculo: "cuidador" };

  beforeEach(() => {
    verifyIdToken.mockReset();
    findFirstUsuario.mockReset();
    findUniqueUsuario.mockReset();
    findFirstVinculo.mockReset();
    findUniqueVinculo.mockReset();
    updateVinculo.mockReset();
    verifyIdToken.mockResolvedValue({ uid: "uid-1" });
  });

  it("aprova quando modo_decisao='idoso' e chamador é o idoso", async () => {
    findFirstUsuario.mockResolvedValue({ id: 10 });
    findUniqueVinculo.mockResolvedValue(VINCULO_PENDENTE);
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "idoso" });
    updateVinculo.mockResolvedValue({ ...VINCULO_PENDENTE, status: "aprovado", aprovador_id: 10 });

    const res = await responder(5, "aprovar");

    expect(res.status).toBe(200);
    expect(updateVinculo).toHaveBeenCalledWith({
      where: { id: 5 },
      data: expect.objectContaining({ status: "aprovado", aprovador_id: 10 }),
    });
  });

  it("recusa quando modo_decisao='idoso' e chamador é o idoso", async () => {
    findFirstUsuario.mockResolvedValue({ id: 10 });
    findUniqueVinculo.mockResolvedValue(VINCULO_PENDENTE);
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "idoso" });
    updateVinculo.mockResolvedValue({ ...VINCULO_PENDENTE, status: "recusado", aprovador_id: 10 });

    const res = await responder(5, "recusar");

    expect(res.status).toBe(200);
    expect(updateVinculo).toHaveBeenCalledWith({
      where: { id: 5 },
      data: expect.objectContaining({ status: "recusado" }),
    });
  });

  it("403 quando modo_decisao='idoso' e chamador não é o idoso", async () => {
    findFirstUsuario.mockResolvedValue({ id: 99 });
    findUniqueVinculo.mockResolvedValue(VINCULO_PENDENTE);
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "idoso" });

    const res = await responder(5, "aprovar");

    expect(res.status).toBe(403);
  });

  it("aprova quando modo_decisao='familiar' e chamador é familiar aprovado", async () => {
    findFirstUsuario.mockResolvedValue({ id: 20 });
    findUniqueVinculo.mockResolvedValue(VINCULO_PENDENTE);
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "familiar" });
    findFirstVinculo.mockResolvedValue({ id: 999 });
    updateVinculo.mockResolvedValue({ ...VINCULO_PENDENTE, status: "aprovado", aprovador_id: 20 });

    const res = await responder(5, "aprovar");

    expect(res.status).toBe(200);
    expect(findFirstVinculo).toHaveBeenCalledWith({
      where: { idoso_id: 10, vinculado_id: 20, tipo_vinculo: "familiar", status: "aprovado" },
      select: { id: true },
    });
  });

  it("recusa quando modo_decisao='familiar' e chamador é familiar aprovado", async () => {
    findFirstUsuario.mockResolvedValue({ id: 20 });
    findUniqueVinculo.mockResolvedValue(VINCULO_PENDENTE);
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "familiar" });
    findFirstVinculo.mockResolvedValue({ id: 999 });
    updateVinculo.mockResolvedValue({ ...VINCULO_PENDENTE, status: "recusado", aprovador_id: 20 });

    const res = await responder(5, "recusar");

    expect(res.status).toBe(200);
  });

  it("403 quando modo_decisao='familiar' e chamador é o próprio idoso", async () => {
    findFirstUsuario.mockResolvedValue({ id: 10 });
    findUniqueVinculo.mockResolvedValue(VINCULO_PENDENTE);
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "familiar" });

    const res = await responder(5, "aprovar");

    expect(res.status).toBe(403);
  });

  it("403 quando modo_decisao='familiar' e chamador é familiar sem vínculo aprovado", async () => {
    findFirstUsuario.mockResolvedValue({ id: 20 });
    findUniqueVinculo.mockResolvedValue(VINCULO_PENDENTE);
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "familiar" });
    findFirstVinculo.mockResolvedValue(null);

    const res = await responder(5, "aprovar");

    expect(res.status).toBe(403);
  });

  it("404 quando vínculo não existe", async () => {
    findFirstUsuario.mockResolvedValue({ id: 10 });
    findUniqueVinculo.mockResolvedValue(null);

    const res = await responder(999, "aprovar");

    expect(res.status).toBe(404);
  });

  it("409 quando vínculo já foi resolvido", async () => {
    findFirstUsuario.mockResolvedValue({ id: 10 });
    findUniqueVinculo.mockResolvedValue({ ...VINCULO_PENDENTE, status: "aprovado" });

    const res = await responder(5, "aprovar");

    expect(res.status).toBe(409);
  });

  // Tarefa 2.7 (RF-027) — mesma rota compartilhada, agora também cobrindo
  // tipo_vinculo='familiar' (Fluxo B, tarefa 2.6). Autoridade idêntica à do
  // vínculo de cuidador, sem variante nova.
  const VINCULO_FAMILIAR_PENDENTE = { id: 6, idoso_id: 10, status: "pendente", tipo_vinculo: "familiar" };

  it("aprova vínculo familiar quando modo_decisao='idoso' e chamador é o idoso", async () => {
    findFirstUsuario.mockResolvedValue({ id: 10 });
    findUniqueVinculo.mockResolvedValue(VINCULO_FAMILIAR_PENDENTE);
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "idoso" });
    updateVinculo.mockResolvedValue({ ...VINCULO_FAMILIAR_PENDENTE, status: "aprovado", aprovador_id: 10 });

    const res = await responder(6, "aprovar");

    expect(res.status).toBe(200);
    expect(updateVinculo).toHaveBeenCalledWith({
      where: { id: 6 },
      data: expect.objectContaining({ status: "aprovado", aprovador_id: 10 }),
    });
  });

  it("recusa vínculo familiar quando modo_decisao='idoso' e chamador é o idoso", async () => {
    findFirstUsuario.mockResolvedValue({ id: 10 });
    findUniqueVinculo.mockResolvedValue(VINCULO_FAMILIAR_PENDENTE);
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "idoso" });
    updateVinculo.mockResolvedValue({ ...VINCULO_FAMILIAR_PENDENTE, status: "recusado", aprovador_id: 10 });

    const res = await responder(6, "recusar");

    expect(res.status).toBe(200);
  });

  it("aprova vínculo familiar quando modo_decisao='familiar' e chamador é outro familiar já aprovado", async () => {
    findFirstUsuario.mockResolvedValue({ id: 20 });
    findUniqueVinculo.mockResolvedValue(VINCULO_FAMILIAR_PENDENTE);
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "familiar" });
    findFirstVinculo.mockResolvedValue({ id: 999 }); // outro Vinculo familiar já aprovado do chamador com este idoso
    updateVinculo.mockResolvedValue({ ...VINCULO_FAMILIAR_PENDENTE, status: "aprovado", aprovador_id: 20 });

    const res = await responder(6, "aprovar");

    expect(res.status).toBe(200);
    expect(findFirstVinculo).toHaveBeenCalledWith({
      where: { idoso_id: 10, vinculado_id: 20, tipo_vinculo: "familiar", status: "aprovado" },
      select: { id: true },
    });
  });

  it("403 vínculo familiar quando modo_decisao='familiar' e chamador é o próprio idoso", async () => {
    findFirstUsuario.mockResolvedValue({ id: 10 });
    findUniqueVinculo.mockResolvedValue(VINCULO_FAMILIAR_PENDENTE);
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "familiar" });

    const res = await responder(6, "aprovar");

    expect(res.status).toBe(403);
  });

  it("403 vínculo familiar quando chamador é o próprio familiar que solicitou (sem vínculo aprovado prévio)", async () => {
    // Familiar solicitante não tem, para este idoso, nenhum outro Vinculo tipo_vinculo='familiar'
    // já aprovado — a checagem de autoridade (findFirstVinculo status='aprovado') não encontra nada,
    // então o próprio solicitante não consegue aprovar o próprio pedido pendente.
    findFirstUsuario.mockResolvedValue({ id: 20 });
    findUniqueVinculo.mockResolvedValue(VINCULO_FAMILIAR_PENDENTE);
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "familiar" });
    findFirstVinculo.mockResolvedValue(null);

    const res = await responder(6, "aprovar");

    expect(res.status).toBe(403);
  });

  it("fluxo de cuidador não regride: tipo_vinculo='cuidador' continua aprovável normalmente", async () => {
    findFirstUsuario.mockResolvedValue({ id: 10 });
    findUniqueVinculo.mockResolvedValue(VINCULO_PENDENTE);
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "idoso" });
    updateVinculo.mockResolvedValue({ ...VINCULO_PENDENTE, status: "aprovado", aprovador_id: 10 });

    const res = await responder(5, "aprovar");

    expect(res.status).toBe(200);
  });
});

describe("PATCH /vinculo/:id/definir-permissoes", () => {
  const VINCULO_CUIDADOR_APROVADO = { id: 7, idoso_id: 10, status: "aprovado", tipo_vinculo: "cuidador" };

  beforeEach(() => {
    verifyIdToken.mockReset();
    findFirstUsuario.mockReset();
    findUniqueUsuario.mockReset();
    findFirstVinculo.mockReset();
    findUniqueVinculo.mockReset();
    updateVinculo.mockReset();
    verifyIdToken.mockResolvedValue({ uid: "uid-1" });
  });

  it("titular idoso atualiza as flags com sucesso", async () => {
    findFirstUsuario.mockResolvedValue({ id: 10 });
    findUniqueVinculo.mockResolvedValue(VINCULO_CUIDADOR_APROVADO);
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "idoso" });
    updateVinculo.mockResolvedValue({
      ...VINCULO_CUIDADOR_APROVADO,
      permite_registrar_saude: true,
      permite_marcar_dose: true,
      definido_por_id: 10,
      definido_em: new Date(),
    });

    const res = await definirPermissoes(7, { permite_registrar_saude: true, permite_marcar_dose: true });

    expect(res.status).toBe(200);
    expect(updateVinculo).toHaveBeenCalledWith({
      where: { id: 7 },
      data: expect.objectContaining({
        permite_registrar_saude: true,
        permite_marcar_dose: true,
        definido_por_id: 10,
        definido_em: expect.any(Date),
      }),
      select: expect.any(Object),
    });
  });

  it("titular familiar aprovado atualiza as flags com sucesso", async () => {
    findFirstUsuario.mockResolvedValue({ id: 20 });
    findUniqueVinculo.mockResolvedValue(VINCULO_CUIDADOR_APROVADO);
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "familiar" });
    findFirstVinculo.mockResolvedValue({ id: 999 });
    updateVinculo.mockResolvedValue({
      ...VINCULO_CUIDADOR_APROVADO,
      permite_criar_evento_cuidado: true,
      definido_por_id: 20,
      definido_em: new Date(),
    });

    const res = await definirPermissoes(7, { permite_criar_evento_cuidado: true });

    expect(res.status).toBe(200);
    expect(findFirstVinculo).toHaveBeenCalledWith({
      where: { idoso_id: 10, vinculado_id: 20, tipo_vinculo: "familiar", status: "aprovado" },
      select: { id: true },
    });
  });

  it("403 quando modo_decisao='idoso' e chamador não é o idoso", async () => {
    findFirstUsuario.mockResolvedValue({ id: 99 });
    findUniqueVinculo.mockResolvedValue(VINCULO_CUIDADOR_APROVADO);
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "idoso" });

    const res = await definirPermissoes(7, { permite_registrar_saude: true });

    expect(res.status).toBe(403);
    expect(updateVinculo).not.toHaveBeenCalled();
  });

  it("403 quando modo_decisao='familiar' e chamador é familiar sem vínculo aprovado", async () => {
    findFirstUsuario.mockResolvedValue({ id: 20 });
    findUniqueVinculo.mockResolvedValue(VINCULO_CUIDADOR_APROVADO);
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "familiar" });
    findFirstVinculo.mockResolvedValue(null);

    const res = await definirPermissoes(7, { permite_registrar_saude: true });

    expect(res.status).toBe(403);
    expect(updateVinculo).not.toHaveBeenCalled();
  });

  it("400 quando tipo_vinculo='familiar'", async () => {
    findFirstUsuario.mockResolvedValue({ id: 10 });
    findUniqueVinculo.mockResolvedValue({ ...VINCULO_CUIDADOR_APROVADO, tipo_vinculo: "familiar" });

    const res = await definirPermissoes(7, { permite_registrar_saude: true });

    expect(res.status).toBe(400);
    expect(updateVinculo).not.toHaveBeenCalled();
  });

  it("409 quando vínculo não está aprovado", async () => {
    findFirstUsuario.mockResolvedValue({ id: 10 });
    findUniqueVinculo.mockResolvedValue({ ...VINCULO_CUIDADOR_APROVADO, status: "pendente" });

    const res = await definirPermissoes(7, { permite_registrar_saude: true });

    expect(res.status).toBe(409);
    expect(updateVinculo).not.toHaveBeenCalled();
  });

  it("404 quando vínculo não existe", async () => {
    findFirstUsuario.mockResolvedValue({ id: 10 });
    findUniqueVinculo.mockResolvedValue(null);

    const res = await definirPermissoes(999, { permite_registrar_saude: true });

    expect(res.status).toBe(404);
  });

  it("atualização parcial: só toca o campo enviado", async () => {
    findFirstUsuario.mockResolvedValue({ id: 10 });
    findUniqueVinculo.mockResolvedValue(VINCULO_CUIDADOR_APROVADO);
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "idoso" });
    updateVinculo.mockResolvedValue({ ...VINCULO_CUIDADOR_APROVADO, permite_marcar_dose: true });

    const res = await definirPermissoes(7, { permite_marcar_dose: true });

    expect(res.status).toBe(200);
    expect(updateVinculo).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        permite_marcar_dose: true,
        definido_por_id: 10,
        definido_em: expect.any(Date),
      },
      select: expect.any(Object),
    });
  });

  it("400 quando nenhuma flag é enviada", async () => {
    findFirstUsuario.mockResolvedValue({ id: 10 });
    findUniqueVinculo.mockResolvedValue(VINCULO_CUIDADOR_APROVADO);
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "idoso" });

    const res = await definirPermissoes(7, {});

    expect(res.status).toBe(400);
    expect(updateVinculo).not.toHaveBeenCalled();
  });
});

// Tarefa 2.9 (RF-033) — transferência de Usuario.modo_decisao pra 'familiar'.
describe("POST /vinculo/:id/solicitar-transferencia-decisao", () => {
  // :id aqui é o vínculo aprovado DO PRÓPRIO familiar solicitante (vinculado_id === req.usuarioId).
  const VINCULO_FAMILIAR_APROVADO = { id: 7, idoso_id: 10, vinculado_id: 77, status: "aprovado", tipo_vinculo: "familiar" };

  beforeEach(() => {
    verifyIdToken.mockReset();
    findFirstUsuario.mockReset();
    findUniqueUsuario.mockReset();
    updateUsuario.mockReset();
    findUniqueVinculo.mockReset();
    countVinculo.mockReset();
    verifyIdToken.mockResolvedValue({ uid: "uid-77" });
    findFirstUsuario.mockResolvedValue({ id: 77 });
    updateUsuario.mockImplementation((args: { data: Record<string, unknown> }) => args.data);
  });

  it("404 quando vínculo não existe", async () => {
    findUniqueVinculo.mockResolvedValue(null);
    const res = await solicitarTransferencia(999);
    expect(res.status).toBe(404);
  });

  it("400 quando tipo_vinculo não é familiar", async () => {
    findUniqueVinculo.mockResolvedValue({ ...VINCULO_FAMILIAR_APROVADO, tipo_vinculo: "cuidador" });
    const res = await solicitarTransferencia(7);
    expect(res.status).toBe(400);
    expect(updateUsuario).not.toHaveBeenCalled();
  });

  it("409 quando vínculo não está aprovado", async () => {
    findUniqueVinculo.mockResolvedValue({ ...VINCULO_FAMILIAR_APROVADO, status: "pendente" });
    const res = await solicitarTransferencia(7);
    expect(res.status).toBe(409);
    expect(updateUsuario).not.toHaveBeenCalled();
  });

  it("403 quando o vínculo não é do próprio chamador", async () => {
    findUniqueVinculo.mockResolvedValue({ ...VINCULO_FAMILIAR_APROVADO, vinculado_id: 999 });
    const res = await solicitarTransferencia(7);
    expect(res.status).toBe(403);
    expect(updateUsuario).not.toHaveBeenCalled();
  });

  it("409 quando modo_decisao já é 'familiar'", async () => {
    findUniqueVinculo.mockResolvedValue(VINCULO_FAMILIAR_APROVADO);
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "familiar" });
    const res = await solicitarTransferencia(7);
    expect(res.status).toBe(409);
    expect(updateUsuario).not.toHaveBeenCalled();
  });

  it("409 quando já existe solicitação em curso — não sobrescreve", async () => {
    findUniqueVinculo.mockResolvedValue(VINCULO_FAMILIAR_APROVADO);
    findUniqueUsuario.mockResolvedValue({
      modo_decisao: "idoso",
      modo_decisao_solicitado: "familiar",
      modo_decisao_solicitado_por_id: 999,
      modo_decisao_expira_em: new Date(Date.now() + 1000 * 60 * 60),
    });
    const res = await solicitarTransferencia(7);
    expect(res.status).toBe(409);
    expect(updateUsuario).not.toHaveBeenCalled();
  });

  it("400 quando modo_decisao_motivo não é texto", async () => {
    findUniqueVinculo.mockResolvedValue(VINCULO_FAMILIAR_APROVADO);
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "idoso" });
    const res = await solicitarTransferencia(7, { modo_decisao_motivo: 123 });
    expect(res.status).toBe(400);
    expect(updateUsuario).not.toHaveBeenCalled();
  });

  it("400 quando modo_decisao_motivo excede 300 caracteres", async () => {
    findUniqueVinculo.mockResolvedValue(VINCULO_FAMILIAR_APROVADO);
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "idoso" });
    const res = await solicitarTransferencia(7, { modo_decisao_motivo: "a".repeat(301) });
    expect(res.status).toBe(400);
    expect(updateUsuario).not.toHaveBeenCalled();
  });

  it("sucesso: abre janela de 7 dias e persiste motivo opcional", async () => {
    findUniqueVinculo.mockResolvedValue(VINCULO_FAMILIAR_APROVADO);
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "idoso" });

    const res = await solicitarTransferencia(7, { modo_decisao_motivo: "Facilita o dia a dia" });

    expect(res.status).toBe(200);
    expect(updateUsuario).toHaveBeenCalledWith({
      where: { id: 10 },
      data: {
        modo_decisao_solicitado: "familiar",
        modo_decisao_solicitado_por_id: 77,
        modo_decisao_solicitado_em: expect.any(Date),
        modo_decisao_expira_em: expect.any(Date),
        modo_decisao_segunda_confirmacao_id: null,
        modo_decisao_motivo: "Facilita o dia a dia",
      },
      select: expect.any(Object),
    });
    const chamada = updateUsuario.mock.calls[0][0];
    const diasJanela =
      (chamada.data.modo_decisao_expira_em.getTime() - chamada.data.modo_decisao_solicitado_em.getTime()) /
      (1000 * 60 * 60 * 24);
    expect(diasJanela).toBeCloseTo(7, 5);
  });

  it("sucesso sem motivo: persiste null", async () => {
    findUniqueVinculo.mockResolvedValue(VINCULO_FAMILIAR_APROVADO);
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "idoso" });

    const res = await solicitarTransferencia(7);

    expect(res.status).toBe(200);
    expect(updateUsuario).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ modo_decisao_motivo: null }) }),
    );
  });
});

describe("POST /vinculo/:id/confirmar-transferencia-decisao", () => {
  const VINCULO_FAMILIAR_APROVADO = { id: 8, idoso_id: 10, vinculado_id: 88, status: "aprovado", tipo_vinculo: "familiar" };

  beforeEach(() => {
    verifyIdToken.mockReset();
    findFirstUsuario.mockReset();
    findUniqueUsuario.mockReset();
    updateUsuario.mockReset();
    findUniqueVinculo.mockReset();
    countVinculo.mockReset();
    verifyIdToken.mockResolvedValue({ uid: "uid-88" });
    findFirstUsuario.mockResolvedValue({ id: 88 });
    updateUsuario.mockImplementation((args: { data: Record<string, unknown> }) => args.data);
  });

  it("404 quando vínculo não existe", async () => {
    findUniqueVinculo.mockResolvedValue(null);
    const res = await confirmarTransferencia(999);
    expect(res.status).toBe(404);
  });

  it("400 quando tipo_vinculo não é familiar", async () => {
    findUniqueVinculo.mockResolvedValue({ ...VINCULO_FAMILIAR_APROVADO, tipo_vinculo: "cuidador" });
    const res = await confirmarTransferencia(8);
    expect(res.status).toBe(400);
  });

  it("409 quando vínculo não está aprovado", async () => {
    findUniqueVinculo.mockResolvedValue({ ...VINCULO_FAMILIAR_APROVADO, status: "pendente" });
    const res = await confirmarTransferencia(8);
    expect(res.status).toBe(409);
  });

  it("403 quando o vínculo não é do próprio chamador", async () => {
    findUniqueVinculo.mockResolvedValue({ ...VINCULO_FAMILIAR_APROVADO, vinculado_id: 999 });
    const res = await confirmarTransferencia(8);
    expect(res.status).toBe(403);
  });

  it("409 quando não há solicitação em curso", async () => {
    findUniqueVinculo.mockResolvedValue(VINCULO_FAMILIAR_APROVADO);
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "idoso", modo_decisao_solicitado: null });
    const res = await confirmarTransferencia(8);
    expect(res.status).toBe(409);
    expect(updateUsuario).not.toHaveBeenCalled();
  });

  it("403 quando quem confirma é o próprio solicitante", async () => {
    findUniqueVinculo.mockResolvedValue(VINCULO_FAMILIAR_APROVADO);
    findUniqueUsuario.mockResolvedValue({
      modo_decisao: "idoso",
      modo_decisao_solicitado: "familiar",
      modo_decisao_solicitado_por_id: 88,
      modo_decisao_expira_em: new Date(Date.now() + 1000 * 60 * 60),
    });
    const res = await confirmarTransferencia(8);
    expect(res.status).toBe(403);
    expect(updateUsuario).not.toHaveBeenCalled();
  });

  it("sucesso: registra a segunda confirmação sem efetivar a mudança na hora", async () => {
    findUniqueVinculo.mockResolvedValue(VINCULO_FAMILIAR_APROVADO);
    findUniqueUsuario.mockResolvedValue({
      modo_decisao: "idoso",
      modo_decisao_solicitado: "familiar",
      modo_decisao_solicitado_por_id: 77,
      modo_decisao_expira_em: new Date(Date.now() + 1000 * 60 * 60),
    });

    const res = await confirmarTransferencia(8);

    expect(res.status).toBe(200);
    expect(updateUsuario).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { modo_decisao_segunda_confirmacao_id: 88 },
      select: expect.any(Object),
    });
  });

  it("edge: confirmação chegando depois da janela expirar (sem segunda confirmação prévia) é tratada como vencida, não efetiva", async () => {
    findUniqueVinculo.mockResolvedValue(VINCULO_FAMILIAR_APROVADO);
    // resolverEstadoModoDecisao lê o estado expirado, exige 2ª confirmação (2 familiares
    // aprovados) e ainda não tinha sido dada — lapsa a solicitação antes desta rota checar.
    findUniqueUsuario.mockResolvedValue({
      modo_decisao: "idoso",
      modo_decisao_solicitado: "familiar",
      modo_decisao_solicitado_por_id: 77,
      modo_decisao_expira_em: new Date(Date.now() - 1000),
      modo_decisao_segunda_confirmacao_id: null,
    });
    countVinculo.mockResolvedValue(2);
    updateUsuario.mockResolvedValue({ modo_decisao_solicitado: null });

    const res = await confirmarTransferencia(8);

    expect(res.status).toBe(409);
    // A única chamada de update até aqui foi o lapso feito por resolverEstadoModoDecisao,
    // não a confirmação (que nunca chega a rodar).
    expect(updateUsuario).toHaveBeenCalledTimes(1);
    expect(updateUsuario).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ modo_decisao_solicitado: null }) }),
    );
  });
});

describe("resolverEstadoModoDecisao — checagem preguiçosa de expiração (RF-033)", () => {
  const VINCULO_CUIDADOR_PENDENTE = { id: 5, idoso_id: 10, status: "pendente", tipo_vinculo: "cuidador" };

  beforeEach(() => {
    verifyIdToken.mockReset();
    findFirstUsuario.mockReset();
    findUniqueUsuario.mockReset();
    updateUsuario.mockReset();
    findUniqueVinculo.mockReset();
    findFirstVinculo.mockReset();
    updateVinculo.mockReset();
    countVinculo.mockReset();
    verifyIdToken.mockResolvedValue({ uid: "uid-77" });
    findUniqueVinculo.mockResolvedValue(VINCULO_CUIDADOR_PENDENTE);
    // /aprovar (veículo destes testes) também escreve em Vinculo pra marcar status —
    // irrelevante pro que está sendo testado aqui (a checagem preguiçosa em Usuario).
    updateVinculo.mockResolvedValue({ id: 5, status: "aprovado" });
  });

  it("efetiva a transferência quando a janela expirou e só 1 familiar aprovado (sem 2ª confirmação exigida)", async () => {
    findFirstUsuario.mockResolvedValue({ id: 77 }); // chamador = o próprio familiar solicitante
    findUniqueUsuario.mockResolvedValue({
      modo_decisao: "idoso",
      modo_decisao_solicitado: "familiar",
      modo_decisao_solicitado_por_id: 77,
      modo_decisao_expira_em: new Date(Date.now() - 1000),
      modo_decisao_segunda_confirmacao_id: null,
    });
    countVinculo.mockResolvedValue(1);
    updateUsuario.mockResolvedValue({ modo_decisao: "familiar" });
    findFirstVinculo.mockResolvedValue({ id: 900 }); // familiarTemVinculoAprovado(10, 77)

    const res = await responder(5, "aprovar");

    expect(res.status).toBe(200);
    expect(updateUsuario).toHaveBeenCalledWith({
      where: { id: 10 },
      data: {
        modo_decisao: "familiar",
        modo_decisao_alterado_por_id: 77,
        modo_decisao_alterado_em: expect.any(Date),
        modo_decisao_solicitado: null,
        modo_decisao_solicitado_por_id: null,
        modo_decisao_solicitado_em: null,
        modo_decisao_expira_em: null,
        modo_decisao_segunda_confirmacao_id: null,
      },
      select: expect.any(Object),
    });
  });

  it("não efetiva (lapsa) quando a janela expirou, 2+ familiares aprovados e a 2ª confirmação nunca veio", async () => {
    findFirstUsuario.mockResolvedValue({ id: 10 }); // chamador = o próprio idoso (ainda tem autoridade)
    findUniqueUsuario.mockResolvedValue({
      modo_decisao: "idoso",
      modo_decisao_solicitado: "familiar",
      modo_decisao_solicitado_por_id: 77,
      modo_decisao_expira_em: new Date(Date.now() - 1000),
      modo_decisao_segunda_confirmacao_id: null,
    });
    countVinculo.mockResolvedValue(2);
    updateUsuario.mockResolvedValue({ modo_decisao_solicitado: null });

    const res = await responder(5, "aprovar");

    expect(res.status).toBe(200); // idoso ainda tem autoridade — solicitação vencida não mudou isso
    expect(updateUsuario).toHaveBeenCalledWith({
      where: { id: 10 },
      data: {
        modo_decisao_solicitado: null,
        modo_decisao_solicitado_por_id: null,
        modo_decisao_solicitado_em: null,
        modo_decisao_expira_em: null,
        modo_decisao_segunda_confirmacao_id: null,
        modo_decisao_motivo: null,
      },
      select: expect.any(Object),
    });
  });

  it("efetiva quando a janela expirou, 2+ familiares aprovados e a 2ª confirmação já tinha sido dada", async () => {
    findFirstUsuario.mockResolvedValue({ id: 77 });
    findUniqueUsuario.mockResolvedValue({
      modo_decisao: "idoso",
      modo_decisao_solicitado: "familiar",
      modo_decisao_solicitado_por_id: 77,
      modo_decisao_expira_em: new Date(Date.now() - 1000),
      modo_decisao_segunda_confirmacao_id: 88,
    });
    countVinculo.mockResolvedValue(2);
    updateUsuario.mockResolvedValue({ modo_decisao: "familiar" });
    findFirstVinculo.mockResolvedValue({ id: 901 });

    const res = await responder(5, "aprovar");

    expect(res.status).toBe(200);
    expect(updateUsuario).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ modo_decisao: "familiar" }) }),
    );
  });

  it("não mexe em nada quando não há solicitação em curso", async () => {
    findFirstUsuario.mockResolvedValue({ id: 10 });
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "idoso", modo_decisao_solicitado: null });

    const res = await responder(5, "aprovar");

    expect(res.status).toBe(200);
    expect(updateUsuario).not.toHaveBeenCalled();
    expect(countVinculo).not.toHaveBeenCalled();
  });

  it("não mexe em nada quando a solicitação ainda não expirou", async () => {
    findFirstUsuario.mockResolvedValue({ id: 10 });
    findUniqueUsuario.mockResolvedValue({
      modo_decisao: "idoso",
      modo_decisao_solicitado: "familiar",
      modo_decisao_expira_em: new Date(Date.now() + 1000 * 60 * 60),
    });

    const res = await responder(5, "aprovar");

    expect(res.status).toBe(200);
    expect(updateUsuario).not.toHaveBeenCalled();
  });
});

// Contestação de vínculo automático já 'aprovado' (RF-022, Fluxo A e RF-030 — dívida
// técnica do item 2.5). Mesma autoridade de aprovar/recusar (Usuario.modo_decisao).
describe("POST /vinculo/:id/contestar", () => {
  // idoso 10, familiar contestado 30, vínculo automático já aprovado.
  const VINCULO_AUTO = {
    id: 5,
    idoso_id: 10,
    vinculado_id: 30,
    status: "aprovado",
    tipo_vinculo: "familiar",
    origem: "convite_idoso",
  };

  function contestar(id: number | string, token = true) {
    const r = request(buildApp()).post(`/vinculo/${id}/contestar`);
    return (token ? r.set("Authorization", "Bearer x") : r).send();
  }

  beforeEach(() => {
    verifyIdToken.mockReset();
    findFirstUsuario.mockReset();
    findUniqueUsuario.mockReset();
    updateUsuario.mockReset();
    findFirstVinculo.mockReset();
    findUniqueVinculo.mockReset();
    updateVinculo.mockReset();
    transaction.mockReset();
    transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
    verifyIdToken.mockResolvedValue({ uid: "uid-1" });
    findUniqueVinculo.mockResolvedValue(VINCULO_AUTO);
    updateVinculo.mockImplementation(({ data }: { data: object }) => Promise.resolve({ ...VINCULO_AUTO, ...data }));
    updateUsuario.mockResolvedValue({});
  });

  it("401 sem token", async () => {
    const res = await contestar(5, false);
    expect(res.status).toBe(401);
    expect(updateVinculo).not.toHaveBeenCalled();
  });

  it("400 id não numérico", async () => {
    findFirstUsuario.mockResolvedValue({ id: 10 });
    const res = await contestar("abc");
    expect(res.status).toBe(400);
  });

  it("404 vínculo inexistente", async () => {
    findFirstUsuario.mockResolvedValue({ id: 10 });
    findUniqueVinculo.mockResolvedValue(null);
    const res = await contestar(5);
    expect(res.status).toBe(404);
  });

  it.each([
    ["tipo_vinculo cuidador", { tipo_vinculo: "cuidador", origem: "solicitacao_cuidador" }],
    ["origem solicitacao_familiar (aprovação manual)", { origem: "solicitacao_familiar" }],
  ])("400 fora de elegibilidade: %s", async (_nome, override) => {
    findFirstUsuario.mockResolvedValue({ id: 10 });
    findUniqueVinculo.mockResolvedValue({ ...VINCULO_AUTO, ...override });
    const res = await contestar(5);
    expect(res.status).toBe(400);
    expect(updateVinculo).not.toHaveBeenCalled();
  });

  it.each(["pendente", "recusado"])("409 quando status=%s", async (status) => {
    findFirstUsuario.mockResolvedValue({ id: 10 });
    findUniqueVinculo.mockResolvedValue({ ...VINCULO_AUTO, status });
    const res = await contestar(5);
    expect(res.status).toBe(409);
    expect(updateVinculo).not.toHaveBeenCalled();
  });

  it.each(["convite_idoso", "cadastro_familiar"])(
    "sucesso: titular idoso (modo_decisao='idoso'), origem %s",
    async (origem) => {
      findFirstUsuario.mockResolvedValue({ id: 10 });
      findUniqueVinculo.mockResolvedValue({ ...VINCULO_AUTO, origem });
      findUniqueUsuario.mockResolvedValue({ modo_decisao: "idoso" });

      const res = await contestar(5);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("recusado");
      expect(updateVinculo).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { status: "recusado", aprovador_id: 10, data_resposta: expect.any(Date) },
      });
    },
  );

  it("sucesso: titular familiar aprovado (modo_decisao='familiar')", async () => {
    findFirstUsuario.mockResolvedValue({ id: 20 });
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "familiar" });
    findFirstVinculo.mockResolvedValue({ id: 999 });

    const res = await contestar(5);

    expect(res.status).toBe(200);
    expect(findFirstVinculo).toHaveBeenCalledWith({
      where: { idoso_id: 10, vinculado_id: 20, tipo_vinculo: "familiar", status: "aprovado" },
      select: { id: true },
    });
    expect(updateVinculo).toHaveBeenCalledWith({
      where: { id: 5 },
      data: expect.objectContaining({ status: "recusado", aprovador_id: 20 }),
    });
  });

  it("403 não titular com modo_decisao='idoso'", async () => {
    findFirstUsuario.mockResolvedValue({ id: 99 });
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "idoso" });
    const res = await contestar(5);
    expect(res.status).toBe(403);
    expect(updateVinculo).not.toHaveBeenCalled();
  });

  it("403 não titular com modo_decisao='familiar' (sem vínculo aprovado)", async () => {
    findFirstUsuario.mockResolvedValue({ id: 77 });
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "familiar" });
    findFirstVinculo.mockResolvedValue(null);
    const res = await contestar(5);
    expect(res.status).toBe(403);
    expect(updateVinculo).not.toHaveBeenCalled();
  });

  it("403 idoso quando modo_decisao='familiar'", async () => {
    findFirstUsuario.mockResolvedValue({ id: 10 });
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "familiar" });
    const res = await contestar(5);
    expect(res.status).toBe(403);
    expect(updateVinculo).not.toHaveBeenCalled();
  });

  it("403 ao contestar o próprio vínculo (isso é desvincular, outro requisito)", async () => {
    findFirstUsuario.mockResolvedValue({ id: 30 });
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "familiar" });
    findFirstVinculo.mockResolvedValue({ id: 5 }); // tem vínculo aprovado — é o próprio
    const res = await contestar(5);
    expect(res.status).toBe(403);
    expect(updateVinculo).not.toHaveBeenCalled();
  });

  it("vínculo contestado deixa de passar em requireVinculoAprovado", async () => {
    // Estado em memória: update muda o status, findFirst filtra por status como o banco.
    const store = { ...VINCULO_AUTO } as Record<string, unknown>;
    updateVinculo.mockImplementation(({ data }: { data: object }) => {
      Object.assign(store, data);
      return Promise.resolve({ ...store });
    });
    findFirstVinculo.mockImplementation(
      ({ where }: { where: { idoso_id: number; vinculado_id: number; status: string } }) =>
        Promise.resolve(
          store.idoso_id === where.idoso_id &&
            store.vinculado_id === where.vinculado_id &&
            store.status === where.status
            ? store
            : null,
        ),
    );
    const app = express();
    app.use(express.json());
    app.use("/vinculo", vinculoRouter);
    app.get("/idoso/:idosoId/dados", requireAuth, requireVinculoAprovado("idosoId"), (_req, res) => {
      res.json({ ok: true });
    });

    findFirstUsuario.mockResolvedValue({ id: 30 });
    expect((await request(app).get("/idoso/10/dados").set("Authorization", "Bearer x")).status).toBe(200);

    findFirstUsuario.mockResolvedValue({ id: 10 });
    findUniqueUsuario.mockResolvedValue({ modo_decisao: "idoso" });
    expect((await request(app).post("/vinculo/5/contestar").set("Authorization", "Bearer x")).status).toBe(200);

    findFirstUsuario.mockResolvedValue({ id: 30 });
    expect((await request(app).get("/idoso/10/dados").set("Authorization", "Bearer x")).status).toBe(403);
  });

  describe("transferência de modo_decisao em curso (D6, RF-033)", () => {
    const EM_CURSO = {
      modo_decisao: "idoso",
      modo_decisao_solicitado: "familiar",
      modo_decisao_solicitado_por_id: 30,
      modo_decisao_solicitado_em: new Date(),
      modo_decisao_expira_em: new Date(Date.now() + 86_400_000),
      modo_decisao_segunda_confirmacao_id: null,
    };

    beforeEach(() => {
      findFirstUsuario.mockResolvedValue({ id: 10 });
    });

    it("contestado é o solicitante: cancela a solicitação inteira (6 campos), atomicamente", async () => {
      findUniqueUsuario.mockResolvedValue({ ...EM_CURSO, modo_decisao_solicitado_por_id: 30 });

      const res = await contestar(5);

      expect(res.status).toBe(200);
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(updateUsuario).toHaveBeenCalledTimes(1);
      expect(updateUsuario).toHaveBeenCalledWith({
        where: { id: 10 },
        data: {
          modo_decisao_solicitado: null,
          modo_decisao_solicitado_por_id: null,
          modo_decisao_solicitado_em: null,
          modo_decisao_expira_em: null,
          modo_decisao_segunda_confirmacao_id: null,
          modo_decisao_motivo: null,
        },
        select: { id: true },
      });
    });

    it("contestado é o segundo confirmador: zera só modo_decisao_segunda_confirmacao_id", async () => {
      findUniqueUsuario.mockResolvedValue({
        ...EM_CURSO,
        modo_decisao_solicitado_por_id: 31,
        modo_decisao_segunda_confirmacao_id: 30,
      });

      const res = await contestar(5);

      expect(res.status).toBe(200);
      expect(updateUsuario).toHaveBeenCalledTimes(1);
      expect(updateUsuario).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { modo_decisao_segunda_confirmacao_id: null },
        select: { id: true },
      });
    });

    it("contestado não participa da transferência: não toca Usuario", async () => {
      findUniqueUsuario.mockResolvedValue({
        ...EM_CURSO,
        modo_decisao_solicitado_por_id: 31,
        modo_decisao_segunda_confirmacao_id: 32,
      });

      const res = await contestar(5);

      expect(res.status).toBe(200);
      expect(updateUsuario).not.toHaveBeenCalled();
    });

    it("sem transferência em curso: não toca Usuario", async () => {
      findUniqueUsuario.mockResolvedValue({ modo_decisao: "idoso" });
      const res = await contestar(5);
      expect(res.status).toBe(200);
      expect(updateUsuario).not.toHaveBeenCalled();
    });
  });
});
