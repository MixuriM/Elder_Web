import express from "express";
import request from "supertest";
import sharp from "sharp";

const verifyIdToken = jest.fn();
const findFirst = jest.fn();
const findUnique = jest.fn();
const update = jest.fn();

jest.mock("../lib/firebaseAdmin", () => ({
  auth: {
    verifyIdToken: (...args: unknown[]) => verifyIdToken(...args),
    updateUser: jest.fn(),
  },
}));
jest.mock("../lib/prisma", () => ({
  prisma: {
    usuario: {
      findFirst: (...args: unknown[]) => findFirst(...args),
      findUnique: (...args: unknown[]) => findUnique(...args),
      findUniqueOrThrow: jest.fn(),
      update: (...args: unknown[]) => update(...args),
      create: jest.fn(),
    },
    vinculo: { findFirst: jest.fn(), count: jest.fn() },
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

const MSG_SEM_ARQUIVO = "Nenhuma foto enviada.";
const MSG_TIPO = "Formato de foto não aceito. Envie uma foto em JPEG, PNG, WebP, GIF, AVIF ou TIFF.";
const MSG_TAMANHO = "Foto acima do limite de 15 MB. Escolha uma foto menor.";
const MSG_RESOLUCAO = "Foto com resolução grande demais. Escolha uma foto menor.";
const MSG_CORROMPIDA = "Não foi possível abrir a foto. O arquivo pode estar danificado. Tente outra foto.";
const MSG_LIMITE = "Você já enviou muitas fotos na última hora. Tente de novo mais tarde.";

const MB = 1024 * 1024;
// Trecho reconhecível: nenhum log nem resposta pode contê-lo.
const MARCADOR = "SEGREDO-DA-FOTO-123";

// Fixtures geradas pelo próprio sharp (nada de binário commitado).
const criar = (width: number, height: number, background = "#c03030", channels: 3 | 4 = 3) =>
  sharp({ create: { width, height, channels, background } });

let JPEG: Buffer;
// JPEG com o marcador e GPS no EXIF: o EXIF tem que sumir ao gravar.
let JPEG_COM_EXIF: Buffer;

// GIF89a de 2 quadros 1x1 montado à mão (o encoder do sharp não gera animação a partir de create).
function gifAnimado(): Buffer {
  const quadro = (indice: number) =>
    Buffer.from([0x21, 0xf9, 4, 0, 10, 0, 0, 0, 0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, indice ? 0x4c : 0x44, 0x01, 0]);
  return Buffer.concat([
    Buffer.from("GIF89a"),
    Buffer.from([1, 0, 1, 0, 0x80, 0, 0, 255, 0, 0, 0, 0, 255]),
    Buffer.from([0x21, 0xff, 11]),
    Buffer.from("NETSCAPE2.0"),
    Buffer.from([3, 1, 0, 0, 0]),
    quadro(0),
    quadro(1),
    Buffer.from([0x3b]),
  ]);
}

beforeAll(async () => {
  JPEG = await criar(64, 48).jpeg().toBuffer();
  JPEG_COM_EXIF = await criar(64, 48)
    .withExif({
      IFD0: { ImageDescription: MARCADOR },
      IFD3: { GPSLatitudeRef: "S", GPSLatitude: "23/1 32/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "46/1 38/1 0/1" },
    })
    .jpeg()
    .toBuffer();
});

// Cada teste começa 2 h depois do anterior: o limite de 10 envios por hora de um teste não vaza para o próximo.
let agora = Date.parse("2026-10-10T12:00:00Z");

beforeEach(() => {
  agora += 2 * 60 * 60_000;
  jest.spyOn(Date, "now").mockImplementation(() => agora);
  verifyIdToken.mockReset().mockResolvedValue({ uid: "uid-42" });
  findFirst.mockReset().mockResolvedValue(USUARIO_LOGADO);
  findUnique.mockReset();
  update.mockReset().mockResolvedValue({ id: 42 });
});

afterEach(() => jest.restoreAllMocks());

const gravado = () => update.mock.calls[0][0].data as { foto_perfil: Uint8Array; foto_perfil_mime_type: string };
const metaGravada = (opcoes?: { animated?: boolean }) => sharp(Buffer.from(gravado().foto_perfil), opcoes).metadata();

describe("POST /usuario/me/foto", () => {
  const enviar = (buf: Buffer, contentType: string, campo = "foto") =>
    request(buildApp())
      .post("/usuario/me/foto")
      .set("Authorization", "Bearer x")
      .attach(campo, buf, { filename: "f.bin", contentType });

  it("401 sem token", async () => {
    const res = await request(buildApp()).post("/usuario/me/foto").attach("foto", JPEG, {
      filename: "f.jpg",
      contentType: "image/jpeg",
    });
    expect(res.status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });

  it("400 sem arquivo", async () => {
    const res = await request(buildApp())
      .post("/usuario/me/foto")
      .set("Authorization", "Bearer x")
      .field("qualquer", "coisa");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: MSG_SEM_ARQUIVO });
    expect(update).not.toHaveBeenCalled();
  });

  it("400 quando o arquivo vem em campo com outro nome", async () => {
    const res = await enviar(JPEG, "image/jpeg", "outro");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: MSG_SEM_ARQUIVO });
    expect(update).not.toHaveBeenCalled();
  });

  it.each(["image/svg+xml", "application/pdf", "image/heic", "image/bmp", "text/plain", "application/octet-stream"])(
    "400 na triagem com mimetype %s, sem ecoar o valor enviado",
    async (tipo) => {
      const res = await enviar(JPEG, tipo);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: MSG_TIPO });
      expect(JSON.stringify(res.body)).not.toContain(tipo);
      expect(update).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["jpeg", "image/jpeg", () => criar(80, 60).jpeg().toBuffer()],
    ["png", "image/png", () => criar(80, 60).png().toBuffer()],
    ["webp", "image/webp", () => criar(80, 60).webp().toBuffer()],
    ["gif", "image/gif", () => criar(80, 60).gif().toBuffer()],
    ["avif", "image/avif", () => criar(80, 60).avif().toBuffer()],
    ["tiff", "image/tiff", () => criar(80, 60).tiff().toBuffer()],
  ] as const)("200 com %s: grava sempre WebP, com o mime vindo do servidor", async (_f, tipo, gerar) => {
    const res = await enviar(await gerar(), tipo);

    expect(res.status).toBe(200);
    expect(gravado().foto_perfil_mime_type).toBe("image/webp");
    expect((await metaGravada()).format).toBe("webp");
    expect(res.body).toEqual({
      foto_perfil_url: `data:image/webp;base64,${Buffer.from(gravado().foto_perfil).toString("base64")}`,
    });
  });

  it.each([
    [
      "SVG declarado como PNG",
      "image/png",
      () =>
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>'),
    ],
    ["texto declarado como JPEG", "image/jpeg", () => Buffer.from(`apenas texto ${MARCADOR}`)],
    ["PDF declarado como JPEG", "image/jpeg", () => Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj\n")],
    ["PSD declarado como PNG", "image/png", () => Buffer.concat([Buffer.from("8BPS"), Buffer.alloc(40)])],
  ] as const)("400 pelos bytes: %s", async (_c, tipo, gerar) => {
    const res = await enviar(gerar(), tipo);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: MSG_TIPO });
    expect(update).not.toHaveBeenCalled();
  });

  it("400 com JPEG cortado no meio (arquivo danificado)", async () => {
    const jpeg = await criar(400, 300).jpeg().toBuffer();
    const res = await enviar(jpeg.subarray(0, jpeg.length / 2), "image/jpeg");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: MSG_CORROMPIDA });
    expect(update).not.toHaveBeenCalled();
  });

  it("aceita foto válida de mais de 5 MB (antes o teto era 2 MB) e grava reduzida a 1024 px", async () => {
    // Ruído não comprime: PNG de ~5,5 MB.
    const ruido = Buffer.alloc(1400 * 1300 * 3);
    for (let i = 0; i < ruido.length; i++) ruido[i] = Math.imul(i, 2654435761) >>> 24;
    const png = await sharp(ruido, { raw: { width: 1400, height: 1300, channels: 3 } })
      .png({ compressionLevel: 0 })
      .toBuffer();
    expect(png.length).toBeGreaterThan(5 * MB);

    const res = await enviar(png, "image/png");

    expect(res.status).toBe(200);
    const meta = await metaGravada();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(1024);
    expect(gravado().foto_perfil.length).toBeLessThan(png.length / 4);
  });

  it("400 acima de 15 MB", async () => {
    const res = await enviar(Buffer.alloc(15 * MB + 1, 1), "image/jpeg");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: MSG_TAMANHO });
    expect(update).not.toHaveBeenCalled();
  });

  it("reduz para caber em 1024 x 1024 sem distorcer", async () => {
    await enviar(await criar(3000, 2000).jpeg().toBuffer(), "image/jpeg");
    const meta = await metaGravada();
    expect([meta.width, meta.height]).toEqual([1024, 683]);
  });

  it("não amplia foto pequena", async () => {
    await enviar(await criar(300, 200).png().toBuffer(), "image/png");
    const meta = await metaGravada();
    expect([meta.width, meta.height]).toEqual([300, 200]);
  });

  it("remove o EXIF (GPS e textos) da foto gravada", async () => {
    expect((await sharp(JPEG_COM_EXIF).metadata()).exif).toBeDefined();

    const res = await enviar(JPEG_COM_EXIF, "image/jpeg");

    expect(res.status).toBe(200);
    const meta = await metaGravada();
    expect(meta.exif).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
    expect(Buffer.from(gravado().foto_perfil).includes(MARCADOR)).toBe(false);
  });

  it("respeita a orientação EXIF do celular antes de descartar o EXIF", async () => {
    // 200 x 100 com orientação 6 (girar 90°): aparece em pé, 100 x 200.
    const deitada = await criar(200, 100).jpeg().withMetadata({ orientation: 6 }).toBuffer();

    await enviar(deitada, "image/jpeg");

    const meta = await metaGravada();
    expect([meta.width, meta.height]).toEqual([100, 200]);
    expect(meta.orientation).toBeUndefined();
  });

  it("GIF animado vira imagem estática (só o primeiro quadro)", async () => {
    const gif = gifAnimado();
    expect((await sharp(gif, { animated: true }).metadata()).pages).toBe(2);

    const res = await enviar(gif, "image/gif");

    expect(res.status).toBe(200);
    expect((await metaGravada({ animated: true })).pages ?? 1).toBe(1);
  });

  it("mantém a transparência do PNG", async () => {
    await enviar(await criar(40, 40, "rgba(0,0,0,0)", 4).png().toBuffer(), "image/png");
    expect((await metaGravada()).hasAlpha).toBe(true);
  });

  it("400 com imagem acima de 50 milhões de pixels (arquivo pequeno, bitmap gigante)", async () => {
    const bomba = await criar(8000, 6300, "#888888").png({ compressionLevel: 9 }).toBuffer();
    expect(bomba.length).toBeLessThan(15 * MB);

    const res = await enviar(bomba, "image/png");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: MSG_RESOLUCAO });
    expect(update).not.toHaveBeenCalled();
  });

  describe("limite de 10 envios por hora", () => {
    const post = (app: express.Express) =>
      request(app)
        .post("/usuario/me/foto")
        .set("Authorization", "Bearer x")
        .attach("foto", JPEG, { filename: "f.jpg", contentType: "image/jpeg" });

    it("429 a partir do 11º envio na mesma hora, sem tocar no banco; libera depois de 1 hora", async () => {
      const app = buildApp();
      for (let i = 0; i < 10; i++) expect((await post(app)).status).toBe(200);

      const bloqueado = await post(app);
      expect(bloqueado.status).toBe(429);
      expect(bloqueado.body).toEqual({ error: MSG_LIMITE });
      expect(Number(bloqueado.headers["retry-after"])).toBeGreaterThan(0);
      expect(update).toHaveBeenCalledTimes(10);

      agora += 60 * 60_000 + 1;
      expect((await post(app)).status).toBe(200);
    });

    it("envio recusado também conta (barra quem insiste com arquivo inválido)", async () => {
      const app = buildApp();
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post("/usuario/me/foto")
          .set("Authorization", "Bearer x")
          .attach("foto", Buffer.from("texto"), { filename: "f.jpg", contentType: "image/jpeg" });
      }
      expect((await post(app)).status).toBe(429);
      expect(update).not.toHaveBeenCalled();
    });

    it("é por usuário: outro usuário segue enviando", async () => {
      const app = buildApp();
      for (let i = 0; i < 10; i++) await post(app);
      expect((await post(app)).status).toBe(429);

      findFirst.mockResolvedValue({ ...USUARIO_LOGADO, id: 43, firebase_uid: "uid-43" });
      verifyIdToken.mockResolvedValue({ uid: "uid-43" });
      expect((await post(app)).status).toBe(200);
    });
  });

  it("qualquer tipo_perfil pode chamar: não consulta tipo_perfil", async () => {
    const res = await enviar(JPEG, "image/jpeg");
    expect(res.status).toBe(200);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("ignora id/usuario_id enviados no form: alvo é sempre o usuário autenticado", async () => {
    const res = await request(buildApp())
      .post("/usuario/me/foto?id=7")
      .set("Authorization", "Bearer x")
      .field("id", "7")
      .field("usuario_id", "7")
      .attach("foto", JPEG, { filename: "f.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(200);
    const arg = update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 42 });
    expect(arg.data.foto_perfil_atualizada_em).toBeInstanceOf(Date);
    // update não pode devolver o buffer de volta
    expect(arg.select?.foto_perfil).toBeUndefined();
  });

  it("nenhuma resposta nem console.* leva bytes ou nome do arquivo (erro de formato, de decodificação e do banco)", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    );
    update.mockRejectedValue(new Error(`falha com ${JPEG_COM_EXIF.toString("base64")} e ${MARCADOR}`));
    const post = (buf: Buffer) =>
      request(buildApp())
        .post("/usuario/me/foto")
        .set("Authorization", "Bearer x")
        .attach("foto", buf, { filename: `casa-da-ana-${MARCADOR}.jpg`, contentType: "image/jpeg" });

    const respostas = [
      await post(JPEG_COM_EXIF),
      await post(Buffer.from(`texto ${MARCADOR}`)),
      await post(JPEG_COM_EXIF.subarray(0, JPEG_COM_EXIF.length - 100)),
    ];

    expect(respostas.map((r) => r.status)).toEqual([500, 400, 400]);
    for (const r of respostas) expect(JSON.stringify(r.body)).not.toContain(MARCADOR);
    for (const s of spies) {
      expect(JSON.stringify(s.mock.calls)).not.toContain(MARCADOR);
      expect(JSON.stringify(s.mock.calls)).not.toContain(JPEG_COM_EXIF.toString("base64").slice(0, 40));
    }
  });
});

