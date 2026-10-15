import request from "supertest";

// D4c (2026-10-14): nas ações sobre um vínculo, quem não tem autoridade recebe sempre o mesmo 404 de "não encontrado",
// exista o vínculo ou não, resolvido ou não, de qualquer tipo. Só quem tem autoridade vê 400 de tipo e 409 de estado.
// Exceção: o idoso dono do vínculo sem autoridade (decisão com a família) segue recebendo 403, como manda o CLAUDE.md
// (ele já sabe que o vínculo existe). Em todo caso negativo nenhuma escrita chega ao Prisma.
// O fake filtra de verdade pelo where. Ids, uids e e-mails FICTÍCIOS, só para teste.

jest.mock("../lib/firebaseAdmin", () => ({
  auth: {
    verifyIdToken: (...args: unknown[]) =>
      jest.requireActual("../testSupport/prismaFakeAutorizacao").verifyIdToken(...args),
  },
}));
jest.mock("../lib/prisma", () => ({
  prisma: jest.requireActual("../testSupport/prismaFakeAutorizacao").prismaFake,
}));

import app from "../app";
import { dados, escritasChamadas, limparChamadas, tokenDe, zerarDados } from "../testSupport/prismaFakeAutorizacao";

const IDOSO = 5; // dono dos vínculos
const OUTRO_IDOSO = 6;
const CUIDADOR = 10; // vinculado nos vínculos de cuidador
const OUTRO_CUIDADOR = 11;
const FAMILIAR = 20; // familiar aprovado do IDOSO
const OUTRO_FAMILIAR = 21; // sem vínculo nenhum
const INEXISTENTE = 999;

const NAO_ENCONTRADO = { error: "Vínculo não encontrado." };

const V_CUIDADOR_PENDENTE = 1;
const V_CUIDADOR_RECUSADO = 2;
const V_CUIDADOR_APROVADO = 3;
const V_FAMILIAR_AUTOMATICO = 4; // familiar, convite_idoso, aprovado
const V_FAMILIAR_RECUSADO = 5; // familiar, convite_idoso, recusado
const V_FAMILIAR_PENDENTE = 6; // do FAMILIAR, solicitacao_familiar, pendente
const V_CONVITE_RESOLVIDO = 7; // cuidador, convite_idoso, recusado

function preparar(modo: "idoso" | "familiar") {
  zerarDados();
  const usuario = (id: number, tipo_perfil: string, extra: Record<string, unknown> = {}) => ({
    id,
    firebase_uid: `uid-${id}`,
    tipo_perfil,
    nome: `Ficticio ${id}`,
    email: `ficticio${id}@teste.invalid`,
    ...extra,
  });
  dados.usuario = [
    usuario(IDOSO, "idoso", { modo_decisao: modo, modo_decisao_solicitado: null }),
    usuario(OUTRO_IDOSO, "idoso", { modo_decisao: "idoso", modo_decisao_solicitado: null }),
    usuario(CUIDADOR, "cuidador"),
    usuario(OUTRO_CUIDADOR, "cuidador"),
    usuario(FAMILIAR, "familiar"),
    usuario(OUTRO_FAMILIAR, "familiar"),
  ];
  const v = (id: number, tipo_vinculo: string, origem: string, status: string, vinculado_id: number) => ({
    id,
    idoso_id: IDOSO,
    vinculado_id,
    tipo_vinculo,
    origem,
    status,
    data_solicitacao: new Date(),
  });
  dados.vinculo = [
    v(V_CUIDADOR_PENDENTE, "cuidador", "solicitacao_cuidador", "pendente", CUIDADOR),
    v(V_CUIDADOR_RECUSADO, "cuidador", "solicitacao_cuidador", "recusado", OUTRO_CUIDADOR),
    v(V_CUIDADOR_APROVADO, "cuidador", "solicitacao_cuidador", "aprovado", CUIDADOR),
    v(V_FAMILIAR_AUTOMATICO, "familiar", "convite_idoso", "aprovado", FAMILIAR),
    v(V_FAMILIAR_RECUSADO, "familiar", "convite_idoso", "recusado", OUTRO_FAMILIAR),
    v(V_FAMILIAR_PENDENTE, "familiar", "solicitacao_familiar", "pendente", OUTRO_FAMILIAR),
    v(V_CONVITE_RESOLVIDO, "cuidador", "convite_idoso", "recusado", CUIDADOR),
  ];
  limparChamadas();
}

