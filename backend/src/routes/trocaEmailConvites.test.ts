import express from "express";
import request from "supertest";

// Ponta a ponta no nível das rotas (PATCH /usuario/me, POST /auth/sync, POST /vinculo/:id/aceitar-convite) sobre um
// Prisma em memória que FILTRA e GRAVA de verdade. Cenário (B1): quem cria conta com o e-mail de um terceiro (sem
// provar a posse) recebe o convite pendente do idoso, troca o e-mail para um que controla, confirma e tenta ficar com o
// vínculo. Todos os ids, e-mails e uids abaixo são FICTÍCIOS, só para teste.
type Linha = Record<string, unknown>;

const dados: { usuario: Linha[]; vinculo: Linha[] } = { usuario: [], vinculo: [] };

function casa(linha: Linha, where: Linha | undefined): boolean {
  return Object.entries(where ?? {}).every(([campo, valor]) => {
    if (valor === undefined) return true;
    if (valor !== null && typeof valor === "object") {
      const op = valor as { in?: unknown[]; not?: unknown };
      if (Array.isArray(op.in)) return op.in.includes(linha[campo]);
      if ("not" in op) return linha[campo] !== op.not;
      throw new Error(`fake: filtro não suportado em ${campo}`);
    }
    if (typeof valor === "string" && typeof linha[campo] === "string" && campo === "email") {
      return (linha[campo] as string).toLowerCase() === valor.toLowerCase(); // SQL Server ignora caixa por padrão
    }
    return linha[campo] === valor;
  });
}

function tabela(nome: "usuario" | "vinculo") {
  const achar = (where?: Linha) => dados[nome].find((l) => casa(l, where)) ?? null;
  return {
    findFirst: async (a?: { where?: Linha }) => achar(a?.where),
    findUnique: async (a?: { where?: Linha }) => achar(a?.where),
    findUniqueOrThrow: async (a?: { where?: Linha }) => {
      const linha = achar(a?.where);
      if (!linha) throw new Error("não encontrado");
      return linha;
    },
    update: async (a: { where: Linha; data: Linha }) => {
      const linha = achar(a.where);
      if (!linha) throw new Error("não encontrado");
      Object.assign(linha, a.data);
      return linha;
    },
    updateMany: async (a: { where: Linha; data: Linha }) => {
      const alvo = dados[nome].filter((l) => casa(l, a.where));
      alvo.forEach((l) => Object.assign(l, a.data));
      return { count: alvo.length };
    },
  };
}

const metodos = (nome: "usuario" | "vinculo") => tabela(nome) as unknown as Record<string, (...a: unknown[]) => unknown>;

const verifyIdToken = jest.fn();
const updateUser = jest.fn();

jest.mock("../lib/firebaseAdmin", () => ({
  auth: {
    verifyIdToken: (...args: unknown[]) => verifyIdToken(...args),
    updateUser: (...args: unknown[]) => updateUser(...args),
  },
}));
jest.mock("../lib/prisma", () => ({
  prisma: {
    usuario: new Proxy({}, { get: (_a, m: string) => (...args: unknown[]) => metodos("usuario")[m](...args) }),
    vinculo: new Proxy({}, { get: (_a, m: string) => (...args: unknown[]) => metodos("vinculo")[m](...args) }),
    $transaction: (operacoes: unknown[]) => Promise.all(operacoes),
  },
}));

import usuarioRouter from "./usuario";
import authRouter from "./auth";
import vinculoRouter from "./vinculo";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/usuario", usuarioRouter);
  app.use("/auth", authRouter);
  app.use("/vinculo", vinculoRouter);
  app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: "Erro interno." });
  });
  return app;
}

const IDOSO = 1;
const FAMILIAR = 5;
const CUIDADOR = 6;
const EMAIL_DO_TERCEIRO = "terceiro.ficticio@exemplo.test"; // o idoso convidou este e-mail
const EMAIL_DO_ATACANTE = "atacante.ficticio@exemplo.test"; // o atacante controla este

// Token do atacante: o e-mail do token acompanha o do Firebase naquele momento.
const TOKEN = {
  naoVerificadoTerceiro: { uid: `uid-${FAMILIAR}`, email: EMAIL_DO_TERCEIRO, email_verified: false },
  verificadoAtacante: { uid: `uid-${FAMILIAR}`, email: EMAIL_DO_ATACANTE, email_verified: true },
  cuidadorNaoVerificadoTerceiro: { uid: `uid-${CUIDADOR}`, email: EMAIL_DO_TERCEIRO, email_verified: false },
  cuidadorVerificadoAtacante: { uid: `uid-${CUIDADOR}`, email: EMAIL_DO_ATACANTE, email_verified: true },
  cuidadorVerificadoTerceiro: { uid: `uid-${CUIDADOR}`, email: EMAIL_DO_TERCEIRO, email_verified: true },
  familiarVerificadoTerceiro: { uid: `uid-${FAMILIAR}`, email: EMAIL_DO_TERCEIRO, email_verified: true },
} as const;

