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

// Item 6.3 (RF-017, RNF-003): visualizar a agenda. Título de evento 'medico' pode carregar dado de saúde
// (RNF-001). Todos os ids e valores abaixo são FICTÍCIOS e os sentinelas obviamente falsos.

const verifyIdToken = jest.fn();
const findFirstUsuario = jest.fn();
const findUniqueUsuario = jest.fn();
const findFirstVinculo = jest.fn();
const findManyEvento = jest.fn();
const createEvento = jest.fn();
const updateEvento = jest.fn();
const deleteEvento = jest.fn();
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
    evento: {
      findMany: (...args: unknown[]) => findManyEvento(...args),
      create: (...args: unknown[]) => createEvento(...args),
      update: (...args: unknown[]) => updateEvento(...args),
      delete: (...args: unknown[]) => deleteEvento(...args),
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

const MSG_403_LEITURA = "Sem permissão para visualizar agenda.";
const MSG_403_MIDDLEWARE = "Vínculo aprovado não encontrado para este idoso.";
const CORPO_500 = { error: "Erro interno." };

const SENT_A = { titulo: "SENT_A_TITULO", descricao: "SENT_A_DESC" };
const SENT_B = { titulo: "SENT_B_TITULO", descricao: "SENT_B_DESC" };
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

type EventoFake = {
  id: number;
  idoso_id: number;
  criado_por_id: number;
  tipo_evento: string;
  titulo: string;
  descricao: string | null;
  data_hora_inicio: Date;
  data_hora_fim: Date | null;
  editado_por_id: number | null;
  created_at: Date;
  updated_at: Date;
};

const CRIADO = new Date("2026-09-01T10:00:00.000Z");

function ev(id: number, idoso_id: number, inicio: string, over: Partial<EventoFake> = {}): EventoFake {
  const sent = idoso_id === IDOSO_A ? SENT_A : SENT_B;
  return {
    id,
    idoso_id,
    criado_por_id: idoso_id,
    tipo_evento: "pessoal",
    titulo: sent.titulo,
    descricao: sent.descricao,
    data_hora_inicio: new Date(inicio),
    data_hora_fim: null,
    editado_por_id: null,
    created_at: CRIADO,
    updated_at: CRIADO,
    ...over,
  };
}

let eventos: EventoFake[] = [];
let vinculos: VinculoFake[] = [];
let logado: { id: number; perfil: Perfil } = { id: IDOSO_A, perfil: "idoso" };
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
    // modo_decisao 'idoso' na coluna: rota de leitura que o consultasse barraria o familiar (nenhum caso pode depender disso).
    return { tipo_perfil: logado.perfil, modo_decisao: "idoso" };
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
  // Filtra de verdade pelo where e aplica orderBy.
  findManyEvento.mockImplementation(async ({ where, orderBy }: { where: { idoso_id: number }; orderBy?: Ordem | Ordem[] }) => {
    falharSeInjetado("evento.findMany");
    return ordenar(
      eventos.filter((e) => e.idoso_id === where.idoso_id),
      orderBy,
    );
  });
  resolverModoDecisaoMock.mockImplementation(async () => {
    throw new Error("resolverModoDecisao não pode ser chamado em rota de leitura");
  });
}

function logadoComo(id: number, perfil: Perfil) {
  logado = { id, perfil };
}

beforeEach(() => {
  [
    verifyIdToken, findFirstUsuario, findUniqueUsuario, findFirstVinculo, findManyEvento,
    createEvento, updateEvento, deleteEvento, resolverModoDecisaoMock,
  ].forEach((m) => m.mockReset());
  falhas.clear();
  mockStubVinculo.passa = false;
  logadoComo(IDOSO_A, "idoso");
  // Idoso A, entrada embaralhada: ids 3 e 2 com o mesmo início (desempate por id), um de cada tipo.
  eventos = [
    ev(3, IDOSO_A, "2026-10-06T12:00:00.000Z", { tipo_evento: "medico", data_hora_fim: new Date("2026-10-06T13:00:00.000Z") }),
    ev(1, IDOSO_A, "2026-10-08T15:00:00.000Z", { tipo_evento: "cuidado", descricao: null }),
    ev(2, IDOSO_A, "2026-10-06T12:00:00.000Z"),
    ev(4, IDOSO_A, "2026-10-05T01:00:00.000Z"),
    ev(10, IDOSO_B, "2026-10-06T12:00:00.000Z"),
    ev(11, IDOSO_B, "2026-10-01T12:00:00.000Z"),
  ];
  vinculos = [];
  instalarFakes();
});

