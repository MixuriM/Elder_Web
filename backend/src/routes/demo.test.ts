import express from "express";
import request from "supertest";

// Modo demonstração (D6): GET /demo/estado, POST /demo/entrar-como e POST /demo/restaurar. Firebase e semente
// FALSOS: nenhuma conta real é criada e nenhum custom token de verdade sai daqui. Todos os uids são FICTÍCIOS.
type Decoded = Record<string, unknown>;
const TOKENS: Record<string, Decoded> = {
  "t-admin": { uid: "admin-1" },
  "t-admin2": { uid: "admin-2" },
  "t-comum": { uid: "uid-comum", email: "comum@exemplo.test" },
  // Parecidos com o admin: comparação por prefixo ou por trecho deixaria passar.
  "t-admin10": { uid: "admin-10" },
  "t-prefixo": { uid: "admin" },
  // Sessão demo emitida por este backend.
  "t-demo": { uid: "demo-idosa-helena", demo: true, demo_admin_uid: "admin-1" },
  // Sessão demo cujo ID token renovado perdeu as claims (pior caso aceito, ver docs/modo-demonstracao.md).
  "t-demo-sem-claim": { uid: "demo-cuidadora-marta" },
  // Admin removido da lista depois de emitir a sessão: a sessão também perde o acesso.
  "t-demo-admin-fora": { uid: "demo-idosa-helena", demo: true, demo_admin_uid: "admin-removido" },
  "t-demo-claim-lixo": { uid: "demo-idosa-helena", demo: true, demo_admin_uid: ["admin-1"] },
  // Conta comum com claim forjada no decoded (impossível no Firebase real, mas a regra não pode depender disso).
  "t-forjado": { uid: "uid-comum", demo: true, demo_admin_uid: "admin-1" },
  "t-uid-demo-parecido": { uid: "demo-idosa-helena-2", demo: true, demo_admin_uid: "admin-1" },
};

const verifyIdToken = jest.fn(async (token: string, checarRevogado?: boolean) => {
  if (token === "t-revogado") {
    if (checarRevogado === true) throw Object.assign(new Error("revogado"), { code: "auth/id-token-revoked" });
    return { uid: "admin-1" };
  }
  if (token === "t-indisponivel") throw new Error("rede");
  const d = TOKENS[token];
  if (!d) throw Object.assign(new Error("inválido"), { code: "auth/argument-error" });
  return d;
});
const createCustomToken = jest.fn(async (_uid: string, _claims?: object) => "custom-token-ficticio");
jest.mock("../lib/firebaseAdmin", () => ({
  auth: {
    verifyIdToken: (...a: [string, boolean?]) => verifyIdToken(...a),
    createCustomToken: (...a: [string, object?]) => createCustomToken(...a),
  },
}));
const semearDemo = jest.fn(async (_args: unknown) => ({ usuarios: 6 }));
jest.mock("../lib/demo/semear", () => ({ semearDemo: (a: unknown) => semearDemo(a) }));
const prismaUsado = jest.fn();
jest.mock("../lib/prisma", () => ({
  prisma: new Proxy({}, { get: (_a, nome) => { prismaUsado(String(nome)); return new Proxy({}, { get: () => jest.fn() }); } }),
}));

import app from "../app";
import { definirLimitesEmTeste, limparLimitadores } from "../lib/limiteTaxa";
import { ELENCO } from "../lib/demo/elenco";

const ENV = { ...process.env };
let logs: jest.SpyInstance[];

beforeEach(() => {
  process.env.DEMO_MODO_ATIVO = "1";
  process.env.DEMO_ADMIN_UIDS = " admin-1 ,admin-2";
  verifyIdToken.mockClear();
  createCustomToken.mockClear();
  semearDemo.mockClear();
  prismaUsado.mockClear();
  logs = (["log", "info", "warn", "error", "debug"] as const).map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
});
afterEach(() => {
  process.env = { ...ENV };
  definirLimitesEmTeste(undefined);
  limparLimitadores();
  jest.restoreAllMocks();
});

type Rota = { metodo: "get" | "post"; caminho: string; corpo?: object };
const ESTADO: Rota = { metodo: "get", caminho: "/demo/estado" };
const ENTRAR: Rota = { metodo: "post", caminho: "/demo/entrar-como", corpo: { conta: "cuidadora-marta" } };
const RESTAURAR: Rota = { metodo: "post", caminho: "/demo/restaurar" };
const ROTAS = [ESTADO, ENTRAR, RESTAURAR];

function chamar(r: Rota, token?: string, corpo = r.corpo) {
  let req = request(app)[r.metodo](r.caminho);
  if (token !== undefined) req = req.set("Authorization", `Bearer ${token}`);
  return corpo ? req.send(corpo) : req;
}