function semear() {
  dados.usuario = [
    { id: IDOSO, firebase_uid: "uid-1", tipo_perfil: "idoso", email: "idoso.ficticio@exemplo.test", nome: "Idoso Ficticio" },
    { id: FAMILIAR, firebase_uid: `uid-${FAMILIAR}`, tipo_perfil: "familiar", email: EMAIL_DO_TERCEIRO, nome: "Atacante F", telefone: "11" },
    { id: CUIDADOR, firebase_uid: `uid-${CUIDADOR}`, tipo_perfil: "cuidador", email: EMAIL_DO_TERCEIRO, nome: "Atacante C", telefone: "11" },
  ];
  dados.vinculo = [
    {
      id: 10, idoso_id: IDOSO, vinculado_id: FAMILIAR, tipo_vinculo: "familiar", origem: "convite_idoso",
      status: "pendente", data_solicitacao: new Date(),
    },
    {
      id: 11, idoso_id: IDOSO, vinculado_id: CUIDADOR, tipo_vinculo: "cuidador", origem: "convite_idoso",
      status: "pendente", data_solicitacao: new Date(),
    },
  ];
}

const statusDo = (id: number) => dados.vinculo.find((v) => v.id === id)?.status;
const como = (token: keyof typeof TOKEN) => {
  verifyIdToken.mockResolvedValue(TOKEN[token]);
  return { Authorization: "Bearer x" };
};

beforeEach(() => {
  semear();
  verifyIdToken.mockReset();
  updateUser.mockReset();
  updateUser.mockResolvedValue(undefined);
});

describe("familiar: convite pendente não sobrevive à troca de e-mail", () => {
  it("controle: sem trocar o e-mail, o login com e-mail verificado promove o convite pendente", async () => {
    const res = await request(buildApp()).post("/auth/sync").set(como("familiarVerificadoTerceiro")).send({});

    expect(res.status).toBe(200);
    expect(statusDo(10)).toBe("aprovado");
  });

  it("trocar para um e-mail próprio e confirmar não aprova o convite feito ao e-mail do terceiro", async () => {
    const troca = await request(buildApp())
      .patch("/usuario/me")
      .set(como("naoVerificadoTerceiro"))
      .send({ email: EMAIL_DO_ATACANTE });
    expect(troca.status).toBe(200);
    expect(updateUser).toHaveBeenCalledWith(`uid-${FAMILIAR}`, { email: EMAIL_DO_ATACANTE, emailVerified: false });
    expect(statusDo(10)).toBe("recusado");

    const login = await request(buildApp()).post("/auth/sync").set(como("verificadoAtacante")).send({});

    expect(login.status).toBe(200);
    expect(statusDo(10)).toBe("recusado");
  });
});

describe("cuidador: convite pendente não sobrevive à troca de e-mail", () => {
  it("controle: sem trocar o e-mail, o aceite com e-mail verificado aprova o convite", async () => {
    const res = await request(buildApp()).post("/vinculo/11/aceitar-convite").set(como("cuidadorVerificadoTerceiro"));

    expect(res.status).toBe(200);
    expect(statusDo(11)).toBe("aprovado");
  });

  it("trocar para um e-mail próprio e confirmar não deixa aceitar o convite feito ao e-mail do terceiro", async () => {
    const troca = await request(buildApp())
      .patch("/usuario/me")
      .set(como("cuidadorNaoVerificadoTerceiro"))
      .send({ email: EMAIL_DO_ATACANTE });
    expect(troca.status).toBe(200);
    expect(statusDo(11)).toBe("recusado");

    const aceite = await request(buildApp()).post("/vinculo/11/aceitar-convite").set(como("cuidadorVerificadoAtacante"));

    // O vínculo já é do próprio usuário, então não é o 404 de "não é seu": é o 409 de "já respondido". Sem escrita.
    expect(aceite.status).toBe(409);
    expect(aceite.body).toEqual({ error: "Este convite já foi respondido." });
    expect(statusDo(11)).toBe("recusado");
  });
});
