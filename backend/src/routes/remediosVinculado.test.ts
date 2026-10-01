import { inspect } from "node:util";
import request from "supertest";
import { Prisma } from "@prisma/client";

// Item 5.1 (RF-011): POST /remedios/idoso/:idosoId. Regra fixa de ator: cuidador NUNCA cria medicamento,
// com qualquer vínculo e qualquer combinação de flags permite_*. Familiar só com vínculo aprovado E
// modo_decisao efetivo 'familiar'. Todos os ids e valores abaixo são FICTÍCIOS, só para teste.

const verifyIdToken = jest.fn();
const findFirstUsuario = jest.fn();
const findUniqueUsuario = jest.fn();
const updateUsuario = jest.fn();
const findFirstVinculo = jest.fn();
const countVinculo = jest.fn();
const createMedicamento = jest.fn();
const resolverModoDecisaoMock = jest.fn();

jest.mock("../lib/firebaseAdmin", () => ({
  auth: { verifyIdToken: (...args: unknown[]) => verifyIdToken(...args) },
}));
jest.mock("../lib/prisma", () => ({
  prisma: {
    usuario: {
      findFirst: (...args: unknown[]) => findFirstUsuario(...args),
      findUnique: (...args: unknown[]) => findUniqueUsuario(...args),
      update: (...args: unknown[]) => updateUsuario(...args),
    },
    vinculo: {
      findFirst: (...args: unknown[]) => findFirstVinculo(...args),
      count: (...args: unknown[]) => countVinculo(...args),
    },
    medicamento: { create: (...args: unknown[]) => createMedicamento(...args) },
  },
}));
// Só resolverModoDecisao é trocada: o resto de vinculo.ts (router, resolverEstadoModoDecisao) segue real.
jest.mock("./vinculo", () => ({
  __esModule: true,
  ...jest.requireActual("./vinculo"),
  resolverModoDecisao: (...args: unknown[]) => resolverModoDecisaoMock(...args),
}));

import app from "../app";
const resolverReal: (id: number) => Promise<"idoso" | "familiar"> =
  jest.requireActual("./vinculo").resolverModoDecisao;

type Perfil = "idoso" | "cuidador" | "familiar";

const CUIDADOR = 10;
const FAMILIAR = 20;
const FAMILIAR_2 = 21;
const IDOSO_A = 5;
const IDOSO_B = 6;
const BODY_OK = { nome: "Remedio Ficticio", dosagem: "10 mg", frequencia: "2x ao dia", data_inicio: "2026-10-01" };
const MSG_403 = "Sem permissão para cadastrar medicamento.";

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

const TODAS_FLAGS = { permite_registrar_saude: true, permite_marcar_dose: true, permite_criar_evento_cuidado: true };

// Fake que FILTRA de verdade pelo where recebido, para o acesso cruzado não passar por vacuidade.
function fakeVinculos(linhas: VinculoFake[]) {
  findFirstVinculo.mockImplementation(
    async ({ where }: { where: { idoso_id: number; vinculado_id: number; status: string } }) =>
      linhas.find(
        (v) => v.idoso_id === where.idoso_id && v.vinculado_id === where.vinculado_id && v.status === where.status,
      ) ?? null,
  );
}

const ESTADO_NEUTRO = {
  modo_decisao: null,
  modo_decisao_solicitado: null,
  modo_decisao_solicitado_por_id: null,
  modo_decisao_solicitado_em: null,
  modo_decisao_expira_em: null,
  modo_decisao_segunda_confirmacao_id: null,
  modo_decisao_alterado_por_id: null,
  modo_decisao_alterado_em: null,
  modo_decisao_motivo: null,
};

const perfis: Record<number, Perfil> = {};
let estadoModo: Record<string, unknown> = ESTADO_NEUTRO;

// findUnique serve a dois chamadores: o perfil do chamador (select.tipo_perfil) e o resolver real
// (select de modo_decisao). O fake os separa pelo select.
function fakeUsuarios() {
  findUniqueUsuario.mockImplementation(
    async ({ where, select }: { where: { id: number }; select: Record<string, boolean> }) => {
      if (select?.tipo_perfil) return perfis[where.id] ? { tipo_perfil: perfis[where.id] } : null;
      return estadoModo;
    },
  );
}

