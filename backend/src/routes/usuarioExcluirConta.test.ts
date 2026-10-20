import request from "supertest";

// Exclusão de conta (item 9.5, LGPD art. 18): DELETE /usuario/me. Apaga os dados do idoso, anonimiza a linha de Usuario
// (a autoria sobre outros idosos fica, sem o nome) e apaga o login no Firebase, tudo numa transação. O Prisma é um fake
// COM ESTADO (testSupport/prismaFakeExclusao): filtra pelo where, grava e desfaz a transação de verdade. Ele não prova
// ordem de FK nem CHECK do SQL Server; isso é papel de scripts/verify-exclusao-conta.ts. Ids, uids, e-mails e valores
// abaixo são FICTÍCIOS, só para teste.

const mockVerifyIdToken = jest.fn();
const mockDeleteUser = jest.fn();
jest.mock("../lib/firebaseAdmin", () => ({
  auth: {
    verifyIdToken: (...args: unknown[]) => mockVerifyIdToken(...args),
    deleteUser: (...args: unknown[]) => mockDeleteUser(...args),
  },
}));
jest.mock("../lib/prisma", () => ({
  prisma: jest.requireActual("../testSupport/prismaFakeExclusao").prismaComEstado,
}));

import app from "../app";
import { dados, zerarDados, type Linha } from "../testSupport/prismaFakeAutorizacao";
import { falhas, opcoesTransacao, ordem, zerarEstadoFake } from "../testSupport/prismaFakeExclusao";

const IDOSO = 5;
const OUTRO_IDOSO = 6;
const IDOSO_SEM_LOGIN = 7;
const CUIDADOR = 10;
const OUTRO_CUIDADOR = 11;
const FAMILIAR = 20;
const OUTRO_FAMILIAR = 21;

const T0_S = 1_800_000_000;
const MSG_REAUTENTICAR = {
  error: "Por segurança, confirme sua identidade de novo para excluir a conta.",
  codigo: "reautenticar",
};
const MSG_502 = { error: "Não foi possível excluir a conta agora. Nada foi apagado. Tente de novo em alguns minutos." };
const CONFIRMA = { confirmacao: "EXCLUIR" };
const DATA = new Date("2026-10-01T12:00:00Z");

// Token "t<id>" = login recente (10 s); sufixos: :limite (300 s), :vencido (301 s), :ausente, :texto.
function claimsDe(token: string) {
  const [base, variante] = token.split(":");
  const uid = base.startsWith("demo-") ? base : `uid-${base.slice(1)}`;
  const claims: Record<string, unknown> = { uid, email_verified: true, auth_time: T0_S - 10 };
  if (variante === "limite") claims.auth_time = T0_S - 300;
  if (variante === "vencido") claims.auth_time = T0_S - 301;
  if (variante === "ausente") delete claims.auth_time;
  if (variante === "texto") claims.auth_time = "agora";
  return claims;
}

function usuario(id: number, tipo_perfil: string, extra: Linha = {}): Linha {
  return {
    id,
    firebase_uid: `uid-${id}`,
    nome: `Pessoa Ficticia ${id}`,
    email: `ficticio${id}@teste.invalid`,
    telefone: "11900000000",
    tipo_perfil,
    email_convite_familiar: null,
    cadastrado_por_id: null,
    termo_responsabilidade_aceito_em: null,
    modo_decisao: null,
    ultimo_login_em: DATA,
    modo_decisao_solicitado: null,
    modo_decisao_solicitado_por_id: null,
    modo_decisao_solicitado_em: null,
    modo_decisao_expira_em: null,
    modo_decisao_segunda_confirmacao_id: null,
    modo_decisao_alterado_por_id: null,
    modo_decisao_alterado_em: null,
    modo_decisao_motivo: null,
    foto_perfil: null,
    foto_perfil_mime_type: null,
    foto_perfil_atualizada_em: null,
    aceite_documentos_em: DATA,
    aceite_documentos_versao: "1.1",
    consentimento_saude_em: DATA,
    created_at: DATA,
    updated_at: DATA,
    ...extra,
  };
}

const vinculo = (id: number, idoso_id: number, vinculado_id: number, tipo_vinculo: string, extra: Linha = {}): Linha => ({
  id,
  idoso_id,
  vinculado_id,
  tipo_vinculo,
  origem: tipo_vinculo === "cuidador" ? "solicitacao_cuidador" : "solicitacao_familiar",
  status: "aprovado",
  aprovador_id: idoso_id,
  definido_por_id: null,
  ...extra,
});

