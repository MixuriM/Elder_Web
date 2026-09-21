import express from "express";
import request from "supertest";

const verifyIdToken = jest.fn();
const findFirst = jest.fn();
const findManyUsuario = jest.fn();
const create = jest.fn();
const updateUsuario = jest.fn();
const createVinculo = jest.fn();
const updateManyVinculo = jest.fn();

jest.mock("../lib/firebaseAdmin", () => ({
  auth: {
    verifyIdToken: (...args: unknown[]) => verifyIdToken(...args),
  },
}));
jest.mock("../lib/prisma", () => ({
  prisma: {
    usuario: {
      findFirst: (...args: unknown[]) => findFirst(...args),
      findMany: (...args: unknown[]) => findManyUsuario(...args),
      create: (...args: unknown[]) => create(...args),
      update: (...args: unknown[]) => updateUsuario(...args),
    },
    vinculo: {
      create: (...args: unknown[]) => createVinculo(...args),
      updateMany: (...args: unknown[]) => updateManyVinculo(...args),
    },
  },
}));

import authRouter from "./auth";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/auth", authRouter);
  app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: "Erro interno." });
  });
  return app;
}

describe("POST /auth/sync — email_convite_familiar (RF-024)", () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
    findFirst.mockReset();
    create.mockReset();
    verifyIdToken.mockResolvedValue({ uid: "uid-novo", email: "idoso@a.com" });
    findFirst.mockResolvedValue(null); // cadastro, não login
  });

  it("idoso com email_convite_familiar preenchido: persiste o campo", async () => {
    create.mockResolvedValue({ id: 1, tipo_perfil: "idoso", email_convite_familiar: "familiar@a.com" });

    const res = await request(buildApp())
      .post("/auth/sync")
      .set("Authorization", "Bearer x")
      .send({ tipo_perfil: "idoso", nome: "Ana", email_convite_familiar: "familiar@a.com" });

    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email_convite_familiar: "familiar@a.com" }),
      })
    );
  });

  it("idoso sem email_convite_familiar: campo não é enviado ao Prisma", async () => {
    create.mockResolvedValue({ id: 1, tipo_perfil: "idoso" });

    const res = await request(buildApp())
      .post("/auth/sync")
      .set("Authorization", "Bearer x")
      .send({ tipo_perfil: "idoso", nome: "Ana" });

    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email_convite_familiar: undefined }),
      })
    );
  });

  it("cuidador mandando email_convite_familiar: retorna 400 e não chega a criar", async () => {
    const res = await request(buildApp())
      .post("/auth/sync")
      .set("Authorization", "Bearer x")
      .send({ tipo_perfil: "cuidador", nome: "João", email_convite_familiar: "familiar@a.com" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email_convite_familiar/i);
    expect(create).not.toHaveBeenCalled();
  });

  it("familiar mandando email_convite_familiar: retorna 400 e não chega a criar", async () => {
    const res = await request(buildApp())
      .post("/auth/sync")
      .set("Authorization", "Bearer x")
      .send({ tipo_perfil: "familiar", nome: "Carla", email_convite_familiar: "familiar@a.com" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email_convite_familiar/i);
    expect(create).not.toHaveBeenCalled();
  });

  it("idoso com email_convite_familiar em formato inválido: retorna 400", async () => {
    const res = await request(buildApp())
      .post("/auth/sync")
      .set("Authorization", "Bearer x")
      .send({ tipo_perfil: "idoso", nome: "Ana", email_convite_familiar: "nao-e-email" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/formato inválido/i);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("POST /auth/sync — vínculo automático Familiar↔Idoso (RF-025)", () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
    findFirst.mockReset();
    findManyUsuario.mockReset();
    create.mockReset();
    updateUsuario.mockReset();
    createVinculo.mockReset();
    updateManyVinculo.mockReset();
    createVinculo.mockResolvedValue({ id: 999 });
    updateManyVinculo.mockResolvedValue({ count: 0 });
    updateUsuario.mockImplementation((args: { where: { id: number }; data: Record<string, unknown> }) => ({
      id: args.where.id,
      ...args.data,
    }));
  });

  it("cadastro de familiar com e-mail correspondente cria Vinculo pendente", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-fam", email: "familiar@a.com", email_verified: false });
    findFirst.mockResolvedValueOnce(null); // não é login
    create.mockResolvedValue({ id: 10, tipo_perfil: "familiar" });
    findManyUsuario.mockResolvedValue([{ id: 1 }]);

    const res = await request(buildApp())
      .post("/auth/sync")
      .set("Authorization", "Bearer x")
      .send({ tipo_perfil: "familiar", nome: "Carla" });

    expect(res.status).toBe(201);
    expect(findManyUsuario).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tipo_perfil: "idoso", email_convite_familiar: "familiar@a.com" } })
    );
    expect(createVinculo).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          idoso_id: 1,
          vinculado_id: 10,
          tipo_vinculo: "familiar",
          origem: "convite_idoso",
          status: "pendente",
        }),
      })
    );
  });

  it("cadastro de familiar já com email_verified=true cria Vinculo direto aprovado", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-fam", email: "familiar@a.com", email_verified: true });
    findFirst.mockResolvedValueOnce(null);
    create.mockResolvedValue({ id: 10, tipo_perfil: "familiar" });
    findManyUsuario.mockResolvedValue([{ id: 1 }]);

    const res = await request(buildApp())
      .post("/auth/sync")
      .set("Authorization", "Bearer x")
      .send({ tipo_perfil: "familiar", nome: "Carla" });

    expect(res.status).toBe(201);
    expect(createVinculo).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "aprovado", confirmado_em: expect.any(Date) }),
      })
    );
  });

  it("cadastro de familiar sem e-mail correspondente não cria nada", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-fam", email: "familiar@a.com", email_verified: false });
    findFirst.mockResolvedValueOnce(null);
    create.mockResolvedValue({ id: 10, tipo_perfil: "familiar" });
    findManyUsuario.mockResolvedValue([]);

    const res = await request(buildApp())
      .post("/auth/sync")
      .set("Authorization", "Bearer x")
      .send({ tipo_perfil: "familiar", nome: "Carla" });

    expect(res.status).toBe(201);
    expect(createVinculo).not.toHaveBeenCalled();
  });

  it("e-mail correspondendo a mais de um idoso cria um Vinculo por idoso", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-fam", email: "familiar@a.com", email_verified: false });
    findFirst.mockResolvedValueOnce(null);
    create.mockResolvedValue({ id: 10, tipo_perfil: "familiar" });
    findManyUsuario.mockResolvedValue([{ id: 1 }, { id: 2 }]);

    const res = await request(buildApp())
      .post("/auth/sync")
      .set("Authorization", "Bearer x")
      .send({ tipo_perfil: "familiar", nome: "Carla" });

    expect(res.status).toBe(201);
    expect(createVinculo).toHaveBeenCalledTimes(2);
  });

  it("cadastro de idoso com email_convite_familiar batendo familiar existente cria Vinculo pendente", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-idoso", email: "idoso@a.com", email_verified: false });
    findFirst
      .mockResolvedValueOnce(null) // não é login
      .mockResolvedValueOnce(null) // pré-checagem de e-mail (3.2): e-mail livre
      .mockResolvedValueOnce({ id: 20 }); // familiar encontrado pelo e-mail
    create.mockResolvedValue({ id: 1, tipo_perfil: "idoso" });

    const res = await request(buildApp())
      .post("/auth/sync")
      .set("Authorization", "Bearer x")
      .send({ tipo_perfil: "idoso", nome: "Ana", email_convite_familiar: "familiar@a.com" });

    expect(res.status).toBe(201);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tipo_perfil: "familiar", email: "familiar@a.com" } })
    );
    expect(createVinculo).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          idoso_id: 1,
          vinculado_id: 20,
          tipo_vinculo: "familiar",
          origem: "convite_idoso",
          status: "pendente",
        }),
      })
    );
  });

  it("cadastro de idoso com email_convite_familiar sem familiar correspondente não cria nada", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-idoso", email: "idoso@a.com", email_verified: false });
    findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    create.mockResolvedValue({ id: 1, tipo_perfil: "idoso" });

    const res = await request(buildApp())
      .post("/auth/sync")
      .set("Authorization", "Bearer x")
      .send({ tipo_perfil: "idoso", nome: "Ana", email_convite_familiar: "familiar@a.com" });

    expect(res.status).toBe(201);
    expect(createVinculo).not.toHaveBeenCalled();
  });

  it("login de familiar com email_verified=true promove vínculos pendentes a aprovado", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-fam", email: "familiar@a.com", email_verified: true });
    findFirst.mockResolvedValueOnce({ id: 10, tipo_perfil: "familiar" });

    const res = await request(buildApp()).post("/auth/sync").set("Authorization", "Bearer x").send({});

    expect(res.status).toBe(200);
    expect(updateManyVinculo).toHaveBeenCalledWith({
      where: {
        vinculado_id: 10,
        tipo_vinculo: "familiar",
        origem: { in: ["convite_idoso", "cadastro_familiar"] },
        status: "pendente",
      },
      data: { status: "aprovado", confirmado_em: expect.any(Date) },
    });
  });

  it("login de familiar promove só origens da lista (convite_idoso, cadastro_familiar), nunca solicitacao_familiar", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-fam", email: "familiar@a.com", email_verified: true });
    findFirst.mockResolvedValueOnce({ id: 10, tipo_perfil: "familiar" });

    await request(buildApp()).post("/auth/sync").set("Authorization", "Bearer x").send({});

    const origem = updateManyVinculo.mock.calls[0][0].where.origem;
    expect(origem).toEqual({ in: ["convite_idoso", "cadastro_familiar"] });
    expect(origem.in).not.toContain("solicitacao_familiar");
  });

  it("login de familiar com vínculo contestado ('recusado') não o reativa (RF-022)", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-fam", email: "familiar@a.com", email_verified: true });
    findFirst.mockResolvedValueOnce({ id: 10, tipo_perfil: "familiar" });
    updateManyVinculo.mockResolvedValue({ count: 0 });

    const res = await request(buildApp()).post("/auth/sync").set("Authorization", "Bearer x").send({});

    expect(res.status).toBe(200);
    // O updateMany só alcança linhas 'pendente': um vínculo 'recusado' fica fora do where.
    const arg = updateManyVinculo.mock.calls[0][0];
    expect(arg.where.status).toBe("pendente");
    expect(arg.data.status).toBe("aprovado");
  });

  it("login de familiar com email_verified=false não promove nada", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-fam", email: "familiar@a.com", email_verified: false });
    findFirst.mockResolvedValueOnce({ id: 10, tipo_perfil: "familiar" });

    const res = await request(buildApp()).post("/auth/sync").set("Authorization", "Bearer x").send({});

    expect(res.status).toBe(200);
    expect(updateManyVinculo).not.toHaveBeenCalled();
  });

  it("login de familiar sem vínculo pendente não quebra", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-fam", email: "familiar@a.com", email_verified: true });
    findFirst.mockResolvedValueOnce({ id: 10, tipo_perfil: "familiar" });
    updateManyVinculo.mockResolvedValue({ count: 0 });

    const res = await request(buildApp()).post("/auth/sync").set("Authorization", "Bearer x").send({});

    expect(res.status).toBe(200);
  });

  it("login repetido não duplica nem falha", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-fam", email: "familiar@a.com", email_verified: true });
    findFirst.mockResolvedValue({ id: 10, tipo_perfil: "familiar" });

    const app = buildApp();
    const res1 = await request(app).post("/auth/sync").set("Authorization", "Bearer x").send({});
    const res2 = await request(app).post("/auth/sync").set("Authorization", "Bearer x").send({});

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(updateManyVinculo).toHaveBeenCalledTimes(2);
  });

  it("login de idoso ou cuidador não tenta promover vínculo", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-idoso", email: "idoso@a.com", email_verified: true });
    findFirst.mockResolvedValueOnce({ id: 1, tipo_perfil: "idoso" });

    const res = await request(buildApp()).post("/auth/sync").set("Authorization", "Bearer x").send({});

    expect(res.status).toBe(200);
    expect(updateManyVinculo).not.toHaveBeenCalled();
  });
});