type Metodo = "post" | "patch";
function acao(metodo: Metodo, id: number, caminho: string, quem: number, corpo: object = {}) {
  return request(app)[metodo](`/vinculo/${id}/${caminho}`).set("Authorization", `Bearer ${tokenDe(quem)}`).send(corpo);
}

const PERMISSOES = { permite_marcar_dose: true };

// Rotas que seguem modo_decisao: [método, caminho, corpo].
const POR_AUTORIDADE: [Metodo, string, object][] = [
  ["post", "aprovar", {}],
  ["post", "recusar", {}],
  ["post", "contestar", {}],
  ["patch", "definir-permissoes", PERMISSOES],
];

describe.each(POR_AUTORIDADE)("%s /vinculo/:id/%s, decisão com o idoso", (metodo, caminho, corpo) => {
  beforeEach(() => preparar("idoso"));

  const todos = [V_CUIDADOR_PENDENTE, V_CUIDADOR_RECUSADO, V_CUIDADOR_APROVADO, V_FAMILIAR_AUTOMATICO, V_FAMILIAR_RECUSADO, V_FAMILIAR_PENDENTE, INEXISTENTE];
  const semAutoridade = [OUTRO_IDOSO, CUIDADOR, OUTRO_CUIDADOR, FAMILIAR, OUTRO_FAMILIAR];

  it.each(semAutoridade.flatMap((quem) => todos.map((id) => [quem, id])))(
    "sem autoridade (usuário %i, vínculo %i): 404 igual, sem escrita",
    async (quem, id) => {
      const res = await acao(metodo, id, caminho, quem, corpo);
      expect(res.status).toBe(404);
      expect(res.body).toEqual(NAO_ENCONTRADO);
      expect(escritasChamadas()).toEqual([]);
    },
  );
});

describe("com autoridade, o estado e o tipo aparecem", () => {
  it("idoso: aprovar ou recusar vínculo já resolvido dá 409", async () => {
    preparar("idoso");
    for (const caminho of ["aprovar", "recusar"]) {
      expect((await acao("post", V_CUIDADOR_RECUSADO, caminho, IDOSO)).status).toBe(409);
    }
  });

  it("idoso: contestar vínculo de cuidador dá 400 e contestar familiar recusado dá 409", async () => {
    preparar("idoso");
    expect((await acao("post", V_CUIDADOR_APROVADO, "contestar", IDOSO)).status).toBe(400);
    expect((await acao("post", V_FAMILIAR_RECUSADO, "contestar", IDOSO)).status).toBe(409);
  });

  it("idoso: permissões em vínculo de familiar dá 400 e em cuidador pendente dá 409", async () => {
    preparar("idoso");
    expect((await acao("patch", V_FAMILIAR_AUTOMATICO, "definir-permissoes", IDOSO, PERMISSOES)).status).toBe(400);
    expect((await acao("patch", V_CUIDADOR_PENDENTE, "definir-permissoes", IDOSO, PERMISSOES)).status).toBe(409);
  });

  it("familiar titular (decisão com a família): aprovar vínculo resolvido dá 409", async () => {
    preparar("familiar");
    expect((await acao("post", V_CUIDADOR_RECUSADO, "aprovar", FAMILIAR)).status).toBe(409);
  });
});

describe("idoso dono sem autoridade (decisão com a família) segue com 403", () => {
  beforeEach(() => preparar("familiar"));

  it.each(POR_AUTORIDADE)("%s %s em vínculo resolvido ou de outro tipo: 403, nunca 409 nem 400", async (metodo, caminho, corpo) => {
    for (const id of [V_CUIDADOR_RECUSADO, V_CUIDADOR_APROVADO, V_FAMILIAR_RECUSADO]) {
      const res = await acao(metodo, id, caminho, IDOSO, corpo);
      expect(res.status).toBe(403);
    }
    expect(escritasChamadas()).toEqual([]);
  });

  it("terceiro segue com 404 mesmo com a decisão com a família", async () => {
    const res = await acao("post", V_CUIDADOR_RECUSADO, "aprovar", OUTRO_FAMILIAR);
    expect(res.status).toBe(404);
    expect(res.body).toEqual(NAO_ENCONTRADO);
  });
});

