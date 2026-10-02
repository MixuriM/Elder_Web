import { inspect } from "node:util";
import request from "supertest";
import { Prisma } from "@prisma/client";
import { CASOS_ACESSO_LEITURA } from "../testSupport/matrizAcessoLeitura";

const verifyIdToken = jest.fn();
const findFirstUsuario = jest.fn();
const findUniqueUsuario = jest.fn();
const findFirstVinculo = jest.fn();
const findManyRegistro = jest.fn();
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
    registroSaude: { findMany: (...args: unknown[]) => findManyRegistro(...args) },
  },
}));
// A leitura não depende de modo_decisao: o resolver não pode ser chamado nesta suíte.
jest.mock("./vinculo", () => ({
  __esModule: true,
  ...jest.requireActual("./vinculo"),
  resolverModoDecisao: (...args: unknown[]) => resolverModoDecisaoMock(...args),
}));

import app from "../app";

// Todos os ids e valores abaixo são FICTÍCIOS, só para teste.
const IDOSO_A = 5;
const IDOSO_B = 6;
const CUIDADOR = 10;
const FAMILIAR = 20;
const VALOR_SIGILOSO = 987.65;
const MSG_403_IDOSO = "Sem permissão para visualizar histórico de saúde.";

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

// Fake que FILTRA de verdade pelo where recebido, para o acesso cruzado não passar por vacuidade.
function fakeVinculos(linhas: VinculoFake[]) {
  findFirstVinculo.mockImplementation(
    async ({ where }: { where: { idoso_id: number; vinculado_id: number; status: string } }) =>
      linhas.find(
        (v) => v.idoso_id === where.idoso_id && v.vinculado_id === where.vinculado_id && v.status === where.status,
      ) ?? null,
  );
}

function registro(id: number, idoso_id: number, dia: number, over: Record<string, unknown> = {}) {
  const d = new Date(Date.UTC(2026, 8, dia, 12));
  return {
    id,
    idoso_id,
    registrado_por_id: idoso_id,
    editado_por_id: idoso_id,
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

// Fake que filtra por where.idoso_id e ordena por orderBy.data_hora, como o Prisma faria.
function fakeRegistros(linhas: ReturnType<typeof registro>[]) {
  findManyRegistro.mockImplementation(
    async ({ where, orderBy }: { where: { idoso_id: number }; orderBy?: { data_hora: "asc" | "desc" } }) => {
      const r = linhas.filter((l) => l.idoso_id === where.idoso_id);
      const sinal = orderBy?.data_hora === "desc" ? -1 : 1;
      return r.sort((a, b) => sinal * (a.data_hora.getTime() - b.data_hora.getTime()));
    },
  );
}

function logadoComo(id: number, tipo_perfil: "idoso" | "cuidador" | "familiar") {
  verifyIdToken.mockResolvedValue({ uid: `uid-${id}` });
  findFirstUsuario.mockResolvedValue({ id, firebase_uid: `uid-${id}` });
  findUniqueUsuario.mockResolvedValue({ tipo_perfil });
}

const auth = (r: request.Test) => r.set("Authorization", "Bearer x");

beforeEach(() => {
  [verifyIdToken, findFirstUsuario, findUniqueUsuario, findFirstVinculo, findManyRegistro, resolverModoDecisaoMock].forEach(
    (m) => m.mockReset(),
  );
  fakeRegistros([
    registro(1, IDOSO_A, 1),
    registro(2, IDOSO_A, 3),
    registro(3, IDOSO_A, 2),
    registro(4, IDOSO_B, 4, { valor_1: new Prisma.Decimal(String(VALOR_SIGILOSO)) }),
  ]);
});

describe("GET /saude (idoso lê o próprio histórico, item 4.4)", () => {
  it("200 só com os registros do próprio idoso, data_hora decrescente, números serializados", async () => {
    logadoComo(IDOSO_A, "idoso");
    const res = await auth(request(app).get("/saude"));
    expect(res.status).toBe(200);
    expect(res.body.registros.map((r: { id: number }) => r.id)).toEqual([2, 3, 1]);
    expect(res.body.registros.every((r: { idoso_id: number }) => r.idoso_id === IDOSO_A)).toBe(true);
    expect(res.body.registros[0].valor_1).toBe(120);
    expect(res.body.registros[0].valor_2).toBe(80);
    expect(findManyRegistro.mock.calls[0][0].where).toEqual({ idoso_id: IDOSO_A });
  });

  it("200 com lista vazia quando o idoso não tem registros", async () => {
    logadoComo(IDOSO_B + 100, "idoso");
    const res = await auth(request(app).get("/saude"));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ registros: [] });
  });

  it("401 sem token", async () => {
    const res = await request(app).get("/saude");
    expect(res.status).toBe(401);
    expect(findManyRegistro).not.toHaveBeenCalled();
  });

  it.each(["cuidador", "familiar"] as const)("403 para %s, sem consultar registros", async (perfil) => {
    logadoComo(perfil === "cuidador" ? CUIDADOR : FAMILIAR, perfil);
    fakeVinculos([vinculo({ vinculado_id: perfil === "cuidador" ? CUIDADOR : FAMILIAR })]);
    const res = await auth(request(app).get("/saude"));
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: MSG_403_IDOSO });
    expect(findManyRegistro).not.toHaveBeenCalled();
  });
});

