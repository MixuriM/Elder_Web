import request from "supertest";

// Fase 11 (11.3): PATCH e DELETE de compromisso, por /agenda/:id (idoso) e /agenda/idoso/:idosoId/:id (vínculo).
// Autoridade de editar e excluir = a de CRIAR (itens 6.1 e 6.2): idoso e familiar (tipo_vinculo E tipo_perfil 'familiar' E
// modo_decisao efetivo 'familiar', via resolver) só mexem em 'pessoal' e 'medico'; cuidador só em 'cuidado', com
// permite_criar_evento_cuidado === true e só no que ele mesmo criou, e o resolver nunca é chamado para ele. 404 (inexistente e
// de outro idoso, o mesmo corpo) vem antes do 403 de ator. Todos os ids e valores são FICTÍCIOS.

const verifyIdToken = jest.fn();
const findFirstUsuario = jest.fn();
const findUniqueUsuario = jest.fn();
const findFirstVinculo = jest.fn();
const countVinculo = jest.fn();
const findFirstEvento = jest.fn();
const updateEvento = jest.fn();
const deleteManyEvento = jest.fn();
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
    evento: {
      findFirst: (...args: unknown[]) => findFirstEvento(...args),
      update: (...args: unknown[]) => updateEvento(...args),
      deleteMany: (...args: unknown[]) => deleteManyEvento(...args),
    },
  },
}));
jest.mock("./vinculo", () => ({
  __esModule: true,
  ...jest.requireActual("./vinculo"),
  resolverModoDecisao: (...args: unknown[]) => resolverModoDecisaoMock(...args),
}));

import app from "../app";

type Perfil = "idoso" | "cuidador" | "familiar";

const IDOSO_A = 5;
const IDOSO_B = 6;
const CUIDADOR = 10;
const OUTRO_CUIDADOR = 11;
const FAMILIAR = 20;
const EV = 100;
const MSG_403_EDICAO = "Sem permissão para editar compromisso.";
const MSG_403_EXCLUSAO = "Sem permissão para excluir compromisso.";
const MSG_404 = { error: "Compromisso não encontrado." };

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

const vinculoCuidador = (over: Partial<VinculoFake> = {}) =>
  vinculo({ vinculado_id: CUIDADOR, tipo_vinculo: "cuidador", permite_criar_evento_cuidado: true, ...over });

function fakeVinculos(linhas: VinculoFake[]) {
  findFirstVinculo.mockImplementation(
    async ({ where }: { where: { idoso_id: number; vinculado_id: number; status: string } }) =>
      linhas.find(
        (v) => v.idoso_id === where.idoso_id && v.vinculado_id === where.vinculado_id && v.status === where.status,
      ) ?? null,
  );
}

const perfis: Record<number, Perfil> = {};

function fakeUsuarios() {
  findUniqueUsuario.mockImplementation(async ({ where }: { where: { id: number } }) =>
    perfis[where.id] ? { tipo_perfil: perfis[where.id] } : null,
  );
}

type EventoFake = {
  id: number;
  idoso_id: number;
  criado_por_id: number;
  tipo_evento: string;
  titulo: string;
  descricao: string | null;
  data_hora_inicio: Date;
  data_hora_fim: Date | null;
  editado_por_id: number | null;
  created_at: Date;
  updated_at: Date;
};

function evento(over: Partial<EventoFake> = {}): EventoFake {
  return {
    id: EV,
    idoso_id: IDOSO_A,
    criado_por_id: IDOSO_A,
    tipo_evento: "pessoal",
    titulo: "Titulo Ficticio Original",
    descricao: "Descricao Ficticia",
    data_hora_inicio: new Date("2026-10-10T12:00:00Z"),
    data_hora_fim: new Date("2026-10-10T13:00:00Z"),
    editado_por_id: null,
    created_at: new Date("2026-10-05T12:00:00Z"),
    updated_at: new Date("2026-10-05T12:00:00Z"),
    ...over,
  };
}