describe("DELETE /usuario/me/foto", () => {
  it("401 sem token", async () => {
    const res = await request(buildApp()).delete("/usuario/me/foto");
    expect(res.status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });

  it("200 zera os 3 campos e devolve foto_perfil_url null", async () => {
    const res = await request(buildApp()).delete("/usuario/me/foto").set("Authorization", "Bearer x");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ foto_perfil_url: null });
    const arg = update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 42 });
    expect(arg.data).toEqual({
      foto_perfil: null,
      foto_perfil_mime_type: null,
      foto_perfil_atualizada_em: null,
    });
  });

  it("idempotente: segunda chamada também responde 200 null", async () => {
    const app = buildApp();
    await request(app).delete("/usuario/me/foto").set("Authorization", "Bearer x");
    const res = await request(app).delete("/usuario/me/foto").set("Authorization", "Bearer x");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ foto_perfil_url: null });
  });

  it("não conta no limite de envios", async () => {
    const app = buildApp();
    for (let i = 0; i < 12; i++) {
      expect((await request(app).delete("/usuario/me/foto").set("Authorization", "Bearer x")).status).toBe(200);
    }
  });
});

describe("GET /usuario/me/foto", () => {
  it("401 sem token", async () => {
    const res = await request(buildApp()).get("/usuario/me/foto");
    expect(res.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("200 devolve data URI do próprio usuário, sem buffer nem mime cru", async () => {
    findUnique.mockResolvedValueOnce({ foto_perfil: JPEG, foto_perfil_mime_type: "image/jpeg" });

    const res = await request(buildApp()).get("/usuario/me/foto").set("Authorization", "Bearer x");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      foto_perfil_url: `data:image/jpeg;base64,${JPEG.toString("base64")}`,
    });
    const arg = findUnique.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 42 });
    expect(arg.select).toEqual({ foto_perfil: true, foto_perfil_mime_type: true });
  });

  it("200 sem foto: foto_perfil_url null", async () => {
    findUnique.mockResolvedValueOnce({ foto_perfil: null, foto_perfil_mime_type: null });
    const res = await request(buildApp()).get("/usuario/me/foto").set("Authorization", "Bearer x");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ foto_perfil_url: null });
  });

  it("falha do banco vira 500", async () => {
    findUnique.mockRejectedValueOnce(new Error("boom"));
    const res = await request(buildApp()).get("/usuario/me/foto").set("Authorization", "Bearer x");
    expect(res.status).toBe(500);
  });
});

describe("GET /usuario/me — não carrega a foto", () => {
  it("não seleciona foto e não devolve foto_perfil_url", async () => {
    findUnique
      .mockResolvedValueOnce(MODO_DECISAO_NEUTRO)
      .mockResolvedValueOnce({ id: 42, nome: "Ana", email: "a@a.com", telefone: "123", tipo_perfil: "idoso" });

    const res = await request(buildApp()).get("/usuario/me").set("Authorization", "Bearer x");

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("foto_perfil_url");
    const select = findUnique.mock.calls[1][0].select;
    expect(select.foto_perfil).toBeUndefined();
    expect(select.foto_perfil_mime_type).toBeUndefined();
  });
});