afterEach(() => {
  expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
});

const auth = (r: request.Test) => r.set("Authorization", "Bearer x");
const getProprio = () => auth(request(app).get("/agenda"));
const getVinculo = (idoso: number | string) => auth(request(app).get(`/agenda/idoso/${idoso}`));

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

type EvResp = { id: number; idoso_id: number; tipo_evento: string; data_hora_inicio: string; data_hora_fim: string | null };

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
describe("matriz de acesso compartilhada (idêntica à de GET /saude e GET /remedios)", () => {
  it.each(CASOS_ACESSO_LEITURA)("$nome = $esperado", async (caso) => {
    logadoComo(ID_ATOR[caso.ator], caso.ator);
    vinculos = vinculoDoCaso(caso);

    const res = await (caso.rota === "proprio" ? getProprio() : getVinculo(IDOSO_A));

    expect(res.status).toBe(caso.esperado);
    if (caso.esperado === 200) {
      const lista = res.body.eventos as EvResp[];
      expect(lista.map((e) => e.id).sort()).toEqual([1, 2, 3, 4]);
      expect(lista.every((e) => e.idoso_id === IDOSO_A)).toBe(true);
      semSentinelas(JSON.stringify(res.body), SENTINELAS_B);
    } else {
      expect(findManyEvento).not.toHaveBeenCalled();
      semSentinelas(JSON.stringify(res.body), TODOS_OS_SENTINELAS);
      expect(res.body).toEqual({ error: caso.rota === "proprio" ? MSG_403_LEITURA : MSG_403_MIDDLEWARE });
    }
  });
});

// T2
describe("idoso lê a própria agenda", () => {
  it("envelope { eventos } só com os eventos do idoso, os 3 tipos", async () => {
    const res = await getProprio();
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(["eventos"]);
    expect(res.body.eventos).toHaveLength(4);
    expect(new Set(res.body.eventos.map((e: EvResp) => e.tipo_evento))).toEqual(new Set(["pessoal", "medico", "cuidado"]));
    semSentinelas(JSON.stringify(res.body), SENTINELAS_B);
  });

  it("ordem crescente por início, desempate por id crescente (entrada embaralhada)", async () => {
    const res = await getProprio();
    expect(res.body.eventos.map((e: EvResp) => e.id)).toEqual([4, 2, 3, 1]);
  });

  it("campos exatos e datas ISO UTC com Z; fim null quando ausente", async () => {
    const res = await getProprio();
    const e3 = res.body.eventos.find((e: EvResp) => e.id === 3);
    const e2 = res.body.eventos.find((e: EvResp) => e.id === 2);
    expect(Object.keys(e3).sort()).toEqual([
      "created_at", "criado_por_id", "data_hora_fim", "data_hora_inicio", "descricao", "editado_por_id", "id",
      "idoso_id", "tipo_evento", "titulo", "updated_at",
    ]);
    expect(e3.data_hora_inicio).toBe("2026-10-06T12:00:00.000Z");
    expect(e3.data_hora_fim).toBe("2026-10-06T13:00:00.000Z");
    expect(e2.data_hora_fim).toBeNull();
    expect(e2.data_hora_inicio).toMatch(/Z$/);
  });

  it("200 com { eventos: [] } sem evento", async () => {
    logadoComo(IDOSO_B + 100, "idoso");
    const res = await getProprio();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ eventos: [] });
  });

  it("200 com lista vazia também na rota de vínculo", async () => {
    logadoComo(FAMILIAR, "familiar");
    vinculos = [vinculo({ idoso_id: IDOSO_B + 100 })];
    const res = await getVinculo(IDOSO_B + 100);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ eventos: [] });
  });

  it("uma única consulta, filtrada por idoso_id, com orderBy início asc e id asc, sem paginação", async () => {
    await getProprio();
    expect(findManyEvento).toHaveBeenCalledTimes(1);
    const arg = findManyEvento.mock.calls[0][0];
    expect(arg.where).toEqual({ idoso_id: IDOSO_A });
    expect(arg.orderBy).toEqual([{ data_hora_inicio: "asc" }, { id: "asc" }]);
    expect(arg.take).toBeUndefined();
    expect(arg.skip).toBeUndefined();
  });

  it("sem filtro por query string", async () => {
    const res = await auth(request(app).get("/agenda?tipo_evento=medico&limit=1"));
    expect(res.body.eventos).toHaveLength(4);
  });
});

