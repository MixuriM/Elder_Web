import { inspect } from "node:util";
import request from "supertest";
import { Prisma } from "@prisma/client";
import {
  BODY_OK_CUIDADO,
  CAMPOS_FORJADOS,
  CASOS_201_CUIDADOR,
  CASOS_400_CAMPOS,
  CASOS_400_TIPO,
  type DadosCreate,
} from "../testSupport/agendaCasosCorpo";

// Item 6.2 (RF-016, RF-032): POST /agenda/idoso/:idosoId com chamador cuidador. Só cria tipo 'cuidado', só com
// vínculo aprovado de cuidador, tipo_perfil 'cuidador' e permite_criar_evento_cuidado === true. O resolver de
// modo_decisao NUNCA é chamado para cuidador. Todos os ids e valores são FICTÍCIOS.

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
// Só resolverModoDecisao é trocada: o resto de vinculo.ts segue real.
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
  permite_criar_evento_cuidado: unknown;
};

function vinculoCuidador(over: Partial<VinculoFake> = {}): VinculoFake {
  return {
    id: 1,
    idoso_id: IDOSO_A,
    vinculado_id: CUIDADOR,
    tipo_vinculo: "cuidador",
    status: "aprovado",
    permite_registrar_saude: false,
    permite_marcar_dose: false,
    permite_criar_evento_cuidado: true,
    ...over,
  };
}

const FLAGS_OUTRAS = { permite_registrar_saude: true, permite_marcar_dose: true };

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

// findUnique serve ao perfil do chamador (select.tipo_perfil) e ao resolver real (select de modo_decisao).
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

function post(idoso: number | string, body: unknown = BODY_OK_CUIDADO) {
  return request(app)
    .post(`/agenda/idoso/${idoso}`)
    .set("Authorization", "Bearer x")
    .send(body as object);
}

function dadosDoCreate(): DadosCreate & Record<string, unknown> {
  return createEvento.mock.calls[0][0].data;
}

function expectNaoCriou(res: request.Response, status: number) {
  expect(res.status).toBe(status);
  expect(createEvento).not.toHaveBeenCalled();
}

