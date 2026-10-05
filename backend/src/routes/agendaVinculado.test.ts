import { inspect } from "node:util";
import request from "supertest";
import { Prisma } from "@prisma/client";
import {
  BODY_OK,
  CAMPOS_FORJADOS,
  CASOS_201,
  CASOS_400_CAMPOS,
  CASOS_400_TIPO,
  type DadosCreate,
} from "../testSupport/agendaCasosCorpo";

// Item 6.1 (RF-015): POST /agenda/idoso/:idosoId. Familiar só cria com vínculo aprovado E modo_decisao
// efetivo 'familiar' (via resolver). Item 6.2: cuidador só cria 'cuidado', com vínculo aprovado e
// permite_criar_evento_cuidado === true (matriz completa em agendaCuidador.test.ts); aqui ficam os 403 que
// seguem valendo para cuidador e um 201 de sanidade. Todos os ids e valores são FICTÍCIOS.

const verifyIdToken = jest.fn();
const findFirstUsuario = jest.fn();
const findUniqueUsuario = jest.fn();
const updateUsuario = jest.fn();
const findFirstVinculo = jest.fn();
const countVinculo = jest.fn();
const createEvento = jest.fn();
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
    evento: { create: (...args: unknown[]) => createEvento(...args) },
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
const MSG_403 = "Sem permissão para criar compromisso.";

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

function post(idoso: number | string, body: unknown = BODY_OK) {
  return request(app)
    .post(`/agenda/idoso/${idoso}`)
    .set("Authorization", "Bearer x")
    .send(body as object);
}

function dadosDoCreate(): DadosCreate {
  return createEvento.mock.calls[0][0].data;
}

function expectNaoCriou(res: request.Response, status: number) {
  expect(res.status).toBe(status);
  expect(createEvento).not.toHaveBeenCalled();
}

beforeEach(() => {
  [
    verifyIdToken,
    findFirstUsuario,
    findUniqueUsuario,
    updateUsuario,
    findFirstVinculo,
    countVinculo,
    createEvento,
    resolverModoDecisaoMock,
  ].forEach((m) => m.mockReset());
  Object.keys(perfis).forEach((k) => delete perfis[Number(k)]);
  estadoModo = ESTADO_NEUTRO;
  fakeUsuarios();
  createEvento.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 1,
    ...data,
    created_at: new Date("2026-10-04T12:00:00Z"),
    updated_at: new Date("2026-10-04T12:00:00Z"),
  }));
});

