import express from "express";
import request from "supertest";

// Fake de Prisma com estado em memória (mais de um idoso): a visibilidade é decidida pelo
// filtro real da rota, não por retorno fixo. O fake devolve os Usuario COMPLETOS (com
// telefone, firebase_uid e e-mail inteiro) de propósito: a rota é quem precisa recortar.
type UsuarioFake = {
  id: number;
  nome: string;
  email: string | null;
  telefone: string | null;
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
  notificado_em: Date | null;
};

type WhereVinculo = {
  idoso_id?: number | { in: number[] };
  vinculado_id?: number;
  tipo_vinculo?: string;
  status?: string;
};

let usuarios: Record<number, UsuarioFake>;
let vinculos: VinculoFake[];
const verifyIdToken = jest.fn();
const findManySpy = jest.fn();

function casa(v: VinculoFake, where: WhereVinculo) {
  if (typeof where.idoso_id === "number" && v.idoso_id !== where.idoso_id) return false;
  if (typeof where.idoso_id === "object" && !where.idoso_id.in.includes(v.idoso_id)) return false;
  if (where.vinculado_id !== undefined && v.vinculado_id !== where.vinculado_id) return false;
  if (where.tipo_vinculo !== undefined && v.tipo_vinculo !== where.tipo_vinculo) return false;
  if (where.status !== undefined && v.status !== where.status) return false;
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
      update: async ({ where, data }: { where: { id: number }; data: Partial<UsuarioFake> }) => {
        Object.assign(usuarios[where.id], data);
        return usuarios[where.id];
      },
    },
    vinculo: {
      findMany: async (args: { where: WhereVinculo }) => {
        findManySpy(args);
        return vinculos
          .filter((v) => casa(v, args.where))
          .map((v) => ({ ...v, idoso: usuarios[v.idoso_id], vinculado: usuarios[v.vinculado_id] }));
      },
      count: async ({ where }: { where: WhereVinculo }) => vinculos.filter((v) => casa(v, where)).length,
    },
  },
}));

import vinculoRouter from "./vinculo";

function usuario(id: number, nome: string, tipo: string, extra: Partial<UsuarioFake> = {}): UsuarioFake {
  return {
    id,
    nome,
    email: `${nome.toLowerCase()}@exemplo.com`,
    telefone: `1199999${String(id).padStart(4, "0")}`,
    firebase_uid: `uid-secreto-${id}`,
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

function vinculo(
  id: number,
  idoso_id: number,
  vinculado_id: number,
  tipo_vinculo: string,
  status: string,
  dia: number,
  origem = tipo_vinculo === "cuidador" ? "solicitacao_cuidador" : "solicitacao_familiar",
): VinculoFake {
  return {
    id,
    idoso_id,
    vinculado_id,
    tipo_vinculo,
    origem,
    status,
    data_solicitacao: new Date(Date.UTC(2026, 0, dia)),
    data_resposta: null,
    confirmado_em: null,
    aprovador_id: null,
    notificado_em: null,
  };
}

const A = 10;
const B = 11;
const F1 = 20;
const F2 = 21;
const C1 = 30;
const C2 = 31;

beforeEach(() => {
  verifyIdToken.mockReset();
  findManySpy.mockReset();
  usuarios = {
    [A]: usuario(A, "Ana", "idoso", { modo_decisao: "idoso" }),
    [B]: usuario(B, "Beto", "idoso", { modo_decisao: "idoso" }),
    [F1]: usuario(F1, "Fabio", "familiar"),
    [F2]: usuario(F2, "Flavia", "familiar"),
    [C1]: usuario(C1, "Caio", "cuidador"),
    [C2]: usuario(C2, "Clara", "cuidador"),
  };
  vinculos = [
    vinculo(1, A, C1, "cuidador", "aprovado", 1),
    vinculo(2, A, F1, "familiar", "aprovado", 2),
    vinculo(3, A, F2, "familiar", "aprovado", 3, "convite_idoso"),
    vinculo(4, B, C2, "cuidador", "pendente", 4),
    vinculo(5, B, F2, "familiar", "pendente", 5),
    vinculo(6, A, C2, "cuidador", "recusado", 6),
  ];
});

type Item = {
  id: number;
  papel_do_chamador: string;
  status: string;
  idoso: { id: number; nome: string | null; email_mascarado: string | null };
  vinculado: { id: number; nome: string; email_mascarado: string | null };
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/vinculo", vinculoRouter);
  app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: "Erro interno." });
  });
  return app;
}

