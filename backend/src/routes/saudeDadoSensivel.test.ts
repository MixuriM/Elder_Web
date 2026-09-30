import { inspect } from "node:util";
import request from "supertest";
import { Prisma } from "@prisma/client";

// Item 4.5 (RNF-001): RegistroSaude é dado pessoal sensível (LGPD Art. 5º, XI). Esta suíte consolida
// (a) o acesso cruzado em TODAS as rotas de saúde e (b) a prova de que valor de saúde não vaza em
// resposta de erro, header, console.* nem process.stdout/stderr. Todos os ids e valores abaixo são
// FICTÍCIOS e os sentinelas são obviamente falsos.

const verifyIdToken = jest.fn();
const findFirstUsuario = jest.fn();
const findUniqueUsuario = jest.fn();
const findFirstVinculo = jest.fn();
const createRegistro = jest.fn();
const findUniqueRegistro = jest.fn();
const findManyRegistro = jest.fn();
const updateRegistro = jest.fn();
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
    registroSaude: {
      create: (...args: unknown[]) => createRegistro(...args),
      findUnique: (...args: unknown[]) => findUniqueRegistro(...args),
      findMany: (...args: unknown[]) => findManyRegistro(...args),
      update: (...args: unknown[]) => updateRegistro(...args),
    },
  },
}));
// Só resolverModoDecisao é trocada: o resto de vinculo.ts segue real.
jest.mock("./vinculo", () => ({
  __esModule: true,
  ...jest.requireActual("./vinculo"),
  resolverModoDecisao: (...args: unknown[]) => resolverModoDecisaoMock(...args),
}));

import app from "../app";

type Perfil = "idoso" | "cuidador" | "familiar";

const IDOSO_A = 5;
const IDOSO_B = 6;
const CUIDADOR = 10; // aprovado só do idoso A, com permite_registrar_saude
const CUIDADOR_B = 12; // aprovado do idoso B, com permite_registrar_saude
const CUIDADOR_SEM = 13; // sem vínculo nenhum
const CUIDADOR_SEM_FLAG = 14; // aprovado do idoso A, permite_registrar_saude=false
const FAMILIAR = 20; // aprovado só do idoso A
const FAMILIAR_PEND = 21; // vínculo pendente com o idoso B
const FAMILIAR_REC = 22; // vínculo recusado com o idoso B
const FAMILIAR_B = 23; // aprovado do idoso B
const REG_A = 1; // do idoso A, criado pelo idoso
const REG_A_CUID = 2; // do idoso A, criado pelo CUIDADOR
const REG_B = 200;

// Valores sigilosos do idoso B: nenhum pode aparecer para quem não tem acesso a ele.
const SENT_B = {
  tipo: "SENT_B_TIPO",
  valor1: "777.77",
  valor2: "666.66",
  unidade: "SENT_B_UNIDADE",
  obs: "SENT_B_OBS",
};
const SENTINELAS_B = Object.values(SENT_B);

const BODY_OK = { tipo_medicao: "pressao", valor_1: 130, valor_2: 85, unidade: "mmHg" };
const MSG_VINCULO = "Vínculo aprovado não encontrado para este idoso.";
const MSG_403_ESCRITA = "Sem permissão para registrar leitura de saúde.";
const MSG_403_LEITURA = "Sem permissão para visualizar histórico de saúde.";
const MSG_404 = "Registro não encontrado.";

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

function vinculo(
  idoso_id: number,
  vinculado_id: number,
  tipo_vinculo: VinculoFake["tipo_vinculo"],
  status: VinculoFake["status"] = "aprovado",
  permite_registrar_saude = tipo_vinculo === "cuidador",
): VinculoFake {
  return {
    id: vinculado_id,
    idoso_id,
    vinculado_id,
    tipo_vinculo,
    status,
    permite_registrar_saude,
    permite_marcar_dose: false,
    permite_criar_evento_cuidado: false,
  };
}

