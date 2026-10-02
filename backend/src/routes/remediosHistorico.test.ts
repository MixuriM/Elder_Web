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

// Item 5.3 (RF-013, RNF-003): histórico de remédios (prescrições + doses). Medicamento e dose são dado
// sensível (RNF-001). Todos os ids e valores abaixo são FICTÍCIOS e os sentinelas obviamente falsos.

const verifyIdToken = jest.fn();
const findFirstUsuario = jest.fn();
const findUniqueUsuario = jest.fn();
const findFirstVinculo = jest.fn();
const findManyMedicamento = jest.fn();
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
    medicamento: { findMany: (...args: unknown[]) => findManyMedicamento(...args) },
  },
}));
// A leitura não depende de modo_decisao: o resolver não pode ser chamado em nenhum teste desta suíte.
jest.mock("./vinculo", () => ({
  __esModule: true,
  ...jest.requireActual("./vinculo"),
  resolverModoDecisao: (...args: unknown[]) => resolverModoDecisaoMock(...args),
}));

import app from "../app";

type Perfil = "idoso" | "cuidador" | "familiar";

const MSG_403_LEITURA_REMEDIOS = "Sem permissão para visualizar histórico de remédios.";
const MSG_403_MIDDLEWARE = "Vínculo aprovado não encontrado para este idoso.";
const CORPO_500 = { error: "Erro interno." };

const SENT_A = { nome: "SENT_A_NOME", dosagem: "SENT_A_DOSAGEM", freq: "SENT_A_FREQ", obs: "SENT_A_OBS", doseObs: "SENT_A_DOSE_OBS" };
const SENT_B = { nome: "SENT_B_NOME", dosagem: "SENT_B_DOSAGEM", freq: "SENT_B_FREQ", obs: "SENT_B_OBS", doseObs: "SENT_B_DOSE_OBS" };
const SENTINELAS_B = Object.values(SENT_B);
const SENT_ERRO = "SENT_ERRO_MSG";
const SENT_META = "SENT_ERRO_META";
const SENTINELAS_ERRO = [SENT_ERRO, SENT_META];
const TODOS_OS_SENTINELAS = [...Object.values(SENT_A), ...SENTINELAS_B, ...SENTINELAS_ERRO];

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

type MedFake = {
  id: number;
  idoso_id: number;
  criado_por_id: number;
  nome: string;
  dosagem: string;
  frequencia: string;
  data_inicio: Date;
  data_fim: Date | null;
  observacoes: string | null;
  ativo: boolean;
  editado_por_id: number | null;
  created_at: Date;
  updated_at: Date;
};

type DoseFake = {
  id: number;
  medicamento_id: number;
  registrado_por_id: number;
  data_hora_administracao: Date;
  status_administracao: string;
  observacoes: string | null;
  created_at: Date;
};

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const CRIADO = new Date("2026-09-01T10:00:00.000Z");

function med(id: number, idoso_id: number, inicio: string, over: Partial<MedFake> = {}): MedFake {
  const sent = idoso_id === IDOSO_A ? SENT_A : SENT_B;
  return {
    id,
    idoso_id,
    criado_por_id: idoso_id,
    nome: sent.nome,
    dosagem: sent.dosagem,
    frequencia: sent.freq,
    data_inicio: dia(inicio),
    data_fim: null,
    observacoes: sent.obs,
    ativo: true,
    editado_por_id: null,
    created_at: CRIADO,
    updated_at: CRIADO,
    ...over,
  };
}

function dose(id: number, medicamento_id: number, quando: string, status: string, over: Partial<DoseFake> = {}): DoseFake {
  return {
    id,
    medicamento_id,
    registrado_por_id: IDOSO_A,
    data_hora_administracao: new Date(quando),
    status_administracao: status,
    observacoes: null,
    created_at: CRIADO,
    ...over,
  };
}

let medicamentos: MedFake[] = [];
let doses: DoseFake[] = [];
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

type ArgsFindMany = {
  where: { idoso_id: number };
  orderBy?: Ordem | Ordem[];
  include?: { doses?: boolean | { orderBy?: Ordem | Ordem[] } };
};