let eventos: EventoFake[] = [];
const casa = (e: EventoFake, where: Record<string, unknown>) =>
  Object.entries(where).every(([k, v]) => v === undefined || (e as Record<string, unknown>)[k] === v);

function fakeEventos(linhas: EventoFake[]) {
  eventos = linhas;
  findFirstEvento.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => eventos.find((e) => casa(e, where)) ?? null);
  updateEvento.mockImplementation(async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => {
    const i = eventos.findIndex((e) => e.id === where.id);
    eventos[i] = { ...eventos[i], ...data, updated_at: new Date("2026-10-11T12:00:00Z") } as EventoFake;
    return eventos[i];
  });
  deleteManyEvento.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
    const antes = eventos.length;
    eventos = eventos.filter((e) => !casa(e, where));
    return { count: antes - eventos.length };
  });
}

function logadoComo(id: number, perfil: Perfil) {
  perfis[id] = perfil;
  verifyIdToken.mockResolvedValue({ uid: `uid-${id}` });
  findFirstUsuario.mockResolvedValue({ id, firebase_uid: `uid-${id}` });
}

const auth = (r: request.Test) => r.set("Authorization", "Bearer x");
const patchIdoso = (id: number | string, body: unknown = { titulo: "Titulo Novo" }) =>
  auth(request(app).patch(`/agenda/${id}`)).send(body as object);
const patchOutro = (idoso: number | string, id: number | string, body: unknown = { titulo: "Titulo Novo" }) =>
  auth(request(app).patch(`/agenda/idoso/${idoso}/${id}`)).send(body as object);
const delIdoso = (id: number | string) => auth(request(app).delete(`/agenda/${id}`));
const delOutro = (idoso: number | string, id: number | string) => auth(request(app).delete(`/agenda/idoso/${idoso}/${id}`));

const dadosDoUpdate = () => updateEvento.mock.calls[0][0].data;
const tituloAtual = () => eventos.find((e) => e.id === EV)?.titulo;

function expectNaoEditou(res: request.Response, status: number) {
  expect(res.status).toBe(status);
  expect(updateEvento).not.toHaveBeenCalled();
  expect(tituloAtual()).toBe("Titulo Ficticio Original");
}

function expectNaoApagou(res: request.Response, status: number) {
  expect(res.status).toBe(status);
  expect(deleteManyEvento).not.toHaveBeenCalled();
  expect(eventos.some((e) => e.id === EV)).toBe(true);
}

beforeEach(() => {
  [verifyIdToken, findFirstUsuario, findUniqueUsuario, findFirstVinculo, countVinculo, findFirstEvento, updateEvento, deleteManyEvento, resolverModoDecisaoMock].forEach((m) => m.mockReset());
  Object.keys(perfis).forEach((k) => delete perfis[Number(k)]);
  fakeUsuarios();
  fakeVinculos([]);
  fakeEventos([evento()]);
  resolverModoDecisaoMock.mockResolvedValue("idoso");
});

