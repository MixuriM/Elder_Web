import { inspect } from "node:util";
import request from "supertest";
import { Prisma } from "@prisma/client";
import {
  CASOS_ACESSO_LEITURA,
  CUIDADOR,
  FAMILIAR,
  IDOSO_A,
  IDOSO_B,
  type CasoAcessoLeitura,
} from "../testSupport/matrizAcessoLeitura";

// Item 7.2 (RF-019): visualizar o histórico alimentar. Alimentação não é configurável por vínculo (ER.md): o cuidador
// aprovado lê sempre, com qualquer combinação das 3 flags permite_*, e o familiar lê com qualquer modo_decisao.
// A descrição pode revelar dieta e condição de saúde (RNF-001 por analogia). Todos os ids e valores abaixo são
// FICTÍCIOS e os sentinelas obviamente falsos.

const verifyIdToken = jest.fn();
const findFirstUsuario = jest.fn();
const findUniqueUsuario = jest.fn();
const findFirstVinculo = jest.fn();
const findManyRegistro = jest.fn();
const createRegistro = jest.fn();
const updateRegistro = jest.fn();
const deleteRegistro = jest.fn();
const resolverModoDecisaoMock = jest.fn();

jest.mock("../lib/firebaseAdmin", () => ({
  auth: { verifyIdToken: (...args: unknown[]) => verifyIdToken(...args) },
}));
jest.mock("../lib/prisma", () => ({
  prisma: {
    usuario: {
      findFirst: (...args: unknown[]) => findFirstUsuario(...args),
      findUnique: (...args: unknown[]) => findUniqueUsuario(...args),
    },
    vinculo: { findFirst: (...args: unknown[]) => findFirstVinculo(...args) },
    registroAlimentar: {
      findMany: (...args: unknown[]) => findManyRegistro(...args),
      create: (...args: unknown[]) => createRegistro(...args),
      update: (...args: unknown[]) => updateRegistro(...args),
      delete: (...args: unknown[]) => deleteRegistro(...args),
    },
  },
}));
// Leitura não depende de modo_decisao: o resolver não pode ser chamado em nenhum teste desta suíte.
jest.mock("./vinculo", () => ({
  __esModule: true,
  ...jest.requireActual("./vinculo"),
  resolverModoDecisao: (...args: unknown[]) => resolverModoDecisaoMock(...args),
}));

// Só para o teste do ramo defensivo: por padrão delega ao middleware real; com passa=true segue sem preencher o vínculo.
const mockStubVinculo = { passa: false };
jest.mock("../middleware/requireVinculoAprovado", () => {
  const real = jest.requireActual("../middleware/requireVinculoAprovado");
  return {
    __esModule: true,
    ...real,
    requireVinculoAprovado: (param: string) => {
      const mw = real.requireVinculoAprovado(param);
      return (req: unknown, res: unknown, next: () => void) => (mockStubVinculo.passa ? next() : mw(req, res, next));
    },
  };
});

import app from "../app";

type Perfil = "idoso" | "cuidador" | "familiar";

const MSG_403_LEITURA = "Sem permissão para visualizar alimentação.";
const MSG_403_MIDDLEWARE = "Vínculo aprovado não encontrado para este idoso.";
const CORPO_500 = { error: "Erro interno." };

const SENT_A = { descricao: "SENT_A_DESC" };
const SENT_B = { descricao: "SENT_B_DESC" };
const SENTINELAS_B = Object.values(SENT_B);
const SENT_ERRO = "SENT_ERRO_MSG";
const SENT_META = "SENT_ERRO_META";
const TODOS_OS_SENTINELAS = [...Object.values(SENT_A), ...SENTINELAS_B, SENT_ERRO, SENT_META];

type VinculoFake = {
  id: number;
  idoso_id: number;
  vinculado_id: number;
  tipo_vinculo: "cuidador" | "familiar";
  status: "pendente" | "aprovado" | "recusado";
  permite_registrar_saude: boolean;
  permite_marcar_dose: boolean;
  permite_criar_evento_cuidado: boolean;
};

function vinculo(over: Partial<VinculoFake> = {}): VinculoFake {
  return {
    id: 1,
    idoso_id: IDOSO_A,
    vinculado_id: FAMILIAR,
    tipo_vinculo: "familiar",
    status: "aprovado",
    permite_registrar_saude: false,
    permite_marcar_dose: false,
    permite_criar_evento_cuidado: false,
    ...over,
  };
}