// Mundo base: idoso 5 com histórico completo; idoso 6 (de outro) com registros escritos pelo cuidador 10.
function montarMundo() {
  dados.usuario = [
    usuario(IDOSO, "idoso", {
      cadastrado_por_id: FAMILIAR,
      termo_responsabilidade_aceito_em: DATA,
      email_convite_familiar: "convite@teste.invalid",
      foto_perfil: Buffer.from("foto-ficticia"),
      foto_perfil_mime_type: "image/webp",
      foto_perfil_atualizada_em: DATA,
      modo_decisao: "idoso",
      modo_decisao_solicitado: "familiar",
      modo_decisao_solicitado_por_id: FAMILIAR,
      modo_decisao_solicitado_em: DATA,
      modo_decisao_expira_em: DATA,
      modo_decisao_segunda_confirmacao_id: OUTRO_FAMILIAR,
      modo_decisao_alterado_por_id: FAMILIAR,
      modo_decisao_alterado_em: DATA,
      modo_decisao_motivo: "motivo ficticio",
    }),
    usuario(OUTRO_IDOSO, "idoso", { modo_decisao: "idoso" }),
    usuario(CUIDADOR, "cuidador"),
    usuario(OUTRO_CUIDADOR, "cuidador"),
    usuario(FAMILIAR, "familiar"),
    usuario(OUTRO_FAMILIAR, "familiar"),
  ];
  dados.vinculo = [
    vinculo(1, IDOSO, CUIDADOR, "cuidador"),
    vinculo(2, IDOSO, FAMILIAR, "familiar"),
    vinculo(3, OUTRO_IDOSO, CUIDADOR, "cuidador", { definido_por_id: CUIDADOR }),
    vinculo(4, OUTRO_IDOSO, OUTRO_FAMILIAR, "familiar", { aprovador_id: CUIDADOR, definido_por_id: CUIDADOR }),
  ];
  dados.medicamento = [
    { id: 1, idoso_id: IDOSO, criado_por_id: IDOSO, editado_por_id: CUIDADOR, nome: "Remedio Ficticio 1" },
    { id: 2, idoso_id: OUTRO_IDOSO, criado_por_id: CUIDADOR, editado_por_id: CUIDADOR, nome: "Remedio Ficticio 2" },
  ];
  dados.registroDoseMedicamento = [
    { id: 1, medicamento_id: 1, registrado_por_id: CUIDADOR },
    { id: 2, medicamento_id: 2, registrado_por_id: CUIDADOR },
  ];
  dados.registroSaude = [
    { id: 1, idoso_id: IDOSO, registrado_por_id: CUIDADOR, editado_por_id: CUIDADOR, valor_1: 120 },
    { id: 2, idoso_id: OUTRO_IDOSO, registrado_por_id: CUIDADOR, editado_por_id: CUIDADOR, valor_1: 121 },
  ];
  dados.registroAlimentar = [
    { id: 1, idoso_id: IDOSO, registrado_por_id: CUIDADOR, editado_por_id: null, descricao: "refeicao ficticia 1" },
    { id: 2, idoso_id: OUTRO_IDOSO, registrado_por_id: CUIDADOR, editado_por_id: CUIDADOR, descricao: "refeicao ficticia 2" },
  ];
  dados.evento = [
    { id: 1, idoso_id: IDOSO, criado_por_id: FAMILIAR, editado_por_id: null, titulo: "Evento Ficticio 1" },
    { id: 2, idoso_id: OUTRO_IDOSO, criado_por_id: CUIDADOR, editado_por_id: CUIDADOR, titulo: "Evento Ficticio 2" },
  ];
}