// Corpo e status que o Express dá a uma rota que não existe (app vazio, mesmo método e caminho).
async function rotaInexistente(r: Rota) {
  const res = await request(express())[r.metodo](r.caminho);
  return { status: res.status, text: res.text };
}

describe.each(ROTAS.map((r) => [`${r.metodo.toUpperCase()} ${r.caminho}`, r] as const))("%s: entrada", (_n, r) => {
  it("401 sem token, com token inválido e com token revogado (checarRevogado ligado)", async () => {
    expect((await chamar(r)).status).toBe(401);
    expect((await chamar(r, "t-qualquer")).status).toBe(401);
    expect((await chamar(r, "t-revogado")).status).toBe(401);
    expect(verifyIdToken.mock.calls.every(([, checar]) => checar === true)).toBe(true);
  });

  it("503 com Firebase indisponível", async () => {
    expect((await chamar(r, "t-indisponivel")).status).toBe(503);
  });

  it.each([["ausente", undefined], ["'0'", "0"], ["'true'", "true"], ["vazio", ""], ["' 1'", " 1"]])(
    "flag %s: 404 igual ao de rota inexistente, mesmo para o admin",
    async (_rotulo, valor) => {
      if (valor === undefined) delete process.env.DEMO_MODO_ATIVO;
      else process.env.DEMO_MODO_ATIVO = valor;
      const res = await chamar(r, "t-admin");
      expect({ status: res.status, text: res.text }).toEqual(await rotaInexistente(r));
      expect(createCustomToken).not.toHaveBeenCalled();
      expect(semearDemo).not.toHaveBeenCalled();
    },
  );

  it.each(["t-comum", "t-admin10", "t-prefixo", "t-forjado", "t-uid-demo-parecido", "t-demo-admin-fora", "t-demo-claim-lixo"])(
    "%s: 404 igual ao de rota inexistente",
    async (token) => {
      const res = await chamar(r, token);
      expect({ status: res.status, text: res.text }).toEqual(await rotaInexistente(r));
      expect(createCustomToken).not.toHaveBeenCalled();
      expect(semearDemo).not.toHaveBeenCalled();
    },
  );

  it("sem DEMO_ADMIN_UIDS, nem o admin nem a sessão demo entram (404)", async () => {
    delete process.env.DEMO_ADMIN_UIDS;
    expect((await chamar(r, "t-admin")).status).toBe(404);
    expect((await chamar(r, "t-demo")).status).toBe(404);
    expect((await chamar(r, "t-demo-sem-claim")).status).toBe(404);
  });

  it("nenhum console é chamado", async () => {
    for (const t of [undefined, "t-qualquer", "t-comum", "t-admin", "t-demo"]) await chamar(r, t);
    for (const s of logs) expect(s).not.toHaveBeenCalled();
  });
});

describe("GET /demo/estado", () => {
  it("admin: as seis contas (sem uid nem e-mail) e atual null", async () => {
    const res = await chamar(ESTADO, "t-admin");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      contas: ELENCO.map(({ slug, nome, tipo_perfil, descricao }) => ({ slug, nome, tipo_perfil, descricao })),
      atual: null,
    });
    expect(res.text).not.toMatch(/@|demo-|admin-1/);
  });

  it("sessão demo: atual é o slug da conta da sessão, com ou sem as claims", async () => {
    expect((await chamar(ESTADO, "t-demo")).body.atual).toBe("idosa-helena");
    expect((await chamar(ESTADO, "t-demo-sem-claim")).body.atual).toBe("cuidadora-marta");
  });

  it("só depende do elenco: não toca no banco", async () => {
    await chamar(ESTADO, "t-admin");
    expect(prismaUsado).not.toHaveBeenCalled();
  });
});