function instalarFakes() {
  verifyIdToken.mockImplementation(async () => ({ uid: `uid-${logado.id}` }));
  findFirstUsuario.mockImplementation(async () => {
    falharSeInjetado("usuario.findFirst");
    return { id: logado.id, firebase_uid: `uid-${logado.id}` };
  });
  findUniqueUsuario.mockImplementation(async () => {
    falharSeInjetado("usuario.findUnique");
    return { tipo_perfil: logado.perfil };
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
  // Filtra de verdade pelo where, aplica orderBy e devolve as doses do include já filtradas e ordenadas.
  findManyMedicamento.mockImplementation(async ({ where, orderBy, include }: ArgsFindMany) => {
    falharSeInjetado("medicamento.findMany");
    const meds = ordenar(
      medicamentos.filter((m) => m.idoso_id === where.idoso_id),
      orderBy,
    );
    if (!include?.doses) return meds;
    const ordemDoses = typeof include.doses === "object" ? include.doses.orderBy : undefined;
    return meds.map((m) => ({
      ...m,
      doses: ordenar(
        doses.filter((d) => d.medicamento_id === m.id),
        ordemDoses,
      ),
    }));
  });
  resolverModoDecisaoMock.mockImplementation(async () => {
    throw new Error("resolverModoDecisao não pode ser chamado em rota de leitura");
  });
}

function logadoComo(id: number, perfil: Perfil) {
  logado = { id, perfil };
}

beforeEach(() => {
  [verifyIdToken, findFirstUsuario, findUniqueUsuario, findFirstVinculo, findManyMedicamento, resolverModoDecisaoMock].forEach(
    (m) => m.mockReset(),
  );
  falhas.clear();
  logadoComo(IDOSO_A, "idoso");
  // Idoso A: 4 medicamentos (um inativo e fora da janela, um futuro, dois com a mesma data_inicio).
  medicamentos = [
    med(1, IDOSO_A, "2026-03-01"),
    med(2, IDOSO_A, "2026-03-01", { ativo: false, data_fim: dia("2026-04-30"), editado_por_id: IDOSO_A }),
    med(3, IDOSO_A, "2026-08-15", { data_fim: dia("2026-12-31"), observacoes: null }),
    med(4, IDOSO_A, "2027-01-10"),
    med(10, IDOSO_B, "2026-09-01"),
    med(11, IDOSO_B, "2026-09-02"),
  ];
  doses = [
    dose(1, 1, "2026-09-14T12:30:00.000Z", "administrado"),
    dose(2, 1, "2026-09-14T12:30:00.000Z", "pulado"), // mesma data_hora que a 1: desempate por id desc
    dose(3, 1, "2026-09-10T08:00:00.000Z", "atrasado", { observacoes: SENT_A.doseObs, registrado_por_id: CUIDADOR }),
    dose(4, 3, "2026-09-20T09:00:00.000Z", "administrado"),
    dose(100, 10, "2026-09-21T09:00:00.000Z", "administrado", { observacoes: SENT_B.doseObs, registrado_por_id: IDOSO_B }),
    dose(101, 11, "2026-09-22T09:00:00.000Z", "pulado", { registrado_por_id: IDOSO_B }),
  ];
  vinculos = [];
  instalarFakes();
});

afterEach(() => {
  // Nenhuma rota de leitura pode consultar modo_decisao.
  expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
});

const auth = (r: request.Test) => r.set("Authorization", "Bearer x");
const getProprio = () => auth(request(app).get("/remedios"));
const getVinculo = (idoso: number | string) => auth(request(app).get(`/remedios/idoso/${idoso}`));

const CONSOLES = ["log", "info", "warn", "error", "debug"] as const;

// Captura console.*, process.stdout.write e process.stderr.write durante fn. util.inspect com depth
// alto inclui message, stack, meta e propriedades do erro (JSON.stringify não incluiria).
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

// Tudo que o cliente enxerga (corpo e headers) mais tudo que o processo escreveu.
function visivel(res: request.Response, saidas: string) {
  return inspect([res.body, res.text, res.headers], { depth: 10, maxStringLength: Infinity }) + saidas;
}

function semSentinelas(texto: string, sentinelas: string[]) {
  for (const s of sentinelas) expect(texto).not.toContain(s);
}

type MedResp = { id: number; idoso_id: number; doses: { id: number; medicamento_id: number }[] };

// ---------------------------------------------------------------------------------------------
// a) Matriz de acesso compartilhada com o item 4.4
// ---------------------------------------------------------------------------------------------
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

describe("matriz de acesso compartilhada (idêntica à de GET /saude)", () => {
  it.each(CASOS_ACESSO_LEITURA)("$nome = $esperado", async (caso) => {
    logadoComo(ID_ATOR[caso.ator], caso.ator);
    vinculos = vinculoDoCaso(caso);

    const res = await (caso.rota === "proprio" ? getProprio() : getVinculo(IDOSO_A));

    expect(res.status).toBe(caso.esperado);
    if (caso.esperado === 200) {
      const lista = res.body.medicamentos as MedResp[];
      expect(lista.map((m) => m.id).sort()).toEqual([1, 2, 3, 4]);
      expect(lista.every((m) => m.idoso_id === IDOSO_A)).toBe(true);
      expect(lista.flatMap((m) => m.doses).map((d) => d.id).sort()).toEqual([1, 2, 3, 4]);
      semSentinelas(JSON.stringify(res.body), SENTINELAS_B);
    } else {
      expect(findManyMedicamento).not.toHaveBeenCalled();
      semSentinelas(JSON.stringify(res.body), TODOS_OS_SENTINELAS);
      expect(res.body).toEqual({ error: caso.rota === "proprio" ? MSG_403_LEITURA_REMEDIOS : MSG_403_MIDDLEWARE });
    }
  });
});

// ---------------------------------------------------------------------------------------------
// b) Forma da resposta
// ---------------------------------------------------------------------------------------------
describe("forma da resposta", () => {
  const CAMPOS_MED = [
    "ativo", "created_at", "criado_por_id", "data_fim", "data_inicio", "dosagem", "doses", "editado_por_id",
    "frequencia", "id", "idoso_id", "nome", "observacoes", "updated_at",
  ];
  const CAMPOS_DOSE = [
    "created_at", "data_hora_administracao", "id", "medicamento_id", "observacoes", "registrado_por_id", "status_administracao",
  ];

  it("envelope { medicamentos } com os campos exatos do medicamento e da dose", async () => {
    const res = await getProprio();
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(["medicamentos"]);
    for (const m of res.body.medicamentos) {
      expect(Object.keys(m).sort()).toEqual(CAMPOS_MED);
      for (const d of m.doses) expect(Object.keys(d).sort()).toEqual(CAMPOS_DOSE);
    }
  });

  it("valores do medicamento e da dose serializados como na rota de criação", async () => {
    const res = await getProprio();
    const m1 = res.body.medicamentos.find((m: MedResp) => m.id === 1);
    expect(m1).toMatchObject({
      id: 1,
      idoso_id: IDOSO_A,
      criado_por_id: IDOSO_A,
      nome: SENT_A.nome,
      dosagem: SENT_A.dosagem,
      frequencia: SENT_A.freq,
      data_inicio: "2026-03-01",
      data_fim: null,
      observacoes: SENT_A.obs,
      ativo: true,
      editado_por_id: null,
      created_at: CRIADO.toISOString(),
      updated_at: CRIADO.toISOString(),
    });
    expect(m1.doses.find((d: { id: number }) => d.id === 3)).toEqual({
      id: 3,
      medicamento_id: 1,
      registrado_por_id: CUIDADOR,
      data_hora_administracao: "2026-09-10T08:00:00.000Z",
      status_administracao: "atrasado",
      observacoes: SENT_A.doseObs,
      created_at: CRIADO.toISOString(),
    });
  });

  it("data_inicio e data_fim saem como YYYY-MM-DD sem deslocar o dia; data_fim nulo vira null", async () => {
    const res = await getProprio();
    const porId = (id: number) => res.body.medicamentos.find((m: MedResp) => m.id === id);
    expect(porId(2).data_inicio).toBe("2026-03-01");
    expect(porId(2).data_fim).toBe("2026-04-30");
    expect(porId(3).data_fim).toBe("2026-12-31");
    expect(porId(1).data_fim).toBeNull();
    expect(porId(4).data_inicio).toBe("2027-01-10");
  });

  it("medicamento sem dose tem doses []", async () => {
    const res = await getProprio();
    expect(res.body.medicamentos.find((m: MedResp) => m.id === 2).doses).toEqual([]);
  });

  it("200 com { medicamentos: [] } quando o idoso não tem medicamento", async () => {
    logadoComo(IDOSO_B + 100, "idoso");
    const res = await getProprio();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ medicamentos: [] });
  });

  it("200 com lista vazia também na rota de vínculo", async () => {
    logadoComo(FAMILIAR, "familiar");
    vinculos = [vinculo({ idoso_id: IDOSO_B + 100 })];
    const res = await getVinculo(IDOSO_B + 100);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ medicamentos: [] });
  });
});