async function listar(comoId: number, query = "") {
  verifyIdToken.mockResolvedValue({ uid: usuarios[comoId].firebase_uid });
  return request(buildApp()).get(`/vinculo${query}`).set("Authorization", "Bearer x");
}

// Toda checagem de conteúdo parte de 200 + lista (senão varreduras de ausência passariam por vacuidade).
async function listarOk(comoId: number, query = "") {
  const res = await listar(comoId, query);
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.vinculos)).toBe(true);
  return res;
}

function itemPorId(res: request.Response, id: number): Item {
  const achado = (res.body.vinculos as Item[]).find((v) => v.id === id);
  expect(achado).toBeDefined();
  return achado as Item;
}

const ids = (res: request.Response) => (res.body.vinculos as Item[]).map((v) => v.id).sort((a, b) => a - b);
const papel = (res: request.Response, id: number) =>
  (res.body.vinculos as Item[]).find((v) => v.id === id)?.papel_do_chamador;

describe("GET /vinculo", () => {
  it("401 sem token", async () => {
    const res = await request(buildApp()).get("/vinculo");
    expect(res.status).toBe(401);
  });

  it("400 para status inválido, sem consultar vínculos", async () => {
    const res = await listar(A, "?status=qualquer");
    expect(res.status).toBe(400);
    expect(findManySpy).not.toHaveBeenCalled();
  });

  it("filtra por status", async () => {
    const res = await listarOk(A, "?status=aprovado");
    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([1, 2, 3]);
  });

  it("ordena por data_solicitacao decrescente e expõe o campo com esse nome", async () => {
    const res = await listarOk(A);
    expect((res.body.vinculos as Item[]).map((v) => v.id)).toEqual([6, 3, 2, 1]);
    expect(res.body.vinculos[0].data_solicitacao).toBe("2026-01-06T00:00:00.000Z");
    expect(res.body.vinculos[0]).not.toHaveProperty("criado_em");
  });

  it("idoso vê os próprios vínculos como dono e não vê os de outro idoso (A x B)", async () => {
    const resA = await listarOk(A);
    expect(ids(resA)).toEqual([1, 2, 3, 6]);
    expect((resA.body.vinculos as Item[]).every((v) => v.papel_do_chamador === "dono")).toBe(true);

    const resB = await listarOk(B);
    expect(ids(resB)).toEqual([4, 5]);
  });

  it("cuidador vê só os próprios", async () => {
    const res = await listarOk(C1);
    expect(ids(res)).toEqual([1]);
    expect(papel(res, 1)).toBe("vinculado");
  });

  it("cuidador nunca é titular, mesmo com o idoso em modo 'familiar'", async () => {
    usuarios[A].modo_decisao = "familiar";
    const res = await listarOk(C1);
    expect(ids(res)).toEqual([1]);
  });

  it("familiar vê só os próprios com o idoso em modo 'idoso' ou NULL", async () => {
    expect(ids(await listarOk(F1))).toEqual([2]);
    usuarios[A].modo_decisao = null;
    expect(ids(await listarOk(F1))).toEqual([2]);
  });

  it("familiar aprovado com idoso em modo 'familiar' é titular e vê os vínculos de outras pessoas", async () => {
    usuarios[A].modo_decisao = "familiar";
    const res = await listarOk(F1);
    expect(ids(res)).toEqual([1, 2, 3, 6]);
    expect(papel(res, 1)).toBe("titular");
    expect(papel(res, 3)).toBe("titular");
    expect(papel(res, 6)).toBe("titular");
  });

  it("sem duplicação: vínculo próprio do titular aparece uma vez, como 'vinculado'", async () => {
    usuarios[A].modo_decisao = "familiar";
    const res = await listarOk(F1);
    expect((res.body.vinculos as Item[]).filter((v) => v.id === 2)).toHaveLength(1);
    expect(papel(res, 2)).toBe("vinculado");
  });

  it.each(["pendente", "recusado"])("familiar com o próprio vínculo %s NÃO é titular", async (status) => {
    usuarios[A].modo_decisao = "familiar";
    vinculos[1].status = status;
    const res = await listarOk(F1);
    expect(ids(res)).toEqual([2]);
  });

  it("familiar de um idoso não vê vínculos de outro idoso (F2 titular de A não vê o vínculo 4 de B)", async () => {
    usuarios[A].modo_decisao = "familiar";
    usuarios[B].modo_decisao = "familiar"; // B em modo familiar, mas F2 só tem vínculo pendente com B
    const res = await listarOk(F2);
    expect(ids(res)).toEqual([1, 2, 3, 5, 6]);
    expect(ids(res)).not.toContain(4);
  });

  it("resolve transferência vencida antes de decidir a visibilidade", async () => {
    Object.assign(usuarios[A], {
      modo_decisao: "idoso",
      modo_decisao_solicitado: "familiar",
      modo_decisao_solicitado_por_id: F1,
      modo_decisao_solicitado_em: new Date(Date.now() - 8 * 86_400_000),
      modo_decisao_expira_em: new Date(Date.now() - 86_400_000),
      modo_decisao_segunda_confirmacao_id: F2, // 2 familiares aprovados: exige segunda confirmação
    });

    const res = await listarOk(F1);

    expect(usuarios[A].modo_decisao).toBe("familiar");
    expect(ids(res)).toEqual([1, 2, 3, 6]);
  });

  it("transferência ainda dentro da janela não concede visibilidade", async () => {
    Object.assign(usuarios[A], {
      modo_decisao_solicitado: "familiar",
      modo_decisao_solicitado_por_id: F1,
      modo_decisao_expira_em: new Date(Date.now() + 86_400_000),
    });
    const res = await listarOk(F1);
    expect(ids(res)).toEqual([2]);
  });

  it("a resposta nunca contém e-mail completo, telefone nem firebase_uid", async () => {
    usuarios[A].modo_decisao = "familiar";
    for (const quem of [A, B, F1, F2, C1, C2]) {
      const res = await listarOk(quem);
      expect(res.body.vinculos.length).toBeGreaterThan(0);
      const json = JSON.stringify(res.body);
      for (const u of Object.values(usuarios)) {
        expect(json).not.toContain(u.email as string);
        expect(json).not.toContain(u.telefone as string);
        expect(json).not.toContain(u.firebase_uid);
      }
      expect(json).not.toMatch(/telefone|firebase_uid/);
      expect(json).not.toMatch(/[\w.]{2,}@/); // só a forma mascarada "x***@"
    }
  });

  it("traz o e-mail do outro lado mascarado e nulo quando não há e-mail", async () => {
    usuarios[C1].email = null;
    const res = await listarOk(A);
    const item = itemPorId(res, 1);
    expect(item.vinculado).toEqual({ id: C1, nome: "Caio", email_mascarado: null });
    const item2 = itemPorId(res, 2);
    expect(item2.vinculado.email_mascarado).toBe("f***@exemplo.com");
  });

  describe("D7: fail-closed sobre o idoso para quem é o vinculado", () => {
    it.each([[4], [6]])("vínculo %i (pendente/recusado) do cuidador: idoso.nome e email_mascarado null", async (id) => {
      const res = await listarOk(C2);
      const item = itemPorId(res, id);
      expect(item.idoso.nome).toBeNull();
      expect(item.idoso.email_mascarado).toBeNull();
      expect(JSON.stringify(res.body)).not.toContain("Beto");
      expect(JSON.stringify(res.body)).not.toContain("Ana");
    });

    it("vínculo aprovado: o vinculado recebe nome e e-mail mascarado do idoso", async () => {
      const res = await listarOk(C1);
      const item = itemPorId(res, 1);
      expect(item.idoso).toEqual({ id: A, nome: "Ana", email_mascarado: "a***@exemplo.com" });
    });

    it("o idoso (dono) vê o vinculado completo mesmo com vínculo pendente", async () => {
      const res = await listarOk(B);
      const item = itemPorId(res, 4);
      expect(item.vinculado.nome).toBe("Clara");
      expect(item.vinculado.email_mascarado).toBe("c***@exemplo.com");
    });
  });
});
