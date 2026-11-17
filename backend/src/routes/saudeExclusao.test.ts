import { inspect } from "node:util";
import request from "supertest";
import { Prisma } from "@prisma/client";

// Fase 11 (11.1): DELETE /saude/:id (idoso) e DELETE /saude/idoso/:idosoId/:id (cuidador e familiar). Exclusão física.
// A autoridade é a MESMA da edição (podeEditarSaude): idoso só o próprio registro; cuidador só registro que ele criou e só
// com permite_registrar_saude; familiar só com modo_decisao efetivo 'familiar' (via resolver). Todos os ids são FICTÍCIOS.

const verifyIdToken = jest.fn();
const findFirstUsuario = jest.fn();
const findUniqueUsuario = jest.fn();
const findFirstVinculo = jest.fn();
const countVinculo = jest.fn();
const findUniqueRegistro = jest.fn();
const deleteManyRegistro = jest.fn();
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
    vinculo: {
      findFirst: (...args: unknown[]) => findFirstVinculo(...args),
      count: (...args: unknown[]) => countVinculo(...args),
    },
    registroSaude: {
      findUnique: (...args: unknown[]) => findUniqueRegistro(...args),
      deleteMany: (...args: unknown[]) => deleteManyRegistro(...args),
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

const IDOSO_A = 5;
const IDOSO_B = 6;
const CUIDADOR = 10;
const CUIDADOR_2 = 11;
const FAMILIAR = 20;
const FAMILIAR_2 = 21;
const REG = 100;
const MSG_403 = "Sem permissão para excluir registro de saúde.";

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
    vinculado_id: CUIDADOR,
    tipo_vinculo: "cuidador",
    status: "aprovado",
    permite_registrar_saude: true,
    permite_marcar_dose: false,
    permite_criar_evento_cuidado: false,
    ...over,
  };
}