// T3
describe("paridade entre atores", () => {
  it.each(["idoso", "familiar"] as const)("familiar com modo_decisao '%s' vê corpo idêntico ao do idoso", async () => {
    const doIdoso = await getProprio();
    logadoComo(FAMILIAR, "familiar");
    vinculos = [vinculo()];
    const doFamiliar = await getVinculo(IDOSO_A);
    expect(doFamiliar.status).toBe(200);
    expect(doFamiliar.body).toEqual(doIdoso.body);
  });

  it.each([false, true])("cuidador com as 3 flags %s vê corpo idêntico ao do idoso", async (flag) => {
    const doIdoso = await getProprio();
    logadoComo(CUIDADOR, "cuidador");
    vinculos = [
      vinculo({
        vinculado_id: CUIDADOR,
        tipo_vinculo: "cuidador",
        permite_registrar_saude: flag,
        permite_marcar_dose: flag,
        permite_criar_evento_cuidado: flag,
      }),
    ];
    const doCuidador = await getVinculo(IDOSO_A);
    expect(doCuidador.status).toBe(200);
    expect(doCuidador.body).toEqual(doIdoso.body);
  });

  it("cuidador e familiar veem evento 'pessoal' do idoso (risco aceito D3)", async () => {
    for (const [id, perfil, tipo] of [
      [CUIDADOR, "cuidador", "cuidador"],
      [FAMILIAR, "familiar", "familiar"],
    ] as const) {
      logadoComo(id, perfil);
      vinculos = [vinculo({ vinculado_id: id, tipo_vinculo: tipo })];
      const res = await getVinculo(IDOSO_A);
      const pessoal = res.body.eventos.find((e: EvResp) => e.id === 2);
      expect(pessoal.tipo_evento).toBe("pessoal");
    }
  });

  it("cuidador vê eventos de qualquer autor e tipo (sem filtro por criado_por_id nem tipo_evento)", async () => {
    logadoComo(CUIDADOR, "cuidador");
    vinculos = [vinculo({ vinculado_id: CUIDADOR, tipo_vinculo: "cuidador" })];
    await getVinculo(IDOSO_A);
    expect(findManyEvento.mock.calls[0][0].where).toEqual({ idoso_id: IDOSO_A });
  });
});

