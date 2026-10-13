import express from "express";
import request from "supertest";

// Caracterização de GET /vinculo (tarefa de desempenho, 2026-10-13): o corpo INTEIRO de cada cenário fica
// gravado no snapshot, gerado pelo código anterior à troca das consultas em sequência por consultas em lote.
// Qualquer diferença de campo, valor, ordem ou status quebra o teste. Cobre idoso, cuidador (com convite
// vencido e válido), familiar titular de um idoso e vinculado de outros, transferência de modo_decisao
// vencida (efetivada na leitura), pedido em curso com segunda confirmação, ?status e os erros 401 e 400.
// O fake filtra de verdade pelo where (idoso_id, vinculado_id, in, OR, tipo_vinculo, status), inclusive no count.

type Usuario = Record<string, unknown> & { id: number; firebase_uid: string };
type Vinculo = Record<string, unknown> & {
  id: number;
  idoso_id: number;
  vinculado_id: number;
  tipo_vinculo: string;
  status: string;
};
type Where = {
  id?: number | { in: number[] };
  idoso_id?: number | { in: number[] };
  vinculado_id?: number | { in: number[] };
  tipo_vinculo?: string;
  status?: string;
  OR?: Where[];
};

let usuarios: Record<number, Usuario>;
let vinculos: Vinculo[];
const verifyIdToken = jest.fn();
// Falhas controladas: perfil que some entre o requireAuth e a rota, e consulta que rejeita com um valor que não
// pode chegar à resposta.
let semPerfil: number | null = null;
let falhar: "findMany" | "count" | null = null;
const rejeitar = () => Promise.reject(new Error("VALOR-SECRETO-DO-BANCO"));

const bate = (valor: number, filtro: Where["idoso_id"]) =>
  filtro === undefined || (typeof filtro === "number" ? valor === filtro : filtro.in.includes(valor));
function casa(v: Vinculo, w: Where): boolean {
  if (w.OR && !w.OR.some((o) => casa(v, o))) return false;
  return (
    bate(v.id, w.id) &&
    bate(v.idoso_id, w.idoso_id) &&
    bate(v.vinculado_id, w.vinculado_id) &&
    (w.tipo_vinculo === undefined || v.tipo_vinculo === w.tipo_vinculo) &&
    (w.status === undefined || v.status === w.status)
  );
}
const recorte = <T extends Record<string, unknown>>(obj: T, select?: Record<string, boolean>) =>
  select ? (Object.fromEntries(Object.keys(select).map((k) => [k, obj[k]])) as T) : { ...obj };

jest.mock("../lib/firebaseAdmin", () => ({
  auth: { verifyIdToken: (...args: unknown[]) => verifyIdToken(...args) },
}));
jest.mock("../lib/prisma", () => ({
  prisma: {
    usuario: {
      findFirst: async ({ where, select }: { where: { firebase_uid: string }; select?: Record<string, boolean> }) => {
        const u = Object.values(usuarios).find((x) => x.firebase_uid === where.firebase_uid);
        return u ? recorte(u, select) : null;
      },
      findUnique: async ({ where, select }: { where: { id: number }; select?: Record<string, boolean> }) =>
        usuarios[where.id] && where.id !== semPerfil ? recorte(usuarios[where.id], select) : null,
      update: async ({ where, data, select }: { where: { id: number }; data: Record<string, unknown>; select?: Record<string, boolean> }) => {
        Object.assign(usuarios[where.id], data);
        return recorte(usuarios[where.id], select);
      },
    },
    vinculo: {
      findMany: async ({ where }: { where: Where }) =>
        falhar === "findMany" ? rejeitar() : vinculos
          .filter((v) => casa(v, where))
          .map((v) => ({
            ...v,
            idoso: recorte(usuarios[v.idoso_id], { id: true, nome: true, email: true }),
            vinculado: recorte(usuarios[v.vinculado_id], { id: true, nome: true, email: true }),
          })),
      count: async ({ where }: { where: Where }) =>
        falhar === "count" ? rejeitar() : vinculos.filter((v) => casa(v, where)).length,
    },
  },
}));

import vinculoRouter from "./vinculo";

const AGORA = new Date("2026-10-13T12:00:00.000Z");
const dias = (n: number) => new Date(AGORA.getTime() + n * 24 * 60 * 60 * 1000);

