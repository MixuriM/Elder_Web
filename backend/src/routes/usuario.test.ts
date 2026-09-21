import express from "express";
import request from "supertest";

const verifyIdToken = jest.fn();
const findFirst = jest.fn();
const findUnique = jest.fn();
const findUniqueOrThrow = jest.fn();
const update = jest.fn();
const updateUser = jest.fn();
const findFirstVinculo = jest.fn();
const countVinculo = jest.fn();
const createUsuario = jest.fn();

jest.mock("../lib/firebaseAdmin", () => ({
  auth: {
    verifyIdToken: (...args: unknown[]) => verifyIdToken(...args),
    updateUser: (...args: unknown[]) => updateUser(...args),
  },
}));
jest.mock("../lib/prisma", () => ({
  prisma: {
    usuario: {
      findFirst: (...args: unknown[]) => findFirst(...args),
      findUnique: (...args: unknown[]) => findUnique(...args),
      findUniqueOrThrow: (...args: unknown[]) => findUniqueOrThrow(...args),
      update: (...args: unknown[]) => update(...args),
      create: (...args: unknown[]) => createUsuario(...args),
    },
    // Usado só por resolverEstadoModoDecisao (import de ./vinculo — mesmo módulo
    // mockado, mesma instância) e pelo guard D6 de PATCH /usuario/me/modo-decisao.
    vinculo: {
      findFirst: (...args: unknown[]) => findFirstVinculo(...args),
      count: (...args: unknown[]) => countVinculo(...args),
    },
  },
}));

import usuarioRouter from "./usuario";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/usuario", usuarioRouter);
  app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: "Erro interno." });
  });
  return app;
}

const USUARIO_LOGADO = { id: 42, firebase_uid: "uid-42", email: "a@a.com", telefone: "123" };

// Estado "sem transferência de decisão em curso" — retorno default de
// resolverEstadoModoDecisao (tarefa 2.9, RF-033) quando nada foi solicitado ainda.
const MODO_DECISAO_NEUTRO = {
  modo_decisao: null,
  modo_decisao_solicitado: null,
  modo_decisao_solicitado_por_id: null,
  modo_decisao_solicitado_em: null,
  modo_decisao_expira_em: null,
  modo_decisao_segunda_confirmacao_id: null,
  modo_decisao_alterado_por_id: null,
  modo_decisao_alterado_em: null,
  modo_decisao_motivo: null,
};

describe("GET /usuario/me", () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
    findFirst.mockReset();
    findUnique.mockReset();
  });

  it("retorna 401 sem token", async () => {
    const res = await request(buildApp()).get("/usuario/me");
    expect(res.status).toBe(401);
  });

  it("retorna 401 com token inválido", async () => {
    verifyIdToken.mockRejectedValue(Object.assign(new Error("bad"), { code: "auth/argument-error" }));
    const res = await request(buildApp()).get("/usuario/me").set("Authorization", "Bearer x");
    expect(res.status).toBe(401);
  });

  it("retorna dados do usuário autenticado", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-42" });
    findFirst.mockResolvedValue(USUARIO_LOGADO);
    // GET /usuario/me chama prisma.usuario.findUnique duas vezes, em sequência: 1ª
    // dentro de resolverEstadoModoDecisao (routes/vinculo.ts), 2ª pros campos de
    // perfil — mockResolvedValueOnce encadeado respeita essa ordem.
    findUnique
      .mockResolvedValueOnce(MODO_DECISAO_NEUTRO)
      .mockResolvedValueOnce({ id: 42, nome: "Ana", email: "a@a.com", telefone: "123", tipo_perfil: "idoso" });

    const res = await request(buildApp()).get("/usuario/me").set("Authorization", "Bearer x");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 42,
      nome: "Ana",
      email: "a@a.com",
      telefone: "123",
      tipo_perfil: "idoso",
      ...MODO_DECISAO_NEUTRO,
    });
  });

  it("inclui campos de modo_decisao_solicitado quando há transferência em curso", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-42" });
    findFirst.mockResolvedValue(USUARIO_LOGADO);
    findUnique
      .mockResolvedValueOnce({
        ...MODO_DECISAO_NEUTRO,
        modo_decisao_solicitado: "familiar",
        modo_decisao_solicitado_por_id: 7,
        modo_decisao_solicitado_em: new Date("2026-09-18T00:00:00Z"),
        modo_decisao_expira_em: new Date("2026-09-25T00:00:00Z"),
        modo_decisao_motivo: "Facilita o dia a dia",
      })
      .mockResolvedValueOnce({ id: 42, nome: "Ana", email: "a@a.com", telefone: "123", tipo_perfil: "idoso" });

    const res = await request(buildApp()).get("/usuario/me").set("Authorization", "Bearer x");

    expect(res.status).toBe(200);
    expect(res.body.modo_decisao_solicitado).toBe("familiar");
    expect(res.body.modo_decisao_solicitado_por_id).toBe(7);
    expect(res.body.modo_decisao_motivo).toBe("Facilita o dia a dia");
  });
});

