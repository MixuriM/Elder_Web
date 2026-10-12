import express from "express";
import request from "supertest";

// Convite do idoso ao cuidador: o cuidador aceita ou recusa (POST /:id/aceitar-convite e /:id/recusar-convite), o
// GET /vinculo mostra quem convidou e /aprovar não aprova convite. Fake de Prisma com estado em memória que filtra
// de verdade pelo where (senão os testes de "vínculo de outro" passariam por vacuidade).
// Todos os ids, nomes, e-mails e uids abaixo são FICTÍCIOS, só para teste.
type UsuarioFake = {
  id: number;
  nome: string;
  email: string;
  firebase_uid: string;
  tipo_perfil: string;
  modo_decisao: string | null;
  modo_decisao_solicitado: string | null;
  modo_decisao_solicitado_por_id: number | null;
  modo_decisao_solicitado_em: Date | null;
  modo_decisao_expira_em: Date | null;
  modo_decisao_segunda_confirmacao_id: number | null;
  modo_decisao_alterado_por_id: number | null;
  modo_decisao_alterado_em: Date | null;
  modo_decisao_motivo: string | null;
};

type VinculoFake = {
  id: number;
  idoso_id: number;
  vinculado_id: number;
  tipo_vinculo: string;
  origem: string;
  status: string;
  data_solicitacao: Date;
  data_resposta: Date | null;
  confirmado_em: Date | null;
  aprovador_id: number | null;
  permite_registrar_saude: boolean;
  permite_marcar_dose: boolean;
  permite_criar_evento_cuidado: boolean;
};

type Where = {
  id?: number;
  idoso_id?: number | { in: number[] };
  vinculado_id?: number;
  tipo_vinculo?: string;
  status?: string | { in: string[] };
};

let usuarios: Record<number, UsuarioFake>;
let vinculos: VinculoFake[];
let aposLeitura: (() => void) | null;
const verifyIdToken = jest.fn();
const updateManySpy = jest.fn();
const updateSpy = jest.fn();

function casa(v: VinculoFake, w: Where): boolean {
  if (w.id !== undefined && v.id !== w.id) return false;
  if (typeof w.idoso_id === "number" && v.idoso_id !== w.idoso_id) return false;
  if (typeof w.idoso_id === "object" && !w.idoso_id.in.includes(v.idoso_id)) return false;
  if (w.vinculado_id !== undefined && v.vinculado_id !== w.vinculado_id) return false;
  if (w.tipo_vinculo !== undefined && v.tipo_vinculo !== w.tipo_vinculo) return false;
  if (typeof w.status === "string" && v.status !== w.status) return false;
  if (typeof w.status === "object" && !w.status.in.includes(v.status)) return false;
  return true;
}

jest.mock("../lib/firebaseAdmin", () => ({
  auth: { verifyIdToken: (...args: unknown[]) => verifyIdToken(...args) },
}));
jest.mock("../lib/prisma", () => ({
  prisma: {
    usuario: {
      findFirst: async ({ where }: { where: { firebase_uid: string } }) =>
        Object.values(usuarios).find((u) => u.firebase_uid === where.firebase_uid) ?? null,
      findUnique: async ({ where }: { where: { id: number } }) => usuarios[where.id] ?? null,
    },
    vinculo: {
      findUnique: async ({ where }: { where: { id: number } }) => {
        const achou = vinculos.find((v) => v.id === where.id) ?? null;
        const copia = achou ? { ...achou } : null;
        aposLeitura?.();
        return copia;
      },
      findFirst: async ({ where }: { where: Where }) => vinculos.find((v) => casa(v, where)) ?? null,
      findMany: async ({ where }: { where: Where }) =>
        vinculos.filter((v) => casa(v, where)).map((v) => ({ ...v, idoso: usuarios[v.idoso_id], vinculado: usuarios[v.vinculado_id] })),
      count: async ({ where }: { where: Where }) => vinculos.filter((v) => casa(v, where)).length,
      update: async (args: { where: { id: number }; data: Partial<VinculoFake> }) => {
        updateSpy(args);
        const v = vinculos.find((x) => x.id === args.where.id);
        if (v) Object.assign(v, args.data);
        return v;
      },
      updateMany: async (args: { where: Where; data: Partial<VinculoFake> }) => {
        updateManySpy(args);
        const alvos = vinculos.filter((v) => casa(v, args.where));
        alvos.forEach((v) => Object.assign(v, args.data));
        return { count: alvos.length };
      },
    },
  },
}));