// T4
describe("origem do idoso da consulta", () => {
  it("rota de vínculo: idoso_id vem do vínculo, não do path (vínculo mock ignora o where)", async () => {
    logadoComo(FAMILIAR, "familiar");
    findFirstVinculo.mockResolvedValue(vinculo({ idoso_id: IDOSO_A }));
    const res = await getVinculo(IDOSO_B);
    expect(res.status).toBe(200);
    expect(findManyEvento.mock.calls[0][0].where).toEqual({ idoso_id: IDOSO_A });
    expect((res.body.eventos as EvResp[]).every((e) => e.idoso_id === IDOSO_A)).toBe(true);
    semSentinelas(JSON.stringify(res.body), SENTINELAS_B);
  });

  it("rota de vínculo: query e corpo com o idoso B são ignorados", async () => {
    logadoComo(FAMILIAR, "familiar");
    vinculos = [vinculo()];
    await auth(request(app).get(`/agenda/idoso/${IDOSO_A}?idoso_id=${IDOSO_B}`)).send({ idoso_id: IDOSO_B });
    expect(findManyEvento.mock.calls[0][0].where).toEqual({ idoso_id: IDOSO_A });
  });

  it("rota própria: idoso_id vem de req.usuarioId; path, query e corpo ignorados", async () => {
    const res = await auth(request(app).get(`/agenda?idoso_id=${IDOSO_B}&idosoId=${IDOSO_B}`)).send({ idoso_id: IDOSO_B });
    expect(res.status).toBe(200);
    expect(findManyEvento.mock.calls[0][0].where).toEqual({ idoso_id: IDOSO_A });
    semSentinelas(JSON.stringify(res.body), SENTINELAS_B);
  });

  it("acesso cruzado com controle positivo: aprovado só do A lê o A e leva 403 no B", async () => {
    logadoComo(FAMILIAR, "familiar");
    vinculos = [vinculo({ idoso_id: IDOSO_A })];
    const ok = await getVinculo(IDOSO_A);
    expect(ok.status).toBe(200);
    expect(ok.body.eventos.length).toBeGreaterThan(0);
    findManyEvento.mockClear();
    const negado = await getVinculo(IDOSO_B);
    expect(negado.status).toBe(403);
    expect(findManyEvento).not.toHaveBeenCalled();
    semSentinelas(JSON.stringify(negado.body), SENTINELAS_B);
    semSentinelas(JSON.stringify(ok.body), SENTINELAS_B);
  });
});

// T5
describe("ordem de erros e efeitos", () => {
  it("401 sem token nas duas rotas, sem tocar o banco", async () => {
    expect((await request(app).get("/agenda")).status).toBe(401);
    expect((await request(app).get(`/agenda/idoso/${IDOSO_A}`)).status).toBe(401);
    expect(findManyEvento).not.toHaveBeenCalled();
    expect(findFirstVinculo).not.toHaveBeenCalled();
  });

  it("401 com token inválido nas duas rotas", async () => {
    verifyIdToken.mockRejectedValue(Object.assign(new Error("token inválido"), { code: "auth/argument-error" }));
    expect((await getProprio()).status).toBe(401);
    expect((await getVinculo(IDOSO_A)).status).toBe(401);
    expect(findManyEvento).not.toHaveBeenCalled();
  });

  it.each([
    ["cuidador", CUIDADOR],
    ["familiar", FAMILIAR],
  ] as const)("403 de perfil de %s em GET /agenda é o texto literal, sem motivo", async (perfil, id) => {
    logadoComo(id, perfil);
    const res = await getProprio();
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Sem permissão para visualizar agenda." });
    expect(res.body.error).not.toMatch(/modo_decisao|cuidador|familiar|vínculo|idoso/i);
    expect(findManyEvento).not.toHaveBeenCalled();
  });

  it.each(["abc", "1.5", "1,5"])("400 com idosoId %p antes de olhar o vínculo", async (id) => {
    logadoComo(FAMILIAR, "familiar");
    vinculos = [vinculo()];
    const res = await getVinculo(id);
    expect(res.status).toBe(400);
    expect(findFirstVinculo).not.toHaveBeenCalled();
    expect(findManyEvento).not.toHaveBeenCalled();
  });

  it("ordem 401, 400, 403: sem token vence idosoId inválido; idosoId inválido vence falta de vínculo", async () => {
    expect((await request(app).get("/agenda/idoso/abc")).status).toBe(401);
    logadoComo(FAMILIAR, "familiar");
    vinculos = [];
    expect((await getVinculo("abc")).status).toBe(400);
    expect((await getVinculo(IDOSO_A)).status).toBe(403);
  });

  it("GET nunca chama create, update nem delete; findMany exatamente uma vez por requisição", async () => {
    await getProprio();
    logadoComo(FAMILIAR, "familiar");
    vinculos = [vinculo()];
    await getVinculo(IDOSO_A);
    expect(createEvento).not.toHaveBeenCalled();
    expect(updateEvento).not.toHaveBeenCalled();
    expect(deleteEvento).not.toHaveBeenCalled();
    expect(findManyEvento).toHaveBeenCalledTimes(2);
  });
});

