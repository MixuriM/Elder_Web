import { inspect } from "node:util";
import request from "supertest";
import { Prisma } from "@prisma/client";
import {
  BODY_OK,
  CAMPOS_FORJADOS,
  CASOS_201,
  CASOS_400,
  CASOS_ORDEM_CORPO,
  CHAVES_CREATE,
  type DadosCreate,
} from "../testSupport/alimentacaoCasosCorpo";

// Item 7.1 (RF-018): POST /alimentacao/idoso/:idosoId. Familiar só cria com vínculo aprovado E modo_decisao
// efetivo 'familiar' (via resolver). Cuidador NUNCA cria (regra fixa de ator, igual à Fase 5): 403 com qualquer
// vínculo e qualquer combinação das flags permite_*, e o resolver nunca é chamado para ele.
// Todos os ids e valores são FICTÍCIOS.

const verifyIdToken = jest.fn();
const findFirstUsuario = jest.fn();
const findUniqueUsuario = jest.fn();
const updateUsuario = jest.fn();
const findFirstVinculo = jest.fn();
const countVinculo = jest.fn();
const createRegistro = jest.fn();
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
    registroAlimentar: { create: (...args: unknown[]) => createRegistro(...args) },
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
const MSG_403 = "Sem permissão para registrar refeição.";

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
const FLAGS = ["permite_registrar_saude", "permite_marcar_dose", "permite_criar_evento_cuidado"] as const;
// As 8 combinações das 3 flags (inclui as 3 falsas e as 3 verdadeiras).
const COMBINACOES_FLAGS = Array.from({ length: 8 }, (_, i) =>
  Object.fromEntries(FLAGS.map((f, bit) => [f, Boolean(i & (1 << bit))])),
) as Record<(typeof FLAGS)[number], boolean>[];

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

// findUnique serve a dois chamadores: o perfil do chamador (select.tipo_perfil, filtrado pelo where.id) e o
// resolver real (select de modo_decisao). O fake os separa pelo select.
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

function post(idoso: number | string, body: unknown = BODY_OK, query = "") {
  return request(app)
    .post(`/alimentacao/idoso/${idoso}${query}`)
    .set("Authorization", "Bearer x")
    .send(body as object);
}

function dadosDoCreate(): DadosCreate & Record<string, unknown> {
  return createRegistro.mock.calls[0][0].data;
}

function expectNaoCriou(res: request.Response, status: number) {
  expect(res.status).toBe(status);
  expect(createRegistro).not.toHaveBeenCalled();
}

beforeEach(() => {
  [
    verifyIdToken,
    findFirstUsuario,
    findUniqueUsuario,
    updateUsuario,
    findFirstVinculo,
    countVinculo,
    createRegistro,
    resolverModoDecisaoMock,
  ].forEach((m) => m.mockReset());
  Object.keys(perfis).forEach((k) => delete perfis[Number(k)]);
  estadoModo = ESTADO_NEUTRO;
  fakeUsuarios();
  createRegistro.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 1,
    ...data,
    created_at: new Date("2026-10-05T12:00:00Z"),
    updated_at: new Date("2026-10-05T12:00:00Z"),
  }));
});