function vinculoCuidador(over: Partial<VinculoFake> = {}): VinculoFake {
  return vinculo({ vinculado_id: CUIDADOR, tipo_vinculo: "cuidador", ...over });
}

type RegistroFake = {
  id: number;
  idoso_id: number;
  registrado_por_id: number;
  refeicao: string;
  descricao: string;
  data_hora: Date;
  editado_por_id: number | null;
  created_at: Date;
  updated_at: Date;
};

const CRIADO = new Date("2026-09-01T10:00:00.000Z");

function reg(id: number, idoso_id: number, dataHora: string, over: Partial<RegistroFake> = {}): RegistroFake {
  const sent = idoso_id === IDOSO_A ? SENT_A : SENT_B;
  return {
    id,
    idoso_id,
    registrado_por_id: idoso_id,
    refeicao: "almoco",
    descricao: `${sent.descricao}_${id}`,
    data_hora: new Date(dataHora),
    editado_por_id: null,
    created_at: CRIADO,
    updated_at: CRIADO,
    ...over,
  };
}

let registros: RegistroFake[] = [];
let vinculos: VinculoFake[] = [];
let logado: { id: number; perfil: Perfil } = { id: IDOSO_A, perfil: "idoso" };
// Valor da coluna modo_decisao devolvido pelo fake de usuario.findUnique. Leitura não pode depender dele.
let modoColuna: "idoso" | "familiar" | null = "idoso";
const falhas = new Map<string, unknown>();

function falharSeInjetado(ponto: string) {
  if (falhas.has(ponto)) throw falhas.get(ponto);
}

type Ordem = Record<string, "asc" | "desc">;

function chaveOrdem(v: unknown) {
  return v instanceof Date ? v.getTime() : (v as number | string);
}

// Aplica orderBy (objeto ou lista) como o Prisma faria. Sem orderBy, mantém a ordem de inserção.
function ordenar<T extends object>(linhas: T[], orderBy?: Ordem | Ordem[]): T[] {
  const regras = orderBy === undefined ? [] : Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...linhas].sort((a, b) => {
    for (const regra of regras) {
      const [campo, direcao] = Object.entries(regra)[0];
      const va = chaveOrdem((a as Record<string, unknown>)[campo]);
      const vb = chaveOrdem((b as Record<string, unknown>)[campo]);
      if (va !== vb) return (va < vb ? -1 : 1) * (direcao === "desc" ? -1 : 1);
    }
    return 0;
  });
}

function instalarFakes() {
  verifyIdToken.mockImplementation(async () => ({ uid: `uid-${logado.id}` }));
  findFirstUsuario.mockImplementation(async () => {
    falharSeInjetado("usuario.findFirst");
    return { id: logado.id, firebase_uid: `uid-${logado.id}` };
  });
  findUniqueUsuario.mockImplementation(async () => {
    falharSeInjetado("usuario.findUnique");
    return { tipo_perfil: logado.perfil, modo_decisao: modoColuna };
  });
  findFirstVinculo.mockImplementation(
    async ({ where }: { where: { idoso_id: number; vinculado_id: number; status: string } }) => {
      falharSeInjetado("vinculo.findFirst");
      return (
        vinculos.find(
          (v) => v.idoso_id === where.idoso_id && v.vinculado_id === where.vinculado_id && v.status === where.status,
        ) ?? null
      );
    },
  );
  // Filtra de verdade pelo where e aplica orderBy (cópia: nunca muta a fixture).
  findManyRegistro.mockImplementation(
    async ({ where, orderBy }: { where: { idoso_id: number }; orderBy?: Ordem | Ordem[] }) => {
      falharSeInjetado("registroAlimentar.findMany");
      return ordenar(
        registros.filter((r) => r.idoso_id === where.idoso_id),
        orderBy,
      );
    },
  );
  resolverModoDecisaoMock.mockImplementation(async () => {
    throw new Error("resolverModoDecisao não pode ser chamado em rota de leitura");
  });
}

function logadoComo(id: number, perfil: Perfil) {
  logado = { id, perfil };
}

// Ordem esperada do idoso A: data_hora decrescente, desempate por id decrescente.
const ORDEM_A = [5, 1, 3, 2, 4];