function logadoComo(id: number, perfil: Perfil) {
  perfis[id] = perfil;
  verifyIdToken.mockResolvedValue({ uid: `uid-${id}` });
  findFirstUsuario.mockResolvedValue({ id, firebase_uid: `uid-${id}` });
}

function modoDoIdoso(modo: "idoso" | "familiar") {
  resolverModoDecisaoMock.mockResolvedValue(modo);
}

function medicamentoDevolvido(over: Record<string, unknown> = {}) {
  const d = new Date("2026-10-01T12:00:00Z");
  return {
    id: 1,
    idoso_id: IDOSO_A,
    criado_por_id: FAMILIAR,
    nome: "Remedio Ficticio",
    dosagem: "10 mg",
    frequencia: "2x ao dia",
    data_inicio: new Date("2026-10-01T00:00:00.000Z"),
    data_fim: null,
    observacoes: null,
    ativo: true,
    editado_por_id: null,
    created_at: d,
    updated_at: d,
    ...over,
  };
}

function post(idoso: number | string, body: unknown = BODY_OK) {
  return request(app)
    .post(`/remedios/idoso/${idoso}`)
    .set("Authorization", "Bearer x")
    .send(body as object);
}

function expectNaoCriou(res: request.Response, status: number) {
  expect(res.status).toBe(status);
  expect(createMedicamento).not.toHaveBeenCalled();
}

beforeEach(() => {
  [
    verifyIdToken,
    findFirstUsuario,
    findUniqueUsuario,
    updateUsuario,
    findFirstVinculo,
    countVinculo,
    createMedicamento,
    resolverModoDecisaoMock,
  ].forEach((m) => m.mockReset());
  Object.keys(perfis).forEach((k) => delete perfis[Number(k)]);
  estadoModo = ESTADO_NEUTRO;
  fakeUsuarios();
  createMedicamento.mockResolvedValue(medicamentoDevolvido());
});