describe("POST /auth/sync — login sempre cancela transferência de modo_decisao em curso (RF-033)", () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
    findFirst.mockReset();
    updateUsuario.mockReset();
    updateUsuario.mockImplementation((args: { where: { id: number }; data: Record<string, unknown> }) => ({
      id: args.where.id,
      ...args.data,
    }));
  });

  it("login do idoso com solicitação pendente cancela os 4 campos e registra ultimo_login_em", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-idoso" });
    findFirst.mockResolvedValueOnce({
      id: 1,
      tipo_perfil: "idoso",
      modo_decisao_solicitado: "familiar",
    });

    const res = await request(buildApp()).post("/auth/sync").set("Authorization", "Bearer x").send({});

    expect(res.status).toBe(200);
    expect(updateUsuario).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        ultimo_login_em: expect.any(Date),
        modo_decisao_solicitado: null,
        modo_decisao_solicitado_por_id: null,
        modo_decisao_solicitado_em: null,
        modo_decisao_expira_em: null,
        modo_decisao_segunda_confirmacao_id: null,
        modo_decisao_motivo: null,
      },
    });
  });

  it("login do idoso sem solicitação pendente só registra ultimo_login_em", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-idoso" });
    findFirst.mockResolvedValueOnce({ id: 1, tipo_perfil: "idoso", modo_decisao_solicitado: null });

    const res = await request(buildApp()).post("/auth/sync").set("Authorization", "Bearer x").send({});

    expect(res.status).toBe(200);
    expect(updateUsuario).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { ultimo_login_em: expect.any(Date) },
    });
  });

  it("login de conta não-idoso nunca cancela modo_decisao_solicitado (guard é por tipo_perfil='idoso')", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-familiar", email_verified: false });
    findFirst.mockResolvedValueOnce({
      id: 10,
      tipo_perfil: "familiar",
      modo_decisao_solicitado: "familiar",
    });

    const res = await request(buildApp()).post("/auth/sync").set("Authorization", "Bearer x").send({});

    expect(res.status).toBe(200);
    expect(updateUsuario).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { ultimo_login_em: expect.any(Date) },
    });
  });
});