beforeEach(() => {
  [
    verifyIdToken, findFirstUsuario, findUniqueUsuario, findFirstVinculo, findManyRegistro,
    createRegistro, updateRegistro, deleteRegistro, resolverModoDecisaoMock,
  ].forEach((m) => m.mockReset());
  falhas.clear();
  mockStubVinculo.passa = false;
  modoColuna = "idoso";
  logadoComo(IDOSO_A, "idoso");
  // Idoso A, entrada embaralhada: ids 3 e 2 com o mesmo instante (desempate por id), um no passado distante e um
  // plano no futuro distante, um registrado por familiar e editado.
  registros = [
    reg(3, IDOSO_A, "2026-10-06T12:00:00.000Z", { refeicao: "almoco" }),
    reg(1, IDOSO_A, "2026-10-08T22:00:00.000Z", { refeicao: "jantar", registrado_por_id: FAMILIAR, editado_por_id: FAMILIAR }),
    reg(2, IDOSO_A, "2026-10-06T12:00:00.000Z", { refeicao: "lanche_tarde" }),
    reg(4, IDOSO_A, "2020-01-01T10:00:00.000Z", { refeicao: "cafe_manha" }),
    reg(5, IDOSO_A, "2099-12-31T23:00:00.000Z", { refeicao: "ceia" }),
    reg(10, IDOSO_B, "2026-10-07T12:00:00.000Z"),
    reg(11, IDOSO_B, "2026-10-01T12:00:00.000Z"),
  ];
  vinculos = [];
  instalarFakes();
});

afterEach(() => {
  expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
});

const auth = (r: request.Test) => r.set("Authorization", "Bearer x");
const getProprio = () => auth(request(app).get("/alimentacao"));
const getVinculo = (idoso: number | string) => auth(request(app).get(`/alimentacao/idoso/${idoso}`));

const CONSOLES = ["log", "info", "warn", "error", "debug"] as const;

async function capturando<T>(fn: () => Promise<T>) {
  const espioes = CONSOLES.map((m) => jest.spyOn(console, m).mockImplementation(() => undefined));
  const out = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  const err = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  try {
    const res = await fn();
    const saidas = inspect([...espioes.map((s) => s.mock.calls), out.mock.calls, err.mock.calls], {
      depth: 12,
      maxStringLength: Infinity,
      maxArrayLength: null,
    });
    return { res, saidas };
  } finally {
    espioes.forEach((s) => s.mockRestore());
    out.mockRestore();
    err.mockRestore();
  }
}

function visivel(res: request.Response, saidas: string) {
  return inspect([res.body, res.text, res.headers], { depth: 10, maxStringLength: Infinity }) + saidas;
}

function semSentinelas(texto: string, sentinelas: string[]) {
  for (const s of sentinelas) expect(texto).not.toContain(s);
}

type RegResp = {
  id: number;
  idoso_id: number;
  registrado_por_id: number;
  refeicao: string;
  descricao: string;
  data_hora: string;
  editado_por_id: number | null;
};

const ids = (res: request.Response) => (res.body.registros as RegResp[]).map((r) => r.id);

const ID_ATOR = { idoso: IDOSO_A, cuidador: CUIDADOR, familiar: FAMILIAR } as const;

function vinculoDoCaso(caso: CasoAcessoLeitura): VinculoFake[] {
  const v = caso.vinculo;
  if (!v) return [];
  const flags = v.flags === true;
  return [
    vinculo({
      vinculado_id: ID_ATOR[caso.ator],
      idoso_id: v.idoso === "A" ? IDOSO_A : IDOSO_B,
      tipo_vinculo: v.tipo_vinculo,
      status: v.status,
      permite_registrar_saude: flags,
      permite_marcar_dose: flags,
      permite_criar_evento_cuidado: flags,
    }),
  ];
}