describe("PATCH /agenda/:id, idoso edita o próprio compromisso", () => {
  beforeEach(() => logadoComo(IDOSO_A, "idoso"));

  it("200: aplica o corpo, editado_por_id do token, só os campos do evento, e devolve o serializado", async () => {
    const res = await patchIdoso(EV, { tipo_evento: "medico", titulo: "  Consulta Ficticia  ", data_hora_inicio: "2026-10-11T15:00:00Z", data_hora_fim: "2026-10-11T16:00:00Z" });
    expect(res.status).toBe(200);
    const { where, data } = updateEvento.mock.calls[0][0];
    expect(where).toEqual({ id: EV });
    expect(Object.keys(data).sort()).toEqual(["data_hora_fim", "data_hora_inicio", "descricao", "editado_por_id", "tipo_evento", "titulo"]);
    expect(data.editado_por_id).toBe(IDOSO_A);
    expect(res.body).toMatchObject({
      id: EV,
      idoso_id: IDOSO_A,
      criado_por_id: IDOSO_A,
      tipo_evento: "medico",
      titulo: "Consulta Ficticia",
      data_hora_inicio: "2026-10-11T15:00:00.000Z",
      editado_por_id: IDOSO_A,
    });
  });

  it("edição parcial: campo ausente mantém o valor atual", async () => {
    const res = await patchIdoso(EV, { titulo: "So o titulo" });
    expect(res.status).toBe(200);
    expect(dadosDoUpdate().tipo_evento).toBe("pessoal");
    expect(dadosDoUpdate().descricao).toBe("Descricao Ficticia");
    expect(dadosDoUpdate().data_hora_inicio.toISOString()).toBe("2026-10-10T12:00:00.000Z");
    expect(dadosDoUpdate().data_hora_fim.toISOString()).toBe("2026-10-10T13:00:00.000Z");
  });

  it("null explícito limpa descricao e data_hora_fim", async () => {
    const res = await patchIdoso(EV, { descricao: null, data_hora_fim: null });
    expect(res.status).toBe(200);
    expect(dadosDoUpdate().descricao).toBeNull();
    expect(dadosDoUpdate().data_hora_fim).toBeNull();
  });

  it.each([
    ["titulo", { titulo: null }, "titulo inválido."],
    ["data_hora_inicio", { data_hora_inicio: null }, "data_hora_inicio inválida."],
    ["tipo_evento", { tipo_evento: null }, "tipo_evento inválido."],
  ])("null explícito em %s (obrigatório) dá 400, não limpa", async (_campo, corpo, msg) => {
    const res = await patchIdoso(EV, corpo);
    expectNaoEditou(res, 400);
    expect(res.body).toEqual({ error: msg });
  });

  it("fim antes do início (já com o início antigo) dá 400", async () => {
    const res = await patchIdoso(EV, { data_hora_fim: "2026-10-10T11:00:00Z" });
    expectNaoEditou(res, 400);
    expect(res.body).toEqual({ error: "data_hora_fim inválida." });
  });

  it.each([["corpo vazio", {}], ["só campos forjados", { id: 1, idoso_id: IDOSO_B, criado_por_id: IDOSO_B }], ["array", []]])(
    "400 sem nenhum campo de compromisso (%s)",
    async (_rotulo, corpo) => {
      const res = await patchIdoso(EV, corpo);
      expectNaoEditou(res, 400);
      expect(res.body).toEqual({ error: "Nenhum campo de compromisso informado." });
    },
  );

  it("campos forjados junto de um válido são ignorados (idoso_id, criado_por_id e editado_por_id)", async () => {
    const res = await patchIdoso(EV, { titulo: "Novo", idoso_id: IDOSO_B, criado_por_id: IDOSO_B, editado_por_id: IDOSO_B });
    expect(res.status).toBe(200);
    expect(dadosDoUpdate()).not.toHaveProperty("idoso_id");
    expect(dadosDoUpdate()).not.toHaveProperty("criado_por_id");
    expect(dadosDoUpdate().editado_por_id).toBe(IDOSO_A);
  });

  it("tipo 'cuidado' pelo idoso dá 403 (ele não cria esse tipo)", async () => {
    const res = await patchIdoso(EV, { tipo_evento: "cuidado" });
    expectNaoEditou(res, 403);
    expect(res.body).toEqual({ error: MSG_403_EDICAO });
  });

  it("compromisso de cuidado (criado pelo cuidador) dá 403 ao idoso", async () => {
    fakeEventos([evento({ tipo_evento: "cuidado", criado_por_id: CUIDADOR })]);
    const res = await patchIdoso(EV);
    expectNaoEditou(res, 403);
    expect(res.body).toEqual({ error: MSG_403_EDICAO });
  });

  it("compromisso de cuidado: 403 vem antes da validação do corpo (corpo vazio não vira 400)", async () => {
    fakeEventos([evento({ tipo_evento: "cuidado", criado_por_id: CUIDADOR })]);
    const res = await patchIdoso(EV, {});
    expectNaoEditou(res, 403);
  });

  it("inexistente e de outro idoso dão o mesmo 404 e o mesmo corpo", async () => {
    fakeEventos([evento(), evento({ id: 101, idoso_id: IDOSO_B })]);
    const inexistente = await patchIdoso(999);
    const doOutro = await patchIdoso(101);
    expect(inexistente.status).toBe(404);
    expect(doOutro.status).toBe(404);
    expect(inexistente.body).toEqual(MSG_404);
    expect(doOutro.body).toEqual(MSG_404);
    expect(updateEvento).not.toHaveBeenCalled();
  });

  it.each(["abc", "0", "-3", "1.5", "1e3", "99999999999"])("id %s dá 400 sem consultar o banco", async (id) => {
    const res = await patchIdoso(id);
    expect(res.status).toBe(400);
    expect(findFirstEvento).not.toHaveBeenCalled();
  });

  it("erro do banco vira 500 genérico, sem o valor enviado", async () => {
    updateEvento.mockRejectedValue(new Error("TITULO SENSIVEL"));
    const res = await patchIdoso(EV, { titulo: "TITULO SENSIVEL" });
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("SENSIVEL");
  });
});