// ---------------------------------------------------------------------------------------------
// c) Conteúdo e ordenação
// ---------------------------------------------------------------------------------------------
describe("conteúdo e ordenação", () => {
  it("inativo e fora da janela data_inicio/data_fim entram (é histórico) e ativo vai na resposta", async () => {
    const res = await getProprio();
    const porId = (id: number) => res.body.medicamentos.find((m: MedResp) => m.id === id);
    expect(porId(2).ativo).toBe(false); // inativo e já encerrado
    expect(porId(4).ativo).toBe(true); // ainda não começou
    expect(res.body.medicamentos).toHaveLength(4);
  });

  it("medicamentos por data_inicio desc, desempate por id desc", async () => {
    const res = await getProprio();
    // 2027-01-10 (4), 2026-08-15 (3), 2026-03-01 duas vezes: id 2 antes do 1.
    expect(res.body.medicamentos.map((m: MedResp) => m.id)).toEqual([4, 3, 2, 1]);
  });

  it("doses por data_hora_administracao desc, desempate por id desc", async () => {
    const res = await getProprio();
    const m1 = res.body.medicamentos.find((m: MedResp) => m.id === 1);
    // 12:30 duas vezes: id 2 antes do 1; depois a de 10/09.
    expect(m1.doses.map((d: { id: number }) => d.id)).toEqual([2, 1, 3]);
  });

  it("os status das doses saem como gravados", async () => {
    const res = await getProprio();
    const m1 = res.body.medicamentos.find((m: MedResp) => m.id === 1);
    expect(m1.doses.map((d: { status_administracao: string }) => d.status_administracao)).toEqual([
      "pulado",
      "administrado",
      "atrasado",
    ]);
  });

  it("dose de medicamento do idoso B nunca aparece na resposta do A, em nenhuma das rotas", async () => {
    // Dose de B cadastrada sob o medicamento 1 do A não existe; aqui garantimos que as de B ficam de fora.
    const proprio = await getProprio();
    logadoComo(FAMILIAR, "familiar");
    vinculos = [vinculo()];
    const porVinculo = await getVinculo(IDOSO_A);
    for (const res of [proprio, porVinculo]) {
      const ids = (res.body.medicamentos as MedResp[]).flatMap((m) => m.doses.map((d) => d.id));
      expect(ids).not.toContain(100);
      expect(ids).not.toContain(101);
      semSentinelas(JSON.stringify(res.body), SENTINELAS_B);
    }
  });

  it("uma única consulta, filtrada por idoso_id, com orderBy e include das doses ordenadas", async () => {
    await getProprio();
    expect(findManyMedicamento).toHaveBeenCalledTimes(1);
    const arg = findManyMedicamento.mock.calls[0][0];
    expect(arg.where).toEqual({ idoso_id: IDOSO_A });
    expect(arg.orderBy).toEqual([{ data_inicio: "desc" }, { id: "desc" }]);
    expect(arg.include).toEqual({ doses: { orderBy: [{ data_hora_administracao: "desc" }, { id: "desc" }] } });
  });

  it("sem filtro por query string: ?ativo=true não esconde os inativos", async () => {
    const res = await auth(request(app).get("/remedios?ativo=true&limit=1"));
    expect(res.status).toBe(200);
    expect(res.body.medicamentos).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------------------------
// d) Paridade entre atores
// ---------------------------------------------------------------------------------------------
describe("paridade", () => {
  it("familiar aprovado vê corpo idêntico ao do idoso", async () => {
    const doIdoso = await getProprio();
    logadoComo(FAMILIAR, "familiar");
    vinculos = [vinculo()];
    const doFamiliar = await getVinculo(IDOSO_A);
    expect(doFamiliar.status).toBe(200);
    expect(doFamiliar.body.medicamentos.length).toBeGreaterThan(0);
    expect(doFamiliar.body).toEqual(doIdoso.body);
  });

  it("cuidador aprovado sem nenhuma flag vê o mesmo conjunto que o idoso", async () => {
    const doIdoso = await getProprio();
    logadoComo(CUIDADOR, "cuidador");
    vinculos = [vinculo({ vinculado_id: CUIDADOR, tipo_vinculo: "cuidador" })];
    const doCuidador = await getVinculo(IDOSO_A);
    expect(doCuidador.status).toBe(200);
    expect(doCuidador.body).toEqual(doIdoso.body);
  });
});

// ---------------------------------------------------------------------------------------------
// e) Origem do idoso da consulta
// ---------------------------------------------------------------------------------------------
describe("origem do idoso da consulta", () => {
  it("rota de vínculo: idoso_id vem do vínculo, não do path (mock do vínculo ignora o where)", async () => {
    logadoComo(FAMILIAR, "familiar");
    findFirstVinculo.mockResolvedValue(vinculo({ idoso_id: IDOSO_A }));
    const res = await getVinculo(IDOSO_B);
    expect(res.status).toBe(200);
    expect(findManyMedicamento.mock.calls[0][0].where).toEqual({ idoso_id: IDOSO_A });
    expect((res.body.medicamentos as MedResp[]).every((m) => m.idoso_id === IDOSO_A)).toBe(true);
    semSentinelas(JSON.stringify(res.body), SENTINELAS_B);
  });

  it("rota de vínculo: findMany que ignora o where não faz o idoso do path vencer", async () => {
    logadoComo(FAMILIAR, "familiar");
    vinculos = [vinculo()];
    await getVinculo(IDOSO_A);
    expect(findManyMedicamento.mock.calls[0][0].where.idoso_id).toBe(IDOSO_A);
    // O where enviado ao banco nunca contém o idoso que o cliente colocou na query ou no corpo.
    findManyMedicamento.mockClear();
    await auth(request(app).get(`/remedios/idoso/${IDOSO_A}?idoso_id=${IDOSO_B}`)).send({ idoso_id: IDOSO_B });
    expect(findManyMedicamento.mock.calls[0][0].where).toEqual({ idoso_id: IDOSO_A });
  });

  it("rota própria: idoso_id vem de req.usuarioId; query e corpo com o idoso B são ignorados", async () => {
    const res = await auth(request(app).get(`/remedios?idoso_id=${IDOSO_B}&idosoId=${IDOSO_B}`)).send({
      idoso_id: IDOSO_B,
    });
    expect(res.status).toBe(200);
    expect(findManyMedicamento.mock.calls[0][0].where).toEqual({ idoso_id: IDOSO_A });
    expect((res.body.medicamentos as MedResp[]).every((m) => m.idoso_id === IDOSO_A)).toBe(true);
    semSentinelas(JSON.stringify(res.body), SENTINELAS_B);
  });

  it("acesso cruzado com controle positivo: aprovado só do A lê o A e leva 403 no B", async () => {
    logadoComo(FAMILIAR, "familiar");
    vinculos = [vinculo({ idoso_id: IDOSO_A })];
    const ok = await getVinculo(IDOSO_A);
    expect(ok.status).toBe(200);
    expect(ok.body.medicamentos.length).toBeGreaterThan(0); // controle positivo: há dados e eles saem
    findManyMedicamento.mockClear();
    const negado = await getVinculo(IDOSO_B);
    expect(negado.status).toBe(403);
    expect(findManyMedicamento).not.toHaveBeenCalled();
    semSentinelas(JSON.stringify(negado.body), SENTINELAS_B);
  });
});

// ---------------------------------------------------------------------------------------------
// g) Ordem de erros
// ---------------------------------------------------------------------------------------------
describe("ordem de erros", () => {
  it("401 sem token nas duas rotas, sem tocar o banco", async () => {
    expect((await request(app).get("/remedios")).status).toBe(401);
    expect((await request(app).get(`/remedios/idoso/${IDOSO_A}`)).status).toBe(401);
    expect(findManyMedicamento).not.toHaveBeenCalled();
    expect(findFirstVinculo).not.toHaveBeenCalled();
  });

  it("401 com token inválido nas duas rotas", async () => {
    verifyIdToken.mockRejectedValue(Object.assign(new Error("token inválido"), { code: "auth/argument-error" }));
    expect((await getProprio()).status).toBe(401);
    expect((await getVinculo(IDOSO_A)).status).toBe(401);
    expect(findManyMedicamento).not.toHaveBeenCalled();
  });

  it.each(["abc", "1.5", "1,5"])("400 com idosoId %p antes de olhar o vínculo", async (id) => {
    logadoComo(FAMILIAR, "familiar");
    vinculos = [vinculo()];
    const res = await getVinculo(id);
    expect(res.status).toBe(400);
    expect(findFirstVinculo).not.toHaveBeenCalled();
    expect(findManyMedicamento).not.toHaveBeenCalled();
  });

  // Comportamento REAL do middleware compartilhado (intocado, D9): ele só rejeita o que Number() não
  // converte em inteiro ("abc", "1.5", "1,5" dão 400 acima). 0, negativo, "1e2" e acima de INT32_MAX passam
  // por ele; com o fake do vínculo (que filtra pelo where) caem no 403, nunca em 200 e nunca na tabela.
  // Medido com Prisma real no verify: 2147483648 e 99999999999 também respondem 403.
  it.each(["0", "-1", "1e2", "2147483648", "99999999999"])("idosoId %p passa pelo middleware e dá 403 no fake, nunca 200 nem tabela", async (id) => {
    logadoComo(FAMILIAR, "familiar");
    vinculos = [vinculo()];
    const res = await getVinculo(id);
    expect(res.status).toBe(403);
    expect(findManyMedicamento).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------------------------
// h) Privacidade
// ---------------------------------------------------------------------------------------------
describe("capturando: o método de captura enxerga console.* e stdout/stderr (controle positivo)", () => {
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
  it("200 não escreve nada em console.*, stdout nem stderr (nenhum valor de medicamento ou dose)", async () => {
    const proprio = await capturando(() => getProprio());
    logadoComo(FAMILIAR, "familiar");
    vinculos = [vinculo()];
    const porVinculo = await capturando(() => getVinculo(IDOSO_A));
    for (const { res, saidas } of [proprio, porVinculo]) {
      expect(res.status).toBe(200);
      expect(res.body.medicamentos.length).toBeGreaterThan(0);
      semSentinelas(saidas, TODOS_OS_SENTINELAS);
      expect(saidas).not.toContain(SENT_A.nome);
    }
  });

  it("corpo do 403 é fixo por rota e igual para todos os atores negados, sem sentinela", async () => {
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
    expect([...(corpos.get("proprio") ?? [])]).toEqual([JSON.stringify({ error: MSG_403_LEITURA_REMEDIOS })]);
    expect([...(corpos.get("vinculo") ?? [])]).toEqual([JSON.stringify({ error: MSG_403_MIDDLEWARE })]);
  });

  // Texto literal, de propósito: não reusa a constante do teste nem compara corpos entre si (dois 404
  // iguais passariam). Cuidador e familiar na rota própria recebem exatamente esta frase, sem motivo.
  it.each([
    ["cuidador", CUIDADOR],
    ["familiar", FAMILIAR],
  ] as const)("403 de perfil de %s na rota própria é o texto literal, sem citar o motivo", async (perfil, id) => {
    logadoComo(id, perfil);
    const res = await getProprio();
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Sem permissão para visualizar histórico de remédios." });
    expect(res.body.error).not.toMatch(/modo_decisao|cuidador|familiar|vínculo|idoso/i);
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
    nome: "GET /remedios",
    ator: [IDOSO_A, "idoso"],
    vinculos: [],
    chamar: () => getProprio(),
    pontos: ["usuario.findUnique", "medicamento.findMany"],
  },
  {
    nome: "GET /remedios/idoso/:idosoId",
    ator: [FAMILIAR, "familiar"],
    vinculos: [vinculo()],
    chamar: () => getVinculo(IDOSO_A),
    pontos: ["vinculo.findFirst", "medicamento.findMany"],
  },
];

const MSG_COM_SENTINELA = `falha ${SENT_ERRO} ${SENT_A.nome} ${SENT_B.obs}`;

const ERROS: [string, () => unknown][] = [
  ["Error com sentinela na message", () => new Error(MSG_COM_SENTINELA)],
  [
    "PrismaClientKnownRequestError",
    () =>
      new Prisma.PrismaClientKnownRequestError(MSG_COM_SENTINELA, {
        code: "P2002",
        clientVersion: "5.22.0",
        meta: { valor: SENT_META, nome: SENT_A.nome },
      }),
  ],
  ["PrismaClientValidationError", () => new Prisma.PrismaClientValidationError(MSG_COM_SENTINELA, { clientVersion: "5.22.0" })],
  ["string lançada", () => MSG_COM_SENTINELA],
  ["objeto simples", () => ({ nome: SENT_A.nome, observacoes: SENT_B.obs, detalhe: SENT_META, erro: SENT_ERRO })],
];

describe("privacidade: falha em qualquer ponto de I/O vira o 500 genérico do errorHandler, sem sentinela em lugar nenhum", () => {
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
    logadoComo(IDOSO_A, "idoso");
    falhas.set("medicamento.findMany", ERROS[1][1]());
    const { res, saidas } = await capturando(() => getProprio());
    expect(res.status).toBe(500);
    expect(saidas).toContain("PrismaClientKnownRequestError");
    expect(saidas).toContain("P2002");
    expect(saidas).toContain("/remedios");
  });
});
