import http from "node:http";
import type { AddressInfo } from "node:net";
import * as fotoPerfil from "../lib/fotoPerfil";

// Vagas de envio de foto (2 no processo, 1 por usuário, prazo de 60 s para o corpo chegar). Cliente HTTP cru,
// não supertest: os testes precisam mandar só parte do corpo e abortar no meio. A normalização é controlada
// por uma promessa: enquanto ela não resolve, o envio está "decodificando" no servidor.
const verifyIdToken = jest.fn(async (token: string) => ({ uid: `uid-${token}` }));
const update = jest.fn(async () => ({ id: 0 }));

jest.mock("../lib/firebaseAdmin", () => ({
  auth: { verifyIdToken: (...a: unknown[]) => verifyIdToken(...(a as [string])) },
}));
jest.mock("../lib/prisma", () => ({
  prisma: {
    usuario: {
      // Filtra de verdade pelo where: o token "<id>" vira firebase_uid "uid-<id>" e resolve o usuário <id>.
      findFirst: async ({ where }: { where: { firebase_uid?: string } }) => {
        const m = /^uid-(\d+)$/.exec(where.firebase_uid ?? "");
        return m ? { id: Number(m[1]) } : null;
      },
      update: (...a: unknown[]) => update(...(a as [])),
    },
  },
}));

import app from "../app";

const MSG_OCUPADO = "Muitos envios de foto neste momento. Tente de novo em instantes.";
const MSG_PRAZO = "O envio da foto demorou demais. Tente de novo com uma conexão melhor.";
const MSG_LIMITE = "Você já enviou muitas fotos na última hora. Tente de novo mais tarde.";
const MARCADOR = "SEGREDO-DA-FOTO-123";
const FOTO_OK = { buffer: Buffer.from("webp"), mimeType: "image/webp" as const };

let servidor: http.Server;
let porta: number;
let normalizar: jest.SpyInstance;
let pendentes: (() => void)[] = [];
let proximoUsuario = 1000;
const novoUsuario = () => proximoUsuario++;
let agora = Date.parse("2026-10-10T12:00:00Z");

beforeAll(async () => {
  servidor = app.listen(0);
  await new Promise((r) => servidor.once("listening", r));
  porta = (servidor.address() as AddressInfo).port;
});

afterAll(async () => {
  servidor.closeAllConnections();
  await new Promise((r) => servidor.close(r));
});

beforeEach(() => {
  agora += 2 * 60 * 60_000;
  jest.spyOn(Date, "now").mockImplementation(() => agora);
  update.mockClear();
  pendentes = [];
  normalizar = jest.spyOn(fotoPerfil, "normalizarFoto").mockResolvedValue(FOTO_OK);
});