// Item 3.2 (RNF-011) — conflito 2: cadastro cujo e-mail já existe em Usuario.
// Nomes/e-mails abaixo são FIXTURES de teste.
describe("POST /auth/sync — conflito de e-mail no cadastro (3.2)", () => {
  const TOKEN_BASE = { uid: "uid-novo", email: "conflito-fixture@x.com", email_verified: true };
  const LINHA_DO_FAMILIAR = { id: 55, firebase_uid: null, cadastrado_por_id: 9 };
  const LINHA_COMUM = { id: 56, firebase_uid: "uid-outro", cadastrado_por_id: null };
  let linhaPorEmail: unknown;

  function sync(body: object) {
    return request(buildApp()).post("/auth/sync").set("Authorization", "Bearer x").send(body);
  }

  function semDados(corpo: unknown) {
    const s = JSON.stringify(corpo);
    for (const proibido of ["conflito-fixture@x.com", "FIXTURE", "55", "56", "9", "uid-outro"]) {
      // "9"/"55"/"56" só como valor numérico solto; codigo/texto não têm dígitos
      expect(s).not.toContain(proibido);
    }
  }

  beforeEach(() => {
    verifyIdToken.mockReset();
    findFirst.mockReset();
    create.mockReset();
    verifyIdToken.mockResolvedValue(TOKEN_BASE);
    linhaPorEmail = null;
    findFirst.mockImplementation((args: { where: { email?: string; firebase_uid?: string } }) =>
      Promise.resolve(args.where.email !== undefined ? linhaPorEmail : null)
    );
    create.mockResolvedValue({ id: 1, tipo_perfil: "idoso" });
  });

  it("email_verified + idoso + linha cadastrada por familiar sem firebase_uid: 409 EMAIL_CADASTRADO_POR_FAMILIAR", async () => {
    linhaPorEmail = LINHA_DO_FAMILIAR;

    const res = await sync({ tipo_perfil: "idoso", nome: "Ana" });

    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe("EMAIL_CADASTRADO_POR_FAMILIAR");
    expect(res.body.proximo_passo).toEqual(expect.any(String));
    expect(Object.keys(res.body).sort()).toEqual(["codigo", "error", "proximo_passo"]);
    expect(create).not.toHaveBeenCalled();
    semDados(res.body);
  });

  it("pré-checagem seleciona só id, firebase_uid e cadastrado_por_id", async () => {
    await sync({ tipo_perfil: "idoso", nome: "Ana" });

    expect(findFirst).toHaveBeenCalledWith({
      where: { email: "conflito-fixture@x.com" },
      select: { id: true, firebase_uid: true, cadastrado_por_id: true },
    });
  });

  it("email_verified=false com a MESMA linha: 409 EMAIL_JA_EM_USO, corpo igual ao da linha comum", async () => {
    verifyIdToken.mockResolvedValue({ ...TOKEN_BASE, email_verified: false });
    linhaPorEmail = LINHA_DO_FAMILIAR;
    const daLinhaDoFamiliar = await sync({ tipo_perfil: "idoso", nome: "Ana" });
    linhaPorEmail = LINHA_COMUM;
    const daLinhaComum = await sync({ tipo_perfil: "idoso", nome: "Ana" });

    expect(daLinhaDoFamiliar.status).toBe(409);
    expect(daLinhaDoFamiliar.body.codigo).toBe("EMAIL_JA_EM_USO");
    expect(daLinhaDoFamiliar.status).toBe(daLinhaComum.status);
    expect(daLinhaDoFamiliar.body).toEqual(daLinhaComum.body);
    expect(create).not.toHaveBeenCalled();
    semDados(daLinhaDoFamiliar.body);
  });

  it.each(["cuidador", "familiar"])(
    "email_verified + %s + linha cadastrada por familiar: 409 EMAIL_JA_EM_USO genérico",
    async (perfil) => {
      linhaPorEmail = LINHA_DO_FAMILIAR;

      const res = await sync({ tipo_perfil: perfil, nome: "João" });

      expect(res.status).toBe(409);
      expect(res.body.codigo).toBe("EMAIL_JA_EM_USO");
      expect(create).not.toHaveBeenCalled();
    }
  );

  it("email_verified + idoso + linha com firebase_uid preenchido: 409 EMAIL_JA_EM_USO", async () => {
    linhaPorEmail = LINHA_COMUM;

    const res = await sync({ tipo_perfil: "idoso", nome: "Ana" });

    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe("EMAIL_JA_EM_USO");
    expect(create).not.toHaveBeenCalled();
    semDados(res.body);
  });

  it("token sem e-mail (só telefone): pré-checagem pulada e criação segue", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-novo", phone_number: "+5511999990000" });

    const res = await sync({ tipo_perfil: "idoso", nome: "Ana" });

    expect(res.status).toBe(201);
    expect(findFirst.mock.calls.some((c) => c[0].where.email !== undefined)).toBe(false);
  });

  it("corrida: create rejeita com duplicidade e firebase_uid não acha: 409 EMAIL_JA_EM_USO, não 500", async () => {
    create.mockRejectedValue(new Error("Violation of UNIQUE KEY constraint 'Usuario_email_key'"));

    const res = await sync({ tipo_perfil: "idoso", nome: "Ana" });

    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe("EMAIL_JA_EM_USO");
    semDados(res.body);
  });

  it("corrida do mesmo firebase_uid: se a busca por firebase_uid acha, continua 200", async () => {
    create.mockRejectedValue(new Error("Violation of UNIQUE KEY constraint 'Usuario_firebase_uid_key'"));
    findFirst.mockImplementation((args: { where: { email?: string; firebase_uid?: string } }) =>
      Promise.resolve(args.where.firebase_uid !== undefined && args.where.email === undefined && create.mock.calls.length > 0 ? { id: 1 } : null)
    );

    const res = await sync({ tipo_perfil: "idoso", nome: "Ana" });

    expect(res.status).toBe(200);
    expect(res.body.criado).toBe(false);
  });

  it("login de usuário existente (firebase_uid) não passa pela pré-checagem de e-mail", async () => {
    updateUsuario.mockResolvedValue({ id: 3 });
    findFirst.mockImplementation((args: { where: { email?: string; firebase_uid?: string } }) =>
      Promise.resolve(args.where.firebase_uid !== undefined ? { id: 3, tipo_perfil: "idoso", modo_decisao_solicitado: null } : LINHA_COMUM)
    );

    const res = await sync({});

    expect(res.status).toBe(200);
    expect(findFirst.mock.calls.some((c) => c[0].where.email !== undefined)).toBe(false);
  });
});