function usuario(id: number, nome: string, tipo: string, extra: Record<string, unknown> = {}): Usuario {
  return {
    id,
    nome,
    email: `${nome.toLowerCase()}@exemplo.com`,
    telefone: "11999990000",
    firebase_uid: `uid-${id}`,
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

let proximoId = 1;
function vinculo(idoso_id: number, vinculado_id: number, tipo_vinculo: string, status: string, origem: string, solicitado: Date, extra: Record<string, unknown> = {}): Vinculo {
  return {
    id: proximoId++,
    idoso_id,
    vinculado_id,
    tipo_vinculo,
    origem,
    status,
    data_solicitacao: solicitado,
    data_resposta: status === "pendente" ? null : solicitado,
    confirmado_em: null,
    aprovador_id: null,
    notificado_em: null,
    permite_registrar_saude: false,
    permite_marcar_dose: false,
    permite_criar_evento_cuidado: false,
    ...extra,
  };
}

// Idosos: A conduzido por familiar; B com transferência vencida e segunda confirmação feita (efetiva na
// leitura); D com pedido em curso; E com transferência vencida sem a segunda confirmação (cancela na leitura).
const A = 10, B = 11, D = 12, E = 13;
const F1 = 20, F2 = 21, F3 = 22, F4 = 23;
const C1 = 30, C2 = 31, C3 = 32, C4 = 33;

beforeEach(() => {
  jest.useFakeTimers({ now: AGORA, doNotFake: ["nextTick", "setImmediate", "queueMicrotask", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "hrtime", "performance"] });
  verifyIdToken.mockReset();
  proximoId = 1;
  semPerfil = null;
  falhar = null;
  usuarios = {
    [A]: usuario(A, "Ana", "idoso", { modo_decisao: "familiar" }),
    [B]: usuario(B, "Beto", "idoso", {
      modo_decisao: "idoso",
      modo_decisao_solicitado: "familiar",
      modo_decisao_solicitado_por_id: F1,
      modo_decisao_solicitado_em: dias(-8),
      modo_decisao_expira_em: dias(-1),
      modo_decisao_segunda_confirmacao_id: F2,
      modo_decisao_motivo: "MOTIVO-B",
    }),
    [D]: usuario(D, "Dora", "idoso", {
      modo_decisao_solicitado: "familiar",
      modo_decisao_solicitado_por_id: F1,
      modo_decisao_solicitado_em: dias(-2),
      modo_decisao_expira_em: dias(5),
    }),
    [E]: usuario(E, "Edu", "idoso", {
      modo_decisao_solicitado: "familiar",
      modo_decisao_solicitado_por_id: F3,
      modo_decisao_solicitado_em: dias(-9),
      modo_decisao_expira_em: dias(-2),
    }),
    [F1]: usuario(F1, "Fabio", "familiar"),
    [F2]: usuario(F2, "Flavia", "familiar", { email: null }),
    [F3]: usuario(F3, "Fred", "familiar"),
    [F4]: usuario(F4, "Fernanda", "familiar"),
    [C1]: usuario(C1, "Caio", "cuidador"),
    [C2]: usuario(C2, "Clara", "cuidador"),
    [C3]: usuario(C3, "Cris", "cuidador"),
    [C4]: usuario(C4, "Celso", "cuidador"),
  };
  vinculos = [
    vinculo(A, C1, "cuidador", "aprovado", "solicitacao_cuidador", dias(-30), { permite_registrar_saude: true, permite_criar_evento_cuidado: true, confirmado_em: dias(-29) }),
    vinculo(A, F1, "familiar", "aprovado", "convite_idoso", dias(-28), { confirmado_em: dias(-27) }),
    vinculo(A, F3, "familiar", "pendente", "solicitacao_familiar", dias(-3)),
    vinculo(A, C4, "cuidador", "recusado", "solicitacao_cuidador", dias(-20)),
    vinculo(B, F1, "familiar", "aprovado", "solicitacao_familiar", dias(-25)),
    vinculo(B, F2, "familiar", "aprovado", "cadastro_familiar", dias(-24)),
    vinculo(B, C2, "cuidador", "pendente", "convite_idoso", dias(-10)), // convite vencido
    vinculo(B, C3, "cuidador", "aprovado", "convite_idoso", dias(-15)),
    vinculo(D, F1, "familiar", "aprovado", "solicitacao_familiar", dias(-12)),
    vinculo(D, F4, "familiar", "aprovado", "convite_idoso", dias(-11)),
    vinculo(D, C3, "cuidador", "pendente", "convite_idoso", dias(-1)), // convite válido
    vinculo(E, F3, "familiar", "aprovado", "solicitacao_familiar", dias(-14)),
    vinculo(E, F4, "familiar", "aprovado", "solicitacao_familiar", dias(-13)),
    vinculo(E, C1, "cuidador", "pendente", "solicitacao_cuidador", dias(-14)), // mesmo instante de outro: desempate por id
  ];
});

afterEach(() => {
  jest.useRealTimers();
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

async function listar(comoId: number | null, query = "") {
  const req = request(buildApp()).get(`/vinculo${query}`);
  if (comoId === null) return req;
  verifyIdToken.mockResolvedValue({ uid: usuarios[comoId].firebase_uid });
  return req.set("Authorization", "Bearer x");
}

const corpo = (res: request.Response) => ({ status: res.status, body: res.body });

describe("GET /vinculo: caracterização do corpo inteiro", () => {
  it.each([
    ["idoso conduzido por familiar (A)", A, ""],
    ["idoso com transferência vencida e segunda confirmação (B)", B, ""],
    ["idoso com pedido em curso (D)", D, ""],
    ["cuidador aprovado em A e pendente em E (C1)", C1, ""],
    ["cuidador com convite vencido (C2)", C2, ""],
    ["cuidador aprovado em B e convite válido em D (C3)", C3, ""],
    ["cuidador recusado (C4)", C4, ""],
    ["familiar titular de A e B, vinculado de D (F1)", F1, ""],
    ["familiar titular, só aprovados (F1)", F1, "?status=aprovado"],
    ["familiar titular, só pendentes (F1)", F1, "?status=pendente"],
    ["familiar sem e-mail, titular de B depois da efetivação (F2)", F2, ""],
    ["familiar pendente em A e aprovado em E vencido sem confirmação (F3)", F3, ""],
    ["familiar aprovado em D e E (F4)", F4, ""],
  ])("%s", async (_nome, quem, query) => {
    expect(corpo(await listar(quem, query))).toMatchSnapshot();
  });

  it("sequência: a leitura efetiva B e cancela E, e as leituras seguintes veem o estado novo", async () => {
    const primeira = corpo(await listar(F1));
    const segunda = corpo(await listar(F1));
    const deE = corpo(await listar(F4));
    expect({ primeira, segunda, deE, b: usuarios[B].modo_decisao, eSolicitado: usuarios[E].modo_decisao_solicitado }).toMatchSnapshot();
  });

  it("erros: 401 sem token, 400 com status inválido e com status repetido", async () => {
    expect([
      corpo(await listar(null)),
      corpo(await listar(F1, "?status=outro")),
      corpo(await listar(F1, "?status=aprovado&status=pendente")),
    ]).toMatchSnapshot();
  });

  // Linhas que nenhuma rota cria (tipo_perfil é fixo e amarrado ao tipo_vinculo): idoso como vinculado e cuidador
  // como idoso. Travam a equivalência entre a consulta única por OR filtrada pelo perfil e as duas consultas antigas.
  it("linhas impossíveis: cada perfil continua vendo só o seu lado", async () => {
    vinculos.push(
      vinculo(B, A, "familiar", "aprovado", "solicitacao_familiar", dias(-5)),
      vinculo(C1, F1, "familiar", "aprovado", "solicitacao_familiar", dias(-4)),
      vinculo(C2, A, "cuidador", "pendente", "solicitacao_cuidador", dias(-6)),
    );
    expect({ A: corpo(await listar(A)), C1: corpo(await listar(C1)), F1: corpo(await listar(F1)) }).toMatchSnapshot();
  });

  it("403 quando o perfil some entre o requireAuth e a rota, com o mesmo corpo", async () => {
    semPerfil = F1;
    expect(corpo(await listar(F1))).toEqual({ status: 403, body: { error: "Usuário não sincronizado." } });
  });

  it.each(["findMany", "count"] as const)("falha em %s: 500 genérico, sem vazar o erro e sem rejeição solta", async (onde) => {
    const soltas: unknown[] = [];
    const ouvir = (e: unknown) => soltas.push(e);
    process.on("unhandledRejection", ouvir);
    try {
      falhar = onde;
      // F1 tem pedido em curso em D: passa pelo findMany e pelo count.
      const res = await listar(F1);
      await new Promise((r) => setImmediate(r));
      expect(corpo(res)).toEqual({ status: 500, body: { error: "Erro interno." } });
      expect(JSON.stringify(res.body)).not.toContain("VALOR-SECRETO");
      expect(soltas).toEqual([]);
    } finally {
      process.off("unhandledRejection", ouvir);
    }
  });
});
