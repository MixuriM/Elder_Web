import express from "express";
import request from "supertest";

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
const MSG_TIPO = "Formato de foto não suportado. Envie JPEG ou PNG.";
const MSG_TAMANHO = "Foto acima do limite de 2 MB.";

const LIMITE = 2 * 1024 * 1024;
// Bytes reconhecíveis: nenhum log/resposta de erro pode conter esse trecho.
const CONTEUDO = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from("SEGREDO-DA-FOTO-123")]);

beforeEach(() => {
  verifyIdToken.mockReset().mockResolvedValue({ uid: "uid-42" });
  findFirst.mockReset().mockResolvedValue(USUARIO_LOGADO);
  findUnique.mockReset();
  update.mockReset().mockResolvedValue({ id: 42 });
});

describe("POST /usuario/me/foto", () => {
  const enviar = (buf: Buffer, contentType: string, campo = "foto") =>
    request(buildApp())
      .post("/usuario/me/foto")
      .set("Authorization", "Bearer x")
      .attach(campo, buf, { filename: "f.bin", contentType });

  it("401 sem token", async () => {
    const res = await request(buildApp()).post("/usuario/me/foto").attach("foto", CONTEUDO, {
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
    const res = await enviar(CONTEUDO, "image/jpeg", "outro");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: MSG_SEM_ARQUIVO });
    expect(update).not.toHaveBeenCalled();
  });

  it.each(["image/gif", "image/webp", "application/pdf", "text/plain", "application/octet-stream"])(
    "400 mimetype %s, sem ecoar o valor enviado",
    async (tipo) => {
      const res = await enviar(CONTEUDO, tipo);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: MSG_TIPO });
      expect(JSON.stringify(res.body)).not.toContain(tipo);
      expect(update).not.toHaveBeenCalled();
    },
  );

  it("400 acima de 2 MB", async () => {
    const res = await enviar(Buffer.alloc(LIMITE + 1, 1), "image/jpeg");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: MSG_TAMANHO });
    expect(update).not.toHaveBeenCalled();
  });

  it("aceita exatamente 2 MB", async () => {
    const res = await enviar(Buffer.alloc(LIMITE, 1), "image/png");
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("200 grava buffer, mime e data no próprio usuário e devolve data URI", async () => {
    const res = await enviar(CONTEUDO, "image/jpeg");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      foto_perfil_url: `data:image/jpeg;base64,${CONTEUDO.toString("base64")}`,
    });
    expect(update).toHaveBeenCalledTimes(1);
    const arg = update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 42 });
    expect(Buffer.from(arg.data.foto_perfil).equals(CONTEUDO)).toBe(true);
    expect(arg.data.foto_perfil_mime_type).toBe("image/jpeg");
    expect(arg.data.foto_perfil_atualizada_em).toBeInstanceOf(Date);
    // update não pode devolver o buffer de volta
    expect(arg.select?.foto_perfil).toBeUndefined();
  });

  it("200 com png", async () => {
    const res = await enviar(CONTEUDO, "image/png");
    expect(res.status).toBe(200);
    expect(res.body.foto_perfil_url).toMatch(/^data:image\/png;base64,/);
    expect(update.mock.calls[0][0].data.foto_perfil_mime_type).toBe("image/png");
  });

  it("qualquer tipo_perfil pode chamar: não consulta tipo_perfil", async () => {
    const res = await enviar(CONTEUDO, "image/jpeg");
    expect(res.status).toBe(200);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("ignora id/usuario_id enviados no form: alvo é sempre o usuário autenticado", async () => {
    const res = await request(buildApp())
      .post("/usuario/me/foto?id=7")
      .set("Authorization", "Bearer x")
      .field("id", "7")
      .field("usuario_id", "7")
      .attach("foto", CONTEUDO, { filename: "f.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(200);
    expect(update.mock.calls[0][0].where).toEqual({ id: 42 });
  });

  it("falha do banco vira 500 sem vazar os bytes em resposta nem em console.*", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    );
    update.mockRejectedValue(new Error(`falha com ${CONTEUDO.toString("base64")} e SEGREDO-DA-FOTO-123`));

    const res = await enviar(CONTEUDO, "image/jpeg");

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("SEGREDO-DA-FOTO");
    for (const s of spies) {
      expect(JSON.stringify(s.mock.calls)).not.toContain("SEGREDO-DA-FOTO");
      expect(JSON.stringify(s.mock.calls)).not.toContain(CONTEUDO.toString("base64"));
      s.mockRestore();
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
});

describe("GET /usuario/me/foto", () => {
  it("401 sem token", async () => {
    const res = await request(buildApp()).get("/usuario/me/foto");
    expect(res.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("200 devolve data URI do próprio usuário, sem buffer nem mime cru", async () => {
    findUnique.mockResolvedValueOnce({ foto_perfil: CONTEUDO, foto_perfil_mime_type: "image/jpeg" });

    const res = await request(buildApp()).get("/usuario/me/foto").set("Authorization", "Bearer x");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      foto_perfil_url: `data:image/jpeg;base64,${CONTEUDO.toString("base64")}`,
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