type RegistroFake = {
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

function registro(over: Partial<RegistroFake>): RegistroFake {
  const d = new Date("2026-09-24T12:00:00Z");
  return {
    id: 0,
    idoso_id: IDOSO_A,
    registrado_por_id: IDOSO_A,
    editado_por_id: IDOSO_A,
    tipo_medicao: "pressao",
    valor_1: new Prisma.Decimal("120"),
    valor_2: new Prisma.Decimal("80"),
    unidade: "mmHg",
    data_hora: d,
    observacoes: null,
    created_at: d,
    updated_at: d,
    ...over,
  };
}

// Armazém em memória: os fakes FILTRAM pelo where e APLICAM o data de verdade, então o acesso
// cruzado e o conteúdo devolvido não passam por vacuidade.
let registros: RegistroFake[] = [];
let vinculos: VinculoFake[] = [];
let logado: { id: number; perfil: Perfil } = { id: IDOSO_A, perfil: "idoso" };
let modoDoIdoso: "idoso" | "familiar" = "familiar";
let proximoId = 1000;
const falhas = new Map<string, unknown>();

function falharSeInjetado(ponto: string) {
  if (falhas.has(ponto)) throw falhas.get(ponto);
}

function logadoComo(id: number, perfil: Perfil) {
  logado = { id, perfil };
}

// "DB_OBS" é um valor do registro já gravado: um erro não pode devolvê-lo.
const SENT_DB_OBS = "SENT_DB_OBS";

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
  resolverModoDecisaoMock.mockImplementation(async () => {
    falharSeInjetado("resolverModoDecisao");
    return modoDoIdoso;
  });
  findUniqueRegistro.mockImplementation(async ({ where }: { where: { id: number } }) => {
    falharSeInjetado("registroSaude.findUnique");
    return registros.find((r) => r.id === where.id) ?? null;
  });
  findManyRegistro.mockImplementation(async ({ where }: { where: { idoso_id: number } }) => {
    falharSeInjetado("registroSaude.findMany");
    return registros
      .filter((r) => r.idoso_id === where.idoso_id)
      .sort((a, b) => b.data_hora.getTime() - a.data_hora.getTime());
  });
  createRegistro.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    falharSeInjetado("registroSaude.create");
    const novo = registro({
      ...(data as Partial<RegistroFake>),
      id: proximoId++,
      valor_1: new Prisma.Decimal(String(data.valor_1)),
      valor_2: data.valor_2 == null ? null : new Prisma.Decimal(String(data.valor_2)),
    });
    registros.push(novo);
    return novo;
  });
  updateRegistro.mockImplementation(async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => {
    falharSeInjetado("registroSaude.update");
    const i = registros.findIndex((r) => r.id === where.id);
    const novo = {
      ...registros[i],
      ...data,
      valor_1: new Prisma.Decimal(String(data.valor_1)),
      valor_2: data.valor_2 == null ? null : new Prisma.Decimal(String(data.valor_2)),
    } as RegistroFake;
    registros[i] = novo;
    return novo;
  });
}

beforeEach(() => {
  [
    verifyIdToken,
    findFirstUsuario,
    findUniqueUsuario,
    findFirstVinculo,
    createRegistro,
    findUniqueRegistro,
    findManyRegistro,
    updateRegistro,
    resolverModoDecisaoMock,
  ].forEach((m) => m.mockReset());
  falhas.clear();
  proximoId = 1000;
  modoDoIdoso = "familiar";
  logadoComo(IDOSO_A, "idoso");
  registros = [
    registro({ id: REG_A, observacoes: SENT_DB_OBS }),
    registro({ id: REG_A_CUID, registrado_por_id: CUIDADOR, editado_por_id: CUIDADOR, observacoes: SENT_DB_OBS }),
    registro({
      id: REG_B,
      idoso_id: IDOSO_B,
      registrado_por_id: IDOSO_B,
      editado_por_id: IDOSO_B,
      tipo_medicao: SENT_B.tipo,
      valor_1: new Prisma.Decimal(SENT_B.valor1),
      valor_2: new Prisma.Decimal(SENT_B.valor2),
      unidade: SENT_B.unidade,
      observacoes: SENT_B.obs,
    }),
  ];
  vinculos = [
    vinculo(IDOSO_A, CUIDADOR, "cuidador"),
    vinculo(IDOSO_A, CUIDADOR_SEM_FLAG, "cuidador", "aprovado", false),
    vinculo(IDOSO_A, FAMILIAR, "familiar"),
    vinculo(IDOSO_B, CUIDADOR_B, "cuidador"),
    vinculo(IDOSO_B, FAMILIAR_B, "familiar"),
    vinculo(IDOSO_B, FAMILIAR_PEND, "familiar", "pendente"),
    vinculo(IDOSO_B, FAMILIAR_REC, "familiar", "recusado"),
  ];
  instalarFakes();
});