afterEach(() => {
  liberarNormalizacao();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const segurarNormalizacao = () =>
  normalizar.mockImplementation(() => new Promise((r) => pendentes.push(() => r(FOTO_OK))));
const liberarNormalizacao = () => pendentes.splice(0).forEach((r) => r());

// Espera por I/O real sem setTimeout (que pode estar falso no teste do prazo).
async function ate(cond: () => boolean) {
  for (let i = 0; i < 200_000 && !cond(); i++) await new Promise((r) => setImmediate(r));
  expect(cond()).toBe(true);
}

type Resposta = { status: number; body: unknown };
type Envio = { req: http.ClientRequest; resposta: Promise<Resposta>; pronta: () => boolean };

// parcial: manda o corpo sem os últimos 100 bytes e fica parado (corpo nunca termina de chegar).
function enviar(
  usuario: number,
  { parcial = false, campo = "foto", conteudo = Buffer.from(`jpeg ${MARCADOR}`), nome = "f.jpg", tamanho = 0 } = {},
): Envio {
  const fronteira = "----elderweb";
  const corpo = Buffer.concat([
    Buffer.from(
      `--${fronteira}\r\nContent-Disposition: form-data; name="${campo}"; filename="${nome}"\r\n` +
        "Content-Type: image/jpeg\r\n\r\n",
    ),
    tamanho ? Buffer.alloc(tamanho, 1) : conteudo,
    Buffer.from(`\r\n--${fronteira}--\r\n`),
  ]);
  let pronta = false;
  let resolver!: (r: Resposta) => void;
  const resposta = new Promise<Resposta>((r) => (resolver = r)).then((r) => ((pronta = true), r));
  const req = http.request(
    {
      port: porta,
      method: "POST",
      path: "/usuario/me/foto",
      headers: {
        authorization: `Bearer ${usuario}`,
        "content-type": `multipart/form-data; boundary=${fronteira}`,
        "content-length": corpo.length,
      },
    },
    (res) => {
      const partes: Buffer[] = [];
      res.on("data", (c: Buffer) => partes.push(c));
      res.on("end", () => {
        const texto = Buffer.concat(partes).toString();
        resolver({ status: res.statusCode ?? 0, body: texto ? JSON.parse(texto) : null });
      });
      res.on("error", () => resolver({ status: -1, body: null }));
    },
  );
  req.on("error", () => resolver({ status: -1, body: null }));
  if (parcial) req.write(corpo.subarray(0, corpo.length - 100));
  else req.end(corpo);
  return { req, resposta, pronta: () => pronta };
}

// As vagas estão zeradas: o usuário do cenário e mais um entram e ficam decodificando (2 vagas livres, usuário
// fora do conjunto) e um terceiro recebe 429 (o contador não ficou negativo). Depois tudo termina em 200.
async function expectVagasZeradas(usuario: number) {
  segurarNormalizacao();
  const base = normalizar.mock.calls.length;
  const a = enviar(usuario);
  const b = enviar(novoUsuario());
  await ate(() => normalizar.mock.calls.length === base + 2 || a.pronta() || b.pronta());
  expect(normalizar.mock.calls.length).toBe(base + 2);
  const c = enviar(novoUsuario());
  await ate(() => c.pronta() || normalizar.mock.calls.length === base + 3);
  liberarNormalizacao();
  expect(await c.resposta).toEqual({ status: 429, body: { error: MSG_OCUPADO } });
  expect((await a.resposta).status).toBe(200);
  expect((await b.resposta).status).toBe(200);
  normalizar.mockResolvedValue(FOTO_OK);
}

describe("vagas de envio de foto", () => {
  it("a) clientes que abortam durante a decodificação seguram a vaga até ela terminar; a gravação é pulada", async () => {
    segurarNormalizacao();
    const a = enviar(novoUsuario());
    const b = enviar(novoUsuario());
    await ate(() => normalizar.mock.calls.length === 2);
    a.req.destroy();
    b.req.destroy();
    await Promise.all([a.resposta, b.resposta]);

    const durante = enviar(novoUsuario());
    await ate(() => durante.pronta() || normalizar.mock.calls.length === 3);
    expect(await durante.resposta).toEqual({ status: 429, body: { error: MSG_OCUPADO } });

    liberarNormalizacao();
    for (let i = 0; i < 50; i++) await new Promise((r) => setImmediate(r));
    const depois = enviar(novoUsuario());
    await ate(() => depois.pronta() || normalizar.mock.calls.length === 3);
    liberarNormalizacao();
    expect((await depois.resposta).status).toBe(200);
    // Só o envio de depois chega ao banco: os abortados não gravam.
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("b) abort durante o corpo libera a vaga e o usuário na hora", async () => {
    const usuario = novoUsuario();
    const parcial = enviar(usuario, { parcial: true });
    await new Promise((r) => setTimeout(r, 50));
    parcial.req.destroy();
    await parcial.resposta;
    await new Promise((r) => setTimeout(r, 50));
    expect(normalizar).not.toHaveBeenCalled();
    await expectVagasZeradas(usuario);
  });

  it("b) erro do multer (arquivo em outro campo) libera a vaga e o usuário", async () => {
    const usuario = novoUsuario();
    expect((await enviar(usuario, { campo: "outro" }).resposta).status).toBe(400);
    await expectVagasZeradas(usuario);
  });

  it("c) 1 envio por usuário: o 2º do mesmo usuário recebe 429, outro usuário passa, e depois o primeiro volta", async () => {
    segurarNormalizacao();
    const usuario = novoUsuario();
    const primeiro = enviar(usuario);
    await ate(() => normalizar.mock.calls.length === 1);

    expect(await enviar(usuario).resposta).toEqual({ status: 429, body: { error: MSG_OCUPADO } });
    const outro = enviar(novoUsuario());
    await ate(() => normalizar.mock.calls.length === 2 || outro.pronta());
    expect(normalizar).toHaveBeenCalledTimes(2);

    liberarNormalizacao();
    expect((await primeiro.resposta).status).toBe(200);
    expect((await outro.resposta).status).toBe(200);
    normalizar.mockResolvedValue(FOTO_OK);
    expect((await enviar(usuario).resposta).status).toBe(200);
  });

  describe("d) prazo de 60 s para o corpo chegar", () => {
    beforeEach(() => jest.useFakeTimers({ now: agora, doNotFake: ["setImmediate", "nextTick", "queueMicrotask"] }));

    it("corpo que não termina de chegar recebe 408 aos 60 s e a vaga volta", async () => {
      const usuario = novoUsuario();
      const parcial = enviar(usuario, { parcial: true });
      await ate(() => jest.getTimerCount() === 1);

      jest.advanceTimersByTime(59_999);
      for (let i = 0; i < 50; i++) await new Promise((r) => setImmediate(r));
      expect(parcial.pronta()).toBe(false);

      jest.advanceTimersByTime(1);
      expect(await parcial.resposta).toEqual({ status: 408, body: { error: MSG_PRAZO } });
      expect(normalizar).not.toHaveBeenCalled();
      await expectVagasZeradas(usuario);
      expect(jest.getTimerCount()).toBe(0);
    });

    it("corpo que chega a tempo não recebe 408, mesmo com a decodificação passando de 60 s; nenhum timer sobra", async () => {
      segurarNormalizacao();
      const envio = enviar(novoUsuario());
      await ate(() => normalizar.mock.calls.length === 1);
      expect(jest.getTimerCount()).toBe(0);

      jest.advanceTimersByTime(61_000);
      liberarNormalizacao();
      expect((await envio.resposta).status).toBe(200);
      jest.advanceTimersByTime(61_000);
      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe("e) vagas voltam a zero (contador e conjunto por usuário)", () => {
    it("depois de sucesso", async () => {
      const usuario = novoUsuario();
      expect((await enviar(usuario).resposta).status).toBe(200);
      await expectVagasZeradas(usuario);
    });

    it("depois de 400 de formato", async () => {
      normalizar.mockRejectedValue(new fotoPerfil.FotoInvalida("formato"));
      const usuario = novoUsuario();
      expect((await enviar(usuario).resposta).status).toBe(400);
      await expectVagasZeradas(usuario);
    });

    it("depois de 400 de tamanho (acima de 15 MB)", async () => {
      const usuario = novoUsuario();
      expect((await enviar(usuario, { tamanho: 15 * 1024 * 1024 + 1 }).resposta).status).toBe(400);
      await expectVagasZeradas(usuario);
    });

    it("depois de 429 do limite por hora: o usuário sai do conjunto (o próximo 429 é o da hora, não o de ocupado)", async () => {
      const usuario = novoUsuario();
      for (let i = 0; i < 10; i++) await enviar(usuario).resposta;
      expect(await enviar(usuario).resposta).toEqual({ status: 429, body: { error: MSG_LIMITE } });
      expect(await enviar(usuario).resposta).toEqual({ status: 429, body: { error: MSG_LIMITE } });
      await expectVagasZeradas(novoUsuario());
    });

    it("depois de 429 de concorrência", async () => {
      segurarNormalizacao();
      const a = enviar(novoUsuario());
      const b = enviar(novoUsuario());
      await ate(() => normalizar.mock.calls.length === 2);
      const recusado = novoUsuario();
      expect((await enviar(recusado).resposta).status).toBe(429);
      liberarNormalizacao();
      await Promise.all([a.resposta, b.resposta]);
      normalizar.mockResolvedValue(FOTO_OK);
      await expectVagasZeradas(recusado);
    });

    it("depois de abort durante a decodificação", async () => {
      segurarNormalizacao();
      const usuario = novoUsuario();
      const envio = enviar(usuario);
      await ate(() => normalizar.mock.calls.length === 1);
      envio.req.destroy();
      await envio.resposta;
      liberarNormalizacao();
      for (let i = 0; i < 50; i++) await new Promise((r) => setImmediate(r));
      normalizar.mockResolvedValue(FOTO_OK);
      await expectVagasZeradas(usuario);
    });
  });

  describe("f) nada vaza no 408 nem no 429", () => {
    const espiarConsole = () =>
      (["log", "info", "warn", "error", "debug"] as const).map((m) =>
        jest.spyOn(console, m).mockImplementation(() => undefined),
      );
    const semVazamento = (spies: jest.SpyInstance[], corpo: unknown, usuario: number) => {
      const textos = [JSON.stringify(corpo), ...spies.map((s) => JSON.stringify(s.mock.calls))];
      for (const t of textos) {
        expect(t).not.toContain(MARCADOR);
        expect(t).not.toContain("casa-da-ana");
        expect(t).not.toContain(String(usuario));
      }
    };

    it("408", async () => {
      jest.useFakeTimers({ now: agora, doNotFake: ["setImmediate", "nextTick", "queueMicrotask"] });
      const spies = espiarConsole();
      const usuario = 987654;
      const parcial = enviar(usuario, { parcial: true, nome: `casa-da-ana-${MARCADOR}.jpg` });
      await ate(() => jest.getTimerCount() === 1);
      jest.advanceTimersByTime(60_000);
      const r = await parcial.resposta;
      for (let i = 0; i < 50; i++) await new Promise((res) => setImmediate(res));
      expect(r).toEqual({ status: 408, body: { error: MSG_PRAZO } });
      semVazamento(spies, r.body, usuario);
      // O multer reclama do corpo cortado depois do 408: isso não pode virar "Erro não tratado" no log.
      for (const s of spies) expect(s).not.toHaveBeenCalled();
    });

    it("429 de concorrência", async () => {
      const spies = espiarConsole();
      segurarNormalizacao();
      const a = enviar(novoUsuario());
      const b = enviar(novoUsuario());
      await ate(() => normalizar.mock.calls.length === 2);
      const usuario = 876543;
      const r = await enviar(usuario, { nome: `casa-da-ana-${MARCADOR}.jpg` }).resposta;
      expect(r.status).toBe(429);
      semVazamento(spies, r.body, usuario);
      liberarNormalizacao();
      await Promise.all([a.resposta, b.resposta]);
    });
  });
});