describe("DELETE /agenda/:id, idoso exclui o próprio compromisso", () => {
  beforeEach(() => logadoComo(IDOSO_A, "idoso"));

  it("204 sem corpo: apaga com idoso_id no where", async () => {
    const res = await delIdoso(EV);
    expect(res.status).toBe(204);
    expect(res.text).toBe("");
    expect(deleteManyEvento.mock.calls[0][0].where).toEqual({ id: EV, idoso_id: IDOSO_A });
    expect(eventos.some((e) => e.id === EV)).toBe(false);
  });

  it("compromisso de cuidado dá 403 ao idoso e não apaga", async () => {
    fakeEventos([evento({ tipo_evento: "cuidado", criado_por_id: CUIDADOR })]);
    const res = await delIdoso(EV);
    expectNaoApagou(res, 403);
    expect(res.body).toEqual({ error: MSG_403_EXCLUSAO });
  });

  it("inexistente e de outro idoso dão o mesmo 404; repetir o DELETE também dá 404", async () => {
    fakeEventos([evento(), evento({ id: 101, idoso_id: IDOSO_B })]);
    expect((await delIdoso(999)).body).toEqual(MSG_404);
    expect((await delIdoso(101)).status).toBe(404);
    expect(eventos.some((e) => e.id === 101)).toBe(true);
    expect((await delIdoso(EV)).status).toBe(204);
    expect((await delIdoso(EV)).status).toBe(404);
  });

  it("apagado entre a leitura e o delete (count 0): 404, não 500", async () => {
    deleteManyEvento.mockResolvedValue({ count: 0 });
    const res = await delIdoso(EV);
    expect(res.status).toBe(404);
    expect(res.body).toEqual(MSG_404);
  });

  it("id inválido dá 400 sem consultar o banco", async () => {
    const res = await delIdoso("abc");
    expect(res.status).toBe(400);
    expect(findFirstEvento).not.toHaveBeenCalled();
  });
});

describe("rota própria não alcança o compromisso do idoso para cuidador nem familiar", () => {
  it.each([
    ["cuidador", CUIDADOR],
    ["familiar", FAMILIAR],
  ] as const)("%s: PATCH e DELETE dão 404 e não escrevem", async (perfil, id) => {
    logadoComo(id, perfil);
    fakeVinculos([vinculoCuidador(), vinculo()]);
    resolverModoDecisaoMock.mockResolvedValue("familiar");
    const p = await patchIdoso(EV);
    const d = await delIdoso(EV);
    expect(p.status).toBe(404);
    expect(d.status).toBe(404);
    expect(updateEvento).not.toHaveBeenCalled();
    expect(deleteManyEvento).not.toHaveBeenCalled();
  });
});