// T1
describe("matriz de acesso compartilhada (idêntica à de GET /saude, GET /remedios e GET /agenda)", () => {
  it.each(CASOS_ACESSO_LEITURA)("$nome = $esperado", async (caso) => {
    logadoComo(ID_ATOR[caso.ator], caso.ator);
    modoColuna = caso.vinculo?.modo_decisao ?? "idoso";
    vinculos = vinculoDoCaso(caso);

    const res = await (caso.rota === "proprio" ? getProprio() : getVinculo(IDOSO_A));

    expect(res.status).toBe(caso.esperado);
    if (caso.esperado === 200) {
      expect(ids(res)).toEqual(ORDEM_A);
      expect((res.body.registros as RegResp[]).every((r) => r.idoso_id === IDOSO_A)).toBe(true);
      semSentinelas(JSON.stringify(res.body), SENTINELAS_B);
    } else {
      expect(findManyRegistro).not.toHaveBeenCalled();
      semSentinelas(JSON.stringify(res.body), TODOS_OS_SENTINELAS);
      expect(res.body).toEqual({ error: caso.rota === "proprio" ? MSG_403_LEITURA : MSG_403_MIDDLEWARE });
    }
  });
});

// T2: critério de pronto do 7.2
describe("cuidador lê sem depender de flag (critério de pronto do 7.2)", () => {
  it("cuidador com vínculo aprovado e as 3 flags false vê o histórico alimentar (200)", async () => {
    logadoComo(CUIDADOR, "cuidador");
    vinculos = [vinculoCuidador()];
    const res = await getVinculo(IDOSO_A);
    expect(res.status).toBe(200);
    expect(ids(res)).toEqual(ORDEM_A);
    expect(JSON.stringify(res.body)).toContain(`${SENT_A.descricao}_1`);
    semSentinelas(JSON.stringify(res.body), SENTINELAS_B);
  });

  const COMBINACOES: [boolean, boolean, boolean][] = [];
  for (const s of [false, true]) for (const d of [false, true]) for (const c of [false, true]) COMBINACOES.push([s, d, c]);

  it.each(COMBINACOES)(
    "permite_registrar_saude=%s, permite_marcar_dose=%s, permite_criar_evento_cuidado=%s: 200 com o mesmo histórico",
    async (saude, dose, evento) => {
      logadoComo(CUIDADOR, "cuidador");
      vinculos = [
        vinculoCuidador({ permite_registrar_saude: saude, permite_marcar_dose: dose, permite_criar_evento_cuidado: evento }),
      ];
      const res = await getVinculo(IDOSO_A);
      expect(res.status).toBe(200);
      expect(ids(res)).toEqual(ORDEM_A);
    },
  );

  it("sem vínculo, 403 sem nenhuma linha lida", async () => {
    logadoComo(CUIDADOR, "cuidador");
    vinculos = [];
    const res = await getVinculo(IDOSO_A);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: MSG_403_MIDDLEWARE });
    expect(findManyRegistro).not.toHaveBeenCalled();
  });

  it.each([
    ["pendente", { status: "pendente" as const }],
    ["recusado", { status: "recusado" as const }],
    ["aprovado só do idoso B pedindo o idoso A", { idoso_id: IDOSO_B }],
  ])("cuidador %s: 403 sem nenhuma linha lida, com flags false e true", async (_nome, over) => {
    logadoComo(CUIDADOR, "cuidador");
    for (const flag of [false, true]) {
      vinculos = [
        vinculoCuidador({
          permite_registrar_saude: flag,
          permite_marcar_dose: flag,
          permite_criar_evento_cuidado: flag,
          ...over,
        }),
      ];
      const res = await getVinculo(IDOSO_A);
      expect(res.status).toBe(403);
      semSentinelas(JSON.stringify(res.body), TODOS_OS_SENTINELAS);
    }
    expect(findManyRegistro).not.toHaveBeenCalled();
  });
});

// T3
describe("modo_decisao não influi na leitura (resolver nunca chamado)", () => {
  it.each(["idoso", "familiar", null] as const)("familiar com modo_decisao %p na coluna lê 200", async (modo) => {
    modoColuna = modo;
    logadoComo(FAMILIAR, "familiar");
    vinculos = [vinculo()];
    const res = await getVinculo(IDOSO_A);
    expect(res.status).toBe(200);
    expect(ids(res)).toEqual(ORDEM_A);
  });

  it.each(["idoso", "familiar", null] as const)("idoso com modo_decisao %p na coluna lê 200", async (modo) => {
    modoColuna = modo;
    const res = await getProprio();
    expect(res.status).toBe(200);
    expect(ids(res)).toEqual(ORDEM_A);
  });
});