describe("POST /agenda/idoso/:idosoId (RF-015, item 6.1)", () => {
  describe("familiar: matriz modo_decisao x vínculo (resolver mockado)", () => {
    it.each(["pessoal", "medico"])("201 '%s' com modo 'familiar': autoria do familiar, idoso_id do vínculo", async (tipo) => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
      modoDoIdoso("familiar");
      const res = await post(IDOSO_A, { ...BODY_OK, tipo_evento: tipo });
      expect(res.status).toBe(201);
      expect(resolverModoDecisaoMock).toHaveBeenCalledWith(IDOSO_A);
      expect(createEvento).toHaveBeenCalledTimes(1);
      expect(dadosDoCreate()).toMatchObject({
        idoso_id: IDOSO_A,
        criado_por_id: FAMILIAR,
        editado_por_id: null,
        tipo_evento: tipo,
      });
      expect(res.body).toMatchObject({ id: 1, idoso_id: IDOSO_A, criado_por_id: FAMILIAR, editado_por_id: null });
      expect(res.body.data_hora_inicio).toBe("2026-10-10T12:00:00.000Z");
    });

    it("403 com modo 'idoso' e vínculo aprovado, mensagem fixa", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
      modoDoIdoso("idoso");
      const res = await post(IDOSO_A);
      expectNaoCriou(res, 403);
      expect(res.body).toEqual({ error: MSG_403 });
    });

    it("403 quando o resolver devolve NULL (nem 'familiar' nem 'idoso')", async () => {
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
      createEvento.mockClear();
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
        createEvento.mockClear();
        expect((await post(IDOSO_A)).status).toBe(201);
        expect(dadosDoCreate()).toMatchObject({ criado_por_id: quem, idoso_id: IDOSO_A });
      }
    });

    it("familiar com 'cuidado': 403 e o create não é chamado", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
      modoDoIdoso("familiar");
      const res = await post(IDOSO_A, { ...BODY_OK, tipo_evento: "cuidado" });
      expectNaoCriou(res, 403);
      expect(res.body).toEqual({ error: MSG_403 });
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
      expect(dadosDoCreate().tipo_evento).toBe("pessoal");
      expect(createEvento.mock.calls[0][0].data.criado_por_id).toBe(FAMILIAR);
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

  describe("cuidador: só cria 'cuidado' com a flag (6.2; matriz completa em agendaCuidador.test.ts)", () => {
    const BODY_CUIDADO = { ...BODY_OK, tipo_evento: "cuidado" };

    it("201 com permite_criar_evento_cuidado true e tipo 'cuidado' (única combinação que passa)", async () => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador({ permite_criar_evento_cuidado: true })]);
      const res = await post(IDOSO_A, BODY_CUIDADO);
      expect(res.status).toBe(201);
      expect(dadosDoCreate()).toMatchObject({ idoso_id: IDOSO_A, criado_por_id: CUIDADOR, tipo_evento: "cuidado" });
    });

    it("403 com as 3 flags permite_* falsas", async () => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador()]);
      modoDoIdoso("familiar");
      const res = await post(IDOSO_A, BODY_CUIDADO);
      expectNaoCriou(res, 403);
      expect(res.body).toEqual({ error: MSG_403 });
    });

    it("403 com só permite_criar_evento_cuidado falsa e as outras duas verdadeiras", async () => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador({ ...TODAS_FLAGS, permite_criar_evento_cuidado: false })]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A, BODY_CUIDADO), 403);
    });

    it.each(["pessoal", "medico"])(
      "403 com permite_criar_evento_cuidado verdadeira e tipo '%s'",
      async (tipo) => {
        logadoComo(CUIDADOR, "cuidador");
        fakeVinculos([vinculoCuidador(TODAS_FLAGS)]);
        modoDoIdoso("familiar");
        expectNaoCriou(await post(IDOSO_A, { ...BODY_OK, tipo_evento: tipo }), 403);
      },
    );

    it.each(["permite_registrar_saude", "permite_marcar_dose"])("403 com só a flag %s verdadeira", async (flag) => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador({ [flag]: true })]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A, BODY_CUIDADO), 403);
    });

    it.each(["pendente", "recusado"] as const)("403 com vínculo %s", async (status) => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador({ ...TODAS_FLAGS, status })]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A, BODY_CUIDADO), 403);
    });

    it("a checagem de ator vem antes do resolver: para cuidador o resolver nunca é chamado (201 e 403)", async () => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador(TODAS_FLAGS)]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A), 403);
      expect((await post(IDOSO_A, BODY_CUIDADO)).status).toBe(201);
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
    });

    it("403 com modo 'familiar' no idoso e flag falsa: modo_decisao não libera cuidador", async () => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador({ ...TODAS_FLAGS, permite_criar_evento_cuidado: false })]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A, BODY_CUIDADO), 403);
    });
  });

  describe("vínculo e perfil inconsistentes", () => {
    it("vínculo 'familiar' com chamador de tipo_perfil 'cuidador': 403 e resolver não chamado", async () => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculo({ vinculado_id: CUIDADOR, tipo_vinculo: "familiar" })]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A), 403);
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
    });

    it("vínculo 'cuidador' com chamador de tipo_perfil 'familiar': 403 e resolver não chamado", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculoCuidador({ vinculado_id: FAMILIAR, ...TODAS_FLAGS })]);
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
  });

  describe("autenticação e ordem de erros", () => {
    it("401 sem token e com token inválido", async () => {
      expectNaoCriou(await request(app).post(`/agenda/idoso/${IDOSO_A}`).send(BODY_OK), 401);
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
      expectNaoCriou(await post(IDOSO_A, { tipo_evento: "outro" }), 403);
    });

    it("403 antes de 400: modo 'idoso' e corpo inválido responde 403", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
      modoDoIdoso("idoso");
      expectNaoCriou(await post(IDOSO_A, { tipo_evento: "outro" }), 403);
    });

    it("403 antes de 400: cuidador sem a flag e com corpo inválido responde 403", async () => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador({ ...TODAS_FLAGS, permite_criar_evento_cuidado: false })]);
      expectNaoCriou(await post(IDOSO_A, {}), 403);
    });

    it("400 de tipo só depois de autorizado; 'cuidado' com título inválido responde 403", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
      modoDoIdoso("familiar");
      expectNaoCriou(await post(IDOSO_A, { ...BODY_OK, tipo_evento: "outro", titulo: "" }), 400);
      expectNaoCriou(await post(IDOSO_A, { ...BODY_OK, tipo_evento: "cuidado", titulo: "" }), 403);
    });

    it("ignora id, autoria e idoso_id forjados no body e no path (mock que ignora o where)", async () => {
      logadoComo(FAMILIAR, "familiar");
      findFirstVinculo.mockResolvedValue(vinculo({ idoso_id: IDOSO_A }));
      modoDoIdoso("familiar");
      const res = await post(IDOSO_B, { ...BODY_OK, ...CAMPOS_FORJADOS, idoso_id: IDOSO_B, titulo: "Titulo valido" });
      expect(res.status).toBe(201);
      const data = dadosDoCreate();
      // Controle positivo: campo da whitelist chegou.
      expect(data.titulo).toBe("Titulo valido");
      expect(data).toMatchObject({ idoso_id: IDOSO_A, criado_por_id: FAMILIAR, editado_por_id: null });
      expect(data).not.toHaveProperty("id");
      expect(data).not.toHaveProperty("created_at");
      expect(data).not.toHaveProperty("updated_at");
      expect(resolverModoDecisaoMock).toHaveBeenCalledWith(IDOSO_A);
    });
  });

  // Mesmos casos de corpo do arquivo do idoso, sobre as duas rotas.
  describe.each([
    ["POST /agenda (idoso)", IDOSO_A, "idoso" as const],
    ["POST /agenda/idoso/:idosoId (familiar)", FAMILIAR, "familiar" as const],
  ])("corpo em %s", (_nome, atorId, perfil) => {
    function chamar(corpo: unknown) {
      if (perfil === "idoso") {
        return request(app)
          .post("/agenda")
          .set("Authorization", "Bearer x")
          .send(corpo as object);
      }
      return post(IDOSO_A, corpo);
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
      expect(dadosDoCreate()).toMatchObject({ criado_por_id: atorId, idoso_id: IDOSO_A });
    });

    it.each([...CASOS_400_TIPO, ...CASOS_400_CAMPOS])("400: %s", async (_rotulo, over) => {
      const res = await chamar({ ...BODY_OK, ...over });
      expectNaoCriou(res, 400);
      expect(typeof res.body.error).toBe("string");
    });

    it("corpo ausente: 400", async () => {
      const rota = perfil === "idoso" ? "/agenda" : `/agenda/idoso/${IDOSO_A}`;
      expectNaoCriou(await request(app).post(rota).set("Authorization", "Bearer x"), 400);
    });
  });

  describe("privacidade (RNF-001)", () => {
    const TITULO = "titulo-ficticio-sigiloso";
    const DESC = "descricao-ficticia-sigilosa";
    const SENT_META = "meta-ficticio-sigiloso";
    const SENTINELAS = [TITULO, DESC, SENT_META];
    const CONSOLES = ["log", "info", "warn", "error", "debug"] as const;
    const MSG_COM_ARGS = `Invalid invocation: data: { titulo: '${TITULO}', descricao: '${DESC}' }`;
    const corpoSigiloso = { ...BODY_OK, tipo_evento: "medico", titulo: TITULO, descricao: DESC };

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

    it("sucesso: o 201 devolve o título (controle positivo) e nada vai para console.*, stdout e stderr", async () => {
      logadoComo(FAMILIAR, "familiar");
      fakeVinculos([vinculo()]);
      modoDoIdoso("familiar");
      const { res, saidas } = await capturando(() => post(IDOSO_A, corpoSigiloso));
      expect(res.status).toBe(201);
      expect(res.body.titulo).toBe(TITULO);
      semSentinelas(saidas);
    });

    it.each([
      ["400 de validação (data inválida)", { ...corpoSigiloso, data_hora_inicio: "2026-02-30T10:00:00Z" }, 400, "familiar"],
      ["400 de validação (descrição longa)", { ...corpoSigiloso, descricao: DESC + "x".repeat(500) }, 400, "familiar"],
      ["403 de 'cuidado'", { ...corpoSigiloso, tipo_evento: "cuidado" }, 403, "familiar"],
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

    it("403 de cuidador nunca repete o valor enviado nem cita flags", async () => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador(TODAS_FLAGS)]);
      const { res, saidas } = await capturando(() => post(IDOSO_A, corpoSigiloso));
      expect(res.status).toBe(403);
      semSentinelas(visivel(res, saidas));
      expect(JSON.stringify(res.body)).not.toMatch(/modo_decisao|permite_/i);
    });

    const erroKnown = () =>
      new Prisma.PrismaClientKnownRequestError(MSG_COM_ARGS, {
        code: "P2002",
        clientVersion: "5.22.0",
        meta: { valor: SENT_META, titulo: TITULO },
      });
    const TIPOS_DE_ERRO: [string, () => unknown][] = [
      ["PrismaClientKnownRequestError com meta sigiloso", erroKnown],
      ["PrismaClientValidationError", () => new Prisma.PrismaClientValidationError(MSG_COM_ARGS, { clientVersion: "5.22.0" })],
      ["Error genérico com sentinela na message", () => new Error(MSG_COM_ARGS)],
      ["string lançada", () => MSG_COM_ARGS],
      ["objeto lançado que não é Error", () => ({ titulo: TITULO, descricao: DESC, detalhe: SENT_META })],
    ];

    describe.each([
      ["vinculo.findFirst", () => findFirstVinculo],
      ["usuario.findUnique", () => findUniqueUsuario],
      ["evento.create", () => createEvento],
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
        expect(saidas).toContain("/agenda");
      });
    });
  });
});