// Idoso sem login (RF-030), cadastrado pelo familiar 20, com dado e vínculo do cadastrante.
function acrescentarIdosoSemLogin(extra: Linha = {}) {
  (dados.usuario as Linha[]).push(
    usuario(IDOSO_SEM_LOGIN, "idoso", {
      firebase_uid: null,
      cadastrado_por_id: FAMILIAR,
      termo_responsabilidade_aceito_em: DATA,
      email: "ficticio7@teste.invalid",
      ...extra,
    }),
  );
  (dados.vinculo as Linha[]).push(vinculo(5, IDOSO_SEM_LOGIN, FAMILIAR, "familiar", { origem: "cadastro_familiar" }));
  (dados.medicamento as Linha[]).push({ id: 3, idoso_id: IDOSO_SEM_LOGIN, criado_por_id: FAMILIAR, editado_por_id: null });
  (dados.registroSaude as Linha[]).push({ id: 3, idoso_id: IDOSO_SEM_LOGIN, registrado_por_id: FAMILIAR, editado_por_id: FAMILIAR });
}

const ids = (tabela: string) => (dados[tabela] as Linha[]).map((l) => l.id).sort();
const usuarioDe = (id: number) => (dados.usuario as Linha[]).find((u) => u.id === id) as Linha;

// As CHECKs de Usuario que a anonimização não pode violar (migrations lidas em 2026-10-20).
function respeitaChecks(u: Linha): boolean {
  const nulo = (v: unknown) => v === null || v === undefined;
  const todosOuNenhum = (...v: unknown[]) => v.every(nulo) || v.every((x) => !nulo(x));
  return (
    (!nulo(u.email) || !nulo(u.telefone)) &&
    (!nulo(u.firebase_uid) || !nulo(u.cadastrado_por_id)) &&
    todosOuNenhum(u.foto_perfil, u.foto_perfil_mime_type, u.foto_perfil_atualizada_em) &&
    todosOuNenhum(u.aceite_documentos_em, u.aceite_documentos_versao, u.consentimento_saude_em) &&
    (nulo(u.termo_responsabilidade_aceito_em) || !nulo(u.cadastrado_por_id)) &&
    (nulo(u.email_convite_familiar) || u.tipo_perfil === "idoso") &&
    (nulo(u.modo_decisao) || ["idoso", "familiar"].includes(u.modo_decisao as string)) &&
    (nulo(u.modo_decisao_solicitado) || u.modo_decisao_solicitado === "familiar") &&
    todosOuNenhum(u.modo_decisao_solicitado, u.modo_decisao_solicitado_por_id, u.modo_decisao_solicitado_em, u.modo_decisao_expira_em)
  );
}

// corpo null = requisição sem corpo (undefined cairia no valor padrão).
function excluir(token: string, corpo: object | null = CONFIRMA) {
  const r = request(app).delete("/usuario/me").set("Authorization", `Bearer ${token}`);
  return corpo === null ? r : r.send(corpo);
}

let consoleEspiado: jest.SpyInstance[];

beforeEach(() => {
  zerarDados();
  zerarEstadoFake();
  mockVerifyIdToken.mockReset().mockImplementation(async (token: string) => claimsDe(token));
  mockDeleteUser.mockReset().mockImplementation(async () => {
    ordem.push("firebase.deleteUser");
  });
  jest.spyOn(Date, "now").mockReturnValue(T0_S * 1000);
  consoleEspiado = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
    jest.spyOn(console, m).mockImplementation(() => undefined),
  );
  montarMundo();
});

afterEach(() => {
  jest.restoreAllMocks();
});

const semConsole = () => consoleEspiado.forEach((e) => expect(e).not.toHaveBeenCalled());

describe("DELETE /usuario/me: confirmação e login recente", () => {
  it.each([
    ["sem corpo", null],
    ["corpo vazio", {}],
    ["minúsculas", { confirmacao: "excluir" }],
    ["com espaço", { confirmacao: "EXCLUIR " }],
    ["lista", { confirmacao: ["EXCLUIR"] }],
    ["objeto", { confirmacao: { valueOf: "EXCLUIR" } }],
    ["booleano", { confirmacao: true }],
    ["campo com outro nome", { confirma: "EXCLUIR" }],
  ])("confirmação inválida (%s): 400 e nada é escrito", async (_nome, corpo) => {
    const antes = structuredClone(dados);
    const res = await excluir(`t${IDOSO}`, corpo as object | null);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Confirmação inválida." });
    expect(dados).toEqual(antes);
    expect(mockDeleteUser).not.toHaveBeenCalled();
    expect(ordem).toEqual([]);
  });

  it("login recente de 10 s: 204 sem corpo", async () => {
    const res = await excluir(`t${CUIDADOR}`);
    expect(res.status).toBe(204);
    expect(res.text).toBe("");
  });

  it("login de exatamente 300 s ainda vale (limite inclusivo)", async () => {
    expect((await excluir(`t${CUIDADOR}:limite`)).status).toBe(204);
  });

  it.each([
    ["301 s (vencido)", `t${CUIDADOR}:vencido`],
    ["auth_time ausente", `t${CUIDADOR}:ausente`],
    ["auth_time não numérico", `t${CUIDADOR}:texto`],
  ])("%s: 401 reautenticar e nada é escrito nem apagado no Firebase", async (_nome, token) => {
    const antes = structuredClone(dados);
    const res = await excluir(token);
    expect(res.status).toBe(401);
    expect(res.body).toEqual(MSG_REAUTENTICAR);
    expect(dados).toEqual(antes);
    expect(mockDeleteUser).not.toHaveBeenCalled();
    expect(ordem).toEqual([]);
  });

  it("confirmação inválida vence o login vencido (400, não 401)", async () => {
    const res = await excluir(`t${CUIDADOR}:vencido`, {});
    expect(res.status).toBe(400);
  });
});