function cuidadorCom(over: Partial<VinculoFake> = {}) {
  logadoComo(CUIDADOR, "cuidador");
  fakeVinculos([vinculoCuidador(over)]);
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

describe("POST /agenda/idoso/:idosoId, cuidador (RF-016, item 6.2)", () => {
  describe("autorização pela flag permite_criar_evento_cuidado", () => {
    it("201 com flag true, tipo 'cuidado', vínculo e perfil de cuidador: objeto exato no create", async () => {
      cuidadorCom();
      const res = await post(IDOSO_A, { ...BODY_OK_CUIDADO, descricao: "Detalhe", data_hora_fim: "2026-10-10T13:00:00Z" });
      expect(res.status).toBe(201);
      expect(createEvento).toHaveBeenCalledTimes(1);
      expect(createEvento.mock.calls[0][0]).toEqual({
        data: {
          idoso_id: IDOSO_A,
          criado_por_id: CUIDADOR,
          editado_por_id: null,
          tipo_evento: "cuidado",
          titulo: "Compromisso Ficticio",
          descricao: "Detalhe",
          data_hora_inicio: new Date("2026-10-10T12:00:00Z"),
          data_hora_fim: new Date("2026-10-10T13:00:00Z"),
        },
      });
      expect(res.body).toMatchObject({
        id: 1,
        idoso_id: IDOSO_A,
        criado_por_id: CUIDADOR,
        tipo_evento: "cuidado",
        editado_por_id: null,
      });
    });

    it("403 com a flag false e as outras duas true (caso do plano), mensagem fixa", async () => {
      cuidadorCom({ ...FLAGS_OUTRAS, permite_criar_evento_cuidado: false });
      const res = await post(IDOSO_A);
      expectNaoCriou(res, 403);
      expect(res.body).toEqual({ error: MSG_403 });
    });

    it.each(Object.keys(FLAGS_OUTRAS))("403 com só a flag %s true (não abre esta porta)", async (flag) => {
      cuidadorCom({ permite_criar_evento_cuidado: false, [flag]: true });
      expectNaoCriou(await post(IDOSO_A), 403);
    });

    it("403 com as 3 flags false", async () => {
      cuidadorCom({ permite_criar_evento_cuidado: false });
      expectNaoCriou(await post(IDOSO_A), 403);
    });

    it.each([
      ["null", null],
      ["undefined", undefined],
      ["número 1", 1],
      ["string 'true'", "true"],
    ])("403 com a flag %s (igualdade estrita com true)", async (_rotulo, valor) => {
      cuidadorCom({ ...FLAGS_OUTRAS, permite_criar_evento_cuidado: valor });
      expectNaoCriou(await post(IDOSO_A), 403);
    });

    it("revogação: a flag vai de true para false entre duas requisições e a segunda dá 403", async () => {
      logadoComo(CUIDADOR, "cuidador");
      const v = vinculoCuidador();
      fakeVinculos([v]);
      expect((await post(IDOSO_A)).status).toBe(201);
      createEvento.mockClear();
      v.permite_criar_evento_cuidado = false;
      expectNaoCriou(await post(IDOSO_A), 403);
    });
  });

  describe("tipo_evento", () => {
    it.each(["pessoal", "medico"])("403 com flag true e tipo '%s'", async (tipo) => {
      cuidadorCom();
      const res = await post(IDOSO_A, { ...BODY_OK_CUIDADO, tipo_evento: tipo });
      expectNaoCriou(res, 403);
      expect(res.body).toEqual({ error: MSG_403 });
    });

    it.each(["pessoal", "medico"])("403 com flag false e tipo '%s'", async (tipo) => {
      cuidadorCom({ permite_criar_evento_cuidado: false });
      expectNaoCriou(await post(IDOSO_A, { ...BODY_OK_CUIDADO, tipo_evento: tipo }), 403);
    });

    it.each([
      ["ausente", undefined],
      ["número", 1],
      ["null", null],
      ["vazio", ""],
      ["'Cuidado'", "Cuidado"],
      ["'CUIDADO'", "CUIDADO"],
      ["' cuidado'", " cuidado"],
      ["'cuidado '", "cuidado "],
      ["'outro'", "outro"],
    ])("400 com flag true e tipo %s", async (_rotulo, tipo) => {
      cuidadorCom();
      const res = await post(IDOSO_A, { ...BODY_OK_CUIDADO, tipo_evento: tipo });
      expectNaoCriou(res, 400);
      expect(typeof res.body.error).toBe("string");
    });
  });

  describe("vínculo e perfil", () => {
    it.each(["pendente", "recusado"] as const)("403 com vínculo %s mesmo com a flag true", async (status) => {
      cuidadorCom({ status });
      expectNaoCriou(await post(IDOSO_A), 403);
    });

    it("403 no acesso cruzado: vínculo só com o idoso B, requisição ao idoso A (com controle positivo)", async () => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador({ idoso_id: IDOSO_B })]);
      expectNaoCriou(await post(IDOSO_A), 403);
      // Controle positivo: o mesmo fake libera o idoso B.
      expect((await post(IDOSO_B)).status).toBe(201);
      expect(dadosDoCreate().idoso_id).toBe(IDOSO_B);
    });

    it("401 sem token e com token inválido", async () => {
      expectNaoCriou(await request(app).post(`/agenda/idoso/${IDOSO_A}`).send(BODY_OK_CUIDADO), 401);
      verifyIdToken.mockRejectedValue(Object.assign(new Error("bad"), { code: "auth/argument-error" }));
      expectNaoCriou(await post(IDOSO_A), 401);
    });

    it("400 com idosoId não numérico, sem consultar vínculo", async () => {
      cuidadorCom();
      expectNaoCriou(await post("abc"), 400);
      expect(findFirstVinculo).not.toHaveBeenCalled();
    });

    it("vínculo 'familiar' com chamador de perfil 'cuidador': 403 e resolver não chamado", async () => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([vinculoCuidador({ tipo_vinculo: "familiar", ...FLAGS_OUTRAS })]);
      expectNaoCriou(await post(IDOSO_A), 403);
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
    });

    it.each(["familiar", "idoso"] as const)("vínculo 'cuidador' com chamador de perfil '%s': 403", async (perfil) => {
      logadoComo(CUIDADOR, perfil);
      fakeVinculos([vinculoCuidador()]);
      expectNaoCriou(await post(IDOSO_A), 403);
    });

    it("403 quando o Usuario do chamador não é encontrado", async () => {
      cuidadorCom();
      findUniqueUsuario.mockResolvedValue(null);
      expectNaoCriou(await post(IDOSO_A), 403);
    });
  });

  describe("modo_decisao não libera nem bloqueia cuidador", () => {
    it.each([
      ["'idoso'", "idoso"],
      ["'familiar'", "familiar"],
      ["NULL", null],
    ])("201 com a flag true e modo_decisao %s: resolver real nunca consultado", async (_rotulo, modo) => {
      cuidadorCom();
      resolverModoDecisaoMock.mockImplementation((id: number) => resolverReal(id));
      estadoModo = { ...ESTADO_NEUTRO, modo_decisao: modo };
      expect((await post(IDOSO_A)).status).toBe(201);
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
      const consultasModo = findUniqueUsuario.mock.calls.filter(([a]) => a?.select?.modo_decisao);
      expect(consultasModo).toHaveLength(0);
    });

    it.each(["idoso", "familiar", null])("403 com a flag false e modo_decisao %s: resolver não chamado", async (modo) => {
      cuidadorCom({ permite_criar_evento_cuidado: false });
      resolverModoDecisaoMock.mockImplementation((id: number) => resolverReal(id));
      estadoModo = { ...ESTADO_NEUTRO, modo_decisao: modo };
      expectNaoCriou(await post(IDOSO_A), 403);
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
    });

    it("resolver não chamado em 403 de tipo 'pessoal' nem em 400 de campos", async () => {
      cuidadorCom();
      expectNaoCriou(await post(IDOSO_A, { ...BODY_OK_CUIDADO, tipo_evento: "pessoal" }), 403);
      expectNaoCriou(await post(IDOSO_A, { ...BODY_OK_CUIDADO, titulo: "" }), 400);
      expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
    });
  });

  describe("ordem de erros (D5)", () => {
    it("cuidador sem a flag com corpo inválido responde 403, nunca 400", async () => {
      cuidadorCom({ permite_criar_evento_cuidado: false });
      expectNaoCriou(await post(IDOSO_A, {}), 403);
      expectNaoCriou(await post(IDOSO_A, { tipo_evento: "outro", titulo: "" }), 403);
    });

    it("flag true + 'pessoal' + título inválido responde 403, não 400", async () => {
      cuidadorCom();
      expectNaoCriou(await post(IDOSO_A, { ...BODY_OK_CUIDADO, tipo_evento: "pessoal", titulo: "" }), 403);
    });

    it("flag true + 'cuidado' + título inválido responde 400", async () => {
      cuidadorCom();
      expectNaoCriou(await post(IDOSO_A, { ...BODY_OK_CUIDADO, titulo: "" }), 400);
    });

    it("403 de vínculo vem antes do 403 de flag e do 400 de corpo", async () => {
      logadoComo(CUIDADOR, "cuidador");
      fakeVinculos([]);
      expectNaoCriou(await post(IDOSO_A, {}), 403);
    });
  });

  describe("campos forjados no corpo", () => {
    it("ignora id, autoria, idoso_id e timestamps do corpo (mock que ignora o where, com controle positivo)", async () => {
      logadoComo(CUIDADOR, "cuidador");
      findFirstVinculo.mockResolvedValue(vinculoCuidador({ idoso_id: IDOSO_A }));
      const res = await post(IDOSO_B, { ...BODY_OK_CUIDADO, ...CAMPOS_FORJADOS, idoso_id: IDOSO_B, titulo: "Titulo valido" });
      expect(res.status).toBe(201);
      const data = dadosDoCreate();
      expect(data.titulo).toBe("Titulo valido");
      expect(data).toMatchObject({ idoso_id: IDOSO_A, criado_por_id: CUIDADOR, editado_por_id: null });
      expect(data).not.toHaveProperty("id");
      expect(data).not.toHaveProperty("created_at");
      expect(data).not.toHaveProperty("updated_at");
      expect(Object.keys(data).sort()).toEqual([
        "criado_por_id",
        "data_hora_fim",
        "data_hora_inicio",
        "descricao",
        "editado_por_id",
        "idoso_id",
        "tipo_evento",
        "titulo",
      ]);
    });
  });

  // Casos de corpo compartilhados com idoso e familiar, com o tipo-base 'cuidado' (ver agendaCasosCorpo.ts:
  // os casos "tipo 'medico'" e "tipo 'pessoal'" não se aplicam ao cuidador e ficam de fora só aqui).
  describe("corpo (casos compartilhados, tipo-base 'cuidado')", () => {
    beforeEach(() => cuidadorCom());

    it.each(CASOS_201_CUIDADOR)("201 e grava corretamente: %s", async (_rotulo, over, checar) => {
      const res = await post(IDOSO_A, { ...BODY_OK_CUIDADO, ...over });
      expect(res.status).toBe(201);
      checar(dadosDoCreate());
      expect(dadosDoCreate()).toMatchObject({ criado_por_id: CUIDADOR, idoso_id: IDOSO_A, tipo_evento: "cuidado" });
    });

    it.each([...CASOS_400_TIPO, ...CASOS_400_CAMPOS])("400: %s", async (_rotulo, over) => {
      const res = await post(IDOSO_A, { ...BODY_OK_CUIDADO, ...over });
      expectNaoCriou(res, 400);
      expect(typeof res.body.error).toBe("string");
    });

    it("corpo ausente: 400", async () => {
      expectNaoCriou(await request(app).post(`/agenda/idoso/${IDOSO_A}`).set("Authorization", "Bearer x"), 400);
    });
  });

  describe("privacidade (RNF-001)", () => {
    const TITULO = "titulo-ficticio-sigiloso";
    const DESC = "descricao-ficticia-sigilosa";
    const SENT_META = "meta-ficticio-sigiloso";
    const SENTINELAS = [TITULO, DESC, SENT_META];
    const CONSOLES = ["log", "info", "warn", "error", "debug"] as const;
    const MSG_COM_ARGS = `Invalid invocation: data: { titulo: '${TITULO}', descricao: '${DESC}' }`;
    const corpoSigiloso = { ...BODY_OK_CUIDADO, titulo: TITULO, descricao: DESC };

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
      cuidadorCom();
      const { res, saidas } = await capturando(() => post(IDOSO_A, corpoSigiloso));
      expect(res.status).toBe(201);
      expect(res.body.titulo).toBe(TITULO);
      semSentinelas(saidas);
    });

    it.each([
      ["400 de validação (data inválida)", { ...corpoSigiloso, data_hora_inicio: "2026-02-30T10:00:00Z" }, 400, true],
      ["400 de validação (descrição longa)", { ...corpoSigiloso, descricao: DESC + "x".repeat(500) }, 400, true],
      ["400 de tipo inválido", { ...corpoSigiloso, tipo_evento: "Cuidado" }, 400, true],
      ["403 de tipo 'pessoal'", { ...corpoSigiloso, tipo_evento: "pessoal" }, 403, true],
      ["403 de flag false", corpoSigiloso, 403, false],
    ])("%s: erro nunca repete o valor enviado nem cita flag ou modo_decisao", async (_rotulo, corpo, status, flag) => {
      cuidadorCom({ ...FLAGS_OUTRAS, permite_criar_evento_cuidado: flag });
      const { res, saidas } = await capturando(() => post(IDOSO_A, corpo));
      expect(res.status).toBe(status);
      semSentinelas(visivel(res, saidas));
      expect(JSON.stringify(res.body)).not.toMatch(/modo_decisao|permite_|flag/i);
    });

    it("403 de perfil/vínculo inconsistente nunca repete o valor enviado nem cita flags", async () => {
      logadoComo(CUIDADOR, "familiar");
      fakeVinculos([vinculoCuidador()]);
      const { res, saidas } = await capturando(() => post(IDOSO_A, corpoSigiloso));
      expect(res.status).toBe(403);
      semSentinelas(visivel(res, saidas));
      expect(JSON.stringify(res.body)).not.toMatch(/modo_decisao|permite_|flag/i);
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
        cuidadorCom();
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

describe("POST /agenda (idoso): cuidador continua 403 (D1)", () => {
  it("403 em POST /agenda mesmo com vínculo e flag true", async () => {
    cuidadorCom();
    const res = await request(app).post("/agenda").set("Authorization", "Bearer x").send(BODY_OK_CUIDADO);
    expectNaoCriou(res, 403);
    expect(res.body).toEqual({ error: MSG_403 });
  });
});