function chamar(metodo: "get" | "post" | "patch", caminho: string, corpo?: object) {
  const req = request(app)[metodo](caminho).set("Authorization", "Bearer x");
  return corpo === undefined ? req : req.send(corpo);
}

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

function nenhumaEscritaNemLeitura() {
  expect(findManyRegistro).not.toHaveBeenCalled();
  expect(findUniqueRegistro).not.toHaveBeenCalled();
  expect(createRegistro).not.toHaveBeenCalled();
  expect(updateRegistro).not.toHaveBeenCalled();
}

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

// ---------------------------------------------------------------------------------------------
// 3a. Matriz de acesso cruzado
// ---------------------------------------------------------------------------------------------
describe("acesso cruzado: rotas guardadas por requireVinculoAprovado respondem 403 antes de tocar a tabela", () => {
  const ATORES_SEM_ACESSO_A_B: [string, number, Perfil][] = [
    ["idoso A (sem vínculo com B)", IDOSO_A, "idoso"],
    ["cuidador aprovado só do idoso A", CUIDADOR, "cuidador"],
    ["familiar aprovado só do idoso A (com modo_decisao='familiar')", FAMILIAR, "familiar"],
    ["cuidador sem vínculo", CUIDADOR_SEM, "cuidador"],
    ["familiar com vínculo pendente com B", FAMILIAR_PEND, "familiar"],
    ["familiar com vínculo recusado com B", FAMILIAR_REC, "familiar"],
  ];

  const ROTAS: [string, () => request.Test, [string, number, Perfil], number][] = [
    ["GET /saude/idoso/:idosoId", () => chamar("get", `/saude/idoso/${IDOSO_B}`), ["familiar aprovado de B", FAMILIAR_B, "familiar"], 200],
    [
      "POST /saude/idoso/:idosoId",
      () => chamar("post", `/saude/idoso/${IDOSO_B}`, BODY_OK),
      ["cuidador aprovado de B com permissão", CUIDADOR_B, "cuidador"],
      201,
    ],
    [
      "PATCH /saude/idoso/:idosoId/:id",
      () => chamar("patch", `/saude/idoso/${IDOSO_B}/${REG_B}`, { valor_1: 131 }),
      ["familiar aprovado de B (modo 'familiar')", FAMILIAR_B, "familiar"],
      200,
    ],
  ];

  describe.each(ROTAS)("%s", (_nome, rota, controle, statusControle) => {
    it.each(ATORES_SEM_ACESSO_A_B)("%s: 403 com a mensagem fixa, sem sentinela e sem tocar a tabela", async (_a, id, perfil) => {
      logadoComo(id, perfil);
      const { res, saidas } = await capturando(() => rota());
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: MSG_VINCULO });
      semSentinelas(visivel(res, saidas), SENTINELAS_B);
      nenhumaEscritaNemLeitura();
    });

    it(`controle positivo: ${controle[0]} recebe ${statusControle} com dado`, async () => {
      logadoComo(controle[1], controle[2]);
      const res = await rota();
      expect(res.status).toBe(statusControle);
      // O sentinela de B existe no armazém: só o ator autorizado o vê (GET) ou altera (PATCH).
      if (statusControle === 200 && res.body.registros) {
        expect(JSON.stringify(res.body)).toContain(SENT_B.valor1);
      } else {
        expect(res.body.idoso_id).toBe(IDOSO_B);
      }
    });
  });
});

