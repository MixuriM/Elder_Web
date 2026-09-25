import express from "express";
import request from "supertest";

const verifyIdToken = jest.fn();
const findFirst = jest.fn();
const findManyUsuario = jest.fn();
const create = jest.fn();
const updateUsuario = jest.fn();

jest.mock("../lib/firebaseAdmin", () => ({
  auth: { verifyIdToken: (...args: unknown[]) => verifyIdToken(...args) },
}));
jest.mock("../lib/prisma", () => ({
  prisma: {
    usuario: {
      findFirst: (...args: unknown[]) => findFirst(...args),
      findMany: (...args: unknown[]) => findManyUsuario(...args),
      create: (...args: unknown[]) => create(...args),
      update: (...args: unknown[]) => updateUsuario(...args),
    },
    vinculo: { create: jest.fn(), updateMany: jest.fn() },
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

const PICTURE = "https://lh3.googleusercontent.com/a/SEGREDO-DA-URL=s96-c";
const CONTEUDO = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from("bytes-da-foto-google")]);
const LIMITE = 2 * 1024 * 1024;

const fetchMock = jest.fn();

function resposta(opts: {
  ok?: boolean;
  status?: number;
  contentType?: string | null;
  contentLength?: string | null;
  corpo?: Buffer;
}) {
  const corpo = opts.corpo ?? CONTEUDO;
  const headers: Record<string, string | null> = {
    "content-type": opts.contentType === undefined ? "image/jpeg" : opts.contentType,
    "content-length": opts.contentLength === undefined ? null : opts.contentLength,
  };
  const arrayBuffer = jest.fn().mockResolvedValue(corpo.buffer.slice(corpo.byteOffset, corpo.byteOffset + corpo.length));
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    arrayBuffer,
  };
}

function sync(token: Record<string, unknown>, body: object = { tipo_perfil: "cuidador", nome: "Ana" }) {
  verifyIdToken.mockResolvedValue({ uid: "uid-novo", email: "ana@a.com", ...token });
  return request(buildApp()).post("/auth/sync").set("Authorization", "Bearer x").send(body);
}

let spies: jest.SpyInstance[];

beforeEach(() => {
  verifyIdToken.mockReset();
  findFirst.mockReset().mockResolvedValue(null);
  findManyUsuario.mockReset().mockResolvedValue([]);
  create.mockReset().mockResolvedValue({ id: 1, tipo_perfil: "cuidador" });
  updateUsuario.mockReset().mockImplementation((a: { where: { id: number } }) => ({ id: a.where.id }));
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
    jest.spyOn(console, m).mockImplementation(() => undefined),
  );
});

afterEach(() => spies.forEach((s) => s.mockRestore()));

function semVazamento() {
  for (const s of spies) {
    const saida = JSON.stringify(s.mock.calls);
    expect(saida).not.toContain("SEGREDO-DA-URL");
    expect(saida).not.toContain("googleusercontent");
    expect(saida).not.toContain("bytes-da-foto-google");
  }
}