describe("DELETE /usuario/me: conta de demonstração e alvo", () => {
  it("conta do elenco recebe 403 e nada acontece", async () => {
    (dados.usuario as Linha[]).push(usuario(30, "idoso", { firebase_uid: "demo-idosa-helena" }));
    const antes = structuredClone(dados);
    const res = await excluir("demo-idosa-helena");
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Ação indisponível no modo demonstração." });
    expect(dados).toEqual(antes);
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("o alvo é sempre quem autenticou: id de terceiro em path, query, corpo e cabeçalho é ignorado", async () => {
    const outroAntes = structuredClone(usuarioDe(OUTRO_IDOSO));
    const res = await request(app)
      .delete(`/usuario/me?id=${OUTRO_IDOSO}&idoso_id=${OUTRO_IDOSO}&usuarioId=${OUTRO_IDOSO}`)
      .set("Authorization", `Bearer t${IDOSO}`)
      .set("X-Usuario-Id", String(OUTRO_IDOSO))
      .send({ ...CONFIRMA, id: OUTRO_IDOSO, idoso_id: OUTRO_IDOSO, usuarioId: OUTRO_IDOSO, firebase_uid: `uid-${OUTRO_IDOSO}` });
    expect(res.status).toBe(204);
    expect(mockDeleteUser).toHaveBeenCalledTimes(1);
    expect(mockDeleteUser).toHaveBeenCalledWith(`uid-${IDOSO}`);
    expect(usuarioDe(OUTRO_IDOSO)).toEqual(outroAntes);
    expect(usuarioDe(IDOSO).email).toBe(`excluido-${IDOSO}@excluido.invalid`);
    expect(ids("medicamento")).toEqual([2]);
  });

  it("não há rota de exclusão com id no caminho", async () => {
    const res = await request(app).delete(`/usuario/${OUTRO_IDOSO}`).set("Authorization", `Bearer t${IDOSO}`).send(CONFIRMA);
    expect(res.status).toBe(404);
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });
});

describe("DELETE /usuario/me: o que se apaga (idoso)", () => {
  it.each([
    ["registroDoseMedicamento", [2]],
    ["medicamento", [2]],
    ["registroSaude", [2]],
    ["registroAlimentar", [2]],
    ["evento", [2]],
  ])("apaga %s do idoso e preserva o dos outros", async (tabela, restam) => {
    expect((await excluir(`t${IDOSO}`)).status).toBe(204);
    expect(ids(tabela)).toEqual(restam);
  });

  it("apaga todos os vínculos em que ele é o idoso e preserva os de outros idosos", async () => {
    await excluir(`t${IDOSO}`);
    expect(ids("vinculo")).toEqual([3, 4]);
  });

  it("apaga as doses antes dos medicamentos (a FK da dose aponta para o medicamento)", async () => {
    await excluir(`t${IDOSO}`);
    const i = (chave: string) => ordem.indexOf(chave);
    expect(i("registroDoseMedicamento.deleteMany")).toBeGreaterThanOrEqual(0);
    expect(i("registroDoseMedicamento.deleteMany")).toBeLessThan(i("medicamento.deleteMany"));
  });

  it("chama o Firebase por último, com o uid exato, depois de todas as escritas", async () => {
    await excluir(`t${IDOSO}`);
    expect(mockDeleteUser).toHaveBeenCalledTimes(1);
    expect(mockDeleteUser).toHaveBeenCalledWith(`uid-${IDOSO}`);
    expect(ordem.length).toBeGreaterThan(1);
    expect(ordem[ordem.length - 1]).toBe("firebase.deleteUser");
    expect(ordem.filter((o) => o === "firebase.deleteUser")).toHaveLength(1);
  });

  it("roda numa transação com timeout de 20 s e espera de 5 s", async () => {
    await excluir(`t${IDOSO}`);
    expect(opcoesTransacao.ultima).toMatchObject({ timeout: 20000, maxWait: 5000 });
  });

  // Auditoria de segurança (2026-10-20): duas exclusões simultâneas (ou uma aprovação de vínculo em paralelo) não podem
  // deixar um idoso sem login órfão nem apagar um que acabou de ganhar vínculo; no SQL Server padrão a leitura não bloqueia.
  it("a transação é Serializable (leituras de vínculo seguram o intervalo até o commit)", async () => {
    await excluir(`t${IDOSO}`);
    expect(opcoesTransacao.ultima).toMatchObject({ isolationLevel: "Serializable" });
  });
});

// Fechamento do 9.5 (F1, F2): a linha anonimizada que a rota grava é reconhecida por quem recusa o token antigo. Sem esta
// ligação, mudar o marcador de um lado só deixaria o ID Token de antes da exclusão valendo por até 1 h.
describe("DELETE /usuario/me: token emitido antes da exclusão", () => {
  it("depois de excluir, o mesmo token leva 401 em rota autenticada e no /auth/sync, sem escrita nova", async () => {
    expect((await excluir(`t${IDOSO}`)).status).toBe(204);
    const antes = structuredClone(dados);

    const leitura = await request(app).get("/usuario/me").set("Authorization", `Bearer t${IDOSO}`);
    const sync = await request(app).post("/auth/sync").set("Authorization", `Bearer t${IDOSO}`).send({});

    expect(leitura.status).toBe(401);
    expect(sync.status).toBe(401);
    expect(sync.body).toEqual(leitura.body);
    expect(dados).toEqual(antes);
    expect(usuarioDe(IDOSO).ultimo_login_em).toBeNull();
  });
});

describe("DELETE /usuario/me: o que se preserva (autoria sobre outro idoso)", () => {
  it("cuidador excluído: nada que ele escreveu sobre outro idoso é apagado nem editado; só os vínculos dele saem", async () => {
    const antes = structuredClone({
      medicamento: dados.medicamento,
      dose: dados.registroDoseMedicamento,
      saude: dados.registroSaude,
      alimentar: dados.registroAlimentar,
      evento: dados.evento,
    });
    expect((await excluir(`t${CUIDADOR}`)).status).toBe(204);
    expect({
      medicamento: dados.medicamento,
      dose: dados.registroDoseMedicamento,
      saude: dados.registroSaude,
      alimentar: dados.registroAlimentar,
      evento: dados.evento,
    }).toEqual(antes);
    expect(ids("vinculo")).toEqual([2, 4]);
    // aprovador_id e definido_por_id seguem apontando para a linha anonimizada.
    expect((dados.vinculo as Linha[]).find((v) => v.id === 4)).toMatchObject({ aprovador_id: CUIDADOR, definido_por_id: CUIDADOR });
  });

  it("familiar excluído: os eventos que ele criou para o idoso ficam, e o vínculo dele sai", async () => {
    await excluir(`t${FAMILIAR}`);
    expect((dados.evento as Linha[]).find((e) => e.id === 1)).toMatchObject({ criado_por_id: FAMILIAR });
    expect(ids("vinculo")).toEqual([1, 3, 4]);
  });
});

describe("DELETE /usuario/me: anonimização da linha de Usuario", () => {
  const ESPERADO_APAGADO: [string, unknown][] = [
    ["nome", "Conta excluída"],
    ["email", `excluido-${IDOSO}@excluido.invalid`],
    ["telefone", null],
    ["email_convite_familiar", null],
    ["ultimo_login_em", null],
    ["foto_perfil", null],
    ["foto_perfil_mime_type", null],
    ["foto_perfil_atualizada_em", null],
    ["termo_responsabilidade_aceito_em", null],
    ["modo_decisao", null],
    ["modo_decisao_solicitado", null],
    ["modo_decisao_solicitado_por_id", null],
    ["modo_decisao_solicitado_em", null],
    ["modo_decisao_expira_em", null],
    ["modo_decisao_segunda_confirmacao_id", null],
    ["modo_decisao_alterado_por_id", null],
    ["modo_decisao_alterado_em", null],
    ["modo_decisao_motivo", null],
  ];

  it.each(ESPERADO_APAGADO)("campo %s vira %j", async (campo, valor) => {
    await excluir(`t${IDOSO}`);
    expect(usuarioDe(IDOSO)[campo]).toEqual(valor);
  });

  it.each(["firebase_uid", "tipo_perfil", "created_at", "cadastrado_por_id", "aceite_documentos_em", "aceite_documentos_versao", "consentimento_saude_em"])(
    "campo %s é preservado (prova de consentimento sem identidade)",
    async (campo) => {
      const antes = usuarioDe(IDOSO)[campo];
      await excluir(`t${IDOSO}`);
      expect(usuarioDe(IDOSO)[campo]).toEqual(antes);
    },
  );

  it("a linha não é apagada e nenhuma CHECK de Usuario é violada, em nenhuma linha", async () => {
    await excluir(`t${IDOSO}`);
    expect(usuarioDe(IDOSO)).toBeDefined();
    for (const u of dados.usuario as Linha[]) expect(respeitaChecks(u)).toBe(true);
  });

  it("e-mail anonimizado é único por id", async () => {
    await excluir(`t${CUIDADOR}`);
    await excluir(`t${FAMILIAR}`);
    expect(usuarioDe(CUIDADOR).email).toBe(`excluido-${CUIDADOR}@excluido.invalid`);
    expect(usuarioDe(FAMILIAR).email).toBe(`excluido-${FAMILIAR}@excluido.invalid`);
  });

  it("os outros usuários não são tocados", async () => {
    const antes = structuredClone([usuarioDe(OUTRO_IDOSO), usuarioDe(OUTRO_CUIDADOR), usuarioDe(OUTRO_FAMILIAR)]);
    await excluir(`t${IDOSO}`);
    expect([usuarioDe(OUTRO_IDOSO), usuarioDe(OUTRO_CUIDADOR), usuarioDe(OUTRO_FAMILIAR)]).toEqual(antes);
  });
});

describe("DELETE /usuario/me: idoso sem login cadastrado pelo familiar (D4 e)", () => {
  it("sem nenhum outro vínculo aprovado: dados apagados e linha anonimizada", async () => {
    acrescentarIdosoSemLogin();
    expect((await excluir(`t${FAMILIAR}`)).status).toBe(204);
    expect(ids("medicamento")).toEqual([1, 2]);
    expect(ids("registroSaude")).toEqual([1, 2]);
    expect(ids("vinculo")).toEqual([1, 3, 4]);
    expect(usuarioDe(IDOSO_SEM_LOGIN)).toMatchObject({
      nome: "Conta excluída",
      email: `excluido-${IDOSO_SEM_LOGIN}@excluido.invalid`,
      telefone: null,
      termo_responsabilidade_aceito_em: null,
      firebase_uid: null,
      cadastrado_por_id: FAMILIAR,
    });
    for (const u of dados.usuario as Linha[]) expect(respeitaChecks(u)).toBe(true);
    expect(mockDeleteUser).toHaveBeenCalledTimes(1);
    expect(mockDeleteUser).toHaveBeenCalledWith(`uid-${FAMILIAR}`);
  });

  it("outro vínculo pendente ou recusado não conta: o idoso sem ninguém com acesso é apagado", async () => {
    acrescentarIdosoSemLogin();
    (dados.vinculo as Linha[]).push(
      vinculo(6, IDOSO_SEM_LOGIN, CUIDADOR, "cuidador", { status: "pendente" }),
      vinculo(7, IDOSO_SEM_LOGIN, OUTRO_CUIDADOR, "cuidador", { status: "recusado" }),
    );
    await excluir(`t${FAMILIAR}`);
    expect(usuarioDe(IDOSO_SEM_LOGIN).nome).toBe("Conta excluída");
    expect(ids("medicamento")).toEqual([1, 2]);
  });

  it("com outro vínculo aprovado (cuidador): o idoso fica intacto e só o vínculo do cadastrante sai", async () => {
    acrescentarIdosoSemLogin();
    (dados.vinculo as Linha[]).push(vinculo(6, IDOSO_SEM_LOGIN, CUIDADOR, "cuidador"));
    const antes = structuredClone(usuarioDe(IDOSO_SEM_LOGIN));
    await excluir(`t${FAMILIAR}`);
    expect(usuarioDe(IDOSO_SEM_LOGIN)).toEqual(antes);
    expect(ids("medicamento")).toEqual([1, 2, 3]);
    expect(ids("registroSaude")).toEqual([1, 2, 3]);
    expect(ids("vinculo")).toContain(6);
    expect(ids("vinculo")).not.toContain(5);
  });

  it("idoso sem login cadastrado por OUTRO familiar não é tocado", async () => {
    acrescentarIdosoSemLogin({ cadastrado_por_id: OUTRO_FAMILIAR });
    (dados.vinculo as Linha[]).find((v) => v.id === 5)!.vinculado_id = OUTRO_FAMILIAR;
    const antes = structuredClone(usuarioDe(IDOSO_SEM_LOGIN));
    await excluir(`t${FAMILIAR}`);
    expect(usuarioDe(IDOSO_SEM_LOGIN)).toEqual(antes);
    expect(ids("medicamento")).toEqual([1, 2, 3]);
  });

  it("idoso com login cadastrado pelo familiar nunca é apagado (só o vínculo do cadastrante sai)", async () => {
    await excluir(`t${FAMILIAR}`);
    expect(usuarioDe(IDOSO).nome).toBe("Pessoa Ficticia 5");
    expect(ids("medicamento")).toEqual([1, 2]);
  });
});

describe("DELETE /usuario/me: modo_decisao de quem perde o último familiar (D4 e, f)", () => {
  const SEM_SOLICITACAO = {
    modo_decisao_solicitado: null,
    modo_decisao_solicitado_por_id: null,
    modo_decisao_solicitado_em: null,
    modo_decisao_expira_em: null,
    modo_decisao_segunda_confirmacao_id: null,
    modo_decisao_motivo: null,
  };

  function idosoDecididoPorFamiliar(extra: Linha = {}) {
    Object.assign(usuarioDe(OUTRO_IDOSO), { modo_decisao: "familiar", ...extra });
  }

  it("idoso com login: o último familiar aprovado sai, volta para 'idoso'", async () => {
    idosoDecididoPorFamiliar();
    (dados.vinculo as Linha[]).splice(3, 1); // tira o vínculo 4 (OUTRO_FAMILIAR); sobra só quem vai sair
    (dados.vinculo as Linha[]).push(vinculo(8, OUTRO_IDOSO, FAMILIAR, "familiar"));
    await excluir(`t${FAMILIAR}`);
    expect(usuarioDe(OUTRO_IDOSO)).toMatchObject({ modo_decisao: "idoso", ...SEM_SOLICITACAO });
  });

  it("sobrou outro familiar aprovado: continua 'familiar'", async () => {
    idosoDecididoPorFamiliar();
    (dados.vinculo as Linha[]).push(vinculo(8, OUTRO_IDOSO, FAMILIAR, "familiar"));
    await excluir(`t${FAMILIAR}`);
    expect(usuarioDe(OUTRO_IDOSO).modo_decisao).toBe("familiar");
  });

  it("familiar pendente ou recusado não conta como familiar restante", async () => {
    idosoDecididoPorFamiliar();
    (dados.vinculo as Linha[]).find((v) => v.id === 4)!.status = "pendente";
    (dados.vinculo as Linha[]).push(vinculo(8, OUTRO_IDOSO, FAMILIAR, "familiar"));
    await excluir(`t${FAMILIAR}`);
    expect(usuarioDe(OUTRO_IDOSO).modo_decisao).toBe("idoso");
  });

  it("idoso sem login que fica (outro vínculo aprovado) mas sem familiar: volta para 'idoso' e limpa a solicitação", async () => {
    acrescentarIdosoSemLogin({
      modo_decisao: "familiar",
      modo_decisao_solicitado: "familiar",
      modo_decisao_solicitado_por_id: FAMILIAR,
      modo_decisao_solicitado_em: DATA,
      modo_decisao_expira_em: DATA,
      modo_decisao_motivo: "motivo ficticio",
    });
    (dados.vinculo as Linha[]).push(vinculo(6, IDOSO_SEM_LOGIN, CUIDADOR, "cuidador"));
    await excluir(`t${FAMILIAR}`);
    expect(usuarioDe(IDOSO_SEM_LOGIN)).toMatchObject({ modo_decisao: "idoso", ...SEM_SOLICITACAO, nome: "Pessoa Ficticia 7" });
    for (const u of dados.usuario as Linha[]) expect(respeitaChecks(u)).toBe(true);
  });

  it("idoso em modo 'idoso' que perde o familiar não é reescrito", async () => {
    usuarioDe(OUTRO_IDOSO).modo_decisao = "idoso";
    (dados.vinculo as Linha[]).push(vinculo(8, OUTRO_IDOSO, FAMILIAR, "familiar"));
    const antes = structuredClone(usuarioDe(OUTRO_IDOSO));
    await excluir(`t${FAMILIAR}`);
    expect(usuarioDe(OUTRO_IDOSO)).toEqual(antes);
  });

  it("transferência pendente iniciada pelo excluído em outro idoso é cancelada (o iniciador deixa de existir)", async () => {
    Object.assign(usuarioDe(OUTRO_IDOSO), {
      modo_decisao: "idoso",
      modo_decisao_solicitado: "familiar",
      modo_decisao_solicitado_por_id: FAMILIAR,
      modo_decisao_solicitado_em: DATA,
      modo_decisao_expira_em: DATA,
      modo_decisao_motivo: "motivo ficticio",
    });
    await excluir(`t${FAMILIAR}`);
    expect(usuarioDe(OUTRO_IDOSO)).toMatchObject({ modo_decisao: "idoso", ...SEM_SOLICITACAO });
    for (const u of dados.usuario as Linha[]) expect(respeitaChecks(u)).toBe(true);
  });

  it("transferência pendente confirmada (segunda confirmação) pelo excluído também é cancelada", async () => {
    Object.assign(usuarioDe(OUTRO_IDOSO), {
      modo_decisao: "idoso",
      modo_decisao_solicitado: "familiar",
      modo_decisao_solicitado_por_id: OUTRO_FAMILIAR,
      modo_decisao_solicitado_em: DATA,
      modo_decisao_expira_em: DATA,
      modo_decisao_segunda_confirmacao_id: FAMILIAR,
    });
    await excluir(`t${FAMILIAR}`);
    expect(usuarioDe(OUTRO_IDOSO)).toMatchObject({ modo_decisao: "idoso", ...SEM_SOLICITACAO });
  });
});

describe("DELETE /usuario/me: falhas desfazem tudo", () => {
  it("Firebase falha: 502 fixo, banco igual ao de antes e sem eco do erro", async () => {
    mockDeleteUser.mockImplementation(async () => {
      ordem.push("firebase.deleteUser");
      throw Object.assign(new Error("segredo-ficticio-do-firebase"), { code: "auth/internal-error" });
    });
    const antes = structuredClone(dados);
    const res = await excluir(`t${IDOSO}`);
    expect(res.status).toBe(502);
    expect(res.body).toEqual(MSG_502);
    expect(res.text).not.toContain("segredo-ficticio");
    expect(dados).toEqual(antes);
    // As escritas aconteceram antes do Firebase (D5) e foram desfeitas pela transação.
    expect(ordem.length).toBeGreaterThan(1);
    expect(ordem[ordem.length - 1]).toBe("firebase.deleteUser");
    semConsole();
  });

  it("uid inexistente no Firebase (auth/user-not-found) também desfaz: 502", async () => {
    mockDeleteUser.mockRejectedValue(Object.assign(new Error("x"), { code: "auth/user-not-found" }));
    const antes = structuredClone(dados);
    expect((await excluir(`t${IDOSO}`)).status).toBe(502);
    expect(dados).toEqual(antes);
  });

  it("banco falha no meio: 500 genérico, nada apagado no Firebase e banco igual ao de antes", async () => {
    falhas.add("registroSaude.deleteMany");
    const antes = structuredClone(dados);
    const res = await excluir(`t${IDOSO}`);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Erro interno." });
    expect(mockDeleteUser).not.toHaveBeenCalled();
    expect(dados).toEqual(antes);
  });

  it("sucesso e 502 não escrevem em console (dado de saúde e de terceiros nunca vão para log)", async () => {
    await excluir(`t${IDOSO}`);
    semConsole();
  });
});