describe("acesso cruzado: rotas sem id de outro idoso no path", () => {
  describe("GET /saude", () => {
    it("idoso A com ?idoso_id=B ignora o parâmetro e só vê o que é dele", async () => {
      const { res, saidas } = await capturando(() => chamar("get", `/saude?idoso_id=${IDOSO_B}`));
      expect(res.status).toBe(200);
      expect(res.body.registros.length).toBeGreaterThan(0);
      expect(res.body.registros.every((r: { idoso_id: number }) => r.idoso_id === IDOSO_A)).toBe(true);
      expect(findManyRegistro.mock.calls[0][0].where).toEqual({ idoso_id: IDOSO_A });
      semSentinelas(visivel(res, saidas), SENTINELAS_B);
    });

    it("controle positivo: o idoso B vê o próprio registro", async () => {
      logadoComo(IDOSO_B, "idoso");
      const res = await chamar("get", "/saude");
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).toContain(SENT_B.valor1);
    });

    it.each([
      ["cuidador aprovado de B", CUIDADOR_B, "cuidador"],
      ["familiar aprovado de B", FAMILIAR_B, "familiar"],
    ] as [string, number, Perfil][])("%s: 403 fixo, sem consultar a tabela", async (_a, id, perfil) => {
      logadoComo(id, perfil);
      const { res, saidas } = await capturando(() => chamar("get", `/saude?idoso_id=${IDOSO_B}`));
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: MSG_403_LEITURA });
      semSentinelas(visivel(res, saidas), SENTINELAS_B);
      expect(findManyRegistro).not.toHaveBeenCalled();
    });
  });

  describe("POST /saude", () => {
    it("idoso A com idoso_id=B no corpo grava sempre no próprio idoso", async () => {
      const res = await chamar("post", "/saude", { ...BODY_OK, idoso_id: IDOSO_B, registrado_por_id: IDOSO_B });
      expect(res.status).toBe(201);
      expect(createRegistro.mock.calls[0][0].data.idoso_id).toBe(IDOSO_A);
      expect(res.body.idoso_id).toBe(IDOSO_A);
      expect(registros.filter((r) => r.idoso_id === IDOSO_B)).toHaveLength(1); // só o REG_B original
    });

    it.each([
      ["cuidador aprovado de B", CUIDADOR_B, "cuidador"],
      ["familiar aprovado de B", FAMILIAR_B, "familiar"],
    ] as [string, number, Perfil][])("%s: 403 fixo, sem criar", async (_a, id, perfil) => {
      logadoComo(id, perfil);
      const res = await chamar("post", "/saude", { ...BODY_OK, idoso_id: IDOSO_B });
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: MSG_403_ESCRITA });
      expect(createRegistro).not.toHaveBeenCalled();
    });
  });

  describe("PATCH /saude/:id (decisão do 4.3: 404 unificado, não 403)", () => {
    it("idoso A no registro do idoso B responde o mesmo 404 de um registro inexistente", async () => {
      const inexistente = await chamar("patch", "/saude/999", BODY_OK);
      const { res: alheio, saidas } = await capturando(() => chamar("patch", `/saude/${REG_B}`, BODY_OK));
      expect(alheio.status).toBe(404);
      expect(alheio.body).toEqual({ error: MSG_404 });
      expect(alheio.status).toBe(inexistente.status);
      expect(alheio.body).toEqual(inexistente.body);
      semSentinelas(visivel(alheio, saidas), SENTINELAS_B);
      expect(updateRegistro).not.toHaveBeenCalled();
    });

    it.each([
      ["cuidador aprovado de B", CUIDADOR_B, "cuidador"],
      ["familiar aprovado de B", FAMILIAR_B, "familiar"],
    ] as [string, number, Perfil][])("%s não é dono do registro: 404, sem atualizar", async (_a, id, perfil) => {
      logadoComo(id, perfil);
      const res = await chamar("patch", `/saude/${REG_B}`, BODY_OK);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: MSG_404 });
      expect(updateRegistro).not.toHaveBeenCalled();
    });

    it("controle positivo: o idoso B edita o próprio registro", async () => {
      logadoComo(IDOSO_B, "idoso");
      const res = await chamar("patch", `/saude/${REG_B}`, { valor_1: 131 });
      expect(res.status).toBe(200);
      expect(res.body.idoso_id).toBe(IDOSO_B);
      expect(updateRegistro).toHaveBeenCalledTimes(1);
    });
  });
});