describe("POST /auth/sync — foto do Google no cadastro", () => {
  it("baixa a foto e grava no MESMO create (sem update depois)", async () => {
    fetchMock.mockResolvedValue(resposta({}));

    const res = await sync({ picture: PICTURE });

    expect(res.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(PICTURE);
    expect(fetchMock.mock.calls[0][1].signal).toBeDefined();
    const data = create.mock.calls[0][0].data;
    expect(Buffer.from(data.foto_perfil).equals(CONTEUDO)).toBe(true);
    expect(data.foto_perfil_mime_type).toBe("image/jpeg");
    expect(data.foto_perfil_atualizada_em).toBeInstanceOf(Date);
    expect(updateUsuario).not.toHaveBeenCalled();
    semVazamento();
  });

  it("aceita image/png e Content-Type com parâmetros/caixa diferente", async () => {
    fetchMock.mockResolvedValue(resposta({ contentType: "IMAGE/PNG; charset=binary" }));
    await sync({ picture: PICTURE });
    expect(create.mock.calls[0][0].data.foto_perfil_mime_type).toBe("image/png");
  });

  it("aceita exatamente 2 MB", async () => {
    fetchMock.mockResolvedValue(resposta({ corpo: Buffer.alloc(LIMITE, 1) }));
    await sync({ picture: PICTURE });
    expect(create.mock.calls[0][0].data.foto_perfil).toBeDefined();
  });

  it("resposta de cadastro não devolve o buffer da foto", async () => {
    fetchMock.mockResolvedValue(resposta({}));
    create.mockResolvedValue({ id: 1, nome: "Ana", foto_perfil: CONTEUDO, foto_perfil_mime_type: "image/jpeg" });

    const res = await sync({ picture: PICTURE });

    expect(res.status).toBe(201);
    expect(res.body.usuario).not.toHaveProperty("foto_perfil");
    expect(JSON.stringify(res.body)).not.toContain("bytes-da-foto-google");
  });

  it("sem decoded.picture: não faz fetch e cadastra sem foto", async () => {
    const res = await sync({});
    expect(res.status).toBe(201);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(create.mock.calls[0][0].data).not.toHaveProperty("foto_perfil");
  });

  it("picture que não é https: não faz fetch e cadastra sem foto", async () => {
    const res = await sync({ picture: "http://interno.local/foto.jpg" });
    expect(res.status).toBe(201);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(create.mock.calls[0][0].data).not.toHaveProperty("foto_perfil");
  });

  it.each([
    "https://evil.example/foto.jpg",
    "https://169.254.169.254/latest/meta-data",
    "https://localhost/foto.jpg",
    "https://googleusercontent.com.evil.example/foto.jpg",
    "https://evilgoogleusercontent.com/foto.jpg",
    "https://lh3.googleusercontent.com@evil.example/foto.jpg",
    "not a url",
  ])("host fora do Google (%s): não faz fetch e cadastra sem foto", async (picture) => {
    const res = await sync({ picture });
    expect(res.status).toBe(201);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(create.mock.calls[0][0].data).not.toHaveProperty("foto_perfil");
  });

  it("fetch usa redirect manual e redirecionamento 3xx é rejeitado", async () => {
    fetchMock.mockResolvedValue(resposta({ ok: false, status: 302 }));
    const res = await sync({ picture: PICTURE });
    expect(res.status).toBe(201);
    expect(fetchMock.mock.calls[0][1].redirect).toBe("manual");
    expect(create.mock.calls[0][0].data).not.toHaveProperty("foto_perfil");
  });

  it.each([
    ["fetch rejeita (rede)", () => fetchMock.mockRejectedValue(new Error(`falha em ${PICTURE}`))],
    [
      "timeout",
      () => fetchMock.mockRejectedValue(Object.assign(new Error("timeout"), { name: "TimeoutError" })),
    ],
    ["HTTP 404", () => fetchMock.mockResolvedValue(resposta({ ok: false, status: 404 }))],
    ["Content-Type image/gif", () => fetchMock.mockResolvedValue(resposta({ contentType: "image/gif" }))],
    ["Content-Type ausente", () => fetchMock.mockResolvedValue(resposta({ contentType: null }))],
    ["Content-Type text/html", () => fetchMock.mockResolvedValue(resposta({ contentType: "text/html" }))],
    [
      "corpo acima de 2 MB",
      () => fetchMock.mockResolvedValue(resposta({ corpo: Buffer.alloc(LIMITE + 1, 1) })),
    ],
    [
      "Content-Length acima de 2 MB (nem lê o corpo)",
      () => fetchMock.mockResolvedValue(resposta({ contentLength: String(LIMITE + 1) })),
    ],
  ])("%s: cadastro segue sem foto, sem vazar URL nem bytes no log", async (_nome, preparar) => {
    preparar();

    const res = await sync({ picture: PICTURE });

    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data).not.toHaveProperty("foto_perfil");
    expect(create.mock.calls[0][0].data).not.toHaveProperty("foto_perfil_mime_type");
    expect(create.mock.calls[0][0].data).not.toHaveProperty("foto_perfil_atualizada_em");
    semVazamento();
  });

  it("Content-Length acima do limite: não chama arrayBuffer", async () => {
    const r = resposta({ contentLength: String(LIMITE + 1) });
    fetchMock.mockResolvedValue(r);
    await sync({ picture: PICTURE });
    expect(r.arrayBuffer).not.toHaveBeenCalled();
  });

  it("falha no download registra no máximo um log curto", async () => {
    fetchMock.mockRejectedValue(new Error("boom"));
    await sync({ picture: PICTURE });
    const chamadas = spies.reduce((n, s) => n + s.mock.calls.length, 0);
    expect(chamadas).toBeLessThanOrEqual(1);
  });
});

describe("POST /auth/sync — foto do Google nunca em login nem em anexo (3.3)", () => {
  it("login (usuário já existe por firebase_uid): não faz fetch e não devolve buffer", async () => {
    findFirst.mockResolvedValue({ id: 7, tipo_perfil: "cuidador" });
    updateUsuario.mockResolvedValue({ id: 7, foto_perfil: CONTEUDO, foto_perfil_mime_type: "image/jpeg" });

    const res = await sync({ picture: PICTURE });

    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(updateUsuario.mock.calls[0][0].data).not.toHaveProperty("foto_perfil");
    expect(res.body.usuario).not.toHaveProperty("foto_perfil");
  });

  it("anexo do idoso (3.3, update): não faz fetch, não grava foto e não devolve buffer", async () => {
    findFirst.mockImplementation((args: { where: { email?: string } }) =>
      Promise.resolve(args.where.email ? { id: 55, firebase_uid: null, cadastrado_por_id: 9 } : null),
    );
    updateUsuario.mockResolvedValue({ id: 55, foto_perfil: CONTEUDO, foto_perfil_mime_type: "image/jpeg" });

    const res = await sync({ picture: PICTURE, email_verified: true }, { tipo_perfil: "idoso" });

    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(updateUsuario.mock.calls[0][0].data).toEqual({ firebase_uid: "uid-novo" });
    expect(res.body.usuario).not.toHaveProperty("foto_perfil");
  });
});