import vinculoRouter from "./vinculo";

function usuario(id: number, nome: string, tipo: string, extra: Partial<UsuarioFake> = {}): UsuarioFake {
  return {
    id,
    nome,
    email: `${nome.toLowerCase()}@exemplo.test`,
    firebase_uid: `uid-ficticio-${id}`,
    tipo_perfil: tipo,
    modo_decisao: null,
    modo_decisao_solicitado: null,
    modo_decisao_solicitado_por_id: null,
    modo_decisao_solicitado_em: null,
    modo_decisao_expira_em: null,
    modo_decisao_segunda_confirmacao_id: null,
    modo_decisao_alterado_por_id: null,
    modo_decisao_alterado_em: null,
    modo_decisao_motivo: null,
    ...extra,
  };
}

const AGORA = new Date("2026-10-12T12:00:00.000Z").getTime();
const DIA = 24 * 60 * 60 * 1000;

function vinculo(id: number, idoso_id: number, vinculado_id: number, extra: Partial<VinculoFake> = {}): VinculoFake {
  return {
    id,
    idoso_id,
    vinculado_id,
    tipo_vinculo: "cuidador",
    origem: "convite_idoso",
    status: "pendente",
    data_solicitacao: new Date(AGORA - DIA),
    data_resposta: null,
    confirmado_em: null,
    aprovador_id: null,
    permite_registrar_saude: false,
    permite_marcar_dose: false,
    permite_criar_evento_cuidado: false,
    ...extra,
  };
}

const IDOSO = 10;
const CUIDADOR = 30;
const OUTRO_CUIDADOR = 31;
const FAMILIAR = 20;
const CONVITE = 1;

let relogio: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  aposLeitura = null;
  relogio = jest.spyOn(Date, "now").mockReturnValue(AGORA);
  usuarios = {
    [IDOSO]: usuario(IDOSO, "Ana", "idoso"),
    [FAMILIAR]: usuario(FAMILIAR, "Fabio", "familiar"),
    [CUIDADOR]: usuario(CUIDADOR, "Caio", "cuidador"),
    [OUTRO_CUIDADOR]: usuario(OUTRO_CUIDADOR, "Clara", "cuidador"),
  };
  vinculos = [vinculo(CONVITE, IDOSO, CUIDADOR)];
});

afterEach(() => {
  relogio.mockRestore();
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/vinculo", vinculoRouter);
  app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: "Erro interno." });
  });
  return app;
}

function como(id: number, emailVerificado = true) {
  verifyIdToken.mockResolvedValue({ uid: usuarios[id].firebase_uid, email_verified: emailVerificado });
}

function post(caminho: string) {
  return request(buildApp()).post(caminho).set("Authorization", "Bearer x").send();
}

const aceitar = (id: number | string = CONVITE) => post(`/vinculo/${id}/aceitar-convite`);
const recusar = (id: number | string = CONVITE) => post(`/vinculo/${id}/recusar-convite`);

