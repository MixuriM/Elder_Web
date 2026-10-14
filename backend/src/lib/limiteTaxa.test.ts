import express from "express";
import request from "supertest";
import { criarLimitador, definirLimitesEmTeste, limparLimitadores, MSG_LIMITE_TAXA } from "./limiteTaxa";

// Chave vem do cabeçalho de teste x-chave; sem cabeçalho, sem chave.
function montar(maximo: number, janelaMs = 60_000) {
  const limitador = criarLimitador({ janelaMs, maximo, chave: (req) => req.header("x-chave") });
  const app = express();
  app.get("/x", limitador, (_req, res) => res.status(200).json({ ok: true }));
  return { app, limitador };
}

const ambienteOriginal = { ...process.env };
let agora = 1_000_000;

beforeEach(() => {
  agora = 1_000_000;
  jest.spyOn(Date, "now").mockImplementation(() => agora);
  definirLimitesEmTeste(true);
});

afterEach(() => {
  jest.restoreAllMocks();
  definirLimitesEmTeste(undefined);
  limparLimitadores();
  process.env = { ...ambienteOriginal };
});

describe("criarLimitador", () => {
  it("deixa passar até o máximo e bloqueia a requisição N+1 com 429, corpo fixo e Retry-After", async () => {
    const { app } = montar(3);
    for (let i = 0; i < 3; i++) expect((await request(app).get("/x").set("x-chave", "a")).status).toBe(200);
    agora += 10_000;
    const res = await request(app).get("/x").set("x-chave", "a");
    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: MSG_LIMITE_TAXA });
    expect(MSG_LIMITE_TAXA).toBe("Muitas tentativas. Aguarde alguns minutos e tente de novo.");
    expect(res.headers["retry-after"]).toBe("50");
  });

  it("a janela reinicia quando vence", async () => {
    const { app } = montar(1);
    expect((await request(app).get("/x").set("x-chave", "a")).status).toBe(200);
    expect((await request(app).get("/x").set("x-chave", "a")).status).toBe(429);
    agora += 60_000;
    expect((await request(app).get("/x").set("x-chave", "a")).status).toBe(200);
  });

  it("chaves diferentes têm contagens isoladas", async () => {
    const { app } = montar(1);
    expect((await request(app).get("/x").set("x-chave", "a")).status).toBe(200);
    expect((await request(app).get("/x").set("x-chave", "a")).status).toBe(429);
    expect((await request(app).get("/x").set("x-chave", "b")).status).toBe(200);
  });

  it("limitadores diferentes não dividem contagem", async () => {
    const um = montar(1);
    const outro = montar(1);
    expect((await request(um.app).get("/x").set("x-chave", "a")).status).toBe(200);
    expect((await request(outro.app).get("/x").set("x-chave", "a")).status).toBe(200);
  });

  it("sem chave, deixa passar", async () => {
    const { app } = montar(1);
    expect((await request(app).get("/x")).status).toBe(200);
    expect((await request(app).get("/x")).status).toBe(200);
  });

  it("purga entradas vencidas quando o mapa passa de 5.000 chaves", () => {
    const { limitador } = montar(1, 1000);
    const next = jest.fn();
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), setHeader: jest.fn() };
    const req = (chave: string) => ({ header: () => chave }) as unknown as express.Request;
    for (let i = 0; i < 5001; i++) limitador(req(`k${i}`), res as unknown as express.Response, next);
    expect(limitador.tamanho()).toBe(5001);
    agora += 1000;
    limitador(req("nova"), res as unknown as express.Response, next);
    expect(limitador.tamanho()).toBe(1);
  });

  it("não loga a chave, o IP nem o corpo ao bloquear", async () => {
    const espioes = (["log", "info", "warn", "error", "debug"] as const).map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
    const { app } = montar(1);
    await request(app).get("/x").set("x-chave", "segredo-chave");
    await request(app).get("/x").set("x-chave", "segredo-chave");
    for (const e of espioes) expect(e).not.toHaveBeenCalled();
  });
});

describe("liga e desliga", () => {
  it("sob Jest (NODE_ENV=test) vem desligado por padrão", async () => {
    definirLimitesEmTeste(undefined);
    const { app } = montar(1);
    expect((await request(app).get("/x").set("x-chave", "a")).status).toBe(200);
    expect((await request(app).get("/x").set("x-chave", "a")).status).toBe(200);
  });

  it("fora de produção, LIMITE_TAXA_DESLIGADO=1 desliga", async () => {
    definirLimitesEmTeste(undefined);
    process.env.NODE_ENV = "development";
    process.env.LIMITE_TAXA_DESLIGADO = "1";
    const { app } = montar(1);
    expect((await request(app).get("/x").set("x-chave", "a")).status).toBe(200);
    expect((await request(app).get("/x").set("x-chave", "a")).status).toBe(200);
  });

  it("fora de produção e sem a variável, fica ligado", async () => {
    definirLimitesEmTeste(undefined);
    process.env.NODE_ENV = "development";
    delete process.env.LIMITE_TAXA_DESLIGADO;
    const { app } = montar(1);
    expect((await request(app).get("/x").set("x-chave", "a")).status).toBe(200);
    expect((await request(app).get("/x").set("x-chave", "a")).status).toBe(429);
  });

  it("em produção, LIMITE_TAXA_DESLIGADO=1 é ignorado", async () => {
    definirLimitesEmTeste(undefined);
    process.env.NODE_ENV = "production";
    process.env.LIMITE_TAXA_DESLIGADO = "1";
    const { app } = montar(1);
    expect((await request(app).get("/x").set("x-chave", "a")).status).toBe(200);
    expect((await request(app).get("/x").set("x-chave", "a")).status).toBe(429);
  });
});