describe("PATCH /usuario/me", () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
    findFirst.mockReset();
    findUniqueOrThrow.mockReset();
    update.mockReset();
    updateUser.mockReset();
    verifyIdToken.mockResolvedValue({ uid: "uid-42" });
    findFirst.mockResolvedValue(USUARIO_LOGADO);
  });

  it("bloqueia email e telefone nulos ao mesmo tempo com mensagem clara", async () => {
    findUniqueOrThrow.mockResolvedValue({ email: "a@a.com", telefone: "123", firebase_uid: "uid-42" });

    const res = await request(buildApp())
      .patch("/usuario/me")
      .set("Authorization", "Bearer x")
      .send({ email: "", telefone: "" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/e-mail ou telefone/i);
    expect(update).not.toHaveBeenCalled();
  });

  it("sincroniza email novo com Firebase Auth via updateUser", async () => {
    findUniqueOrThrow.mockResolvedValue({ email: "a@a.com", telefone: "123", firebase_uid: "uid-42" });
    updateUser.mockResolvedValue(undefined);
    update.mockResolvedValue({ id: 42, nome: "Ana", email: "novo@a.com", telefone: "123", tipo_perfil: "idoso" });

    const res = await request(buildApp())
      .patch("/usuario/me")
      .set("Authorization", "Bearer x")
      .send({ email: "novo@a.com" });

    expect(res.status).toBe(200);
    expect(updateUser).toHaveBeenCalledWith("uid-42", { email: "novo@a.com" });
    expect(res.body.email).toBe("novo@a.com");
  });

  it("trata colisão de email já em uso com mensagem tratada, não erro cru", async () => {
    findUniqueOrThrow.mockResolvedValue({ email: "a@a.com", telefone: "123", firebase_uid: "uid-42" });
    updateUser.mockResolvedValue(undefined);
    update.mockRejectedValue(new Error("Violation of UNIQUE KEY constraint 'Usuario_email_key'"));

    const res = await request(buildApp())
      .patch("/usuario/me")
      .set("Authorization", "Bearer x")
      .send({ email: "duplicado@a.com" });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/já está em uso/i);
  });
});