// T4
describe("forma da resposta", () => {
  it("envelope { registros } só com os registros do idoso", async () => {
    const res = await getProprio();
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(["registros"]);
    expect(res.body.registros).toHaveLength(5);
    semSentinelas(JSON.stringify(res.body), SENTINELAS_B);
  });

  it("campos exatos do serializer, só ids de autor e editor, sem nome", async () => {
    const res = await getProprio();
    const r1 = (res.body.registros as RegResp[]).find((r) => r.id === 1)!;
    expect(Object.keys(r1).sort()).toEqual([
      "created_at", "data_hora", "descricao", "editado_por_id", "id", "idoso_id", "refeicao", "registrado_por_id",
      "updated_at",
    ]);
    expect(r1).toMatchObject({
      idoso_id: IDOSO_A,
      registrado_por_id: FAMILIAR,
      editado_por_id: FAMILIAR,
      refeicao: "jantar",
      descricao: `${SENT_A.descricao}_1`,
      data_hora: "2026-10-08T22:00:00.000Z",
    });
    expect(JSON.stringify(res.body)).not.toMatch(/"nome"|registrado_por"|editado_por"/);
    const r2 = (res.body.registros as RegResp[]).find((r) => r.id === 2)!;
    expect(r2.editado_por_id).toBeNull();
  });

  it("200 com { registros: [] } sem registro", async () => {
    logadoComo(IDOSO_B + 100, "idoso");
    const res = await getProprio();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ registros: [] });
  });

  it("200 com lista vazia também na rota de vínculo", async () => {
    logadoComo(FAMILIAR, "familiar");
    vinculos = [vinculo({ idoso_id: IDOSO_B + 100 })];
    const res = await getVinculo(IDOSO_B + 100);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ registros: [] });
  });

  it("uma única consulta, só where por idoso_id e orderBy data_hora desc e id desc, sem paginação nem include", async () => {
    await getProprio();
    expect(findManyRegistro).toHaveBeenCalledTimes(1);
    const arg = findManyRegistro.mock.calls[0][0];
    expect(Object.keys(arg).sort()).toEqual(["orderBy", "where"]);
    expect(arg.where).toEqual({ idoso_id: IDOSO_A });
    expect(arg.orderBy).toEqual([{ data_hora: "desc" }, { id: "desc" }]);
  });

  it("sem filtro nem limite por query string", async () => {
    const res = await auth(request(app).get("/alimentacao?refeicao=ceia&limit=1&take=1"));
    expect(ids(res)).toEqual(ORDEM_A);
  });
});

// T5
describe("ordem e instantes", () => {
  it("data_hora decrescente, desempate por id decrescente (entrada embaralhada), sem mutar a entrada", async () => {
    const antes = registros.map((r) => r.id);
    const res = await getProprio();
    expect(ids(res)).toEqual(ORDEM_A);
    expect(registros.map((r) => r.id)).toEqual(antes);
  });

  it("passado distante e plano futuro entram", async () => {
    const res = await getProprio();
    const datas = (res.body.registros as RegResp[]).map((r) => r.data_hora);
    expect(datas).toContain("2020-01-01T10:00:00.000Z");
    expect(datas).toContain("2099-12-31T23:00:00.000Z");
  });

  it("09:00-03:00 gravado como 12:00Z volta como 12:00:00.000Z, com milissegundos preservados", async () => {
    registros = [
      reg(1, IDOSO_A, new Date("2026-10-05T09:00:00-03:00").toISOString()),
      reg(2, IDOSO_A, "2026-10-05T12:00:00.123Z"),
      reg(3, IDOSO_A, "2026-10-05T12:00:00.999Z"),
    ];
    const res = await getProprio();
    expect((res.body.registros as RegResp[]).map((r) => [r.id, r.data_hora])).toEqual([
      [3, "2026-10-05T12:00:00.999Z"],
      [2, "2026-10-05T12:00:00.123Z"],
      [1, "2026-10-05T12:00:00.000Z"],
    ]);
  });
});