describe("POST /vinculo/:id/aceitar-convite", () => {
  it("aceita: aprova, grava o aprovador e as datas, resposta só { id, status } e flags continuam false", async () => {
    como(CUIDADOR);
    const res = await aceitar();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: CONVITE, status: "aprovado" });
    expect(updateManySpy).toHaveBeenCalledTimes(1);
    expect(updateManySpy).toHaveBeenCalledWith({
      where: { id: CONVITE, status: "pendente" },
      data: {
        status: "aprovado",
        aprovador_id: CUIDADOR,
        data_resposta: expect.any(Date),
        confirmado_em: expect.any(Date),
      },
    });
    const dados = updateManySpy.mock.calls[0][0].data;
    expect(Object.keys(dados).some((k) => k.startsWith("permite_"))).toBe(false);
    expect(vinculos[0].permite_registrar_saude).toBe(false);
    expect(vinculos[0].permite_marcar_dose).toBe(false);
    expect(vinculos[0].permite_criar_evento_cuidado).toBe(false);
  });

  it("convite com 6 dias ainda vale", async () => {
    vinculos[0].data_solicitacao = new Date(AGORA - 6 * DIA);
    como(CUIDADOR);
    expect((await aceitar()).status).toBe(200);
  });

  it("convite com exatamente 7 dias ainda vale", async () => {
    vinculos[0].data_solicitacao = new Date(AGORA - 7 * DIA);
    como(CUIDADOR);
    expect((await aceitar()).status).toBe(200);
  });

  it("409 com 7 dias e 1 ms: expirado, sem escrita", async () => {
    vinculos[0].data_solicitacao = new Date(AGORA - 7 * DIA - 1);
    como(CUIDADOR);
    const res = await aceitar();

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Este convite não vale mais. Peça um novo convite ao idoso.");
    expect(updateManySpy).not.toHaveBeenCalled();
    expect(vinculos[0].status).toBe("pendente");
  });

  it("409 quando a autoridade do idoso já passou para a família, sem escrita", async () => {
    usuarios[IDOSO].modo_decisao = "familiar";
    como(CUIDADOR);
    const res = await aceitar();

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Este convite não vale mais. Peça um novo convite ao idoso.");
    expect(res.body.error).not.toMatch(/modo_decisao/);
    expect(updateManySpy).not.toHaveBeenCalled();
  });

  it("403 sem e-mail verificado, sem escrita", async () => {
    como(CUIDADOR, false);
    const res = await aceitar();

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Confirme o seu e-mail antes de aceitar o convite.");
    expect(updateManySpy).not.toHaveBeenCalled();
    expect(vinculos[0].status).toBe("pendente");
  });

  it("e-mail não verificado ausente no token também dá 403", async () => {
    verifyIdToken.mockResolvedValue({ uid: usuarios[CUIDADOR].firebase_uid });
    expect((await aceitar()).status).toBe(403);
    expect(updateManySpy).not.toHaveBeenCalled();
  });

  it("409 por corrida: o idoso cancelou entre a leitura e a escrita (count 0)", async () => {
    como(CUIDADOR);
    aposLeitura = () => {
      vinculos[0].status = "recusado";
    };
    const res = await aceitar();

    expect(res.status).toBe(409);
    expect(vinculos[0].status).toBe("recusado");
    expect(vinculos[0].confirmado_em).toBeNull();
  });
});

describe("regras comuns de aceitar e recusar convite", () => {
  const rotas = [
    ["aceitar", aceitar],
    ["recusar", recusar],
  ] as const;

  describe.each(rotas)("%s", (_nome, chamar) => {
    it.each(["abc", "1.5", "1e1x"])("400 para :id inválido %s", async (id) => {
      como(CUIDADOR);
      expect((await chamar(id)).status).toBe(400);
      expect(updateManySpy).not.toHaveBeenCalled();
    });

    it("404 igual para vínculo inexistente, de outro cuidador, de familiar e de origem solicitacao_cuidador", async () => {
      vinculos.push(
        vinculo(2, IDOSO, OUTRO_CUIDADOR),
        vinculo(3, IDOSO, CUIDADOR, { tipo_vinculo: "familiar" }),
        vinculo(4, IDOSO, CUIDADOR, { origem: "solicitacao_cuidador" }),
      );
      como(CUIDADOR);

      const respostas = [];
      for (const id of [999, 2, 3, 4]) {
        respostas.push(await chamar(id));
      }

      respostas.forEach((r) => expect(r.status).toBe(404));
      expect(new Set(respostas.map((r) => r.text)).size).toBe(1);
      expect(updateManySpy).not.toHaveBeenCalled();
      expect(vinculos.slice(1).every((v) => v.status === "pendente")).toBe(true);
    });

    it("404 quando o idoso (dono do convite) tenta responder em nome do cuidador", async () => {
      como(IDOSO);
      expect((await chamar()).status).toBe(404);
      expect(updateManySpy).not.toHaveBeenCalled();
    });

    it.each(["aprovado", "recusado"])("409 se o convite já está %s", async (status) => {
      vinculos[0].status = status;
      como(CUIDADOR);
      expect((await chamar()).status).toBe(409);
      expect(updateManySpy).not.toHaveBeenCalled();
    });
  });
});