// Item 2.10 (RF-034) — idoso altera Usuario.modo_decisao diretamente, sem janela de
// carência, incluindo reverter de 'familiar' pra 'idoso'. Escopo separado da 2.9 (que
// cobre só a transferência pra 'familiar' solicitada por um Familiar): aqui quem pede é
// sempre o próprio idoso (req.usuarioId), sem checar familiares na reversão (D5/D6/D7,
// ver relatório da tarefa).
describe("PATCH /usuario/me/modo-decisao", () => {
  function patch(body: unknown) {
    return request(buildApp())
      .patch("/usuario/me/modo-decisao")
      .set("Authorization", "Bearer x")
      .send(body as Record<string, unknown>);
  }

  beforeEach(() => {
    verifyIdToken.mockReset();
    findFirst.mockReset();
    findUnique.mockReset();
    update.mockReset();
    findFirstVinculo.mockReset();
    countVinculo.mockReset();
    verifyIdToken.mockResolvedValue({ uid: "uid-42" });
    findFirst.mockResolvedValue(USUARIO_LOGADO);
  });

  it("a) idoso -> familiar com familiar aprovado: 200, grava alterado_por_id e motivo NULL", async () => {
    findUnique
      .mockResolvedValueOnce({ tipo_perfil: "idoso" })
      .mockResolvedValueOnce({ ...MODO_DECISAO_NEUTRO, modo_decisao: "idoso" });
    findFirstVinculo.mockResolvedValue({ id: 900 });
    update.mockResolvedValue({
      ...MODO_DECISAO_NEUTRO,
      modo_decisao: "familiar",
      modo_decisao_alterado_por_id: 42,
      modo_decisao_alterado_em: new Date(),
    });

    const res = await patch({ modo_decisao: "familiar" });

    expect(res.status).toBe(200);
    expect(findFirstVinculo).toHaveBeenCalledWith({
      where: { idoso_id: 42, tipo_vinculo: "familiar", status: "aprovado" },
      select: { id: true },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: {
        modo_decisao: "familiar",
        modo_decisao_alterado_por_id: 42,
        modo_decisao_alterado_em: expect.any(Date),
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

  it("b) idoso -> familiar sem familiar aprovado: 409, sem update", async () => {
    findUnique
      .mockResolvedValueOnce({ tipo_perfil: "idoso" })
      .mockResolvedValueOnce({ ...MODO_DECISAO_NEUTRO, modo_decisao: "idoso" });
    findFirstVinculo.mockResolvedValue(null);

    const res = await patch({ modo_decisao: "familiar" });

    expect(res.status).toBe(409);
    expect(update).not.toHaveBeenCalled();
  });

  it("c) modo_decisao NULL tratado como 'idoso': NULL -> familiar com familiar aprovado funciona", async () => {
    findUnique
      .mockResolvedValueOnce({ tipo_perfil: "idoso" })
      .mockResolvedValueOnce({ ...MODO_DECISAO_NEUTRO, modo_decisao: null });
    findFirstVinculo.mockResolvedValue({ id: 1 });
    update.mockResolvedValue({ ...MODO_DECISAO_NEUTRO, modo_decisao: "familiar" });

    const res = await patch({ modo_decisao: "familiar" });

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalled();
  });

  it("d) familiar -> idoso com 0, 1 e 2 familiares aprovados: 200 imediato, contagem de vínculos não consultada", async () => {
    for (const familiaresAprovados of [0, 1, 2]) {
      void familiaresAprovados; // contagem irrelevante: countVinculo nunca é chamado nesta direção
      findUnique.mockReset();
      update.mockReset();
      countVinculo.mockReset();
      findFirstVinculo.mockReset();
      findUnique
        .mockResolvedValueOnce({ tipo_perfil: "idoso" })
        .mockResolvedValueOnce({ ...MODO_DECISAO_NEUTRO, modo_decisao: "familiar" });
      update.mockResolvedValue({ ...MODO_DECISAO_NEUTRO, modo_decisao: "idoso" });

      const res = await patch({ modo_decisao: "idoso" });

      expect(res.status).toBe(200);
      expect(countVinculo).not.toHaveBeenCalled();
      expect(findFirstVinculo).not.toHaveBeenCalled();
    }
  });

  it("e) familiar -> idoso com motivo preenchido: motivo vira NULL", async () => {
    findUnique
      .mockResolvedValueOnce({ tipo_perfil: "idoso" })
      .mockResolvedValueOnce({ ...MODO_DECISAO_NEUTRO, modo_decisao: "familiar", modo_decisao_motivo: "Facilita o dia a dia" });
    update.mockResolvedValue({ ...MODO_DECISAO_NEUTRO, modo_decisao: "idoso" });

    const res = await patch({ modo_decisao: "idoso" });

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ modo_decisao_motivo: null }) }),
    );
  });

  it("f) valor igual ao atual, sem solicitação: 200, update não chamado", async () => {
    findUnique
      .mockResolvedValueOnce({ tipo_perfil: "idoso" })
      .mockResolvedValueOnce({ ...MODO_DECISAO_NEUTRO, modo_decisao: "idoso" });

    const res = await patch({ modo_decisao: "idoso" });

    expect(res.status).toBe(200);
    expect(update).not.toHaveBeenCalled();
    expect(res.body.modo_decisao).toBe("idoso");
  });

  it("g) valor igual ao atual, com solicitação em curso: 200, 6 campos a NULL, modo_decisao/alterado_* fora do data", async () => {
    findUnique.mockResolvedValueOnce({ tipo_perfil: "idoso" }).mockResolvedValueOnce({
      ...MODO_DECISAO_NEUTRO,
      modo_decisao: "idoso",
      modo_decisao_solicitado: "familiar",
      modo_decisao_solicitado_por_id: 7,
      modo_decisao_solicitado_em: new Date(),
      modo_decisao_expira_em: new Date(Date.now() + 100000),
    });
    update.mockResolvedValue({ ...MODO_DECISAO_NEUTRO, modo_decisao: "idoso" });

    const res = await patch({ modo_decisao: "idoso" });

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      where: { id: 42 },
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

  it("h) idoso -> familiar com solicitação em curso de outro familiar: muda e limpa os 6 campos no mesmo update", async () => {
    findUnique.mockResolvedValueOnce({ tipo_perfil: "idoso" }).mockResolvedValueOnce({
      ...MODO_DECISAO_NEUTRO,
      modo_decisao: "idoso",
      modo_decisao_solicitado: "familiar",
      modo_decisao_solicitado_por_id: 7,
      modo_decisao_expira_em: new Date(Date.now() + 100000),
    });
    findFirstVinculo.mockResolvedValue({ id: 5 });
    update.mockResolvedValue({ ...MODO_DECISAO_NEUTRO, modo_decisao: "familiar" });

    const res = await patch({ modo_decisao: "familiar" });

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: {
        modo_decisao: "familiar",
        modo_decisao_alterado_por_id: 42,
        modo_decisao_alterado_em: expect.any(Date),
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

  it("i) solicitação vencida efetivada pra 'familiar' antes de o idoso pedir 'idoso': resultado final 'idoso', alterado_por_id do idoso", async () => {
    findUnique.mockResolvedValueOnce({ tipo_perfil: "idoso" }).mockResolvedValueOnce({
      modo_decisao: "idoso",
      modo_decisao_solicitado: "familiar",
      modo_decisao_solicitado_por_id: 7,
      modo_decisao_solicitado_em: new Date(Date.now() - 200000),
      modo_decisao_expira_em: new Date(Date.now() - 1000),
      modo_decisao_segunda_confirmacao_id: null,
      modo_decisao_alterado_por_id: null,
      modo_decisao_alterado_em: null,
      modo_decisao_motivo: null,
    });
    countVinculo.mockResolvedValue(1); // 1 familiar aprovado: não exige 2ª confirmação
    update
      .mockResolvedValueOnce({
        // efetivação feita por resolverEstadoModoDecisao (routes/vinculo.ts)
        modo_decisao: "familiar",
        modo_decisao_alterado_por_id: 7,
        modo_decisao_alterado_em: new Date(),
        modo_decisao_solicitado: null,
        modo_decisao_solicitado_por_id: null,
        modo_decisao_solicitado_em: null,
        modo_decisao_expira_em: null,
        modo_decisao_segunda_confirmacao_id: null,
        modo_decisao_motivo: null,
      })
      .mockResolvedValueOnce({
        // update feito pela rota desta tarefa
        modo_decisao: "idoso",
        modo_decisao_alterado_por_id: 42,
        modo_decisao_alterado_em: new Date(),
        modo_decisao_solicitado: null,
        modo_decisao_solicitado_por_id: null,
        modo_decisao_solicitado_em: null,
        modo_decisao_expira_em: null,
        modo_decisao_segunda_confirmacao_id: null,
        modo_decisao_motivo: null,
      });

    const res = await patch({ modo_decisao: "idoso" });

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledTimes(2);
    expect(findFirstVinculo).not.toHaveBeenCalled();
    expect(res.body.modo_decisao).toBe("idoso");
    expect(res.body.modo_decisao_alterado_por_id).toBe(42);
  });

  it("j) cuidador chamando: 403, sem update", async () => {
    findUnique.mockResolvedValueOnce({ tipo_perfil: "cuidador" });

    const res = await patch({ modo_decisao: "familiar" });

    expect(res.status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it("j) familiar chamando: 403, sem update", async () => {
    findUnique.mockResolvedValueOnce({ tipo_perfil: "familiar" });

    const res = await patch({ modo_decisao: "idoso" });

    expect(res.status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it.each([[undefined], ["admin"], [123], [null]])(
    "k) valor de body inválido (%p) recebe 400",
    async (valor) => {
      findUnique.mockResolvedValueOnce({ tipo_perfil: "idoso" });

      const res = await patch(valor === undefined ? {} : { modo_decisao: valor });

      expect(res.status).toBe(400);
      expect(update).not.toHaveBeenCalled();
    },
  );

  it("l) id/idoso_id no body são ignorados, update usa req.usuarioId", async () => {
    findUnique
      .mockResolvedValueOnce({ tipo_perfil: "idoso" })
      .mockResolvedValueOnce({ ...MODO_DECISAO_NEUTRO, modo_decisao: "idoso" });
    findFirstVinculo.mockResolvedValue({ id: 1 });
    update.mockResolvedValue({ ...MODO_DECISAO_NEUTRO, modo_decisao: "familiar" });

    const res = await patch({ modo_decisao: "familiar", id: 999, idoso_id: 999 });

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 42 } }));
  });
});

describe("POST /usuario/cadastrar-idoso (RF-030)", () => {
  const BODY_OK = { nome: "Dona Maria", email: "maria@a.com", aceita_termo_responsabilidade: true };
  const CRIADO = {
    id: 99,
    nome: "Dona Maria",
    email: "maria@a.com",
    telefone: null,
    tipo_perfil: "idoso",
    firebase_uid: null,
    modo_decisao: "familiar",
    vinculos_como_idoso: [{ id: 7, status: "pendente", origem: "cadastro_familiar" }],
  };

  function post(body: unknown) {
    return request(buildApp())
      .post("/usuario/cadastrar-idoso")
      .set("Authorization", "Bearer x")
      .send(body as object);
  }

  beforeEach(() => {
    verifyIdToken.mockReset();
    findFirst.mockReset();
    findUnique.mockReset();
    createUsuario.mockReset();
    verifyIdToken.mockResolvedValue({ uid: "uid-42", email_verified: false });
    findFirst.mockResolvedValue(USUARIO_LOGADO);
    findUnique.mockResolvedValue({ tipo_perfil: "familiar" });
    createUsuario.mockResolvedValue(CRIADO);
  });

  it("401 sem token", async () => {
    const res = await request(buildApp()).post("/usuario/cadastrar-idoso").send(BODY_OK);
    expect(res.status).toBe(401);
  });

  it("familiar com e-mail NÃO verificado: 201 e vínculo pendente sem confirmado_em", async () => {
    const res = await post(BODY_OK);

    expect(res.status).toBe(201);
    const arg = createUsuario.mock.calls[0][0];
    expect(arg.data).toMatchObject({
      nome: "Dona Maria",
      email: "maria@a.com",
      tipo_perfil: "idoso",
      cadastrado_por_id: 42,
      modo_decisao: "familiar",
    });
    expect(arg.data.firebase_uid).toBeUndefined();
    expect(arg.data.modo_decisao_alterado_por_id).toBeUndefined();
    expect(arg.data.modo_decisao_alterado_em).toBeUndefined();
    expect(arg.data.vinculos_como_idoso.create).toMatchObject({
      vinculado_id: 42,
      tipo_vinculo: "familiar",
      origem: "cadastro_familiar",
      status: "pendente",
      data_solicitacao: expect.any(Date),
    });
    expect(arg.data.vinculos_como_idoso.create.confirmado_em).toBeUndefined();
    expect(arg.data.vinculos_como_idoso.create.aprovador_id).toBeUndefined();
    expect(arg.data.vinculos_como_idoso.create.notificado_em).toBeUndefined();
  });

  it("resposta 201 tem só os campos de D8 (sem firebase_uid nem campos de decisão)", async () => {
    const res = await post(BODY_OK);

    expect(res.body).toEqual({
      usuario: { id: 99, nome: "Dona Maria", email: "maria@a.com", telefone: null, tipo_perfil: "idoso" },
      vinculo: { id: 7, status: "pendente", origem: "cadastro_familiar" },
    });
  });

  it("familiar com e-mail verificado: vínculo aprovado com confirmado_em", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-42", email_verified: true });

    const res = await post(BODY_OK);

    expect(res.status).toBe(201);
    expect(createUsuario.mock.calls[0][0].data.vinculos_como_idoso.create).toMatchObject({
      status: "aprovado",
      confirmado_em: expect.any(Date),
    });
  });

  it("timestamp do aceite é gerado pelo servidor", async () => {
    const antes = Date.now();
    await post({ ...BODY_OK, termo_responsabilidade_aceito_em: "2000-01-01T00:00:00Z" });
    const ts: Date = createUsuario.mock.calls[0][0].data.termo_responsabilidade_aceito_em;

    expect(ts).toBeInstanceOf(Date);
    expect(ts.getTime()).toBeGreaterThanOrEqual(antes);
  });

  it("campos proibidos no body são ignorados", async () => {
    await post({
      ...BODY_OK,
      tipo_perfil: "familiar",
      cadastrado_por_id: 1,
      firebase_uid: "x",
      modo_decisao: "idoso",
      email_convite_familiar: "o@o.com",
    });
    const data = createUsuario.mock.calls[0][0].data;

    expect(data.tipo_perfil).toBe("idoso");
    expect(data.cadastrado_por_id).toBe(42);
    expect(data.firebase_uid).toBeUndefined();
    expect(data.modo_decisao).toBe("familiar");
    expect(data.email_convite_familiar).toBeUndefined();
  });

  it("201 só com telefone", async () => {
    const res = await post({ nome: "Seu José", telefone: " 11999990000 ", aceita_termo_responsabilidade: true });

    expect(res.status).toBe(201);
    const data = createUsuario.mock.calls[0][0].data;
    expect(data.telefone).toBe("11999990000");
    expect(data.email).toBeUndefined();
  });

  it.each(["idoso", "cuidador"])("403 para %s", async (perfil) => {
    findUnique.mockResolvedValue({ tipo_perfil: perfil });

    const res = await post(BODY_OK);

    expect(res.status).toBe(403);
    expect(createUsuario).not.toHaveBeenCalled();
  });

  it.each([
    ["ausente", undefined],
    ["false", false],
    ['string "true"', "true"],
  ])("400 sem aceite (%s)", async (_rotulo, valor) => {
    const res = await post({ nome: "Ana", email: "a@a.com", aceita_termo_responsabilidade: valor });

    expect(res.status).toBe(400);
    expect(createUsuario).not.toHaveBeenCalled();
  });

  it.each([
    ["sem nome", { email: "a@a.com" }],
    ["nome só espaços", { nome: "   ", email: "a@a.com" }],
    ["nome acima de 150", { nome: "x".repeat(151), email: "a@a.com" }],
    ["sem e-mail e sem telefone", { nome: "Ana" }],
    ["e-mail e telefone só espaços", { nome: "Ana", email: " ", telefone: " " }],
    ["e-mail inválido", { nome: "Ana", email: "nao-e-email" }],
    ["e-mail acima de 255", { nome: "Ana", email: `${"a".repeat(250)}@a.com` }],
    ["telefone acima de 20", { nome: "Ana", telefone: "1".repeat(21) }],
  ])("400: %s", async (_rotulo, corpo) => {
    const res = await post({ ...corpo, aceita_termo_responsabilidade: true });

    expect(res.status).toBe(400);
    expect(createUsuario).not.toHaveBeenCalled();
  });

  it("409 e-mail duplicado: mensagem genérica sem dado de terceiro e sem segunda escrita", async () => {
    createUsuario.mockRejectedValue(new Error("Violation of UNIQUE KEY constraint 'Usuario_email_key'"));

    const res = await post(BODY_OK);

    expect(res.status).toBe(409);
    expect(JSON.stringify(res.body)).not.toContain("maria@a.com");
    expect(createUsuario).toHaveBeenCalledTimes(1);
  });

  it("erro não relacionado a e-mail duplicado vai pro errorHandler (500)", async () => {
    createUsuario.mockRejectedValue(new Error("boom"));

    const res = await post(BODY_OK);

    expect(res.status).toBe(500);
  });
});