// Transferência de decisão: a autoridade é ser o dono do vínculo de familiar usado no pedido.
describe.each(["solicitar-transferencia-decisao", "confirmar-transferencia-decisao"])("POST /vinculo/:id/%s", (caminho) => {
  beforeEach(() => preparar("idoso"));

  const todos = [V_CUIDADOR_PENDENTE, V_CUIDADOR_RECUSADO, V_FAMILIAR_AUTOMATICO, V_FAMILIAR_RECUSADO, V_FAMILIAR_PENDENTE, INEXISTENTE];

  it.each([OUTRO_IDOSO, OUTRO_CUIDADOR, OUTRO_FAMILIAR].flatMap((quem) => todos.map((id) => [quem, id])))(
    "quem não é dono do vínculo (usuário %i, vínculo %i): 404 igual, sem escrita",
    async (quem, id) => {
      // Quem é o vinculado do próprio vínculo é dono e cai nos casos de baixo.
      if ((dados.vinculo ?? []).some((v) => v.id === id && v.vinculado_id === quem)) return;
      const res = await acao("post", id, caminho, quem);
      expect(res.status).toBe(404);
      expect(res.body).toEqual(NAO_ENCONTRADO);
      expect(escritasChamadas()).toEqual([]);
    },
  );

  it("o FAMILIAR em vínculo de cuidador (de outra pessoa) recebe 404, não 400", async () => {
    const res = await acao("post", V_CUIDADOR_APROVADO, caminho, FAMILIAR);
    expect(res.status).toBe(404);
    expect(res.body).toEqual(NAO_ENCONTRADO);
  });

  it("dono do vínculo vê o estado: pendente dá 409", async () => {
    expect((await acao("post", V_FAMILIAR_PENDENTE, caminho, OUTRO_FAMILIAR)).status).toBe(409);
  });

  it("dono de vínculo de cuidador vê o tipo: 400", async () => {
    expect((await acao("post", V_CUIDADOR_APROVADO, caminho, CUIDADOR)).status).toBe(400);
  });

  it("idoso dono do vínculo: 403, nunca 409 nem 400", async () => {
    for (const id of [V_FAMILIAR_AUTOMATICO, V_FAMILIAR_PENDENTE, V_CUIDADOR_APROVADO]) {
      expect((await acao("post", id, caminho, IDOSO)).status).toBe(403);
    }
  });
});

// Já estavam na ordem certa (dono antes do 409): só acesso cruzado.
describe.each(["aceitar-convite", "recusar-convite"])("POST /vinculo/:id/%s", (caminho) => {
  beforeEach(() => preparar("idoso"));

  it.each([OUTRO_CUIDADOR, OUTRO_IDOSO, IDOSO, FAMILIAR])("quem não é o convidado (%i) recebe 404 mesmo com convite resolvido", async (quem) => {
    const res = await acao("post", V_CONVITE_RESOLVIDO, caminho, quem);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Convite não encontrado." });
    expect(escritasChamadas()).toEqual([]);
  });

  it("o convidado vê o 409 de convite já respondido", async () => {
    expect((await acao("post", V_CONVITE_RESOLVIDO, caminho, CUIDADOR)).status).toBe(409);
  });
});

// Achado da auditoria (2026-10-14): o idoso cancela o próprio convite pelo /recusar; a resposta não pode trazer
// vinculado_id (o id da conta convidada que o GET /vinculo esconde, D4b). Aprovar e recusar devolvem só id e status.
describe("aprovar e recusar devolvem só id e status", () => {
  beforeEach(() => preparar("idoso"));

  it("idoso recusa (cancela) convite pendente: corpo sem vinculado_id", async () => {
    dados.vinculo?.push({
      id: 8,
      idoso_id: IDOSO,
      vinculado_id: OUTRO_CUIDADOR,
      tipo_vinculo: "cuidador",
      origem: "convite_idoso",
      status: "pendente",
      data_solicitacao: new Date(),
    });
    const res = await acao("post", 8, "recusar", IDOSO);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 8, status: "recusado" });
  });

  it("idoso aprova pedido pendente do cuidador: só id e status", async () => {
    const res = await acao("post", V_CUIDADOR_PENDENTE, "aprovar", IDOSO);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: V_CUIDADOR_PENDENTE, status: "aprovado" });
  });
});