describe("POST /demo/entrar-como", () => {
  it("admin: custom token para o uid EXATO do elenco, com as claims da D6, e só o token na resposta", async () => {
    const res = await chamar(ENTRAR, "t-admin", { conta: "idosa-helena" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ token: "custom-token-ficticio" });
    expect(createCustomToken).toHaveBeenCalledTimes(1);
    expect(createCustomToken).toHaveBeenCalledWith("demo-idosa-helena", { demo: true, demo_admin_uid: "admin-1" });
    expect(prismaUsado).not.toHaveBeenCalled();
  });

  it("sessão demo troca de conta e a nova sessão continua presa ao admin original", async () => {
    const res = await chamar(ENTRAR, "t-demo", { conta: "familiar-renata" });
    expect(res.status).toBe(200);
    expect(createCustomToken).toHaveBeenCalledWith("demo-familiar-renata", { demo: true, demo_admin_uid: "admin-1" });
  });

  it("sessão demo sem claims (renovada) troca de conta sem inventar admin", async () => {
    const res = await chamar(ENTRAR, "t-demo-sem-claim", { conta: "idoso-antonio" });
    expect(res.status).toBe(200);
    expect(createCustomToken).toHaveBeenCalledWith("demo-idoso-antonio", { demo: true });
  });

  it.each([
    ["ausente", {}],
    ["número", { conta: 1 }],
    ["array", { conta: ["idosa-helena"] }],
    ["objeto", { conta: { slug: "idosa-helena" } }],
    ["__proto__", { conta: "__proto__" }],
    ["constructor", { conta: "constructor" }],
    ["caminho", { conta: "../x" }],
    ["uid no lugar do slug", { conta: "demo-idosa-helena" }],
    ["uid de usuário real", { conta: "uid-comum" }],
    ["string vazia", { conta: "" }],
    ["maiúsculas", { conta: "IDOSA-HELENA" }],
  ])("conta %s: 400 e nenhum token emitido", async (_n, corpo) => {
    const res = await chamar(ENTRAR, "t-admin", corpo);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Conta de demonstração inválida." });
    expect(createCustomToken).not.toHaveBeenCalled();
  });

  it("corpo com uid extra é ignorado: o uid emitido sai sempre do elenco", async () => {
    await chamar(ENTRAR, "t-admin", { conta: "cuidador-paulo", uid: "uid-comum", demo_admin_uid: "outro" });
    expect(createCustomToken).toHaveBeenCalledWith("demo-cuidador-paulo", { demo: true, demo_admin_uid: "admin-1" });
  });

  it("falha do Firebase ao emitir o token vira o 500 genérico, sem token na resposta", async () => {
    createCustomToken.mockRejectedValueOnce(Object.assign(new Error("falhou demo-idosa-helena"), { code: "auth/internal-error" }));
    const res = await chamar(ENTRAR, "t-admin", { conta: "idosa-helena" });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Erro interno." });
    expect(JSON.stringify(logs.flatMap((s) => s.mock.calls))).not.toMatch(/demo-idosa|falhou/);
  });

  it("todo uid emitido em qualquer pedido válido é do elenco (o admin nunca alcança conta real)", async () => {
    for (const c of ELENCO) await chamar(ENTRAR, "t-admin", { conta: c.slug });
    expect(createCustomToken.mock.calls.map(([uid]) => uid)).toEqual(ELENCO.map((c) => c.uid));
  });
});

describe("POST /demo/restaurar", () => {
  it("chama semearDemo uma vez com o agora real e responde { ok: true }", async () => {
    const antes = Date.now();
    const res = await chamar(RESTAURAR, "t-demo");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(semearDemo).toHaveBeenCalledTimes(1);
    const args = semearDemo.mock.calls[0][0] as { agora: Date; prisma: unknown; auth: unknown };
    expect(args.agora.getTime()).toBeGreaterThanOrEqual(antes);
    expect(args.prisma).toBeDefined();
    expect(args.auth).toBeDefined();
  });

  it("falha da semente vira o 500 genérico do errorHandler", async () => {
    semearDemo.mockRejectedValueOnce(Object.assign(new Error("detalhe do banco com demo-idosa-helena"), { name: "PrismaClientKnownRequestError", code: "P2002" }));
    const res = await chamar(RESTAURAR, "t-admin");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Erro interno." });
    expect(JSON.stringify(logs.flatMap((s) => s.mock.calls))).not.toMatch(/demo-idosa|detalhe/);
  });
});

describe("limites de taxa (chave: admin efetivo)", () => {
  beforeEach(() => {
    definirLimitesEmTeste(true);
    limparLimitadores();
  });

  it("entrar-como: 30 por 15 min; a sessão demo divide o limite com o admin dela; outro admin não", async () => {
    for (let i = 0; i < 30; i++) expect((await chamar(ENTRAR, i % 2 ? "t-admin" : "t-demo")).status).toBe(200);
    expect((await chamar(ENTRAR, "t-admin")).status).toBe(429);
    expect((await chamar(ENTRAR, "t-demo")).status).toBe(429);
    expect((await chamar(ENTRAR, "t-admin2")).status).toBe(200);
  });

  it("restaurar: 5 por hora", async () => {
    for (let i = 0; i < 5; i++) expect((await chamar(RESTAURAR, "t-admin")).status).toBe(200);
    expect((await chamar(RESTAURAR, "t-admin")).status).toBe(429);
    expect(semearDemo).toHaveBeenCalledTimes(5);
  });
});