describe("GET /saude/idoso/:idosoId (cuidador/familiar aprovado lê, item 4.4)", () => {
  const get = (idoso: number | string) => auth(request(app).get(`/saude/idoso/${idoso}`));

  it("cuidador aprovado lê, mesmo SEM permite_registrar_saude", async () => {
    logadoComo(CUIDADOR, "cuidador");
    fakeVinculos([vinculo({ vinculado_id: CUIDADOR, tipo_vinculo: "cuidador", permite_registrar_saude: false })]);
    const res = await get(IDOSO_A);
    expect(res.status).toBe(200);
    expect(res.body.registros.map((r: { id: number }) => r.id)).toEqual([2, 3, 1]);
    expect(res.body.registros.every((r: { idoso_id: number }) => r.idoso_id === IDOSO_A)).toBe(true);
    expect(res.body.registros[0].valor_1).toBe(120);
  });

  it("familiar aprovado lê, mesmo com modo_decisao='idoso' (resolver nem é chamado)", async () => {
    logadoComo(FAMILIAR, "familiar");
    fakeVinculos([vinculo()]);
    resolverModoDecisaoMock.mockResolvedValue("idoso");
    const res = await get(IDOSO_A);
    expect(res.status).toBe(200);
    expect(res.body.registros).toHaveLength(3);
    expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
  });

  it("familiar aprovado vê o mesmo conjunto que o idoso", async () => {
    logadoComo(IDOSO_A, "idoso");
    const doIdoso = await auth(request(app).get("/saude"));
    logadoComo(FAMILIAR, "familiar");
    fakeVinculos([vinculo()]);
    const doFamiliar = await get(IDOSO_A);
    expect(JSON.stringify(doFamiliar.body)).toBe(JSON.stringify(doIdoso.body));
  });

  it("idoso_id da consulta vem do vínculo, não do path", async () => {
    logadoComo(FAMILIAR, "familiar");
    // Ignora o where: devolve um vínculo cujo idoso_id difere do parâmetro da URL.
    findFirstVinculo.mockResolvedValue(vinculo({ idoso_id: IDOSO_A }));
    const res = await get(IDOSO_B);
    expect(res.status).toBe(200);
    expect(findManyRegistro.mock.calls[0][0].where).toEqual({ idoso_id: IDOSO_A });
    expect(res.body.registros.every((r: { idoso_id: number }) => r.idoso_id === IDOSO_A)).toBe(true);
  });

  it("consulta ordena por data_hora decrescente", async () => {
    logadoComo(FAMILIAR, "familiar");
    fakeVinculos([vinculo()]);
    await get(IDOSO_A);
    expect(findManyRegistro.mock.calls[0][0].orderBy).toEqual({ data_hora: "desc" });
  });

  it.each(["pendente", "recusado"] as const)("403 com vínculo %s", async (status) => {
    logadoComo(FAMILIAR, "familiar");
    fakeVinculos([vinculo({ status })]);
    const res = await get(IDOSO_A);
    expect(res.status).toBe(403);
    expect(findManyRegistro).not.toHaveBeenCalled();
  });

  it("403 sem vínculo", async () => {
    logadoComo(FAMILIAR, "familiar");
    fakeVinculos([]);
    const res = await get(IDOSO_A);
    expect(res.status).toBe(403);
    expect(findManyRegistro).not.toHaveBeenCalled();
  });

  it("403 no acesso cruzado: aprovado só com o idoso A, chamada com o idoso B", async () => {
    logadoComo(FAMILIAR, "familiar");
    fakeVinculos([vinculo({ idoso_id: IDOSO_A })]);
    // Controle positivo: o mesmo fake libera o idoso A.
    expect((await get(IDOSO_A)).status).toBe(200);
    findManyRegistro.mockClear();
    const res = await get(IDOSO_B);
    expect(res.status).toBe(403);
    expect(findManyRegistro).not.toHaveBeenCalled();
    expect(JSON.stringify(res.body)).not.toContain(String(VALOR_SIGILOSO));
  });

  it("401 sem token", async () => {
    const res = await request(app).get(`/saude/idoso/${IDOSO_A}`);
    expect(res.status).toBe(401);
    expect(findManyRegistro).not.toHaveBeenCalled();
  });

  it("400 com idosoId não numérico", async () => {
    logadoComo(FAMILIAR, "familiar");
    const res = await get("abc");
    expect(res.status).toBe(400);
    expect(findManyRegistro).not.toHaveBeenCalled();
  });
});

