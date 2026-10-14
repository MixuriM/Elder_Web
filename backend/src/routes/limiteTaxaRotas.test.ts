import type { Server } from "node:http";
import request from "supertest";

// Fiação do limite de taxa (decisão D1 de 2026-10-14): cada rota sensível bloqueia na requisição N+1 com 429, por
// usuário (outro usuário passa); o limite geral do requireAuth cobre toda rota autenticada; /auth/sync limita por IP
// antes do token e por uid depois. Ids, uids e e-mails FICTÍCIOS, só para teste.

jest.mock("../lib/firebaseAdmin", () => ({
  auth: {
    verifyIdToken: (...args: unknown[]) =>
      jest.requireActual("../testSupport/prismaFakeAutorizacao").verifyIdToken(...args),
  },
}));
jest.mock("../lib/prisma", () => ({
  prisma: jest.requireActual("../testSupport/prismaFakeAutorizacao").prismaFake,
}));

import app from "../app";
import { definirLimitesEmTeste, limparLimitadores, MSG_LIMITE_TAXA } from "../lib/limiteTaxa";
import { dados, tokenDe, TOKEN_REJEITADO, zerarDados } from "../testSupport/prismaFakeAutorizacao";

const IDOSO = 5;
const OUTRO_IDOSO = 6;
const CUIDADOR = 10;
const OUTRO_CUIDADOR = 11;
const FAMILIAR = 20;
const OUTRO_FAMILIAR = 21;

let servidor: Server;

beforeAll(() => {
  servidor = app.listen(0);
});
afterAll((feito) => {
  servidor.close(feito);
});

beforeEach(() => {
  zerarDados();
  const usuario = (id: number, tipo_perfil: string) => ({ id, firebase_uid: `uid-${id}`, tipo_perfil, nome: `Ficticio ${id}`, email: `ficticio${id}@teste.invalid` });
  dados.usuario = [
    usuario(IDOSO, "idoso"),
    usuario(OUTRO_IDOSO, "idoso"),
    usuario(CUIDADOR, "cuidador"),
    usuario(OUTRO_CUIDADOR, "cuidador"),
    usuario(FAMILIAR, "familiar"),
    usuario(OUTRO_FAMILIAR, "familiar"),
  ];
  definirLimitesEmTeste(true);
});

afterEach(() => {
  definirLimitesEmTeste(undefined);
  limparLimitadores();
});

type Metodo = "get" | "post" | "patch";

async function chamar(metodo: Metodo, caminho: string, id: number) {
  return request(servidor)[metodo](caminho).set("Authorization", `Bearer ${tokenDe(id)}`).send({});
}

const ROTAS: [Metodo, string, number, number, number][] = [
  ["post", "/vinculo/solicitar-cuidador", 20, CUIDADOR, OUTRO_CUIDADOR],
  ["post", "/vinculo/solicitar-familiar", 20, FAMILIAR, OUTRO_FAMILIAR],
  ["post", "/vinculo/convidar-cuidador", 30, IDOSO, OUTRO_IDOSO],
  ["post", "/vinculo/convidar-familiar", 30, IDOSO, OUTRO_IDOSO],
  ["patch", "/usuario/me", 30, IDOSO, OUTRO_IDOSO],
  ["post", "/usuario/cadastrar-idoso", 10, FAMILIAR, OUTRO_FAMILIAR],
];

describe.each(ROTAS)("%s %s: limite de %i por usuário", (metodo, caminho, maximo, usuario, outro) => {
  it("bloqueia a requisição N+1 com 429 e Retry-After; outro usuário passa", async () => {
    for (let i = 0; i < maximo; i++) expect((await chamar(metodo, caminho, usuario)).status).not.toBe(429);
    const bloqueada = await chamar(metodo, caminho, usuario);
    expect(bloqueada.status).toBe(429);
    expect(bloqueada.body).toEqual({ error: MSG_LIMITE_TAXA });
    expect(Number(bloqueada.headers["retry-after"])).toBeGreaterThan(0);
    expect((await chamar(metodo, caminho, outro)).status).not.toBe(429);
  }, 30_000);
});

describe("limite geral do requireAuth", () => {
  it("toda rota autenticada conta: 2000 passam, a 2001 dá 429; outro usuário passa", async () => {
    for (let i = 0; i < 2000; i++) {
      const caminho = i % 2 === 0 ? "/usuario/me" : "/vinculo";
      expect((await chamar("get", caminho, IDOSO)).status).not.toBe(429);
    }
    expect((await chamar("get", "/vinculo", IDOSO)).status).toBe(429);
    expect((await chamar("get", "/usuario/me", OUTRO_IDOSO)).status).toBe(200);
  }, 60_000);
});

describe("POST /auth/sync", () => {
  it("limita por IP antes de verificar o token: 300 passam (401), a 301 dá 429", async () => {
    for (let i = 0; i < 300; i++) {
      expect((await request(servidor).post("/auth/sync").set("Authorization", `Bearer ${TOKEN_REJEITADO}`)).status).toBe(401);
    }
    const bloqueada = await request(servidor).post("/auth/sync");
    expect(bloqueada.status).toBe(429);
    expect(bloqueada.body).toEqual({ error: MSG_LIMITE_TAXA });
  }, 30_000);

  it("limita por uid depois do token: 60 passam, a 61 dá 429; outro uid passa", async () => {
    const sync = (id: number) => request(servidor).post("/auth/sync").set("Authorization", `Bearer ${tokenDe(id)}`).send({});
    for (let i = 0; i < 60; i++) expect((await sync(900)).status).not.toBe(429);
    expect((await sync(900)).status).toBe(429);
    expect((await sync(901)).status).not.toBe(429);
  }, 30_000);
});
