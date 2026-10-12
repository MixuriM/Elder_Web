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
const updateManyVinculo = jest.fn();
const transaction = jest.fn();

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
      updateMany: (...args: unknown[]) => updateManyVinculo(...args),
    },
    $transaction: (...args: unknown[]) => transaction(...args),
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
        modo_decisao_solicitado_em: new Date(Date.now() - 86400000),
        modo_decisao_expira_em: new Date(Date.now() + 6 * 86400000),
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
    updateManyVinculo.mockReset();
    transaction.mockReset();
    transaction.mockImplementation((operacoes: unknown[]) => Promise.all(operacoes));
    verifyIdToken.mockResolvedValue({ uid: "uid-42" });
    // findFirst é compartilhado entre requireAuth (por firebase_uid) e a checagem de e-mail em uso: este fake filtra de
    // verdade pelo where (e-mail sem diferenciar caixa, como o SQL Server; exclui o id em NOT), senão os testes de
    // duplicidade passariam por vacuidade. Contas do banco: a logada (42) e a de outra pessoa (7).
    const contas = [
      { id: 42, email: "a@a.com" },
      { id: 7, email: "ocupado@a.com" },
    ];
    findFirst.mockImplementation((args: { where: { email?: string; id?: { not?: number } } }) => {
      const { email, id } = args.where;
      if (email === undefined) return Promise.resolve(USUARIO_LOGADO);
      const achada = contas.find((c) => c.email.toLowerCase() === email.toLowerCase() && c.id !== id?.not);
      return Promise.resolve(achada ? { id: achada.id } : null);
    });
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
    // O e-mail novo ainda não foi provado: a verificação do antigo não vale para ele (senão dava para verificar o
    // e-mail A, trocar para o e-mail B de outra pessoa e aceitar um convite feito a B com a verificação velha).
    expect(updateUser).toHaveBeenCalledTimes(1);
    expect(updateUser).toHaveBeenCalledWith("uid-42", { email: "novo@a.com", emailVerified: false });
    expect(res.body.email).toBe("novo@a.com");
  });

  it("e-mail novo com espaços: manda ao Firebase o valor sem espaços e emailVerified false", async () => {
    findUniqueOrThrow.mockResolvedValue({ email: "a@a.com", telefone: "123", firebase_uid: "uid-42" });
    updateUser.mockResolvedValue(undefined);
    update.mockResolvedValue({ id: 42, nome: "Ana", email: "novo@a.com", telefone: "123", tipo_perfil: "idoso" });

    await request(buildApp()).patch("/usuario/me").set("Authorization", "Bearer x").send({ email: "  novo@a.com  " });

    expect(updateUser).toHaveBeenCalledWith("uid-42", { email: "novo@a.com", emailVerified: false });
  });

  it("e-mail igual ao atual: não chama o Firebase (a verificação existente continua valendo)", async () => {
    findUniqueOrThrow.mockResolvedValue({ email: "a@a.com", telefone: "123", firebase_uid: "uid-42" });
    update.mockResolvedValue({ id: 42, nome: "Ana", email: "a@a.com", telefone: "123", tipo_perfil: "idoso" });

    const res = await request(buildApp()).patch("/usuario/me").set("Authorization", "Bearer x").send({ email: "a@a.com" });

    expect(res.status).toBe(200);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("e-mail apagado (com telefone preenchido): nunca manda emailVerified ao Firebase", async () => {
    findUniqueOrThrow.mockResolvedValue({ email: "a@a.com", telefone: "123", firebase_uid: "uid-42" });
    updateUser.mockResolvedValue(undefined);
    update.mockResolvedValue({ id: 42, nome: "Ana", email: null, telefone: "123", tipo_perfil: "idoso" });

    const res = await request(buildApp()).patch("/usuario/me").set("Authorization", "Bearer x").send({ email: "" });

    expect(res.status).toBe(200);
    updateUser.mock.calls.forEach(([, propriedades]) => expect(propriedades).not.toHaveProperty("emailVerified"));
  });

  // A2: formato e unicidade no banco são checados ANTES do Firebase; o mesmo 409 e o mesmo 400 valem quando é o Firebase
  // que acusa o problema, para a resposta não revelar em qual dos dois sistemas o e-mail existe.
  describe("e-mail novo: validação antes do Firebase", () => {
    const MSG_EM_USO = "Este e-mail já está em uso por outra conta.";
    const MSG_INVALIDO = "E-mail inválido.";

    function patchEmail(email: string) {
      return request(buildApp()).patch("/usuario/me").set("Authorization", "Bearer x").send({ email });
    }

    beforeEach(() => {
      findUniqueOrThrow.mockResolvedValue({ email: "a@a.com", telefone: "123", firebase_uid: "uid-42" });
      updateUser.mockResolvedValue(undefined);
      update.mockResolvedValue({ id: 42, nome: "Ana", email: "novo@a.com", telefone: "123", tipo_perfil: "idoso" });
    });

    it.each([
      ["sem arroba", "sem-arroba"],
      ["sem domínio", "a@"],
      ["com espaço no meio", "a b@a.com"],
      ["acima de 255 caracteres", `${"a".repeat(250)}@a.com`],
    ])("e-mail %s: 400 sem chamar o Firebase nem o banco", async (_nome, email) => {
      const res = await patchEmail(email);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: MSG_INVALIDO });
      expect(updateUser).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    });

    it("e-mail de outra conta: 409 sem chamar o Firebase nem o banco, sem eco do e-mail", async () => {
      const res = await patchEmail("ocupado@a.com");

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: MSG_EM_USO });
      expect(updateUser).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    });

    it("e-mail de outra conta com caixa diferente: 409 também", async () => {
      const res = await patchEmail("OCUPADO@a.com");

      expect(res.status).toBe(409);
      expect(updateUser).not.toHaveBeenCalled();
    });

    it("a checagem de duplicidade lê só o id e exclui a própria conta", async () => {
      await patchEmail("novo@a.com");

      const chamada = findFirst.mock.calls.find((c) => c[0].where.email !== undefined);
      expect(chamada?.[0]).toEqual({ where: { email: "novo@a.com", id: { not: 42 } }, select: { id: true } });
    });

    it("o próprio e-mail em outra caixa não conta como duplicado: 200, grava como digitado, sem tocar no Firebase", async () => {
      const res = await patchEmail("A@A.com");

      expect(res.status).toBe(200);
      expect(update.mock.calls[0][0].data).toEqual({ email: "A@A.com" });
      expect(updateUser).not.toHaveBeenCalled();
    });

    it("e-mail igual ao atual não é revalidado (cadastro antigo fora do formato não trava o perfil)", async () => {
      findUniqueOrThrow.mockResolvedValue({ email: "legado", telefone: "123", firebase_uid: "uid-42" });

      const res = await patchEmail("legado");

      expect(res.status).toBe(200);
      expect(updateUser).not.toHaveBeenCalled();
    });

    it("Firebase acusa auth/email-already-exists: o mesmo 409 da checagem no banco", async () => {
      updateUser.mockRejectedValue(Object.assign(new Error("exists"), { code: "auth/email-already-exists" }));

      const noFirebase = await patchEmail("novo@a.com");
      const noBanco = await patchEmail("ocupado@a.com");

      expect(noFirebase.status).toBe(409);
      expect(noFirebase.body).toEqual(noBanco.body);
      expect(noFirebase.body).toEqual({ error: MSG_EM_USO });
      expect(update).not.toHaveBeenCalled();
    });

    it("Firebase acusa auth/invalid-email: o mesmo 400 da checagem de formato", async () => {
      updateUser.mockRejectedValue(Object.assign(new Error("invalid"), { code: "auth/invalid-email" }));

      const noFirebase = await patchEmail("novo@a.com");
      const noFormato = await patchEmail("sem-arroba");

      expect(noFirebase.status).toBe(400);
      expect(noFirebase.body).toEqual(noFormato.body);
      expect(update).not.toHaveBeenCalled();
    });

    it("outro erro do Firebase segue para o errorHandler (500), sem persistir", async () => {
      updateUser.mockRejectedValue(Object.assign(new Error("interno"), { code: "auth/internal-error" }));

      const res = await patchEmail("novo@a.com");

      expect(res.status).toBe(500);
      expect(update).not.toHaveBeenCalled();
    });
  });

  // B1: o vínculo pendente de convite do idoso foi criado para a conta que tinha o e-mail ANTIGO. Trocar o e-mail
  // cancela esses convites (o idoso convida de novo), na mesma transação que grava o e-mail novo. Troca só de caixa não
  // é troca. O fake de vínculos filtra de verdade pelo where, senão os testes de escopo passariam por vacuidade.
  describe("troca de e-mail cancela convites pendentes do próprio usuário", () => {
    type LinhaVinculo = Record<string, unknown> & { id: number; status: string };
    let vinculos: LinhaVinculo[];

    function patch(corpo: object) {
      return request(buildApp()).patch("/usuario/me").set("Authorization", "Bearer x").send(corpo);
    }
    const status = (id: number) => vinculos.find((v) => v.id === id)?.status;

    beforeEach(() => {
      vinculos = [
        { id: 1, vinculado_id: 42, tipo_vinculo: "familiar", origem: "convite_idoso", status: "pendente" },
        { id: 2, vinculado_id: 42, tipo_vinculo: "cuidador", origem: "convite_idoso", status: "pendente" },
        { id: 3, vinculado_id: 42, tipo_vinculo: "familiar", origem: "solicitacao_familiar", status: "pendente" },
        { id: 4, vinculado_id: 42, tipo_vinculo: "cuidador", origem: "solicitacao_cuidador", status: "pendente" },
        { id: 5, vinculado_id: 42, tipo_vinculo: "familiar", origem: "cadastro_familiar", status: "pendente" },
        { id: 6, vinculado_id: 42, tipo_vinculo: "familiar", origem: "convite_idoso", status: "aprovado" },
        { id: 7, vinculado_id: 99, tipo_vinculo: "familiar", origem: "convite_idoso", status: "pendente" },
        { id: 8, vinculado_id: 42, tipo_vinculo: "familiar", origem: "convite_idoso", status: "recusado" },
      ];
      updateManyVinculo.mockImplementation(
        async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
          const alvo = vinculos.filter((v) => Object.entries(args.where).every(([campo, valor]) => v[campo] === valor));
          alvo.forEach((v) => Object.assign(v, args.data));
          return { count: alvo.length };
        },
      );
      findUniqueOrThrow.mockResolvedValue({ email: "a@a.com", telefone: "123", firebase_uid: "uid-42" });
      updateUser.mockResolvedValue(undefined);
      update.mockResolvedValue({ id: 42, nome: "Ana", email: "novo@a.com", telefone: "123", tipo_perfil: "familiar" });
    });

    it("e-mail novo: recusa só os convite_idoso pendentes do próprio usuário (familiar e cuidador), numa única transação com o update", async () => {
      const res = await patch({ email: "novo@a.com" });

      expect(res.status).toBe(200);
      expect(res.body.email).toBe("novo@a.com");
      expect(transaction).toHaveBeenCalledTimes(1);
      // As duas operações passadas à transação, nesta ordem: o cancelamento (count dos 2 convites) e o update do usuário.
      expect(await Promise.all(transaction.mock.calls[0][0])).toEqual([
        { count: 2 },
        { id: 42, nome: "Ana", email: "novo@a.com", telefone: "123", tipo_perfil: "familiar" },
      ]);
      expect(updateManyVinculo).toHaveBeenCalledTimes(1);
      expect(updateManyVinculo).toHaveBeenCalledWith({
        where: { vinculado_id: 42, origem: "convite_idoso", status: "pendente" },
        data: { status: "recusado", aprovador_id: 42, data_resposta: expect.any(Date) },
      });
      expect(update).toHaveBeenCalledTimes(1);
      expect([1, 2].map(status)).toEqual(["recusado", "recusado"]);
      // intocados: outras origens, aprovado, recusado antigo e vínculo de outro usuário
      expect([3, 4, 5, 6, 7, 8].map(status)).toEqual([
        "pendente",
        "pendente",
        "pendente",
        "aprovado",
        "pendente",
        "recusado",
      ]);
    });

    it("e-mail apagado (com telefone preenchido): também recusa os convites pendentes", async () => {
      update.mockResolvedValue({ id: 42, nome: "Ana", email: null, telefone: "123", tipo_perfil: "familiar" });

      const res = await patch({ email: "" });

      expect(res.status).toBe(200);
      expect(transaction).toHaveBeenCalledTimes(1);
      expect([1, 2].map(status)).toEqual(["recusado", "recusado"]);
      expect(status(7)).toBe("pendente");
    });

    it("troca só de caixa: não chama o Firebase, não cancela nada e grava o e-mail como digitado", async () => {
      const res = await patch({ email: "  A@A.com  " });

      expect(res.status).toBe(200);
      expect(updateUser).not.toHaveBeenCalled();
      expect(transaction).not.toHaveBeenCalled();
      expect(updateManyVinculo).not.toHaveBeenCalled();
      expect(update.mock.calls[0][0].data).toEqual({ email: "A@A.com" });
      expect(status(1)).toBe("pendente");
    });

    it("e-mail igual ao atual, ou só nome e telefone: não cancela nada", async () => {
      await patch({ email: "a@a.com" });
      await patch({ nome: "Ana Souza", telefone: "999" });

      expect(transaction).not.toHaveBeenCalled();
      expect(updateManyVinculo).not.toHaveBeenCalled();
      expect(vinculos.filter((v) => v.status === "pendente")).toHaveLength(6);
    });

    it("falha do Firebase: nada é cancelado nem gravado (500)", async () => {
      updateUser.mockRejectedValue(Object.assign(new Error("interno"), { code: "auth/internal-error" }));

      const res = await patch({ email: "novo@a.com" });

      expect(res.status).toBe(500);
      expect(transaction).not.toHaveBeenCalled();
      expect(updateManyVinculo).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
      expect(status(1)).toBe("pendente");
    });

    it("e-mail em uso detectado antes do Firebase (409): nada é cancelado", async () => {
      const res = await patch({ email: "ocupado@a.com" });

      expect(res.status).toBe(409);
      expect(transaction).not.toHaveBeenCalled();
      expect(updateManyVinculo).not.toHaveBeenCalled();
      expect(status(1)).toBe("pendente");
    });

    it("falha da transação (índice único do banco): 409 tratado", async () => {
      transaction.mockRejectedValue(new Error("Violation of UNIQUE KEY constraint 'Usuario_email_key'"));

      const res = await patch({ email: "novo@a.com" });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: "Este e-mail já está em uso por outra conta." });
    });
  });


  // B2: tamanho de nome (NVarChar 150) e telefone (NVarChar 20) é checado antes do Firebase; senão o update do banco
  // falharia depois do updateUser e os dois sistemas ficariam com e-mails diferentes.
  describe("tamanho de nome e telefone antes do Firebase", () => {
    function patch(corpo: object) {
      return request(buildApp()).patch("/usuario/me").set("Authorization", "Bearer x").send(corpo);
    }

    beforeEach(() => {
      findUniqueOrThrow.mockResolvedValue({ email: "a@a.com", telefone: "123", firebase_uid: "uid-42" });
      updateUser.mockResolvedValue(undefined);
      update.mockResolvedValue({ id: 42, nome: "Ana", email: "novo@a.com", telefone: "123", tipo_perfil: "idoso" });
    });

    it.each([
      ["nome com 151 caracteres", { nome: "n".repeat(151) }, "Nome deve ter até 150 caracteres."],
      ["telefone com 21 caracteres", { telefone: "1".repeat(21) }, "Telefone deve ter até 20 caracteres."],
    ])("%s junto com e-mail novo: 400, sem chamar o Firebase nem o banco", async (_nome, corpo, mensagem) => {
      const res = await patch({ ...corpo, email: "novo@a.com" });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: mensagem });
      expect(updateUser).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
      expect(transaction).not.toHaveBeenCalled();
    });

    it("nome com espaços nas pontas conta sem eles; nome com 150 e telefone com 20 caracteres são aceitos", async () => {
      const res = await patch({ nome: `  ${"n".repeat(150)}  `, telefone: "1".repeat(20), email: "novo@a.com" });

      expect(res.status).toBe(200);
      expect(update.mock.calls[0][0].data).toMatchObject({ nome: "n".repeat(150), telefone: "1".repeat(20) });
      expect(updateUser).toHaveBeenCalledTimes(1);
    });
  });

  it("só o telefone muda: não chama o Firebase", async () => {
    findUniqueOrThrow.mockResolvedValue({ email: "a@a.com", telefone: "123", firebase_uid: "uid-42" });
    update.mockResolvedValue({ id: 42, nome: "Ana", email: "a@a.com", telefone: "999", tipo_perfil: "idoso" });

    const res = await request(buildApp()).patch("/usuario/me").set("Authorization", "Bearer x").send({ telefone: "999" });

    expect(res.status).toBe(200);
    expect(updateUser).not.toHaveBeenCalled();
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

  it("bloqueia nome vazio com mensagem clara, não persiste", async () => {
    const res = await request(buildApp())
      .patch("/usuario/me")
      .set("Authorization", "Bearer x")
      .send({ nome: "   " });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/nome/i);
    expect(update).not.toHaveBeenCalled();
  });

  // Injeção de operador: o Prisma aceita objeto no data ({ set: "" }), o que pularia a checagem de
  // nome vazio. Só string (ou null em email/telefone, para limpar) chega ao Prisma.
  it.each([
    ["nome objeto { set: '' }", { nome: { set: "" } }],
    ["nome array", { nome: ["Ana"] }],
    ["nome número", { nome: 123 }],
    ["email objeto", { email: { set: "x@a.com" } }],
    ["telefone objeto", { telefone: { set: null } }],
    ["telefone array", { telefone: ["123"] }],
  ])("400 com %s, sem tocar banco nem Firebase", async (_nome, corpo) => {
    findUniqueOrThrow.mockResolvedValue({ email: "a@a.com", telefone: "123", firebase_uid: "uid-42" });

    const res = await request(buildApp()).patch("/usuario/me").set("Authorization", "Bearer x").send(corpo);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Nome, e-mail e telefone precisam ser texto." });
    expect(update).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("email e telefone null continuam aceitos (limpar o campo)", async () => {
    findUniqueOrThrow.mockResolvedValue({ email: "a@a.com", telefone: "123", firebase_uid: "uid-42" });
    update.mockResolvedValue({ id: 42, nome: "Ana", email: "a@a.com", telefone: null, tipo_perfil: "idoso" });

    const res = await request(buildApp()).patch("/usuario/me").set("Authorization", "Bearer x").send({ telefone: null });

    expect(res.status).toBe(200);
    expect(update.mock.calls[0][0].data).toEqual({ telefone: null });
  });

  it("corpo sem campo nenhum: não quebra, chama update sem tocar nada", async () => {
    update.mockResolvedValue({ id: 42, nome: "Ana", email: "a@a.com", telefone: "123", tipo_perfil: "idoso" });

    const res = await request(buildApp()).patch("/usuario/me").set("Authorization", "Bearer x").send({});

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 42 }, data: {} })
    );
    expect(findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("falha do Firebase em updateUser: não persiste no banco, propaga erro (500)", async () => {
    findUniqueOrThrow.mockResolvedValue({ email: "a@a.com", telefone: "123", firebase_uid: "uid-42" });
    updateUser.mockRejectedValue(new Error("Firebase indisponível"));

    const res = await request(buildApp())
      .patch("/usuario/me")
      .set("Authorization", "Bearer x")
      .send({ email: "novo@a.com" });

    expect(res.status).toBe(500);
    expect(update).not.toHaveBeenCalled();
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
    // findFirst é compartilhado entre requireAuth (por firebase_uid) e a pré-checagem
    // de e-mail (3.2) — distingue pelo where. Padrão: e-mail livre.
    findFirst.mockImplementation((args: { where: { email?: string } }) =>
      Promise.resolve(args.where.email !== undefined ? null : USUARIO_LOGADO)
    );
    findUnique.mockResolvedValue({ tipo_perfil: "familiar", email: "familiar-fixture@a.com" });
    createUsuario.mockResolvedValue(CRIADO);
  });

  // Item 3.2 (RNF-011) — conflito 1. Nomes/e-mails abaixo são FIXTURES de teste.
  describe("conflito de e-mail (3.2)", () => {
    const CONTA_EXISTENTE = { id: 77, nome: "FIXTURE Fulano Existente", email: "existente-fixture@x.com", tipo_perfil: "idoso" };

    function emailOcupado() {
      findFirst.mockImplementation((args: { where: { email?: string } }) =>
        Promise.resolve(args.where.email !== undefined ? CONTA_EXISTENTE : USUARIO_LOGADO)
      );
    }

    it("e-mail já existente: 409 EMAIL_JA_EM_USO_CADASTRO_IDOSO com proximo_passo, sem create", async () => {
      emailOcupado();

      const res = await post(BODY_OK);

      expect(res.status).toBe(409);
      expect(res.body.codigo).toBe("EMAIL_JA_EM_USO_CADASTRO_IDOSO");
      expect(typeof res.body.error).toBe("string");
      expect(res.body.proximo_passo).toEqual(expect.any(String));
      expect(res.body.proximo_passo.length).toBeGreaterThan(0);
      expect(Object.keys(res.body).sort()).toEqual(["codigo", "error", "proximo_passo"]);
      expect(createUsuario).not.toHaveBeenCalled();
    });

    it("corpo não contém e-mail enviado nem nome/e-mail/id da conta existente", async () => {
      emailOcupado();

      const res = await post(BODY_OK);
      const corpo = JSON.stringify(res.body);

      expect(corpo).not.toContain("maria@a.com");
      expect(corpo).not.toContain("FIXTURE");
      expect(corpo).not.toContain("existente-fixture@x.com");
      expect(corpo).not.toContain("77");
    });

    it("pré-checagem seleciona só id", async () => {
      emailOcupado();

      await post(BODY_OK);

      const chamadaEmail = findFirst.mock.calls.find((c) => c[0].where.email !== undefined);
      expect(chamadaEmail?.[0]).toEqual({ where: { email: "maria@a.com" }, select: { id: true } });
    });

    // A partir da tarefa 3.3, e-mail é obrigatório: sem ele nem chega na pré-checagem.
    it("só telefone (sem e-mail): 400, pré-checagem de e-mail nem roda", async () => {
      const res = await post({ nome: "Seu José", telefone: "11999990000", aceita_termo_responsabilidade: true });

      expect(res.status).toBe(400);
      expect(findFirst.mock.calls.some((c) => c[0].where.email !== undefined)).toBe(false);
      expect(createUsuario).not.toHaveBeenCalled();
    });

    it("corrida: pré-checagem não acha, create rejeita com duplicidade: 409 com o mesmo corpo", async () => {
      createUsuario.mockRejectedValue(new Error("Violation of UNIQUE KEY constraint 'Usuario_email_key'"));
      const corrida = await post(BODY_OK);
      emailOcupado();
      const preCheck = await post(BODY_OK);

      expect(corrida.status).toBe(409);
      expect(corrida.body).toEqual(preCheck.body);
    });
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
    verifyIdToken.mockResolvedValue({ uid: "uid-42", email: "familiar-fixture@a.com", email_verified: true });

    const res = await post(BODY_OK);

    expect(res.status).toBe(201);
    expect(createUsuario.mock.calls[0][0].data.vinculos_como_idoso.create).toMatchObject({
      status: "aprovado",
      confirmado_em: expect.any(Date),
    });
  });

  // Token antigo (até 1 h) segue com email_verified=true depois da troca de e-mail: só vale se o e-mail do token for o do
  // cadastro. Senão o vínculo nasce pendente, com o mesmo 201 e o mesmo corpo.
  describe("e-mail do token precisa ser o do cadastro para aprovar", () => {
    it("e-mail do token diferente do cadastro: 201 igual, vínculo pendente sem confirmado_em", async () => {
      verifyIdToken.mockResolvedValue({ uid: "uid-42", email: "antigo-fixture@a.com", email_verified: true });

      const res = await post(BODY_OK);

      expect(res.status).toBe(201);
      expect(res.body.vinculo).toEqual({ id: 7, status: "pendente", origem: "cadastro_familiar" });
      const criado = createUsuario.mock.calls[0][0].data.vinculos_como_idoso.create;
      expect(criado.status).toBe("pendente");
      expect(criado.confirmado_em).toBeUndefined();
    });

    it("mesmo e-mail com caixa diferente: aprovado", async () => {
      verifyIdToken.mockResolvedValue({ uid: "uid-42", email: "FAMILIAR-Fixture@A.com", email_verified: true });

      const res = await post(BODY_OK);

      expect(res.status).toBe(201);
      expect(createUsuario.mock.calls[0][0].data.vinculos_como_idoso.create.status).toBe("aprovado");
    });

    it("e-mail do token igual ao do cadastro mas NÃO verificado: pendente", async () => {
      verifyIdToken.mockResolvedValue({ uid: "uid-42", email: "familiar-fixture@a.com", email_verified: false });

      const res = await post(BODY_OK);

      expect(res.status).toBe(201);
      expect(createUsuario.mock.calls[0][0].data.vinculos_como_idoso.create.status).toBe("pendente");
    });

    it("token sem claim de e-mail: pendente", async () => {
      verifyIdToken.mockResolvedValue({ uid: "uid-42", email_verified: true });

      const res = await post(BODY_OK);

      expect(res.status).toBe(201);
      expect(createUsuario.mock.calls[0][0].data.vinculos_como_idoso.create.status).toBe("pendente");
    });

    it("cadastro do familiar sem e-mail: pendente", async () => {
      findUnique.mockResolvedValue({ tipo_perfil: "familiar", email: null });
      verifyIdToken.mockResolvedValue({ uid: "uid-42", email: "familiar-fixture@a.com", email_verified: true });

      const res = await post(BODY_OK);

      expect(res.status).toBe(201);
      expect(createUsuario.mock.calls[0][0].data.vinculos_como_idoso.create.status).toBe("pendente");
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

  // Reabertura da tarefa 3.1 nesta rodada (3.3): e-mail passou a ser obrigatório, "só
  // telefone" deixou de bastar sozinho. Este teste esperava 201 antes; agora espera 400 —
  // ver docs/historico-implementacao.md, entrada do item 3.3 (reabertura da 3.1).
  it("400 só com telefone (sem e-mail) — e-mail agora é obrigatório", async () => {
    const res = await post({ nome: "Seu José", telefone: " 11999990000 ", aceita_termo_responsabilidade: true });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/e-mail/i);
    expect(createUsuario).not.toHaveBeenCalled();
  });

  it("telefone continua opcional e complementar quando e-mail está presente", async () => {
    const res = await post({ ...BODY_OK, telefone: " 11999990000 " });

    expect(res.status).toBe(201);
    const data = createUsuario.mock.calls[0][0].data;
    expect(data.telefone).toBe("11999990000");
    expect(data.email).toBe("maria@a.com");
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