// Defesa em profundidade: o idoso alvo vem SEMPRE do vínculo aprovado, nunca do path. O fake de
// vínculo aqui ignora o where e devolve um vínculo do idoso A mesmo com o path apontando para B,
// então só código que lê o path (em vez do vínculo) acessaria o idoso B.
describe("idoso alvo vem do vínculo aprovado, não do path", () => {
  beforeEach(() => {
    findFirstVinculo.mockImplementation(async () => vinculo(IDOSO_A, FAMILIAR, "familiar"));
    logadoComo(FAMILIAR, "familiar");
  });

  it("GET: consulta só o idoso do vínculo e não devolve dado de B", async () => {
    const { res, saidas } = await capturando(() => chamar("get", `/saude/idoso/${IDOSO_B}`));
    expect(res.status).toBe(200);
    expect(findManyRegistro.mock.calls[0][0].where).toEqual({ idoso_id: IDOSO_A });
    semSentinelas(visivel(res, saidas), SENTINELAS_B);
  });

  it("POST: grava no idoso do vínculo", async () => {
    const res = await chamar("post", `/saude/idoso/${IDOSO_B}`, BODY_OK);
    expect(res.status).toBe(201);
    expect(createRegistro.mock.calls[0][0].data.idoso_id).toBe(IDOSO_A);
  });

  it("PATCH: edita registro do idoso do vínculo e nunca o de B", async () => {
    const res = await chamar("patch", `/saude/idoso/${IDOSO_B}/${REG_A}`, { valor_1: 131 });
    expect(res.status).toBe(200);
    expect(res.body.idoso_id).toBe(IDOSO_A);
    // Registro de B pelo mesmo caminho: 404, porque o registro não pertence ao idoso do vínculo.
    updateRegistro.mockClear();
    const alheio = await chamar("patch", `/saude/idoso/${IDOSO_B}/${REG_B}`, { valor_1: 131 });
    expect(alheio.status).toBe(404);
    expect(updateRegistro).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------------------------
// 3b. Decisão 1: cuidador aprovado lê mesmo sem permite_registrar_saude
// ---------------------------------------------------------------------------------------------
describe("decisão 1: leitura de cuidador depende só do vínculo aprovado, não da flag de escrita", () => {
  it("cuidador aprovado SEM permite_registrar_saude lê o histórico (200)", async () => {
    logadoComo(CUIDADOR_SEM_FLAG, "cuidador");
    const res = await chamar("get", `/saude/idoso/${IDOSO_A}`);
    expect(res.status).toBe(200);
    expect(res.body.registros.length).toBeGreaterThan(0);
    expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
  });

  it("controle: o mesmo cuidador sem a flag NÃO escreve (403)", async () => {
    logadoComo(CUIDADOR_SEM_FLAG, "cuidador");
    const res = await chamar("post", `/saude/idoso/${IDOSO_A}`, BODY_OK);
    expect(res.status).toBe(403);
    expect(createRegistro).not.toHaveBeenCalled();
  });

  it("cuidador sem vínculo aprovado não lê (403)", async () => {
    logadoComo(CUIDADOR_SEM, "cuidador");
    const res = await chamar("get", `/saude/idoso/${IDOSO_A}`);
    expect(res.status).toBe(403);
    expect(findManyRegistro).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------------------------
// 3c. Privacidade de erro e log, nas 6 rotas
// ---------------------------------------------------------------------------------------------
const SENT_CORPO_TIPO = "SENT_CORPO_TIPO";
const SENT_CORPO_NUM = "543.21";
const SENT_ERR = "SENT_ERR_MSG";
const SENT_META = "SENT_ERR_META";
const TODOS_OS_SENTINELAS = [SENT_CORPO_TIPO, SENT_CORPO_NUM, SENT_ERR, SENT_META, SENT_DB_OBS];

const BODY_SIGILOSO = { tipo_medicao: SENT_CORPO_TIPO, valor_1: 543.21, unidade: "kg", observacoes: SENT_ERR };
const MSG_COM_ARGS = `Invalid \`prisma.registroSaude.create()\` invocation: data: { tipo_medicao: '${SENT_CORPO_TIPO}', valor_1: ${SENT_CORPO_NUM}, observacoes: '${SENT_DB_OBS}', detalhe: '${SENT_ERR}' }`;

type RotaDeFalha = {
  nome: string;
  ator: [number, Perfil];
  chamar: () => request.Test;
  pontos: string[];
  principal?: string; // recebe também os outros 4 tipos de erro
};

const ROTAS_DE_FALHA: RotaDeFalha[] = [
  {
    nome: "POST /saude",
    ator: [IDOSO_A, "idoso"],
    chamar: () => chamar("post", "/saude?q=SENT_CORPO_TIPO", BODY_SIGILOSO),
    pontos: ["usuario.findFirst", "usuario.findUnique", "registroSaude.create"],
    principal: "registroSaude.create",
  },
  {
    nome: "POST /saude/idoso/:idosoId (cuidador)",
    ator: [CUIDADOR, "cuidador"],
    chamar: () => chamar("post", `/saude/idoso/${IDOSO_A}`, BODY_SIGILOSO),
    pontos: ["usuario.findFirst", "vinculo.findFirst", "registroSaude.create"],
    principal: "registroSaude.create",
  },
  {
    nome: "POST /saude/idoso/:idosoId (familiar)",
    ator: [FAMILIAR, "familiar"],
    chamar: () => chamar("post", `/saude/idoso/${IDOSO_A}`, BODY_SIGILOSO),
    pontos: ["resolverModoDecisao", "registroSaude.create"],
  },
  {
    nome: "PATCH /saude/:id",
    ator: [IDOSO_A, "idoso"],
    chamar: () => chamar("patch", `/saude/${REG_A}`, BODY_SIGILOSO),
    pontos: ["usuario.findFirst", "registroSaude.findUnique", "registroSaude.update"],
    principal: "registroSaude.update",
  },
  {
    nome: "PATCH /saude/idoso/:idosoId/:id (cuidador)",
    ator: [CUIDADOR, "cuidador"],
    chamar: () => chamar("patch", `/saude/idoso/${IDOSO_A}/${REG_A_CUID}`, BODY_SIGILOSO),
    pontos: ["vinculo.findFirst", "registroSaude.findUnique", "registroSaude.update"],
    principal: "registroSaude.update",
  },
  {
    nome: "PATCH /saude/idoso/:idosoId/:id (familiar)",
    ator: [FAMILIAR, "familiar"],
    chamar: () => chamar("patch", `/saude/idoso/${IDOSO_A}/${REG_A}`, BODY_SIGILOSO),
    pontos: ["resolverModoDecisao", "registroSaude.update"],
  },
  {
    nome: "GET /saude",
    ator: [IDOSO_A, "idoso"],
    chamar: () => chamar("get", "/saude?q=SENT_CORPO_TIPO"),
    pontos: ["usuario.findUnique", "registroSaude.findMany"],
    principal: "registroSaude.findMany",
  },
  {
    nome: "GET /saude/idoso/:idosoId",
    ator: [CUIDADOR, "cuidador"],
    chamar: () => chamar("get", `/saude/idoso/${IDOSO_A}`),
    pontos: ["vinculo.findFirst", "registroSaude.findMany"],
    principal: "registroSaude.findMany",
  },
];

const erroKnown = () =>
  new Prisma.PrismaClientKnownRequestError(MSG_COM_ARGS, {
    code: "P2002",
    clientVersion: "5.22.0",
    meta: { valor: SENT_META, observacoes: SENT_DB_OBS },
  });

const OUTROS_ERROS: [string, () => unknown][] = [
  ["PrismaClientValidationError", () => new Prisma.PrismaClientValidationError(MSG_COM_ARGS, { clientVersion: "5.22.0" })],
  ["Error genérico com sentinela na message", () => new Error(MSG_COM_ARGS)],
  ["string lançada", () => MSG_COM_ARGS],
  ["objeto lançado que não é Error", () => ({ tipo_medicao: SENT_CORPO_TIPO, valor_1: SENT_CORPO_NUM, observacoes: SENT_DB_OBS, detalhe: SENT_META })],
];

async function expectFalhaSemVazamento(rota: RotaDeFalha, ponto: string, erro: unknown) {
  logadoComo(...rota.ator);
  falhas.set(ponto, erro);
  const { res, saidas } = await capturando(() => rota.chamar());
  expect(res.status).toBe(500);
  expect(res.body).toEqual({ error: "Erro interno." });
  semSentinelas(visivel(res, saidas), TODOS_OS_SENTINELAS);
}

describe("privacidade: falha em qualquer ponto de I/O vira 500 genérico sem valor de saúde em lugar nenhum", () => {
  describe.each(ROTAS_DE_FALHA)("$nome", (rota) => {
    it.each(rota.pontos)("PrismaClientKnownRequestError com meta sigiloso em %s", async (ponto) => {
      await expectFalhaSemVazamento(rota, ponto, erroKnown());
    });

    if (rota.principal) {
      it.each(OUTROS_ERROS)("%s em %s", async (_tipo, criar) => {
        await expectFalhaSemVazamento(rota, rota.principal as string, criar());
      });
    }
  });

  it("o errorHandler registra só name, code, método e path (e o erro foi mesmo registrado)", async () => {
    logadoComo(IDOSO_A, "idoso");
    falhas.set("registroSaude.create", erroKnown());
    const { res, saidas } = await capturando(() => chamar("post", "/saude", BODY_SIGILOSO));
    expect(res.status).toBe(500);
    expect(saidas).toContain("PrismaClientKnownRequestError");
    expect(saidas).toContain("P2002");
    expect(saidas).toContain("/saude");
  });
});

// ---------------------------------------------------------------------------------------------
// 3d. Corpo malformado e corpo acima do limite do express.json()
// ---------------------------------------------------------------------------------------------
const ROTAS_DE_ESCRITA: [string, "post" | "patch", string, [number, Perfil]][] = [
  ["POST /saude", "post", "/saude", [IDOSO_A, "idoso"]],
  ["POST /saude/idoso/:idosoId", "post", `/saude/idoso/${IDOSO_A}`, [CUIDADOR, "cuidador"]],
  ["PATCH /saude/:id", "patch", `/saude/${REG_A}`, [IDOSO_A, "idoso"]],
  ["PATCH /saude/idoso/:idosoId/:id", "patch", `/saude/idoso/${IDOSO_A}/${REG_A_CUID}`, [CUIDADOR, "cuidador"]],
];

describe("corpo malformado ou grande demais: sem sentinela na resposta nem nas saídas", () => {
  // Decisão 5: JSON malformado e corpo grande chegam ao errorHandler e respondem 500 (medido), não 400/413.
  // Não corrigido de propósito; se o status mudar, este teste deve ser atualizado junto.
  it.each(ROTAS_DE_ESCRITA)("%s: JSON malformado", async (_n, metodo, caminho, ator) => {
    logadoComo(...ator);
    const { res, saidas } = await capturando(() =>
      request(app)[metodo](caminho)
        .set("Authorization", "Bearer x")
        .set("Content-Type", "application/json")
        .send(`{"tipo_medicao":"SENT_MALFORMADO","valor_1":987.65,`),
    );
    expect(res.status).toBe(500);
    semSentinelas(visivel(res, saidas), ["SENT_MALFORMADO", "987.65"]);
    expect(createRegistro).not.toHaveBeenCalled();
    expect(updateRegistro).not.toHaveBeenCalled();
  });

  it.each(ROTAS_DE_ESCRITA)("%s: corpo acima do limite de 100kb", async (_n, metodo, caminho, ator) => {
    logadoComo(...ator);
    const { res, saidas } = await capturando(() =>
      request(app)[metodo](caminho)
        .set("Authorization", "Bearer x")
        .set("Content-Type", "application/json")
        .send(`{"observacoes":"SENT_GRANDE${"x".repeat(200 * 1024)}"}`),
    );
    expect(res.status).toBe(500);
    semSentinelas(visivel(res, saidas), ["SENT_GRANDE"]);
    expect(createRegistro).not.toHaveBeenCalled();
    expect(updateRegistro).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------------------------
// 3e. Mensagens de validação nunca reproduzem o valor enviado
// ---------------------------------------------------------------------------------------------
const CAMPOS_INVALIDOS: [string, Record<string, unknown>, string][] = [
  ["tipo_medicao longo demais", { tipo_medicao: `SENT_VAL_TIPO${"x".repeat(60)}` }, "SENT_VAL_TIPO"],
  ["valor_1 não numérico", { valor_1: "SENT_VAL_V1" }, "SENT_VAL_V1"],
  ["valor_1 com casas demais e acima do limite", { valor_1: 98765.4321 }, "98765.4321"],
  ["valor_2 não numérico", { valor_2: "SENT_VAL_V2" }, "SENT_VAL_V2"],
  ["unidade longa demais", { unidade: `SENT_VAL_UN${"x".repeat(30)}` }, "SENT_VAL_UN"],
  ["observacoes longas demais", { observacoes: `SENT_VAL_OBS${"x".repeat(300)}` }, "SENT_VAL_OBS"],
  ["data_hora inválida", { data_hora: "SENT_VAL_DATA" }, "SENT_VAL_DATA"],
];

describe("validação: o corpo 400 nunca contém o valor enviado", () => {
  describe.each(ROTAS_DE_ESCRITA)("%s", (_n, metodo, caminho, ator) => {
    it.each(CAMPOS_INVALIDOS)("%s", async (_c, override, sentinela) => {
      logadoComo(...ator);
      const { res, saidas } = await capturando(() => chamar(metodo, caminho, { ...BODY_OK, ...override }));
      expect(res.status).toBe(400);
      expect(typeof res.body.error).toBe("string");
      semSentinelas(visivel(res, saidas), [sentinela]);
      expect(createRegistro).not.toHaveBeenCalled();
      expect(updateRegistro).not.toHaveBeenCalled();
    });
  });
});
