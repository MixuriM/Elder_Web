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
import { extrairTextoPdf } from "../testSupport/extrairTextoPdf";

// Item 5.4 (RF-014): exportar o histórico combinado (remédios + saúde) em um único PDF. Medicamento, dose e
// RegistroSaude são dado sensível (RNF-001). Todos os ids e valores abaixo são FICTÍCIOS; sentinelas óbvios.
// A extração de texto do PDF roda FORA das janelas de captura de console/stdout/stderr.

const verifyIdToken = jest.fn();
const findFirstUsuario = jest.fn();
const findUniqueUsuario = jest.fn();
const findFirstVinculo = jest.fn();
const findManyMedicamento = jest.fn();
const findManyRegistro = jest.fn();
const resolverModoDecisaoMock = jest.fn();
const gerarMock = jest.fn();

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
    registroSaude: { findMany: (...args: unknown[]) => findManyRegistro(...args) },
  },
}));
// A exportação é leitura: o resolver não pode ser chamado em nenhum teste desta suíte.
jest.mock("./vinculo", () => ({
  __esModule: true,
  ...jest.requireActual("./vinculo"),
  resolverModoDecisao: (...args: unknown[]) => resolverModoDecisaoMock(...args),
}));
// Builder real por padrão; o mock permite injetar falha nele.
jest.mock("../lib/historicoPdf", () => {
  const real = jest.requireActual("../lib/historicoPdf");
  return { __esModule: true, ...real, gerarHistoricoPdf: (...args: unknown[]) => gerarMock(...args) };
});

import app from "../app";

type Perfil = "idoso" | "cuidador" | "familiar";

const MSG_403_EXPORTACAO = "Sem permissão para exportar histórico.";
const MSG_403_MIDDLEWARE = "Vínculo aprovado não encontrado para este idoso.";
const CORPO_500 = { error: "Erro interno." };

const SENT_A = { idoso: "SENT_A_IDOSO", nome: "SENT_A_NOME", dosagem: "SENT_A_DOSAGEM", freq: "SENT_A_FREQ", obs: "SENT_A_OBS", doseObs: "SENT_A_DOSE_OBS", tipo: "SENT_A_TIPO", unidade: "SENT_A_UN", regObs: "SENT_A_REG_OBS" };
const SENT_B = { idoso: "SENT_B_IDOSO", nome: "SENT_B_NOME", dosagem: "SENT_B_DOSAGEM", freq: "SENT_B_FREQ", obs: "SENT_B_OBS", doseObs: "SENT_B_DOSE_OBS", tipo: "SENT_B_TIPO", unidade: "SENT_B_UN", regObs: "SENT_B_REG_OBS", valor: "777,77" };
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

type RegFake = {
  id: number;
  idoso_id: number;
  registrado_por_id: number;
  editado_por_id: number;
  tipo_medicao: string;
  valor_1: Prisma.Decimal;
  valor_2: Prisma.Decimal | null;
  unidade: string;
  data_hora: Date;
  observacoes: string | null;
  created_at: Date;
  updated_at: Date;
};

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const CRIADO = new Date("2026-09-01T10:00:00.000Z");

function sent(idoso_id: number) {
  return idoso_id === IDOSO_A ? SENT_A : SENT_B;
}