// T6
describe("paridade entre atores", () => {
  it.each(["idoso", "familiar", null] as const)(
    "familiar com modo_decisao %p vê corpo idêntico ao do idoso",
    async (modo) => {
      const doIdoso = await getProprio();
      modoColuna = modo;
      logadoComo(FAMILIAR, "familiar");
      vinculos = [vinculo()];
      const doFamiliar = await getVinculo(IDOSO_A);
      expect(doFamiliar.status).toBe(200);
      expect(doFamiliar.body).toEqual(doIdoso.body);
    },
  );

  it.each([false, true])("cuidador com as 3 flags %s vê corpo idêntico ao do idoso", async (flag) => {
    const doIdoso = await getProprio();
    logadoComo(CUIDADOR, "cuidador");
    vinculos = [
      vinculoCuidador({ permite_registrar_saude: flag, permite_marcar_dose: flag, permite_criar_evento_cuidado: flag }),
    ];
    const doCuidador = await getVinculo(IDOSO_A);
    expect(doCuidador.status).toBe(200);
    expect(doCuidador.body).toEqual(doIdoso.body);
  });
});

// T7
describe("origem do idoso da consulta", () => {
  it("rota de vínculo: idoso_id vem do vínculo, não do path (vínculo mock ignora o where)", async () => {
    logadoComo(FAMILIAR, "familiar");
    findFirstVinculo.mockResolvedValue(vinculo({ idoso_id: IDOSO_A }));
    const res = await getVinculo(IDOSO_B);
    expect(res.status).toBe(200);
    expect(findManyRegistro.mock.calls[0][0].where).toEqual({ idoso_id: IDOSO_A });
    expect((res.body.registros as RegResp[]).every((r) => r.idoso_id === IDOSO_A)).toBe(true);
    semSentinelas(JSON.stringify(res.body), SENTINELAS_B);
  });

  it("rota de vínculo: query e corpo com o idoso B são ignorados", async () => {
    logadoComo(FAMILIAR, "familiar");
    vinculos = [vinculo()];
    const res = await auth(
      request(app).get(`/alimentacao/idoso/${IDOSO_A}?idoso_id=${IDOSO_B}&idosoId=${IDOSO_B}`),
    ).send({ idoso_id: IDOSO_B, idosoId: IDOSO_B });
    expect(res.status).toBe(200);
    expect(findManyRegistro.mock.calls[0][0].where).toEqual({ idoso_id: IDOSO_A });
    semSentinelas(JSON.stringify(res.body), SENTINELAS_B);
  });

  it("rota própria: idoso_id vem de req.usuarioId; query e corpo ignorados", async () => {
    const res = await auth(request(app).get(`/alimentacao?idoso_id=${IDOSO_B}&idosoId=${IDOSO_B}`)).send({
      idoso_id: IDOSO_B,
      idosoId: IDOSO_B,
    });
    expect(res.status).toBe(200);
    expect(findManyRegistro.mock.calls[0][0].where).toEqual({ idoso_id: IDOSO_A });
    semSentinelas(JSON.stringify(res.body), SENTINELAS_B);
  });

  it("acesso cruzado com controle positivo: idoso B lê só os dele; aprovado só do A lê o A e leva 403 no B", async () => {
    logadoComo(IDOSO_B, "idoso");
    const doB = await getProprio();
    expect(ids(doB)).toEqual([10, 11]);
    semSentinelas(JSON.stringify(doB.body), Object.values(SENT_A));

    logadoComo(FAMILIAR, "familiar");
    vinculos = [vinculo({ idoso_id: IDOSO_A })];
    const ok = await getVinculo(IDOSO_A);
    expect(ok.status).toBe(200);
    expect(ok.body.registros.length).toBeGreaterThan(0);
    semSentinelas(JSON.stringify(ok.body), SENTINELAS_B);
    findManyRegistro.mockClear();
    const negado = await getVinculo(IDOSO_B);
    expect(negado.status).toBe(403);
    expect(findManyRegistro).not.toHaveBeenCalled();
    semSentinelas(JSON.stringify(negado.body), TODOS_OS_SENTINELAS);
  });
});