describe("familiar em /agenda/idoso/:idosoId/:id", () => {
  beforeEach(() => {
    logadoComo(FAMILIAR, "familiar");
    fakeVinculos([vinculo()]);
  });

  it("modo_decisao 'familiar': edita e exclui 'pessoal' e 'medico'", async () => {
    resolverModoDecisaoMock.mockResolvedValue("familiar");
    const p = await patchOutro(IDOSO_A, EV);
    expect(p.status).toBe(200);
    expect(dadosDoUpdate().editado_por_id).toBe(FAMILIAR);
    fakeEventos([evento({ tipo_evento: "medico" })]);
    const d = await delOutro(IDOSO_A, EV);
    expect(d.status).toBe(204);
    expect(deleteManyEvento.mock.calls[0][0].where).toEqual({ id: EV, idoso_id: IDOSO_A });
  });

  it("modo_decisao 'idoso' (e NULL, que o resolver devolve como 'idoso'): 403 e não escreve", async () => {
    resolverModoDecisaoMock.mockResolvedValue("idoso");
    const p = await patchOutro(IDOSO_A, EV);
    const d = await delOutro(IDOSO_A, EV);
    expectNaoEditou(p, 403);
    expectNaoApagou(d, 403);
    expect(p.body).toEqual({ error: MSG_403_EDICAO });
    expect(d.body).toEqual({ error: MSG_403_EXCLUSAO });
  });

  it("compromisso de cuidado: 403 mesmo com modo 'familiar'", async () => {
    resolverModoDecisaoMock.mockResolvedValue("familiar");
    fakeEventos([evento({ tipo_evento: "cuidado", criado_por_id: CUIDADOR })]);
    expectNaoEditou(await patchOutro(IDOSO_A, EV), 403);
    expectNaoApagou(await delOutro(IDOSO_A, EV), 403);
  });

  it("tipo 'cuidado' no corpo: 403", async () => {
    resolverModoDecisaoMock.mockResolvedValue("familiar");
    expectNaoEditou(await patchOutro(IDOSO_A, EV, { tipo_evento: "cuidado" }), 403);
  });

  it("vínculo de familiar com tipo_perfil de cuidador: 403", async () => {
    logadoComo(FAMILIAR, "cuidador");
    resolverModoDecisaoMock.mockResolvedValue("familiar");
    expectNaoEditou(await patchOutro(IDOSO_A, EV), 403);
  });

  it("o 404 vem antes do 403: sem autoridade e compromisso inexistente, ainda 404", async () => {
    resolverModoDecisaoMock.mockResolvedValue("idoso");
    const res = await patchOutro(IDOSO_A, 999);
    expect(res.status).toBe(404);
    expect(res.body).toEqual(MSG_404);
    expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
  });

  it("compromisso de outro idoso dá 404 (o idoso vem do vínculo, nunca do caminho do registro)", async () => {
    resolverModoDecisaoMock.mockResolvedValue("familiar");
    fakeEventos([evento({ idoso_id: IDOSO_B })]);
    expect((await patchOutro(IDOSO_A, EV)).status).toBe(404);
    expect((await delOutro(IDOSO_A, EV)).status).toBe(404);
  });

  it("sem vínculo aprovado com o idoso: 403 do vínculo", async () => {
    fakeVinculos([]);
    expect((await patchOutro(IDOSO_A, EV)).status).toBe(403);
    expect((await delOutro(IDOSO_A, EV)).status).toBe(403);
    expect(findFirstEvento).not.toHaveBeenCalled();
  });
});