describe("POST /remedios/idoso/:idosoId (RF-011, item 5.1)", () => {
  describe("familiar: matriz modo_decisao x vínculo (resolver mockado)", () => {
    it("201 com modo 'familiar' e vínculo aprovado: autoria do familiar, idoso_id do vínculo", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
      modoDoIdoso("familiar");
      const res = await post(IDOSO_A);
      expect(res.status).toBe(201);
      expect(resolverModoDecisaoMock).toHaveBeenCalledWith(IDOSO_A);
      expect(createMedicamento).toHaveBeenCalledTimes(1);
      const { data } = createMedicamento.mock.calls[0][0];
      expect(data.idoso_id).toBe(IDOSO_A);
      expect(data.criado_por_id).toBe(FAMILIAR);
      expect(data.editado_por_id).toBeNull();
      expect(data.ativo).toBe(true);
      expect(res.body.data_inicio).toBe("2026-10-01");
    });

    it("403 com modo 'idoso' e vínculo aprovado, mensagem fixa", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
      modoDoIdoso("idoso");
      const res = await post(IDOSO_A);
      expectNaoCriou(res, 403);
      expect(res.body).toEqual({ error: MSG_403 });
    });

    it.each(["pendente", "recusado"] as const)("403 com modo 'familiar' e vínculo %s", async (status) => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo({ status })]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A), 403);
    });

    it("403 com vínculo inexistente (resolver nem é consultado)", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A), 403);
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
    });

    it("403 no acesso cruzado: aprovado só com o idoso A, chamada com o idoso B", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo({ idoso_id: IDOSO_A })]);
      modoDoIdoso("familiar");
      // Controle positivo: o mesmo fake libera o idoso A.
      expect((await post(IDOSO_A)).status).toBe(201);
      createMedicamento.mockClear();
      expectNaoCriou(await post(IDOSO_B), 403);
    });

    it("403 para idoso chamando a rota com o próprio id", async () => {
      logadoComo(IDOSO_A, "idoso");
      fakeVinculos([vinculo()]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A), 403);
    });

    it("dois familiares aprovados do mesmo idoso: cada um cria com a própria autoria", async () => {
      fakeVinculos([vinculo({ id: 1, vinculado_id: FAMILIAR }), vinculo({ id: 2, vinculado_id: FAMILIAR_2 })]);
      modoDoIdoso("familiar");
      for (const quem of [FAMILIAR, FAMILIAR_2]) {
        logadoComo(quem, "familiar");
        createMedicamento.mockClear();
        expect((await post(IDOSO_A)).status).toBe(201);
        const { data } = createMedicamento.mock.calls[0][0];
        expect(data.criado_por_id).toBe(quem);
        expect(data.idoso_id).toBe(IDOSO_A);
      }
    });
  });

  describe("familiar: resolver real (NULL e transferência)", () => {
    beforeEach(() => {
      resolverModoDecisaoMock.mockImplementation((id: number) => resolverReal(id));
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
    });

    it("403 com modo_decisao NULL: vale 'idoso'", async () => {
      estadoModo = { ...ESTADO_NEUTRO, modo_decisao: null };
      expectNaoCriou(await post(IDOSO_A), 403);
    });

    it("403 com modo_decisao 'idoso' explícito lido pelo resolver real", async () => {
      estadoModo = { ...ESTADO_NEUTRO, modo_decisao: "idoso" };
      expectNaoCriou(await post(IDOSO_A), 403);
    });

    it("201 quando a transferência venceu e o resolver real efetiva 'familiar'", async () => {
      estadoModo = {
        ...ESTADO_NEUTRO,
        modo_decisao: "idoso",
        modo_decisao_solicitado: "familiar",
        modo_decisao_solicitado_por_id: FAMILIAR,
        modo_decisao_expira_em: new Date(Date.now() - 60_000),
      };
      countVinculo.mockResolvedValue(1);
      updateUsuario.mockResolvedValue({ ...ESTADO_NEUTRO, modo_decisao: "familiar" });
      const res = await post(IDOSO_A);
      expect(res.status).toBe(201);
      expect(updateUsuario).toHaveBeenCalledTimes(1);
      expect(createMedicamento.mock.calls[0][0].data.criado_por_id).toBe(FAMILIAR);
    });

    it("403 com transferência em curso ainda não vencida: segue 'idoso'", async () => {
      estadoModo = {
        ...ESTADO_NEUTRO,
        modo_decisao: "idoso",
        modo_decisao_solicitado: "familiar",
        modo_decisao_solicitado_por_id: FAMILIAR,
        modo_decisao_expira_em: new Date(Date.now() + 3 * 24 * 3600 * 1000),
      };
      expectNaoCriou(await post(IDOSO_A), 403);
      expect(updateUsuario).not.toHaveBeenCalled();
    });
  });

  describe("cuidador: nunca cria (regra fixa de ator)", () => {
    it("403 com vínculo aprovado e as 3 flags permite_* verdadeiras (teste do plano)", async () => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador(TODAS_FLAGS)]);
      modoDoIdoso("familiar");
      const res = await post(IDOSO_A);
      expectNaoCriou(res, 403);
      expect(res.body).toEqual({ error: MSG_403 });
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
    });

    it.each(Object.keys(TODAS_FLAGS))("403 com só a flag %s verdadeira", async (flag) => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador({ [flag]: true })]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A), 403);
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
    });

    it("403 com as 3 flags falsas", async () => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador()]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A), 403);
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
    });

    it.each(["pendente", "recusado"] as const)("403 com vínculo %s", async (status) => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador({ ...TODAS_FLAGS, status })]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A), 403);
    });

    it("403 com modo 'familiar' no idoso: modo_decisao não libera cuidador", async () => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador(TODAS_FLAGS)]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A), 403);
    });

    it("regra no ator: vínculo tipo 'familiar' com chamador de tipo_perfil 'cuidador' dá 403", async () => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculo({ vinculado_id: CUIDADOR, tipo_vinculo: "familiar" })]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A), 403);
    });

    it("regra no vínculo: vínculo tipo 'cuidador' com chamador de tipo_perfil 'familiar' dá 403", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculoCuidador({ vinculado_id: FAMILIAR, ...TODAS_FLAGS })]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A), 403);
    });
  });

  describe("autenticação, ordem e corpo", () => {
    it("401 sem token e com token inválido", async () => {
      expectNaoCriou(await request(app).post(`/remedios/idoso/${IDOSO_A}`).send(BODY_OK), 401);
      verifyIdToken.mockRejectedValue(Object.assign(new Error("bad"), { code: "auth/argument-error" }));
      expectNaoCriou(await post(IDOSO_A), 401);
    });

    it("400 com idosoId não numérico, sem consultar vínculo nem resolver", async () => {
      logadoComo(FAMILIAR, "familiar");
      expectNaoCriou(await post("abc"), 400);
      expect(findFirstVinculo).not.toHaveBeenCalled();
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
    });

    it("403 antes de 400: sem vínculo e corpo inválido responde 403", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([]);
      expectNaoCriou(await post(IDOSO_A, { nome: "" }), 403);
    });

    it("403 antes de 400: modo 'idoso' e corpo inválido responde 403", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
      modoDoIdoso("idoso");
      expectNaoCriou(await post(IDOSO_A, { nome: "" }), 403);
    });

    it("403 antes de 400: cuidador com corpo inválido responde 403", async () => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador(TODAS_FLAGS)]);
      expectNaoCriou(await post(IDOSO_A, { nome: "" }), 403);
    });

    it("400 de corpo só depois de autorizado (familiar, modo 'familiar')", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A, { ...BODY_OK, data_inicio: "2026-02-30" }), 400);
    });

    it("400: data_fim anterior a data_inicio", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A, { ...BODY_OK, data_fim: "2026-09-30" }), 400);
    });

    it("ignora id, autoria, ativo e idoso_id forjados no body", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
      modoDoIdoso("familiar");
      const res = await post(IDOSO_A, {
        ...BODY_OK,
        id: 999,
        idoso_id: IDOSO_B,
        criado_por_id: 77,
        editado_por_id: 77,
        ativo: false,
      });
      expect(res.status).toBe(201);
      const { data } = createMedicamento.mock.calls[0][0];
      expect(data.idoso_id).toBe(IDOSO_A);
      expect(data.criado_por_id).toBe(FAMILIAR);
      expect(data.editado_por_id).toBeNull();
      expect(data.ativo).toBe(true);
      expect(data).not.toHaveProperty("id");
    });

    it("idoso_id gravado vem da linha do vínculo, não do path (mock que ignora o where)", async () => {
      logadoComo(FAMILIAR, "familiar");
      findFirstVinculo.mockResolvedValue(vinculo({ idoso_id: IDOSO_A }));
      modoDoIdoso("familiar");
      expect((await post(IDOSO_B)).status).toBe(201);
      expect(createMedicamento.mock.calls[0][0].data.idoso_id).toBe(IDOSO_A);
      expect(resolverModoDecisaoMock).toHaveBeenCalledWith(IDOSO_A);
    });
  });

  describe("privacidade", () => {
    const NOME = "nome-ficticio-sigiloso";
    const OBS = "obs-ficticia-sigilosa";
    const consoles = ["log", "info", "warn", "error", "debug"] as const;

    it("corpo do 403 e do 400 não traz o valor enviado nem cita modo_decisao ou flags", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
      modoDoIdoso("idoso");
      const r403 = await post(IDOSO_A, { ...BODY_OK, nome: NOME, observacoes: OBS });
      modoDoIdoso("familiar");
      const r400 = await post(IDOSO_A, { ...BODY_OK, nome: NOME, observacoes: OBS, dosagem: "d".repeat(51) });
      expect(r403.status).toBe(403);
      expect(r400.status).toBe(400);
      for (const r of [r403, r400]) {
        const texto = JSON.stringify(r.body);
        expect(texto).not.toContain(NOME);
        expect(texto).not.toContain(OBS);
        expect(texto).not.toMatch(/modo_decisao|permite_/i);
      }
    });

    it("erro do Prisma no create: 500 genérico e nenhum valor em corpo nem em console.*", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
      modoDoIdoso("familiar");
      createMedicamento.mockRejectedValue(
        new Prisma.PrismaClientValidationError(`Invalid invocation: data: { nome: '${NOME}', observacoes: '${OBS}' }`, {
          clientVersion: "5.22.0",
        }),
      );
      const espioes = consoles.map((m) => jest.spyOn(console, m).mockImplementation(() => undefined));
      try {
        const res = await post(IDOSO_A, { ...BODY_OK, nome: NOME, observacoes: OBS });
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: "Erro interno." });
        const tudo = inspect(espioes.flatMap((s) => s.mock.calls), { depth: 8 });
        expect(tudo).not.toContain(NOME);
        expect(tudo).not.toContain(OBS);
      } finally {
        espioes.forEach((s) => s.mockRestore());
      }
    });
  });
});