// T8
describe("ordem de erros e efeitos", () => {
  it("401 sem token nas duas rotas, sem tocar o banco", async () => {
    expect((await request(app).get("/alimentacao")).status).toBe(401);
    expect((await request(app).get(`/alimentacao/idoso/${IDOSO_A}`)).status).toBe(401);
    expect(findManyRegistro).not.toHaveBeenCalled();
    expect(findFirstVinculo).not.toHaveBeenCalled();
  });

  it("401 com token inválido nas duas rotas", async () => {
    verifyIdToken.mockRejectedValue(Object.assign(new Error("token inválido"), { code: "auth/argument-error" }));
    expect((await getProprio()).status).toBe(401);
    expect((await getVinculo(IDOSO_A)).status).toBe(401);
    expect(findManyRegistro).not.toHaveBeenCalled();
  });

  it.each([
    ["cuidador", CUIDADOR],
    ["familiar", FAMILIAR],
  ] as const)("403 de perfil de %s em GET /alimentacao é o texto literal, sem motivo", async (perfil, id) => {
    logadoComo(id, perfil);
    const res = await getProprio();
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Sem permissão para visualizar alimentação." });
    expect(res.body.error).not.toMatch(/modo_decisao|permite|flag|cuidador|familiar|vínculo|idoso/i);
    expect(findManyRegistro).not.toHaveBeenCalled();
  });

  it("cuidador na rota própria com as 3 flags no vínculo segue 403 (a rota própria nunca olha vínculo)", async () => {
    logadoComo(CUIDADOR, "cuidador");
    vinculos = [
      vinculoCuidador({ permite_registrar_saude: true, permite_marcar_dose: true, permite_criar_evento_cuidado: true }),
    ];
    const res = await getProprio();
    expect(res.status).toBe(403);
    expect(findManyRegistro).not.toHaveBeenCalled();
  });

  it.each(["abc", "1.5", "1,5"])("400 com idosoId %p antes de olhar o vínculo", async (id) => {
    logadoComo(FAMILIAR, "familiar");
    vinculos = [vinculo()];
    const res = await getVinculo(id);
    expect(res.status).toBe(400);
    expect(findFirstVinculo).not.toHaveBeenCalled();
    expect(findManyRegistro).not.toHaveBeenCalled();
  });

  it("ordem 401, 400, 403, 200 na rota de vínculo", async () => {
    expect((await request(app).get("/alimentacao/idoso/abc")).status).toBe(401);
    logadoComo(FAMILIAR, "familiar");
    vinculos = [];
    expect((await getVinculo("abc")).status).toBe(400);
    expect((await getVinculo(IDOSO_A)).status).toBe(403);
    vinculos = [vinculo()];
    expect((await getVinculo(IDOSO_A)).status).toBe(200);
  });

  it("GET nunca chama create, update nem delete; findMany exatamente uma vez por requisição", async () => {
    await getProprio();
    logadoComo(FAMILIAR, "familiar");
    vinculos = [vinculo()];
    await getVinculo(IDOSO_A);
    expect(createRegistro).not.toHaveBeenCalled();
    expect(updateRegistro).not.toHaveBeenCalled();
    expect(deleteRegistro).not.toHaveBeenCalled();
    expect(findManyRegistro).toHaveBeenCalledTimes(2);
  });
});

// Ramo defensivo: middleware que passa sem preencher req.vinculoAprovado (inalcançável com o middleware real).
describe("ramo sem req.vinculoAprovado", () => {
  it("403 fixo, sem repetir o valor enviado, e registroAlimentar.findMany nunca é chamado", async () => {
    mockStubVinculo.passa = true;
    logadoComo(FAMILIAR, "familiar");
    vinculos = [vinculo()];
    const res = await getVinculo("987654");
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: MSG_403_LEITURA });
    expect(JSON.stringify(res.body)).not.toContain("987654");
    expect(findManyRegistro).not.toHaveBeenCalled();
  });
});

// T9
describe("capturando: controle positivo da captura", () => {
  it("captura uma escrita feita em cada saída", async () => {
    const { saidas } = await capturando(async () => {
      console.error("CONTROLE_CONSOLE");
      process.stdout.write("CONTROLE_STDOUT");
      process.stderr.write("CONTROLE_STDERR");
    });
    expect(saidas).toContain("CONTROLE_CONSOLE");
    expect(saidas).toContain("CONTROLE_STDOUT");
    expect(saidas).toContain("CONTROLE_STDERR");
  });
});