describe("cuidador em /agenda/idoso/:idosoId/:id", () => {
  const doCuidador = () => evento({ tipo_evento: "cuidado", criado_por_id: CUIDADOR });

  beforeEach(() => {
    logadoComo(CUIDADOR, "cuidador");
    fakeVinculos([vinculoCuidador()]);
    fakeEventos([doCuidador()]);
  });

  it("com a flag, edita e exclui o compromisso de cuidado que ele criou; o resolver nunca é chamado", async () => {
    const p = await patchOutro(IDOSO_A, EV);
    expect(p.status).toBe(200);
    expect(dadosDoUpdate().tipo_evento).toBe("cuidado");
    expect(dadosDoUpdate().editado_por_id).toBe(CUIDADOR);
    const d = await delOutro(IDOSO_A, EV);
    expect(d.status).toBe(204);
    expect(resolverModoDecisaoMock).not.toHaveBeenCalled();
  });

  it.each([
    ["permite_registrar_saude"],
    ["permite_marcar_dose"],
  ] as const)("só %s true (sem a flag de compromisso): 403 e não escreve", async (flag) => {
    fakeVinculos([vinculoCuidador({ permite_criar_evento_cuidado: false, [flag]: true })]);
    const p = await patchOutro(IDOSO_A, EV);
    const d = await delOutro(IDOSO_A, EV);
    expect(p.status).toBe(403);
    expect(d.status).toBe(403);
    expect(updateEvento).not.toHaveBeenCalled();
    expect(deleteManyEvento).not.toHaveBeenCalled();
  });

  it("sem a flag, corpo inválido continua 403 (a autorização vem antes da validação)", async () => {
    fakeVinculos([vinculoCuidador({ permite_criar_evento_cuidado: false })]);
    expect((await patchOutro(IDOSO_A, EV, { lixo: true })).status).toBe(403);
  });

  it("compromisso de cuidado criado por outro cuidador: 403", async () => {
    fakeEventos([evento({ tipo_evento: "cuidado", criado_por_id: OUTRO_CUIDADOR })]);
    expectNaoEditou(await patchOutro(IDOSO_A, EV), 403);
    expectNaoApagou(await delOutro(IDOSO_A, EV), 403);
  });

  it("compromisso 'pessoal' ou 'medico' do idoso: 403", async () => {
    fakeEventos([evento({ tipo_evento: "pessoal", criado_por_id: CUIDADOR })]);
    expectNaoEditou(await patchOutro(IDOSO_A, EV), 403);
    expectNaoApagou(await delOutro(IDOSO_A, EV), 403);
  });

  it("tentar trocar o tipo para 'pessoal': 403", async () => {
    const res = await patchOutro(IDOSO_A, EV, { tipo_evento: "pessoal" });
    expect(res.status).toBe(403);
    expect(updateEvento).not.toHaveBeenCalled();
  });

  it("vínculo de cuidador com tipo_perfil de familiar: 403", async () => {
    logadoComo(CUIDADOR, "familiar");
    expectNaoEditou(await patchOutro(IDOSO_A, EV), 403);
  });

  it("o 404 vem antes do 403: inexistente dá 404 mesmo sem a flag", async () => {
    fakeVinculos([vinculoCuidador({ permite_criar_evento_cuidado: false })]);
    expect((await patchOutro(IDOSO_A, 999)).status).toBe(404);
    expect((await delOutro(IDOSO_A, 999)).status).toBe(404);
  });
});

describe("privacidade (RNF-001): título de compromisso médico nunca vai a log nem a erro", () => {
  it("nenhum console.* e nenhum corpo de erro com o título, em 404, 403 e 400", async () => {
    const espioes = (["log", "info", "warn", "error", "debug"] as const).map((m) => jest.spyOn(console, m).mockImplementation(() => undefined));
    try {
      logadoComo(IDOSO_A, "idoso");
      const respostas = [
        await patchIdoso(999, { titulo: "TITULO SENSIVEL" }),
        await patchIdoso(EV, { titulo: "TITULO SENSIVEL", data_hora_fim: "2026-10-10T11:00:00Z" }),
      ];
      fakeEventos([evento({ tipo_evento: "cuidado", criado_por_id: CUIDADOR })]);
      respostas.push(await patchIdoso(EV, { titulo: "TITULO SENSIVEL" }));
      expect(JSON.stringify(respostas.map((r) => r.body))).not.toContain("SENSIVEL");
      expect(JSON.stringify(espioes.flatMap((s) => s.mock.calls))).not.toContain("SENSIVEL");
    } finally {
      espioes.forEach((s) => s.mockRestore());
    }
  });
});