// Matriz compartilhada com o item 5.3 (remediosHistorico.test.ts): mesmo nível de acesso, mesmos casos.
describe("matriz de acesso compartilhada (idêntica à de GET /remedios)", () => {
  const ID_ATOR = { idoso: IDOSO_A, cuidador: CUIDADOR, familiar: FAMILIAR } as const;

  it.each(CASOS_ACESSO_LEITURA)("$nome = $esperado", async (caso) => {
    const id = ID_ATOR[caso.ator];
    logadoComo(id, caso.ator);
    const v = caso.vinculo;
    const flags = v?.flags === true;
    fakeVinculos(
      v
        ? [
            vinculo({
              vinculado_id: id,
              idoso_id: v.idoso === "A" ? IDOSO_A : IDOSO_B,
              tipo_vinculo: v.tipo_vinculo,
              status: v.status,
              permite_registrar_saude: flags,
              permite_marcar_dose: flags,
              permite_criar_evento_cuidado: flags,
            }),
          ]
        : [],
    );

    const res = await auth(request(app).get(caso.rota === "proprio" ? "/saude" : `/saude/idoso/${IDOSO_A}`));

    expect(res.status).toBe(caso.esperado);
    if (caso.esperado === 200) {
      const regs = res.body.registros as { id: number; idoso_id: number }[];
      expect(regs.map((r) => r.id).sort()).toEqual([1, 2, 3]);
      expect(regs.every((r) => r.idoso_id === IDOSO_A)).toBe(true);
      expect(JSON.stringify(res.body)).not.toContain(String(VALOR_SIGILOSO));
    } else {
      expect(findManyRegistro).not.toHaveBeenCalled();
      expect(JSON.stringify(res.body)).not.toContain(String(VALOR_SIGILOSO));
    }
  });
});

describe("privacidade", () => {
  it("nenhum valor de saúde em corpo de 403 nem em console.*", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    );
    try {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([]);
      const res403 = await auth(request(app).get(`/saude/idoso/${IDOSO_B}`));
      expect(res403.status).toBe(403);
      logadoComo(CUIDADOR, "cuidador");
      const res403b = await auth(request(app).get("/saude"));
      expect(res403b.status).toBe(403);
      const tudo = inspect([res403.body, res403b.body, ...spies.map((s) => s.mock.calls)], { depth: 10 });
      expect(tudo).not.toContain(String(VALOR_SIGILOSO));
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
  });

  it("erro do banco na leitura vira 500 genérico sem valor de saúde no log", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    );
    try {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
      findManyRegistro.mockRejectedValue(new Error(`falha com valor ${VALOR_SIGILOSO}`));
      const res = await auth(request(app).get(`/saude/idoso/${IDOSO_A}`));
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: "Erro interno." });
      expect(inspect(spies.map((s) => s.mock.calls), { depth: 10 })).not.toContain(String(VALOR_SIGILOSO));
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
  });
});