describe("privacidade", () => {
  it("200 não escreve nada em console.*, stdout nem stderr", async () => {
    const proprio = await capturando(() => getProprio());
    logadoComo(CUIDADOR, "cuidador");
    vinculos = [vinculoCuidador()];
    const porVinculo = await capturando(() => getVinculo(IDOSO_A));
    for (const { res, saidas } of [proprio, porVinculo]) {
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).toContain(SENT_A.descricao); // controle positivo: o dado sai no corpo
      semSentinelas(saidas, TODOS_OS_SENTINELAS);
    }
  });

  it("403 é fixo por rota, igual para todos os atores negados, sem sentinela", async () => {
    const corpos = new Map<string, Set<string>>();
    for (const caso of CASOS_ACESSO_LEITURA.filter((c) => c.esperado === 403)) {
      logadoComo(ID_ATOR[caso.ator], caso.ator);
      vinculos = vinculoDoCaso(caso);
      const { res, saidas } = await capturando(() => (caso.rota === "proprio" ? getProprio() : getVinculo(IDOSO_A)));
      expect(res.status).toBe(403);
      semSentinelas(visivel(res, saidas), TODOS_OS_SENTINELAS);
      const set = corpos.get(caso.rota) ?? new Set<string>();
      set.add(JSON.stringify(res.body));
      corpos.set(caso.rota, set);
    }
    expect([...(corpos.get("proprio") ?? [])]).toEqual([JSON.stringify({ error: MSG_403_LEITURA })]);
    expect([...(corpos.get("vinculo") ?? [])]).toEqual([JSON.stringify({ error: MSG_403_MIDDLEWARE })]);
  });
});

type RotaDeFalha = {
  nome: string;
  ator: [number, Perfil];
  vinculos: VinculoFake[];
  chamar: () => request.Test;
  pontos: string[];
};

const ROTAS_DE_FALHA: RotaDeFalha[] = [
  {
    nome: "GET /alimentacao",
    ator: [IDOSO_A, "idoso"],
    vinculos: [],
    chamar: () => getProprio(),
    pontos: ["usuario.findUnique", "registroAlimentar.findMany"],
  },
  {
    nome: "GET /alimentacao/idoso/:idosoId",
    ator: [CUIDADOR, "cuidador"],
    vinculos: [vinculoCuidador()],
    chamar: () => getVinculo(IDOSO_A),
    pontos: ["vinculo.findFirst", "registroAlimentar.findMany"],
  },
];

const MSG_COM_SENTINELA = `falha ${SENT_ERRO} ${SENT_A.descricao} ${SENT_B.descricao}`;

const ERROS: [string, () => unknown][] = [
  ["Error com sentinela na message", () => new Error(MSG_COM_SENTINELA)],
  [
    "PrismaClientKnownRequestError",
    () =>
      new Prisma.PrismaClientKnownRequestError(MSG_COM_SENTINELA, {
        code: "P2002",
        clientVersion: "5.22.0",
        meta: { valor: SENT_META, descricao: SENT_A.descricao },
      }),
  ],
  ["PrismaClientValidationError", () => new Prisma.PrismaClientValidationError(MSG_COM_SENTINELA, { clientVersion: "5.22.0" })],
  ["string lançada", () => MSG_COM_SENTINELA],
  ["objeto simples", () => ({ descricao: SENT_A.descricao, outra: SENT_B.descricao, detalhe: SENT_META, erro: SENT_ERRO })],
];

describe("privacidade: falha em qualquer ponto de I/O vira o 500 genérico, sem sentinela em lugar nenhum", () => {
  describe.each(ROTAS_DE_FALHA)("$nome", (rota) => {
    describe.each(rota.pontos)("falha em %s", (ponto) => {
      it.each(ERROS)("%s", async (_tipo, criar) => {
        logadoComo(...rota.ator);
        vinculos = rota.vinculos;
        falhas.set(ponto, criar());
        const { res, saidas } = await capturando(() => rota.chamar());
        expect(res.status).toBe(500);
        expect(res.body).toEqual(CORPO_500);
        semSentinelas(visivel(res, saidas), TODOS_OS_SENTINELAS);
      });
    });
  });

  it("o errorHandler registra só name, code, método e path (e o erro foi mesmo registrado)", async () => {
    falhas.set("registroAlimentar.findMany", ERROS[1][1]());
    const { res, saidas } = await capturando(() => getProprio());
    expect(res.status).toBe(500);
    expect(saidas).toContain("PrismaClientKnownRequestError");
    expect(saidas).toContain("P2002");
    expect(saidas).toContain("/alimentacao");
  });
});