describe("POST /vinculo/:id/recusar-convite", () => {
  it("recusa: grava recusado, aprovador e data, resposta só { id, status }", async () => {
    como(CUIDADOR);
    const res = await recusar();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: CONVITE, status: "recusado" });
    expect(updateManySpy).toHaveBeenCalledWith({
      where: { id: CONVITE, status: "pendente" },
      data: { status: "recusado", aprovador_id: CUIDADOR, data_resposta: expect.any(Date) },
    });
    expect(vinculos[0].confirmado_em).toBeNull();
  });

  it("recusar não exige e-mail verificado", async () => {
    como(CUIDADOR, false);
    expect((await recusar()).status).toBe(200);
  });

  it("recusar não exige prazo: convite vencido ainda pode ser recusado", async () => {
    vinculos[0].data_solicitacao = new Date(AGORA - 30 * DIA);
    como(CUIDADOR);
    expect((await recusar()).status).toBe(200);
  });

  it("recusar vale mesmo com a autoridade já com a família", async () => {
    usuarios[IDOSO].modo_decisao = "familiar";
    como(CUIDADOR);
    expect((await recusar()).status).toBe(200);
  });

  it("409 por corrida: o idoso cancelou entre a leitura e a escrita (count 0)", async () => {
    como(CUIDADOR);
    aposLeitura = () => {
      vinculos[0].status = "recusado";
    };
    expect((await recusar()).status).toBe(409);
  });
});

describe("POST /vinculo/:id/aprovar em convite de cuidador", () => {
  it("o idoso recebe 409 com mensagem própria do convite e nada é gravado", async () => {
    como(IDOSO);
    const res = await post(`/vinculo/${CONVITE}/aprovar`);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Este convite só vale quando o cuidador aceitar.");
    expect(updateSpy).not.toHaveBeenCalled();
    expect(vinculos[0].status).toBe("pendente");
  });

  it("o idoso continua podendo cancelar o convite pelo /recusar existente", async () => {
    como(IDOSO);
    const res = await post(`/vinculo/${CONVITE}/recusar`);

    expect(res.status).toBe(200);
    expect(vinculos[0].status).toBe("recusado");
  });

  it("convite de familiar mantém a mensagem antiga (confirmação do e-mail)", async () => {
    vinculos.push(vinculo(5, IDOSO, FAMILIAR, { tipo_vinculo: "familiar" }));
    como(IDOSO);
    const res = await post("/vinculo/5/aprovar");

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/confirmar o e-mail/i);
  });
});

describe("GET /vinculo: o cuidador vê quem o convidou", () => {
  type Item = { id: number; idoso: { id: number | null; nome: string | null; email_mascarado: string | null } };

  async function listar(comoId: number) {
    como(comoId);
    const res = await request(buildApp()).get("/vinculo").set("Authorization", "Bearer x");
    expect(res.status).toBe(200);
    return res.body.vinculos as Item[];
  }

  it("convite pendente: nome e e-mail mascarado do idoso, nunca o e-mail completo nem o id", async () => {
    const [item] = await listar(CUIDADOR);

    expect(item.idoso.nome).toBe("Ana");
    expect(item.idoso.email_mascarado).toEqual(expect.any(String));
    expect(item.idoso.email_mascarado).not.toBe(usuarios[IDOSO].email);
    expect(item.idoso.id).toBeNull();
    expect(JSON.stringify(item)).not.toContain(usuarios[IDOSO].email);
  });

  it.each([
    ["pedido do cuidador pendente", { origem: "solicitacao_cuidador" }],
    ["convite recusado", { status: "recusado" }],
  ])("continua escondido em %s", async (_nome, extra) => {
    Object.assign(vinculos[0], extra);
    const [item] = await listar(CUIDADOR);

    expect(item.idoso).toEqual({ id: null, nome: null, email_mascarado: null });
  });

  it("convite de familiar pendente continua escondido do familiar", async () => {
    vinculos = [vinculo(7, IDOSO, FAMILIAR, { tipo_vinculo: "familiar" })];
    const [item] = await listar(FAMILIAR);

    expect(item.idoso).toEqual({ id: null, nome: null, email_mascarado: null });
  });

  it("depois de aceito aparece completo como antes (id incluso)", async () => {
    vinculos[0].status = "aprovado";
    const [item] = await listar(CUIDADOR);

    expect(item.idoso.id).toBe(IDOSO);
    expect(item.idoso.nome).toBe("Ana");
  });
});