// Ramo defensivo: middleware que passa sem preencher req.vinculoAprovado (inalcançável com o middleware real).
describe("ramo sem req.vinculoAprovado", () => {
  it("403 fixo, sem repetir o valor enviado, e evento.findMany nunca é chamado", async () => {
    mockStubVinculo.passa = true;
    logadoComo(FAMILIAR, "familiar");
    vinculos = [vinculo()];
    const res = await getVinculo("987654");
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: MSG_403_LEITURA });
    expect(JSON.stringify(res.body)).not.toContain("987654");
    expect(findManyEvento).not.toHaveBeenCalled();
  });
});

// T6
describe("instantes exatos", () => {
  it("09:00-03:00 gravado como 12:00Z volta como 12:00:00.000Z, com milissegundos", async () => {
    eventos = [
      ev(1, IDOSO_A, new Date("2026-10-05T09:00:00-03:00").toISOString()),
      ev(2, IDOSO_A, "2026-10-05T12:00:00.123Z"),
    ];
    const res = await getProprio();
    expect(res.body.eventos.map((e: EvResp) => e.data_hora_inicio)).toEqual([
      "2026-10-05T12:00:00.000Z",
      "2026-10-05T12:00:00.123Z",
    ]);
  });

  it("evento que atravessa a meia-noite volta com os dois instantes intactos", async () => {
    eventos = [
      ev(1, IDOSO_A, "2026-10-06T02:00:00.000Z", { data_hora_fim: new Date("2026-10-06T05:00:00.000Z") }),
    ];
    const res = await getProprio();
    expect(res.body.eventos[0].data_hora_inicio).toBe("2026-10-06T02:00:00.000Z");
    expect(res.body.eventos[0].data_hora_fim).toBe("2026-10-06T05:00:00.000Z");
  });
});

// T7
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
    logadoComo(FAMILIAR, "familiar");
    vinculos = [vinculo()];
    const porVinculo = await capturando(() => getVinculo(IDOSO_A));
    for (const { res, saidas } of [proprio, porVinculo]) {
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).toContain(SENT_A.titulo); // controle positivo: o dado sai no corpo
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
    nome: "GET /agenda",
    ator: [IDOSO_A, "idoso"],
    vinculos: [],
    chamar: () => getProprio(),
    pontos: ["usuario.findUnique", "evento.findMany"],
  },
  {
    nome: "GET /agenda/idoso/:idosoId",
    ator: [FAMILIAR, "familiar"],
    vinculos: [vinculo()],
    chamar: () => getVinculo(IDOSO_A),
    pontos: ["vinculo.findFirst", "evento.findMany"],
  },
];

const MSG_COM_SENTINELA = `falha ${SENT_ERRO} ${SENT_A.titulo} ${SENT_B.descricao}`;

const ERROS: [string, () => unknown][] = [
  ["Error com sentinela na message", () => new Error(MSG_COM_SENTINELA)],
  [
    "PrismaClientKnownRequestError",
    () =>
      new Prisma.PrismaClientKnownRequestError(MSG_COM_SENTINELA, {
        code: "P2002",
        clientVersion: "5.22.0",
        meta: { valor: SENT_META, titulo: SENT_A.titulo },
      }),
  ],
  ["PrismaClientValidationError", () => new Prisma.PrismaClientValidationError(MSG_COM_SENTINELA, { clientVersion: "5.22.0" })],
  ["string lançada", () => MSG_COM_SENTINELA],
  ["objeto simples", () => ({ titulo: SENT_A.titulo, descricao: SENT_B.descricao, detalhe: SENT_META, erro: SENT_ERRO })],
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
    falhas.set("evento.findMany", ERROS[1][1]());
    const { res, saidas } = await capturando(() => getProprio());
    expect(res.status).toBe(500);
    expect(saidas).toContain("PrismaClientKnownRequestError");
    expect(saidas).toContain("P2002");
    expect(saidas).toContain("/agenda");
  });
});