describe("POST /alimentacao/idoso/:idosoId (RF-018, item 7.1)", () => {
  describe("cuidador: NUNCA cria (regra fixa de ator, critério de pronto)", () => {
    it("caso do plano: vínculo aprovado com as 3 flags true recebe 403, sem linha e sem resolver", async () => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador(TODAS_FLAGS)]);
      modoDoIdoso("familiar");
      const res = await post(IDOSO_A);
      expectNaoCriou(res, 403);
      expect(res.body).toEqual({ error: MSG_403 });
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
      // Controle positivo: o vínculo foi encontrado (o 403 é do ator, não do middleware).
      expect(findFirstVinculo).toHaveBeenCalledTimes(1);
      expect(await findFirstVinculo.mock.results[0].value).not.toBeNull();
    });

    it.each(COMBINACOES_FLAGS)("vínculo aprovado com flags %o: 403, sem linha e sem resolver", async (flags) => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador(flags)]);
      modoDoIdoso("familiar");
      const res = await post(IDOSO_A);
      expectNaoCriou(res, 403);
      expect(res.body).toEqual({ error: MSG_403 });
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
    });

    it.each(FLAGS)("só a flag %s true: 403, sem linha e sem resolver", async (flag) => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador({ [flag]: true })]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A), 403);
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
    });

    it.each(["pendente", "recusado"] as const)("vínculo %s com as 3 flags: 403, sem linha e sem resolver", async (status) => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador({ ...TODAS_FLAGS, status })]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A), 403);
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
    });

    it("sem vínculo: 403, sem linha e sem resolver", async () => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A), 403);
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
    });

    it("com modo_decisao 'familiar' no idoso (resolver real) e as 3 flags: 403 e o resolver nunca é consultado", async () => {
      resolverModoDecisaoMock.mockImplementation((id: number) => resolverReal(id));
      estadoModo = { ...ESTADO_NEUTRO, modo_decisao: "familiar" };
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador(TODAS_FLAGS)]);
      expectNaoCriou(await post(IDOSO_A), 403);
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
    });

    it.each([
      ["corpo válido", BODY_OK],
      ["corpo vazio", {}],
      ["refeicao inválida", { ...BODY_OK, refeicao: "outro" }],
      ["descricao inválida", { ...BODY_OK, descricao: "" }],
      ["data_hora inválida", { ...BODY_OK, data_hora: "x" }],
    ])("com as 3 flags e %s: sempre 403, nunca 400 nem 201", async (_rotulo, corpo) => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador(TODAS_FLAGS)]);
      modoDoIdoso("familiar");
      const res = await post(IDOSO_A, corpo);
      expectNaoCriou(res, 403);
      expect(res.body).toEqual({ error: MSG_403 });
    });

    it("POST /alimentacao (rota do idoso) também é 403 para cuidador", async () => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador(TODAS_FLAGS)]);
      const res = await request(app).post("/alimentacao").set("Authorization", "Bearer x").send(BODY_OK);
      expectNaoCriou(res, 403);
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
    });
  });

  describe("vínculo e perfil inconsistentes", () => {
    it("vínculo 'cuidador' com chamador de tipo_perfil 'familiar' (3 flags): 403, sem linha e sem resolver", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculoCuidador({ vinculado_id: FAMILIAR, ...TODAS_FLAGS })]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A), 403);
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
    });

    it("vínculo 'familiar' com chamador de tipo_perfil 'cuidador': 403, sem linha e sem resolver", async () => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculo({ vinculado_id: CUIDADOR, tipo_vinculo: "familiar", ...TODAS_FLAGS })]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A), 403);
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
    });

    it("vínculo 'familiar' com chamador de tipo_perfil 'idoso': 403", async () => {
      logadoComo(FAMILIAR, "idoso");
      fakeVinculos([vinculo()]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A), 403);
    });

    it("vínculo 'familiar' com chamador sem Usuario no findUnique: 403", async () => {
      logadoComo(FAMILIAR, "familiar");
      delete perfis[FAMILIAR];
      fakeVinculos([vinculo()]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A), 403);
    });
  });

  describe("familiar: matriz modo_decisao x vínculo (resolver mockado)", () => {
    it("201 com modo 'familiar': autoria do familiar, idoso_id do vínculo, editado_por_id null", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
      modoDoIdoso("familiar");
      const res = await post(IDOSO_A);
      expect(res.status).toBe(201);
      expect(resolverModoDecisaoMock).toHaveBeenCalledWith(IDOSO_A);
      expect(createRegistro).toHaveBeenCalledTimes(1);
      expect(dadosDoCreate()).toMatchObject({
        idoso_id: IDOSO_A,
        registrado_por_id: FAMILIAR,
        editado_por_id: null,
        refeicao: "almoco",
      });
      expect(res.body).toEqual({
        id: 1,
        idoso_id: IDOSO_A,
        registrado_por_id: FAMILIAR,
        refeicao: "almoco",
        descricao: "Refeicao Ficticia",
        data_hora: "2026-10-10T12:00:00.000Z",
        editado_por_id: null,
        created_at: "2026-10-05T12:00:00.000Z",
        updated_at: "2026-10-05T12:00:00.000Z",
      });
    });

    it("201 com qualquer combinação de flags no vínculo do familiar (flags não contam para familiar)", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo(TODAS_FLAGS)]);
      modoDoIdoso("familiar");
      expect((await post(IDOSO_A)).status).toBe(201);
    });

    it("403 com modo 'idoso' e vínculo aprovado, mensagem fixa", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
      modoDoIdoso("idoso");
      const res = await post(IDOSO_A);
      expectNaoCriou(res, 403);
      expect(res.body).toEqual({ error: MSG_403 });
      expect(resolverModoDecisaoMock).toHaveBeenCalledWith(IDOSO_A);
    });

    it("403 quando o resolver devolve null (nem 'familiar' nem 'idoso')", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
      resolverModoDecisaoMock.mockResolvedValue(null);
      expectNaoCriou(await post(IDOSO_A), 403);
    });

    it.each(["pendente", "recusado"] as const)("403 com modo 'familiar' e vínculo %s", async (status) => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo({ status })]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A), 403);
    });

    it("403 sem vínculo (resolver nem é consultado)", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A), 403);
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
    });

    it("403 no acesso cruzado: aprovado só com o idoso A, chamada com o idoso B (com controle positivo)", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo({ idoso_id: IDOSO_A })]);
      modoDoIdoso("familiar");
      // Controle positivo: o mesmo fake libera o idoso A.
      expect((await post(IDOSO_A)).status).toBe(201);
      createRegistro.mockClear();
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
        createRegistro.mockClear();
        expect((await post(IDOSO_A)).status).toBe(201);
        expect(dadosDoCreate()).toMatchObject({ registrado_por_id: quem, idoso_id: IDOSO_A, editado_por_id: null });
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

    it("201 com modo_decisao 'familiar' na coluna", async () => {
      estadoModo = { ...ESTADO_NEUTRO, modo_decisao: "familiar" };
      expect((await post(IDOSO_A)).status).toBe(201);
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
      expect(dadosDoCreate()).toMatchObject({ registrado_por_id: FAMILIAR, idoso_id: IDOSO_A });
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

  describe("autenticação e ordem de erros", () => {
    it("401 sem token e com token inválido", async () => {
      expectNaoCriou(await request(app).post(`/alimentacao/idoso/${IDOSO_A}`).send(BODY_OK), 401);
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
      expectNaoCriou(await post(IDOSO_A, { refeicao: "outro" }), 403);
    });

    it("403 antes de 400: modo 'idoso' e corpo inválido responde 403", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
      modoDoIdoso("idoso");
      expectNaoCriou(await post(IDOSO_A, {}), 403);
    });

    it("400 de corpo só depois de autorizado", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
      modoDoIdoso("familiar");
      const res = await post(IDOSO_A, { ...BODY_OK, refeicao: "outro" });
      expectNaoCriou(res, 400);
      expect(res.body).toEqual({ error: "refeicao inválida." });
    });

    it("ignora id, autoria e idoso_id forjados no body, no path e na query (mock que ignora o where)", async () => {
      logadoComo(FAMILIAR, "familiar");
      findFirstVinculo.mockResolvedValue(vinculo({ idoso_id: IDOSO_A }));
      modoDoIdoso("familiar");
      const res = await post(
        IDOSO_B,
        { ...BODY_OK, ...CAMPOS_FORJADOS, idoso_id: IDOSO_B, descricao: "Descricao valida" },
        `?idoso_id=${IDOSO_B}`,
      );
      expect(res.status).toBe(201);
      const data = dadosDoCreate();
      // Controle positivo: campo da whitelist chegou.
      expect(data.descricao).toBe("Descricao valida");
      expect(data).toMatchObject({ idoso_id: IDOSO_A, registrado_por_id: FAMILIAR, editado_por_id: null });
      expect(Object.keys(data).sort()).toEqual(CHAVES_CREATE);
      expect(resolverModoDecisaoMock).toHaveBeenCalledWith(IDOSO_A);
    });
  });

  // Mesmos casos de corpo nas duas rotas.
  describe.each([
    ["POST /alimentacao (idoso)", IDOSO_A, "idoso" as const],
    ["POST /alimentacao/idoso/:idosoId (familiar)", FAMILIAR, "familiar" as const],
  ])("corpo em %s", (_nome, atorId, perfil) => {
    const rota = perfil === "idoso" ? "/alimentacao" : `/alimentacao/idoso/${IDOSO_A}`;
    function chamar(corpo: unknown) {
      return request(app)
        .post(rota)
        .set("Authorization", "Bearer x")
        .send(corpo as object);
    }

    beforeEach(() => {
      logadoComo(atorId, perfil);
      fakeVinculos([vinculo()]);
      modoDoIdoso("familiar");
    });

    it.each(CASOS_201)("201 e grava corretamente: %s", async (_rotulo, over, checar) => {
      const res = await chamar({ ...BODY_OK, ...over });
      expect(res.status).toBe(201);
      checar(dadosDoCreate());
      expect(dadosDoCreate()).toMatchObject({ registrado_por_id: atorId, idoso_id: IDOSO_A, editado_por_id: null });
    });

    it.each([...CASOS_400, ...CASOS_ORDEM_CORPO])("400: %s", async (_rotulo, over, msg) => {
      const res = await chamar({ ...BODY_OK, ...over });
      expectNaoCriou(res, 400);
      expect(res.body).toEqual({ error: msg });
    });

    it("corpo ausente: 400", async () => {
      expectNaoCriou(await request(app).post(rota).set("Authorization", "Bearer x"), 400);
    });
  });

  describe("privacidade (RNF-001 por analogia)", () => {
    const DESC = "descricao-alimentar-ficticia-sigilosa";
    const SENT_META = "meta-ficticio-sigiloso";
    const SENT_REF = "refeicao-ficticia-sigilosa";
    const SENTINELAS = [DESC, SENT_META, SENT_REF];
    const CONSOLES = ["log", "info", "warn", "error", "debug"] as const;
    const MSG_COM_ARGS = `Invalid invocation: data: { descricao: '${DESC}' }`;
    const corpoSigiloso = { ...BODY_OK, descricao: DESC };

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

    function semSentinelas(texto: string) {
      for (const s of SENTINELAS) expect(texto).not.toContain(s);
    }

    it("a captura enxerga console.*, stdout e stderr (controle positivo)", async () => {
      const { saidas } = await capturando(async () => {
        console.error("CONTROLE_CONSOLE");
        process.stdout.write("CONTROLE_STDOUT");
        process.stderr.write("CONTROLE_STDERR");
      });
      expect(saidas).toContain("CONTROLE_CONSOLE");
      expect(saidas).toContain("CONTROLE_STDOUT");
      expect(saidas).toContain("CONTROLE_STDERR");
    });

    it("sucesso: o 201 devolve a descrição (controle positivo) e nada vai para console.*, stdout e stderr", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
      modoDoIdoso("familiar");
      const { res, saidas } = await capturando(() => post(IDOSO_A, corpoSigiloso));
      expect(res.status).toBe(201);
      expect(res.body.descricao).toBe(DESC);
      semSentinelas(saidas);
    });

    it.each([
      ["400 de refeicao fora da lista", { ...corpoSigiloso, refeicao: SENT_REF }, 400, "familiar"],
      ["400 de data inválida", { ...corpoSigiloso, data_hora: "2026-02-30T10:00:00Z" }, 400, "familiar"],
      ["400 de descrição longa", { ...corpoSigiloso, descricao: DESC + "x".repeat(500) }, 400, "familiar"],
      ["403 de modo_decisao 'idoso'", corpoSigiloso, 403, "idoso"],
    ])("%s: erro nunca repete o valor enviado nem cita modo_decisao", async (_rotulo, corpo, status, modo) => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
      modoDoIdoso(modo as "idoso" | "familiar");
      const { res, saidas } = await capturando(() => post(IDOSO_A, corpo));
      expect(res.status).toBe(status);
      semSentinelas(visivel(res, saidas));
      expect(JSON.stringify(res.body)).not.toMatch(/modo_decisao|permite_/i);
    });

    it("403 de cuidador com as 3 flags nunca repete o valor enviado nem cita flags, motivo ou perfil", async () => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador(TODAS_FLAGS)]);
      const { res, saidas } = await capturando(() => post(IDOSO_A, { ...corpoSigiloso, refeicao: SENT_REF }));
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: MSG_403 });
      semSentinelas(visivel(res, saidas));
      expect(JSON.stringify(res.body)).not.toMatch(/modo_decisao|permite_|flag|cuidador|perfil/i);
    });

    const erroKnown = () =>
      new Prisma.PrismaClientKnownRequestError(MSG_COM_ARGS, {
        code: "P2002",
        clientVersion: "5.22.0",
        meta: { valor: SENT_META, descricao: DESC },
      });
    const TIPOS_DE_ERRO: [string, () => unknown][] = [
      ["PrismaClientKnownRequestError com meta sigiloso", erroKnown],
      ["PrismaClientValidationError", () => new Prisma.PrismaClientValidationError(MSG_COM_ARGS, { clientVersion: "5.22.0" })],
      ["Error genérico com sentinela na message", () => new Error(MSG_COM_ARGS)],
      ["string lançada", () => MSG_COM_ARGS],
      ["objeto lançado que não é Error", () => ({ descricao: DESC, detalhe: SENT_META })],
    ];

    describe.each([
      ["vinculo.findFirst", () => findFirstVinculo],
      ["usuario.findUnique", () => findUniqueUsuario],
      ["registroAlimentar.create", () => createRegistro],
    ])("falha injetada em %s", (_ponto, alvo) => {
      it.each(TIPOS_DE_ERRO)("%s: 500 exato e sem sentinela em lugar nenhum", async (_tipo, criar) => {
        logadoComo(FAMILIAR, "familiar");
        fakeVinculos([vinculo()]);
        modoDoIdoso("familiar");
        alvo().mockImplementation(async () => {
          throw criar();
        });
        const { res, saidas } = await capturando(() => post(IDOSO_A, corpoSigiloso));
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: "Erro interno." });
        semSentinelas(visivel(res, saidas));
        expect(saidas).toContain("/alimentacao");
      });
    });
  });
});