function med(id: number, idoso_id: number, inicio: string, over: Partial<MedFake> = {}): MedFake {
  const s = sent(idoso_id);
  return {
    id,
    idoso_id,
    criado_por_id: idoso_id,
    nome: s.nome,
    dosagem: s.dosagem,
    frequencia: s.freq,
    data_inicio: dia(inicio),
    data_fim: null,
    observacoes: s.obs,
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

function reg(id: number, idoso_id: number, quando: string, over: Partial<RegFake> = {}): RegFake {
  const s = sent(idoso_id);
  return {
    id,
    idoso_id,
    registrado_por_id: idoso_id,
    editado_por_id: idoso_id,
    tipo_medicao: s.tipo,
    valor_1: new Prisma.Decimal("120"),
    valor_2: new Prisma.Decimal("80"),
    unidade: s.unidade,
    data_hora: new Date(quando),
    observacoes: s.regObs,
    created_at: CRIADO,
    updated_at: CRIADO,
    ...over,
  };
}

let medicamentos: MedFake[] = [];
let doses: DoseFake[] = [];
let registros: RegFake[] = [];
let vinculos: VinculoFake[] = [];
let logado: { id: number; perfil: Perfil } = { id: IDOSO_A, perfil: "idoso" };
const falhas = new Map<string, unknown>();

const USUARIOS: Record<number, { nome: string; tipo_perfil: Perfil }> = {
  [IDOSO_A]: { nome: SENT_A.idoso, tipo_perfil: "idoso" },
  [IDOSO_B]: { nome: SENT_B.idoso, tipo_perfil: "idoso" },
  [CUIDADOR]: { nome: "Cuidador Fictício", tipo_perfil: "cuidador" },
  [FAMILIAR]: { nome: "Familiar Fictício", tipo_perfil: "familiar" },
  [IDOSO_B + 100]: { nome: "Idoso Vazio", tipo_perfil: "idoso" },
};

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
  // Filtra de verdade pelo where.id e respeita o select: devolve só o que foi pedido.
  findUniqueUsuario.mockImplementation(async ({ where, select }: { where: { id: number }; select: Record<string, boolean> }) => {
    falharSeInjetado("usuario.findUnique");
    const u = USUARIOS[where.id];
    if (!u) return null;
    return Object.fromEntries(Object.entries(u).filter(([k]) => select?.[k]));
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
  findManyRegistro.mockImplementation(async ({ where, orderBy }: ArgsFindMany) => {
    falharSeInjetado("registroSaude.findMany");
    return ordenar(
      registros.filter((r) => r.idoso_id === where.idoso_id),
      orderBy,
    );
  });
  resolverModoDecisaoMock.mockImplementation(async () => {
    throw new Error("resolverModoDecisao não pode ser chamado em rota de leitura");
  });
  gerarMock.mockImplementation((...args: unknown[]) =>
    (jest.requireActual("../lib/historicoPdf") as { gerarHistoricoPdf: (...a: unknown[]) => Promise<Buffer> }).gerarHistoricoPdf(...args),
  );
}

function logadoComo(id: number, perfil: Perfil) {
  logado = { id, perfil };
}

beforeEach(() => {
  [verifyIdToken, findFirstUsuario, findUniqueUsuario, findFirstVinculo, findManyMedicamento, findManyRegistro, resolverModoDecisaoMock, gerarMock].forEach(
    (m) => m.mockReset(),
  );
  falhas.clear();
  logadoComo(IDOSO_A, "idoso");
  medicamentos = [
    med(1, IDOSO_A, "2026-03-01"),
    med(2, IDOSO_A, "2026-03-01", { ativo: false, data_fim: dia("2026-04-30") }),
    med(3, IDOSO_A, "2026-08-15", { data_fim: dia("2026-12-31"), observacoes: null }),
    med(10, IDOSO_B, "2026-09-01"),
  ];
  doses = [
    dose(1, 1, "2026-09-14T12:30:00.000Z", "administrado"),
    dose(2, 1, "2026-09-14T12:30:00.000Z", "pulado"),
    dose(3, 1, "2026-09-10T08:00:00.000Z", "atrasado", { observacoes: SENT_A.doseObs, registrado_por_id: CUIDADOR }),
    dose(100, 10, "2026-09-21T09:00:00.000Z", "administrado", { observacoes: SENT_B.doseObs, registrado_por_id: IDOSO_B }),
  ];
  registros = [
    reg(1, IDOSO_A, "2026-09-24T12:00:00.000Z", { tipo_medicao: "pressao", unidade: "mmHg", observacoes: SENT_A.regObs }),
    reg(2, IDOSO_A, "2026-09-25T12:00:00.000Z", { tipo_medicao: "temperatura", valor_1: new Prisma.Decimal("36.6"), valor_2: null, unidade: "°C", observacoes: null }),
    reg(200, IDOSO_B, "2026-09-26T12:00:00.000Z", { valor_1: new Prisma.Decimal("777.77"), valor_2: new Prisma.Decimal("666.66") }),
  ];
  vinculos = [];
  instalarFakes();
});

afterEach(() => {
  // Exportação é leitura: nenhuma rota pode consultar modo_decisao.
  expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
});

type CorpoBinario = Buffer | { error?: string } | null;

// Recebe PDF como Buffer; qualquer outro content-type (erro JSON) vira objeto.
function parseBinarioOuJson(res: NodeJS.ReadableStream & { headers: Record<string, string | string[] | undefined> }, cb: (e: Error | null, corpo?: CorpoBinario) => void) {
  const partes: Buffer[] = [];
  res.on("data", (c: Buffer) => partes.push(c));
  res.on("end", () => {
    const buf = Buffer.concat(partes);
    if (String(res.headers["content-type"] ?? "").startsWith("application/pdf")) return cb(null, buf);
    try {
      cb(null, buf.length ? (JSON.parse(buf.toString("utf8")) as CorpoBinario) : null);
    } catch (e) {
      cb(e as Error);
    }
  });
}

const baixar = (r: request.Test) =>
  r.set("Authorization", "Bearer x").buffer(true).parse(parseBinarioOuJson as never);
const getProprio = () => baixar(request(app).get("/historico/pdf"));
const getVinculo = (idoso: number | string) => baixar(request(app).get(`/historico/idoso/${idoso}/pdf`));

const CONSOLES = ["log", "info", "warn", "error", "debug"] as const;

// Captura console.*, process.stdout.write e process.stderr.write durante fn. util.inspect com depth alto
// inclui message, stack, meta e propriedades do erro.
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

// Tudo que o cliente enxerga em resposta de erro (corpo JSON e headers) mais tudo que o processo escreveu.
function visivel(res: request.Response, saidas: string) {
  const corpo = Buffer.isBuffer(res.body) ? res.body.toString("latin1") : res.body;
  return inspect([corpo, res.headers], { depth: 10, maxStringLength: Infinity }) + saidas;
}

function semSentinelas(texto: string, sentinelas: string[]) {
  for (const s of sentinelas) expect(texto).not.toContain(s);
}

const pdf = (res: request.Response) => res.body as Buffer;
const textoDe = async (res: request.Response) => (await extrairTextoPdf(pdf(res))).texto;
const semGeradoEm = (t: string) => t.split("\n").filter((l) => !l.startsWith("Gerado em")).join("\n");

// ---------------------------------------------------------------------------------------------
// a) Matriz de acesso compartilhada (itens 4.4, 5.3 e 5.4)
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

describe("matriz de acesso compartilhada (idêntica à de GET /saude e GET /remedios)", () => {
  it.each(CASOS_ACESSO_LEITURA)("$nome = $esperado", async (caso) => {
    logadoComo(ID_ATOR[caso.ator], caso.ator);
    vinculos = vinculoDoCaso(caso);

    const res = await (caso.rota === "proprio" ? getProprio() : getVinculo(IDOSO_A));

    expect(res.status).toBe(caso.esperado);
    if (caso.esperado === 200) {
      expect(res.headers["content-type"]).toMatch(/^application\/pdf/);
      const t = await textoDe(res);
      expect(t).toContain(SENT_A.nome);
      expect(t).toContain(SENT_A.idoso);
      semSentinelas(t, SENTINELAS_B);
    } else {
      expect(findManyMedicamento).not.toHaveBeenCalled();
      expect(findManyRegistro).not.toHaveBeenCalled();
      expect(res.body).toEqual({ error: caso.rota === "proprio" ? MSG_403_EXPORTACAO : MSG_403_MIDDLEWARE });
    }
  });
});

// ---------------------------------------------------------------------------------------------
// b) Resposta 200: headers, bytes e conteúdo
// ---------------------------------------------------------------------------------------------
describe("resposta 200", () => {
  it.each([
    ["GET /historico/pdf", () => getProprio(), null],
    ["GET /historico/idoso/:idosoId/pdf", () => getVinculo(IDOSO_A), [FAMILIAR, "familiar"] as const],
  ])("%s: headers, magic bytes e fim do arquivo", async (_nome, chamar, ator) => {
    if (ator) {
      logadoComo(ator[0], ator[1]);
      vinculos = [vinculo()];
    }
    const res = await chamar();
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^application\/pdf/);
    expect(res.headers["content-disposition"]).toBe('attachment; filename="historico-saude-remedios.pdf"');
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    const buf = pdf(res);
    expect(buf.subarray(0, 4).toString("latin1")).toBe("%PDF");
    expect(buf.toString("latin1").trimEnd().endsWith("%%EOF")).toBe(true);
    // Nome do arquivo fixo: nunca nome nem id de pessoa.
    expect(res.headers["content-disposition"]).not.toMatch(/SENT_|\d{2,}/);
  });

  it("texto extraído: nome do idoso, medicamento, situação da dose e valor de saúde formatado", async () => {
    const res = await getProprio();
    const t = await textoDe(res);
    expect(t).toContain(SENT_A.idoso);
    expect(t).toContain(SENT_A.nome);
    expect(t).toContain("Administrado");
    expect(t).toContain("Pulado");
    expect(t).toContain("Atrasado");
    expect(t).toContain("120/80");
    expect(t).toContain("36,6 °C");
    expect(t).toContain("Gerado em");
    expect(t).toContain(SENT_A.doseObs);
    expect(t).toContain(SENT_A.regObs);
  });

  it("valor conhecido '120/80 mmHg' (unidade real) sai no texto", async () => {
    registros = [reg(1, IDOSO_A, "2026-09-24T12:00:00.000Z", { unidade: "mmHg", tipo_medicao: "pressao", observacoes: null })];
    const t = await textoDe(await getProprio());
    expect(t).toContain("120/80 mmHg");
  });

  it("inclui inativo e fora da janela (é histórico) e ordena: medicamentos por data_inicio desc, id desc", async () => {
    medicamentos = [
      med(1, IDOSO_A, "2026-03-01", { nome: "MED_UM" }),
      med(2, IDOSO_A, "2026-03-01", { nome: "MED_DOIS", ativo: false, data_fim: dia("2026-04-30") }),
      med(3, IDOSO_A, "2026-08-15", { nome: "MED_TRES" }),
    ];
    const t = await textoDe(await getProprio());
    expect(t).toContain("Situação: Inativo");
    // 2026-08-15 (3), depois 2026-03-01 duas vezes: id 2 antes do 1.
    expect(t.indexOf("MED_TRES")).toBeLessThan(t.indexOf("MED_DOIS"));
    expect(t.indexOf("MED_DOIS")).toBeLessThan(t.indexOf("MED_UM"));
  });

  it("consultas Prisma: where por idoso_id, select mínimo (sem foto), include das doses e ordenação", async () => {
    await getProprio();
    expect(findUniqueUsuario).toHaveBeenCalledTimes(1);
    const u = findUniqueUsuario.mock.calls[0][0];
    expect(u.where).toEqual({ id: IDOSO_A });
    // NUNCA o BLOB de foto: o select só pode pedir nome (e tipo_perfil, na rota própria).
    expect(Object.keys(u.select).sort()).toEqual(["nome", "tipo_perfil"]);
    expect(findManyMedicamento).toHaveBeenCalledTimes(1);
    const m = findManyMedicamento.mock.calls[0][0];
    expect(m.where).toEqual({ idoso_id: IDOSO_A });
    expect(m.orderBy).toEqual([{ data_inicio: "desc" }, { id: "desc" }]);
    expect(m.include).toEqual({ doses: { orderBy: [{ data_hora_administracao: "desc" }, { id: "desc" }] } });
    expect(findManyRegistro).toHaveBeenCalledTimes(1);
    const r = findManyRegistro.mock.calls[0][0];
    expect(r.where).toEqual({ idoso_id: IDOSO_A });
    expect(r.orderBy).toEqual({ data_hora: "desc" });
  });

  it("rota por vínculo: o select do usuário pede só o nome", async () => {
    logadoComo(FAMILIAR, "familiar");
    vinculos = [vinculo()];
    await getVinculo(IDOSO_A);
    const u = findUniqueUsuario.mock.calls[0][0];
    expect(u.where).toEqual({ id: IDOSO_A });
    expect(Object.keys(u.select)).toEqual(["nome"]);
  });

  it("sem paginação nem filtro: query string não esconde nada", async () => {
    const t = await textoDe(await baixar(request(app).get("/historico/pdf?ativo=true&limit=1")));
    expect(t).toContain("Situação: Inativo");
  });

  it("não inclui ids, autor, e-mail nem foto no texto", async () => {
    const t = await textoDe(await getProprio());
    expect(t).not.toMatch(/autor|editad|criad|e-mail|@/i);
  });
});

// ---------------------------------------------------------------------------------------------
// c) Estados vazios e volume
// ---------------------------------------------------------------------------------------------
describe("estados vazios e volume", () => {
  it("idoso sem dados: 200 com os dois textos de estado vazio", async () => {
    logadoComo(IDOSO_B + 100, "idoso");
    const res = await getProprio();
    expect(res.status).toBe(200);
    const t = await textoDe(res);
    expect(t).toContain("Nenhum medicamento cadastrado.");
    expect(t).toContain("Nenhum registro de saúde.");
  });

  it("estado vazio também na rota de vínculo", async () => {
    logadoComo(FAMILIAR, "familiar");
    vinculos = [vinculo({ idoso_id: IDOSO_B + 100 })];
    const res = await getVinculo(IDOSO_B + 100);
    expect(res.status).toBe(200);
    expect(await textoDe(res)).toContain("Nenhum medicamento cadastrado.");
  });

  it("300 medicamentos com doses geram mais de uma página sem erro", async () => {
    medicamentos = Array.from({ length: 300 }, (_, i) => med(1000 + i, IDOSO_A, "2026-03-01", { nome: `MEDVOL_${i}` }));
    doses = medicamentos.flatMap((m) => [dose(m.id, m.id, "2026-09-14T12:30:00.000Z", "administrado")]);
    const res = await getProprio();
    expect(res.status).toBe(200);
    const { texto, paginas } = await extrairTextoPdf(pdf(res));
    expect(paginas).toBeGreaterThan(1);
    expect(texto).toContain("MEDVOL_0");
    expect(texto).toContain("MEDVOL_299");
    expect(texto).toContain(`Página ${paginas} de ${paginas}`);
  });
});

// ---------------------------------------------------------------------------------------------
// d) Paridade entre atores
// ---------------------------------------------------------------------------------------------
describe("paridade", () => {
  it("familiar aprovado (modo_decisao 'idoso') recebe o mesmo conteúdo do idoso", async () => {
    const doIdoso = await textoDe(await getProprio());
    logadoComo(FAMILIAR, "familiar");
    vinculos = [vinculo()];
    const res = await getVinculo(IDOSO_A);
    expect(res.status).toBe(200);
    expect(doIdoso).toContain(SENT_A.nome);
    expect(semGeradoEm(await textoDe(res))).toBe(semGeradoEm(doIdoso));
  });

  it("cuidador aprovado sem nenhuma flag recebe o mesmo conteúdo do idoso", async () => {
    const doIdoso = await textoDe(await getProprio());
    logadoComo(CUIDADOR, "cuidador");
    vinculos = [vinculo({ vinculado_id: CUIDADOR, tipo_vinculo: "cuidador" })];
    const res = await getVinculo(IDOSO_A);
    expect(res.status).toBe(200);
    expect(semGeradoEm(await textoDe(res))).toBe(semGeradoEm(doIdoso));
  });
});

// ---------------------------------------------------------------------------------------------
// e) Origem do idoso da consulta e acesso cruzado
// ---------------------------------------------------------------------------------------------
describe("origem do idoso da consulta", () => {
  it("rota de vínculo: idoso_id vem do vínculo, não do path (mock do vínculo ignora o where)", async () => {
    logadoComo(FAMILIAR, "familiar");
    findFirstVinculo.mockResolvedValue(vinculo({ idoso_id: IDOSO_A }));
    const res = await getVinculo(IDOSO_B);
    expect(res.status).toBe(200);
    for (const mock of [findManyMedicamento, findManyRegistro]) expect(mock.mock.calls[0][0].where).toEqual({ idoso_id: IDOSO_A });
    expect(findUniqueUsuario.mock.calls[0][0].where).toEqual({ id: IDOSO_A });
    const t = await textoDe(res);
    expect(t).toContain(SENT_A.nome);
    semSentinelas(t, SENTINELAS_B);
  });

  it("rota de vínculo: query e corpo com o idoso B são ignorados", async () => {
    logadoComo(FAMILIAR, "familiar");
    vinculos = [vinculo()];
    const res = await baixar(request(app).get(`/historico/idoso/${IDOSO_A}/pdf?idoso_id=${IDOSO_B}&idosoId=${IDOSO_B}`).send({ idoso_id: IDOSO_B }));
    expect(res.status).toBe(200);
    expect(findManyMedicamento.mock.calls[0][0].where).toEqual({ idoso_id: IDOSO_A });
    expect(findManyRegistro.mock.calls[0][0].where).toEqual({ idoso_id: IDOSO_A });
    semSentinelas(await textoDe(res), SENTINELAS_B);
  });

  it("rota própria: idoso_id vem de req.usuarioId; query e corpo com o idoso B são ignorados", async () => {
    const res = await baixar(request(app).get(`/historico/pdf?idoso_id=${IDOSO_B}&idosoId=${IDOSO_B}`).send({ idoso_id: IDOSO_B }));
    expect(res.status).toBe(200);
    for (const mock of [findManyMedicamento, findManyRegistro]) expect(mock.mock.calls[0][0].where).toEqual({ idoso_id: IDOSO_A });
    expect(findUniqueUsuario.mock.calls[0][0].where).toEqual({ id: IDOSO_A });
    semSentinelas(await textoDe(res), SENTINELAS_B);
  });

  it("acesso cruzado com controle positivo: aprovado só do A lê o A e leva 403 no B; B existe e sai para quem tem acesso", async () => {
    logadoComo(FAMILIAR, "familiar");
    vinculos = [vinculo({ idoso_id: IDOSO_A })];
    const ok = await getVinculo(IDOSO_A);
    expect(ok.status).toBe(200);
    const tA = await textoDe(ok);
    expect(tA).toContain(SENT_A.nome);
    semSentinelas(tA, SENTINELAS_B);
    findManyMedicamento.mockClear();
    findManyRegistro.mockClear();
    const negado = await getVinculo(IDOSO_B);
    expect(negado.status).toBe(403);
    expect(findManyMedicamento).not.toHaveBeenCalled();
    expect(findManyRegistro).not.toHaveBeenCalled();
    // Controle positivo: o idoso B tem mesmo esses dados e os sentinelas dele saem no PDF dele.
    logadoComo(IDOSO_B, "idoso");
    const tB = await textoDe(await getProprio());
    for (const s of [SENT_B.nome, SENT_B.idoso, SENT_B.tipo, SENT_B.valor]) expect(tB).toContain(s);
    semSentinelas(tB, Object.values(SENT_A));
  });
});

// ---------------------------------------------------------------------------------------------
// f) Ordem de erros
// ---------------------------------------------------------------------------------------------
describe("ordem de erros", () => {
  it("401 sem token nas duas rotas, sem tocar o banco", async () => {
    expect((await request(app).get("/historico/pdf")).status).toBe(401);
    expect((await request(app).get(`/historico/idoso/${IDOSO_A}/pdf`)).status).toBe(401);
    for (const m of [findManyMedicamento, findManyRegistro, findFirstVinculo, findUniqueUsuario]) expect(m).not.toHaveBeenCalled();
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

  it.each(["0", "-1", "1e2", "2147483648"])("idosoId %p passa pelo middleware e dá 403 no fake, nunca 200 nem tabela", async (id) => {
    logadoComo(FAMILIAR, "familiar");
    vinculos = [vinculo()];
    const res = await getVinculo(id);
    expect(res.status).toBe(403);
    expect(findManyMedicamento).not.toHaveBeenCalled();
    expect(findManyRegistro).not.toHaveBeenCalled();
  });

  // Texto literal, de propósito: não reusa a constante do teste. Sem citar o motivo.
  it.each([
    ["cuidador", CUIDADOR],
    ["familiar", FAMILIAR],
  ] as const)("403 de perfil de %s na rota própria é o texto literal, sem citar o motivo", async (perfil, id) => {
    logadoComo(id, perfil);
    const res = await getProprio();
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Sem permissão para exportar histórico." });
    expect(res.body.error).not.toMatch(/modo_decisao|cuidador|familiar|vínculo|idoso|perfil/i);
  });

  it("403 de vínculo vem do middleware, com o texto próprio dele (rota por vínculo)", async () => {
    logadoComo(CUIDADOR, "cuidador");
    const res = await getVinculo(IDOSO_A);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: MSG_403_MIDDLEWARE });
  });
});

// ---------------------------------------------------------------------------------------------
// g) Privacidade
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
  it("200 não escreve nada em console.*, stdout nem stderr (nenhum valor de saúde ou medicamento)", async () => {
    const proprio = await capturando(() => getProprio());
    logadoComo(FAMILIAR, "familiar");
    vinculos = [vinculo()];
    const porVinculo = await capturando(() => getVinculo(IDOSO_A));
    for (const { res, saidas } of [proprio, porVinculo]) {
      expect(res.status).toBe(200);
      semSentinelas(saidas, TODOS_OS_SENTINELAS);
      expect(saidas).not.toContain("120");
    }
    // Extração só depois da janela de captura, e com conteúdo de verdade (não passa por vacuidade).
    expect(await textoDe(proprio.res)).toContain(SENT_A.nome);
  });

  it("corpo do 403 é fixo por rota e igual para todos os atores negados, sem sentinela", async () => {
    const corpos = new Map<string, Set<string>>();
    for (const caso of CASOS_ACESSO_LEITURA.filter((c) => c.esperado === 403)) {
      logadoComo(ID_ATOR[caso.ator], caso.ator);
      vinculos = vinculoDoCaso(caso);
      const { res, saidas } = await capturando(() => (caso.rota === "proprio" ? getProprio() : getVinculo(IDOSO_A)));
      expect(res.status).toBe(403);
      expect(res.headers["content-type"]).not.toMatch(/pdf/);
      semSentinelas(visivel(res, saidas), TODOS_OS_SENTINELAS);
      const set = corpos.get(caso.rota) ?? new Set<string>();
      set.add(JSON.stringify(res.body));
      corpos.set(caso.rota, set);
    }
    expect([...(corpos.get("proprio") ?? [])]).toEqual([JSON.stringify({ error: MSG_403_EXPORTACAO })]);
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
    nome: "GET /historico/pdf",
    ator: [IDOSO_A, "idoso"],
    vinculos: [],
    chamar: () => getProprio(),
    pontos: ["usuario.findUnique", "medicamento.findMany", "registroSaude.findMany", "builder"],
  },
  {
    nome: "GET /historico/idoso/:idosoId/pdf",
    ator: [FAMILIAR, "familiar"],
    vinculos: [vinculo()],
    chamar: () => getVinculo(IDOSO_A),
    pontos: ["vinculo.findFirst", "usuario.findUnique", "medicamento.findMany", "registroSaude.findMany", "builder"],
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

describe("privacidade: falha em qualquer ponto vira o 500 genérico do errorHandler, sem PDF e sem sentinela", () => {
  describe.each(ROTAS_DE_FALHA)("$nome", (rota) => {
    describe.each(rota.pontos)("falha em %s", (ponto) => {
      it.each(ERROS)("%s", async (_tipo, criar) => {
        logadoComo(...rota.ator);
        vinculos = rota.vinculos;
        const erro = criar();
        if (ponto === "builder") gerarMock.mockImplementation(async () => { throw erro; });
        else falhas.set(ponto, erro);
        const { res, saidas } = await capturando(() => rota.chamar());
        expect(res.status).toBe(500);
        expect(res.body).toEqual(CORPO_500);
        // Falha antes de qualquer byte: nada de PDF (nem truncado) e nem header de download.
        expect(res.headers["content-type"]).not.toMatch(/pdf/);
        expect(res.headers["content-disposition"]).toBeUndefined();
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
    expect(saidas).toContain("/historico/pdf");
  });
});

describe("montagem em memória (D4): o builder termina antes de qualquer byte ser enviado", () => {
  it("falha do builder devolve JSON 500 normal, não um socket derrubado", async () => {
    gerarMock.mockImplementation(async () => {
      throw new Error(MSG_COM_SENTINELA);
    });
    const { res } = await capturando(() => getProprio());
    expect(res.status).toBe(500);
    expect(res.body).toEqual(CORPO_500);
    expect(gerarMock).toHaveBeenCalledTimes(1);
  });

  it("o builder recebe os dados já carregados (nome, medicamentos com doses, registros com Number)", async () => {
    await getProprio();
    const arg = gerarMock.mock.calls[0][0];
    expect(arg.nomeIdoso).toBe(SENT_A.idoso);
    expect(arg.geradoEm).toBeInstanceOf(Date);
    expect(arg.medicamentos.map((m: { nome: string }) => m.nome)).toEqual([SENT_A.nome, SENT_A.nome, SENT_A.nome]);
    expect(arg.registros.every((r: { valor_1: unknown }) => typeof r.valor_1 === "number")).toBe(true);
    expect(arg.registros.map((r: { valor_2: unknown }) => r.valor_2)).toContain(null);
    // Nada além do contrato: sem ids, sem autor.
    expect(JSON.stringify(arg)).not.toMatch(/registrado_por_id|editado_por_id|criado_por_id|idoso_id|firebase/);
  });
});