function fakeVinculos(linhas: VinculoFake[]) {
  findFirstVinculo.mockImplementation(
    async ({ where }: { where: { idoso_id: number; vinculado_id: number; status: string } }) =>
      linhas.find(
        (v) => v.idoso_id === where.idoso_id && v.vinculado_id === where.vinculado_id && v.status === where.status,
      ) ?? null,
  );
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

function registro(over: Partial<RegistroFake> = {}): RegistroFake {
  return {
    id: REG,
    idoso_id: IDOSO_A,
    registrado_por_id: CUIDADOR,
    editado_por_id: CUIDADOR,
    tipo_medicao: "pressao",
    valor_1: new Prisma.Decimal("120"),
    valor_2: new Prisma.Decimal("80"),
    unidade: "mmHg",
    data_hora: new Date("2026-09-24T12:00:00Z"),
    observacoes: null,
    created_at: new Date("2026-09-24T12:00:00Z"),
    updated_at: new Date("2026-09-24T12:00:00Z"),
    ...over,
  };
}

// Armazém em memória: findUnique e deleteMany filtram de verdade pelo where, então o 404 e o acesso cruzado não passam
// por vacuidade e "a linha some" é observável.
let registros: RegistroFake[] = [];
function fakeRegistros(linhas: RegistroFake[]) {
  registros = linhas;
  findUniqueRegistro.mockImplementation(async ({ where }: { where: { id: number } }) => {
    return registros.find((r) => r.id === where.id) ?? null;
  });
  deleteManyRegistro.mockImplementation(async ({ where }: { where: { id: number; idoso_id?: number } }) => {
    const antes = registros.length;
    registros = registros.filter((r) => !(r.id === where.id && (where.idoso_id === undefined || r.idoso_id === where.idoso_id)));
    return { count: antes - registros.length };
  });
}

function logadoComo(id: number) {
  verifyIdToken.mockResolvedValue({ uid: `uid-${id}` });
  findFirstUsuario.mockResolvedValue({ id, firebase_uid: `uid-${id}` });
}

function modoDoIdoso(modo: "idoso" | "familiar") {
  resolverModoDecisaoMock.mockResolvedValue(modo);
}

function delIdoso(id: number | string) {
  return request(app).delete(`/saude/${id}`).set("Authorization", "Bearer x");
}

function delOutro(idoso: number | string, id: number | string) {
  return request(app).delete(`/saude/idoso/${idoso}/${id}`).set("Authorization", "Bearer x");
}

function expectNaoApagou(res: request.Response, status: number) {
  expect(res.status).toBe(status);
  expect(deleteManyRegistro).not.toHaveBeenCalled();
  expect(registros.some((r) => r.id === REG)).toBe(true);
}

function expectApagou(res: request.Response) {
  expect(res.status).toBe(204);
  expect(res.text).toBe("");
  expect(deleteManyRegistro).toHaveBeenCalledTimes(1);
  expect(registros.some((r) => r.id === REG)).toBe(false);
}

beforeEach(() => {
  [
    verifyIdToken,
    findFirstUsuario,
    findUniqueUsuario,
    findFirstVinculo,
    countVinculo,
    findUniqueRegistro,
    deleteManyRegistro,
    resolverModoDecisaoMock,
  ].forEach((m) => m.mockReset());
  fakeRegistros([registro({ registrado_por_id: IDOSO_A, editado_por_id: IDOSO_A })]);
});

describe("DELETE /saude/:id, idoso exclui o próprio registro (Fase 11)", () => {
  it("204 sem corpo: a linha some e o delete leva id e idoso_id no where", async () => {
    logadoComo(IDOSO_A);
    expectApagou(await delIdoso(REG));
    expect(deleteManyRegistro.mock.calls[0][0]).toEqual({ where: { id: REG, idoso_id: IDOSO_A } });
  });

  it("idoso exclui registro criado por cuidador (dono do dado é o idoso)", async () => {
    logadoComo(IDOSO_A);
    fakeRegistros([registro({ registrado_por_id: CUIDADOR })]);
    expectApagou(await delIdoso(REG));
  });

  it("não consulta vínculo nem modo_decisao", async () => {
    logadoComo(IDOSO_A);
    expectApagou(await delIdoso(REG));
    expect(findFirstVinculo).not.toHaveBeenCalled();
    expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
  });

  it("registro de outro idoso e registro inexistente: 404 idêntico, e a linha do outro permanece", async () => {
    logadoComo(IDOSO_B);
    const deOutro = await delIdoso(REG);
    const inexistente = await delIdoso(999);
    expectNaoApagou(deOutro, 404);
    expect(inexistente.status).toBe(404);
    expect(deOutro.body).toEqual(inexistente.body);
    expect(deOutro.body).toEqual({ error: "Registro não encontrado." });
  });

  it("segundo DELETE do mesmo registro dá 404 (sem idempotência)", async () => {
    logadoComo(IDOSO_A);
    expect((await delIdoso(REG)).status).toBe(204);
    const segundo = await delIdoso(REG);
    expect(segundo.status).toBe(404);
    expect(segundo.body).toEqual({ error: "Registro não encontrado." });
  });

  it("apagado por outra chamada entre a leitura e o delete: 404, não 500", async () => {
    logadoComo(IDOSO_A);
    deleteManyRegistro.mockResolvedValue({ count: 0 });
    const res = await delIdoso(REG);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Registro não encontrado." });
  });

  it.each(["abc", "1.5", "-3", "0", "1e3", "99999999999"])("400 com id inválido (%s), sem consultar o banco", async (id) => {
    logadoComo(IDOSO_A);
    const res = await delIdoso(id);
    expect(res.status).toBe(400);
    expect(findUniqueRegistro).not.toHaveBeenCalled();
    expect(deleteManyRegistro).not.toHaveBeenCalled();
  });

  it("401 sem token e com token inválido", async () => {
    expectNaoApagou(await request(app).delete(`/saude/${REG}`), 401);
    verifyIdToken.mockRejectedValue(Object.assign(new Error("bad"), { code: "auth/argument-error" }));
    expectNaoApagou(await delIdoso(REG), 401);
  });

  it("cuidador e familiar não excluem pela rota própria: 404, mesmo com vínculo e tudo liberado", async () => {
    fakeVinculos([vinculo(), vinculo({ vinculado_id: FAMILIAR, tipo_vinculo: "familiar" })]);
    modoDoIdoso("familiar");
    for (const id of [CUIDADOR, FAMILIAR]) {
      logadoComo(id);
      expectNaoApagou(await delIdoso(REG), 404);
    }
  });
});

describe("DELETE /saude/idoso/:idosoId/:id, cuidador e familiar (Fase 11)", () => {
  describe("cuidador", () => {
    it("204 com a flag ativa e registro criado por ele mesmo; o resolver não é chamado", async () => {
      logadoComo(CUIDADOR);
      fakeVinculos([vinculo()]);
      fakeRegistros([registro({ registrado_por_id: CUIDADOR })]);
      expectApagou(await delOutro(IDOSO_A, REG));
      expect(deleteManyRegistro.mock.calls[0][0]).toEqual({ where: { id: REG, idoso_id: IDOSO_A } });
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
    });

    it.each([
      ["o idoso", IDOSO_A],
      ["outro cuidador", CUIDADOR_2],
      ["um familiar", FAMILIAR],
    ])("403 com a flag ativa em registro criado por %s", async (_nome, autor) => {
      logadoComo(CUIDADOR);
      fakeVinculos([vinculo()]);
      fakeRegistros([registro({ registrado_por_id: autor })]);
      const res = await delOutro(IDOSO_A, REG);
      expectNaoApagou(res, 403);
      expect(res.body).toEqual({ error: MSG_403 });
    });

    it("403 com a flag inativa, mesmo em registro próprio", async () => {
      logadoComo(CUIDADOR);
      fakeVinculos([vinculo({ permite_registrar_saude: false })]);
      fakeRegistros([registro({ registrado_por_id: CUIDADOR })]);
      const res = await delOutro(IDOSO_A, REG);
      expectNaoApagou(res, 403);
      expect(res.body).toEqual({ error: MSG_403 });
    });

    it("permite_marcar_dose e permite_criar_evento_cuidado não bastam", async () => {
      logadoComo(CUIDADOR);
      fakeVinculos([
        vinculo({ permite_registrar_saude: false, permite_marcar_dose: true, permite_criar_evento_cuidado: true }),
      ]);
      fakeRegistros([registro({ registrado_por_id: CUIDADOR })]);
      expectNaoApagou(await delOutro(IDOSO_A, REG), 403);
    });
  });

  describe("familiar", () => {
    beforeEach(() => {
      logadoComo(FAMILIAR);
      fakeVinculos([vinculo({ vinculado_id: FAMILIAR, tipo_vinculo: "familiar", permite_registrar_saude: false })]);
    });

    it.each([
      ["o idoso", IDOSO_A],
      ["um cuidador", CUIDADOR],
      ["outro familiar", FAMILIAR_2],
      ["ele mesmo", FAMILIAR],
    ])("204 com modo 'familiar' em registro criado por %s (autoria não conta)", async (_nome, autor) => {
      modoDoIdoso("familiar");
      fakeRegistros([registro({ registrado_por_id: autor })]);
      expectApagou(await delOutro(IDOSO_A, REG));
      expect(resolverModoDecisaoMock).toHaveBeenCalledWith(IDOSO_A);
    });

    it("403 com modo 'idoso', genérico, sem citar modo_decisao", async () => {
      modoDoIdoso("idoso");
      fakeRegistros([registro({ registrado_por_id: FAMILIAR })]);
      const res = await delOutro(IDOSO_A, REG);
      expectNaoApagou(res, 403);
      expect(res.body).toEqual({ error: MSG_403 });
      expect(JSON.stringify(res.body)).not.toMatch(/modo_decisao|permite_/i);
    });

    it("o modo vem do resolver (transferência vencida e NULL), nunca da coluna: resolver chamado com o idoso do vínculo", async () => {
      modoDoIdoso("idoso");
      await delOutro(IDOSO_A, REG);
      expect(resolverModoDecisaoMock).toHaveBeenCalledTimes(1);
      expect(resolverModoDecisaoMock).toHaveBeenCalledWith(IDOSO_A);
      expect(findUniqueUsuario).not.toHaveBeenCalled();
    });
  });

  describe("vínculo", () => {
    it.each(["pendente", "recusado"] as const)("403 com vínculo %s", async (status) => {
      logadoComo(CUIDADOR);
      fakeVinculos([vinculo({ status })]);
      fakeRegistros([registro({ registrado_por_id: CUIDADOR })]);
      expectNaoApagou(await delOutro(IDOSO_A, REG), 403);
    });

    it("403 sem vínculo algum", async () => {
      logadoComo(CUIDADOR);
      fakeVinculos([]);
      fakeRegistros([registro({ registrado_por_id: CUIDADOR })]);
      expectNaoApagou(await delOutro(IDOSO_A, REG), 403);
    });

    it("403 no acesso cruzado: vínculo só com o idoso A, chamada com o idoso B", async () => {
      logadoComo(CUIDADOR);
      fakeVinculos([vinculo({ idoso_id: IDOSO_A })]);
      fakeRegistros([registro({ idoso_id: IDOSO_B, registrado_por_id: CUIDADOR })]);
      expectNaoApagou(await delOutro(IDOSO_B, REG), 403);
    });
  });

  describe("registro", () => {
    beforeEach(() => {
      logadoComo(CUIDADOR);
      fakeVinculos([vinculo()]);
    });

    it("404 quando o registro não existe", async () => {
      expectNaoApagou(await delOutro(IDOSO_A, 999), 404);
    });

    it("404 quando o registro é de outro idoso, igual ao inexistente, e a linha do outro idoso permanece", async () => {
      fakeRegistros([registro({ idoso_id: IDOSO_B, registrado_por_id: CUIDADOR })]);
      const outro = await delOutro(IDOSO_A, REG);
      const inexistente = await delOutro(IDOSO_A, 999);
      expectNaoApagou(outro, 404);
      expect(inexistente.status).toBe(404);
      expect(outro.body).toEqual(inexistente.body);
    });

    it("segundo DELETE do mesmo registro dá 404", async () => {
      fakeRegistros([registro({ registrado_por_id: CUIDADOR })]);
      expect((await delOutro(IDOSO_A, REG)).status).toBe(204);
      expect((await delOutro(IDOSO_A, REG)).status).toBe(404);
    });

    it.each(["abc", "1.5", "-3", "0"])("400 com id inválido (%s), sem consultar registro", async (id) => {
      expectNaoApagou(await delOutro(IDOSO_A, id), 400);
      expect(findUniqueRegistro).not.toHaveBeenCalled();
    });
  });

  describe("autenticação e ordem", () => {
    it("401 sem token e com token inválido", async () => {
      expectNaoApagou(await request(app).delete(`/saude/idoso/${IDOSO_A}/${REG}`), 401);
      verifyIdToken.mockRejectedValue(Object.assign(new Error("bad"), { code: "auth/argument-error" }));
      expectNaoApagou(await delOutro(IDOSO_A, REG), 401);
    });

    it("400 com idosoId não numérico, sem consultar vínculo", async () => {
      logadoComo(CUIDADOR);
      expectNaoApagou(await delOutro("abc", REG), 400);
      expect(findFirstVinculo).not.toHaveBeenCalled();
    });

    it("sem vínculo, id inválido ainda dá 403 (o vínculo vem antes do 400 do id)", async () => {
      logadoComo(CUIDADOR);
      fakeVinculos([]);
      expectNaoApagou(await delOutro(IDOSO_A, "abc"), 403);
    });

    it("sem autoridade e registro inexistente dá 404, não 403 (o 404 vem antes do 403 de ator)", async () => {
      logadoComo(CUIDADOR);
      fakeVinculos([vinculo({ permite_registrar_saude: false })]);
      expectNaoApagou(await delOutro(IDOSO_A, 999), 404);
    });
  });
});

describe("privacidade (RNF-001): exclusão de saúde", () => {
  const SEGREDO = "segredo-clinico-ficticio";
  const consoles = ["log", "info", "warn", "error", "debug"] as const;

  async function comConsolesEspiados(fn: () => Promise<void>): Promise<string> {
    const espioes = consoles.map((m) => jest.spyOn(console, m).mockImplementation(() => undefined));
    try {
      await fn();
      return inspect(espioes.flatMap((s) => s.mock.calls), { depth: 8 });
    } finally {
      espioes.forEach((s) => s.mockRestore());
    }
  }

  function registroSensivel() {
    return registro({ registrado_por_id: CUIDADOR, observacoes: SEGREDO, valor_1: new Prisma.Decimal("123.45") });
  }

  function semVazamento(res: request.Response, consolesTexto: string) {
    const tudo = `${JSON.stringify(res.body)}${res.text}${consolesTexto}`;
    expect(tudo).not.toContain(SEGREDO);
    expect(tudo).not.toContain("123.45");
  }

  it("404: corpo e console sem o valor do registro", async () => {
    logadoComo(IDOSO_B);
    fakeRegistros([registroSensivel()]);
    let res!: request.Response;
    const logs = await comConsolesEspiados(async () => {
      res = await delIdoso(REG);
    });
    expect(res.status).toBe(404);
    semVazamento(res, logs);
  });

  it("403 de cuidador sem autoria: corpo e console sem o valor do registro", async () => {
    logadoComo(CUIDADOR_2);
    fakeVinculos([vinculo({ vinculado_id: CUIDADOR_2 })]);
    fakeRegistros([registroSensivel()]);
    let res!: request.Response;
    const logs = await comConsolesEspiados(async () => {
      res = await delOutro(IDOSO_A, REG);
    });
    expect(res.status).toBe(403);
    semVazamento(res, logs);
  });

  it("403 de familiar sem modo 'familiar': corpo e console sem o valor do registro", async () => {
    logadoComo(FAMILIAR);
    fakeVinculos([vinculo({ vinculado_id: FAMILIAR, tipo_vinculo: "familiar" })]);
    modoDoIdoso("idoso");
    fakeRegistros([registroSensivel()]);
    let res!: request.Response;
    const logs = await comConsolesEspiados(async () => {
      res = await delOutro(IDOSO_A, REG);
    });
    expect(res.status).toBe(403);
    semVazamento(res, logs);
  });

  it("400 de id inválido: o id enviado não volta no corpo", async () => {
    logadoComo(IDOSO_A);
    const res = await delIdoso("segredo-id");
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain("segredo-id");
  });

  it("erro do Prisma no delete: 500 genérico e nenhum valor de saúde em console.*", async () => {
    logadoComo(IDOSO_A);
    fakeRegistros([registroSensivel(), registro({ id: 101, registrado_por_id: IDOSO_A })]);
    registros[0].idoso_id = IDOSO_A;
    deleteManyRegistro.mockRejectedValue(
      new Prisma.PrismaClientValidationError(
        `Invalid invocation: where: { valor_1: 123.45, observacoes: '${SEGREDO}' }`,
        { clientVersion: "5.22.0" },
      ),
    );
    let res!: request.Response;
    const logs = await comConsolesEspiados(async () => {
      res = await delIdoso(REG);
    });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Erro interno." });
    semVazamento(res, logs);
  });
});
