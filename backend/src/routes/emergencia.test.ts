import request from "supertest";

// Fake de Prisma em memória que FILTRA pelo where (igualdade e { in }), para "só vínculo aprovado do próprio idoso"
// ser decidido pela rota, não por retorno fixo. fetch sempre mockado: nenhum e-mail sai de verdade.
// Todos os ids, nomes, uids, e-mails e a chave são FICTÍCIOS, só para teste.
type Linha = Record<string, unknown>;
let usuarios: Linha[];
let vinculos: Linha[];

function casa(l: Linha, where: Linha = {}) {
  return Object.entries(where).every(([campo, valor]) => {
    if (valor === undefined) return true;
    if (valor && typeof valor === "object" && Array.isArray((valor as { in?: unknown[] }).in)) {
      return (valor as { in: unknown[] }).in.includes(l[campo]);
    }
    if (valor && typeof valor === "object") throw new Error(`filtro não suportado em ${campo}`);
    return l[campo] === valor;
  });
}

const verifyIdToken = jest.fn();
const getUsers = jest.fn();
jest.mock("../lib/firebaseAdmin", () => ({
  auth: {
    verifyIdToken: (...a: unknown[]) => verifyIdToken(...a),
    getUsers: (...a: unknown[]) => getUsers(...a),
  },
}));
jest.mock("../lib/prisma", () => ({
  prisma: {
    usuario: {
      findFirst: async ({ where }: { where: Linha }) => usuarios.find((u) => casa(u, where)) ?? null,
      findUnique: async ({ where }: { where: Linha }) => usuarios.find((u) => casa(u, where)) ?? null,
      findMany: async ({ where }: { where: Linha }) => usuarios.filter((u) => casa(u, where)),
    },
    vinculo: {
      findMany: async ({ where }: { where: Linha }) => vinculos.filter((v) => casa(v, where)),
    },
  },
}));

import app from "../app";

const IDOSO = 1;
const OUTRO_IDOSO = 2;
const CUIDADOR = 10;
const FAMILIAR = 20;
const FAMILIAR_2 = 21;
const PENDENTE = 30;
const RECUSADO = 31;
const CONTESTADO = 32;
const SEM_EMAIL = 33;
const DE_OUTRO_IDOSO = 34;

const email = (id: number) => `pessoa${id}@exemplo.test`;
const usuario = (id: number, tipo_perfil: string, extra: Linha = {}): Linha => ({
  id,
  firebase_uid: `uid-${id}`,
  nome: `Pessoa ${id}`,
  email: email(id),
  tipo_perfil,
  ...extra,
});
const vinculo = (vinculado_id: number, tipo_vinculo: string, status = "aprovado", extra: Linha = {}): Linha => ({
  idoso_id: IDOSO,
  vinculado_id,
  tipo_vinculo,
  status,
  origem: tipo_vinculo === "cuidador" ? "solicitacao_cuidador" : "convite_idoso",
  ...extra,
});

const ENV_ORIGINAL = { ...process.env };
const MINUTO = 60_000;
// Cada teste começa 10 h depois do anterior: o limite em memória de um teste nunca vaza para o próximo.
let agora = Date.parse("2026-10-09T15:30:00Z");
let fetchMock: jest.SpyInstance;
let logs: jest.SpyInstance[];

beforeEach(() => {
  agora += 10 * 60 * MINUTO;
  jest.spyOn(Date, "now").mockImplementation(() => agora);
  process.env.EMAIL_API_KEY = "chave-fake-de-teste";
  process.env.EMAIL_REMETENTE_ENDERECO = "avisos@exemplo.test";
  verifyIdToken.mockReset().mockImplementation(async (t: string) => ({ uid: `uid-${t.slice(1)}` }));
  // Firebase: cada Usuario fake tem uma conta com o mesmo e-mail; verificado salvo se marcado como não verificado.
  getUsers.mockReset().mockImplementation(async (ids: { uid: string }[]) => ({
    users: ids.flatMap(({ uid }) => {
      const u = usuarios.find((x) => x.firebase_uid === uid);
      return u ? [{ uid, email: u.emailFirebase ?? u.email, emailVerified: u.verificado !== false }] : [];
    }),
    notFound: [],
  }));
  fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 201 }));
  logs = (["log", "info", "warn", "error"] as const).map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
  usuarios = [
    usuario(IDOSO, "idoso", { nome: "Maria Teste" }),
    usuario(OUTRO_IDOSO, "idoso"),
    usuario(CUIDADOR, "cuidador"),
    usuario(FAMILIAR, "familiar"),
    usuario(FAMILIAR_2, "familiar"),
    usuario(PENDENTE, "cuidador"),
    usuario(RECUSADO, "familiar"),
    usuario(CONTESTADO, "familiar"),
    usuario(SEM_EMAIL, "cuidador", { email: null }),
    usuario(DE_OUTRO_IDOSO, "familiar"),
  ];
  vinculos = [];
});

afterEach(() => {
  jest.restoreAllMocks();
  process.env = { ...ENV_ORIGINAL };
});

const avisar = (id = IDOSO) => request(app).post("/emergencia/avisar").set("Authorization", `Bearer t${id}`);
const destinatarios = () =>
  fetchMock.mock.calls.map(([, init]) => (JSON.parse((init as RequestInit).body as string).to as { email: string }[]));
const textoLogs = () => JSON.stringify(logs.flatMap((s) => s.mock.calls));

describe("POST /emergencia/avisar: quem pode", () => {
  it("sem token: 401 e nenhum envio", async () => {
    const res = await request(app).post("/emergencia/avisar");
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["cuidador", CUIDADOR],
    ["familiar", FAMILIAR],
  ])("%s recebe 403 e nada é enviado, mesmo vinculado ao idoso", async (_p, id) => {
    vinculos = [vinculo(CUIDADOR, "cuidador"), vinculo(FAMILIAR, "familiar")];
    const res = await avisar(id);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Só o idoso pode pedir ajuda por aqui." });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("POST /emergencia/avisar: destinatários", () => {
  it("0 vínculos: 200 com mensagem fixa e nenhum envio", async () => {
    const res = await avisar();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ avisados: 0, falharam: 0, nao_confirmados: 0, mensagem: "Nenhuma pessoa vinculada para avisar." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("1 vínculo aprovado: 1 e-mail, só para essa pessoa", async () => {
    vinculos = [vinculo(FAMILIAR, "familiar")];
    const res = await avisar();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ avisados: 1, falharam: 0, nao_confirmados: 0, mensagem: "Aviso enviado." });
    expect(destinatarios()).toEqual([[{ email: email(FAMILIAR) }]]);
  });

  it("vários: só aprovados com e-mail do próprio idoso; pendente, recusado e contestado ficam de fora", async () => {
    vinculos = [
      vinculo(CUIDADOR, "cuidador"),
      vinculo(FAMILIAR, "familiar"),
      vinculo(FAMILIAR_2, "familiar", "aprovado", { origem: "solicitacao_familiar" }),
      vinculo(PENDENTE, "cuidador", "pendente"),
      vinculo(RECUSADO, "familiar", "recusado", { origem: "solicitacao_familiar" }),
      // Contestar um vínculo automático o grava como 'recusado' (POST /vinculo/:id/contestar).
      vinculo(CONTESTADO, "familiar", "recusado", { origem: "convite_idoso" }),
      vinculo(SEM_EMAIL, "cuidador"),
      vinculo(DE_OUTRO_IDOSO, "familiar", "aprovado", { idoso_id: OUTRO_IDOSO }),
    ];
    const res = await avisar();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ avisados: 3, falharam: 0, nao_confirmados: 0, mensagem: "Aviso enviado." });
    // Um e-mail por pessoa: ninguém vê o endereço de outra.
    expect(destinatarios().sort()).toEqual(
      [[{ email: email(CUIDADOR) }], [{ email: email(FAMILIAR) }], [{ email: email(FAMILIAR_2) }]].sort(),
    );
  });

  it("e-mail traz nome do idoso, horário de São Paulo e a orientação do 192, sem endereço de ninguém", async () => {
    // Horário conhecido (13:10 UTC = 10:10 em São Paulo), depois de todos os anteriores: o relógio só avança.
    agora = Date.parse("2026-11-20T13:10:00Z");
    vinculos = [vinculo(FAMILIAR, "familiar")];
    await avisar();
    const corpo = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(corpo.subject).toBe("Maria Teste pediu ajuda pelo Elder Web");
    expect(corpo.textContent).toContain("Maria Teste pediu ajuda pelo Elder Web em 20/11/2026 às 10:10");
    expect(corpo.textContent).toContain("Ligue para ele(a) agora. Se não conseguir contato, ligue 192.");
    expect(corpo.textContent).not.toContain("@");
  });

  it("quebra de linha no nome não chega ao assunto", async () => {
    usuarios[0].nome = "Maria\r\nBcc: x";
    vinculos = [vinculo(FAMILIAR, "familiar")];
    await avisar();
    const corpo = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(corpo.subject).not.toMatch(/[\r\n]/);
  });
});

describe("POST /emergencia/avisar: falhas", () => {
  it("sem chave configurada: 503 com mensagem fixa e nenhum envio", async () => {
    delete process.env.EMAIL_API_KEY;
    vinculos = [vinculo(FAMILIAR, "familiar")];
    const res = await avisar();
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: "Não foi possível avisar agora. Ligue 192." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falha total do provedor: 502 com contagem", async () => {
    vinculos = [vinculo(CUIDADOR, "cuidador"), vinculo(FAMILIAR, "familiar")];
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    const res = await avisar();
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ avisados: 0, falharam: 2, nao_confirmados: 0, error: "Não foi possível avisar. Ligue 192." });
  });

  it("falha parcial: 200 com quantos foram avisados e quantos falharam", async () => {
    vinculos = [vinculo(CUIDADOR, "cuidador"), vinculo(FAMILIAR, "familiar")];
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockRejectedValueOnce(new TypeError("fetch failed"));
    const res = await avisar();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ avisados: 1, falharam: 1, nao_confirmados: 0, mensagem: "Aviso enviado." });
  });

  it("resposta e log nunca têm e-mail nem o texto do aviso; o log tem id, contagens e código", async () => {
    vinculos = [vinculo(CUIDADOR, "cuidador"), vinculo(FAMILIAR, "familiar")];
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: email(FAMILIAR) }), { status: 400 }));
    const res = await avisar();
    expect(JSON.stringify(res.body)).not.toContain("@");
    const log = textoLogs();
    expect(log).not.toContain("@");
    expect(log).not.toContain("Maria Teste");
    expect(log).not.toContain("chave-fake-de-teste");
    expect(log).toContain(`"idosoId":${IDOSO}`);
    expect(log).toContain('"avisados":1');
    expect(log).toContain('"falharam":1');
    expect(log).toContain("HTTP_400");
  });
});

describe("POST /emergencia/avisar: limite de uso (em memória)", () => {
  beforeEach(() => {
    vinculos = [vinculo(FAMILIAR, "familiar")];
  });

  it("no máximo 1 aviso a cada 2 minutos", async () => {
    expect((await avisar()).status).toBe(200);
    agora += MINUTO;
    const bloqueado = await avisar();
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.body).toEqual({ error: "Você pediu ajuda há pouco. Se for urgente, ligue 192." });
    expect(Number(bloqueado.headers["retry-after"])).toBe(60);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    agora += MINUTO;
    expect((await avisar()).status).toBe(200);
  });

  it("no máximo 5 avisos por hora", async () => {
    const inicio = agora;
    for (let i = 0; i < 5; i++) {
      expect((await avisar()).status).toBe(200);
      agora += 3 * MINUTO;
    }
    expect((await avisar()).status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    agora = inicio + 60 * MINUTO;
    expect((await avisar()).status).toBe(200);
  });

  it("o limite é por idoso: outro idoso não é afetado", async () => {
    vinculos.push(vinculo(DE_OUTRO_IDOSO, "familiar", "aprovado", { idoso_id: OUTRO_IDOSO }));
    expect((await avisar()).status).toBe(200);
    expect((await avisar(OUTRO_IDOSO)).status).toBe(200);
  });

  it("dois pedidos ao mesmo tempo: só um envia (o envio em curso bloqueia o segundo)", async () => {
    // Provedor lento: o segundo pedido chega enquanto o primeiro ainda está enviando.
    fetchMock.mockImplementation(
      () => new Promise((ok) => setTimeout(() => ok(new Response(null, { status: 201 })), 200)),
    );
    const [a, b] = await Promise.all([avisar(), avisar()]);
    expect([a.status, b.status].sort()).toEqual([200, 429]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sem vínculo ou sem chave não gasta o limite", async () => {
    vinculos = [];
    await avisar();
    delete process.env.EMAIL_API_KEY;
    vinculos = [vinculo(FAMILIAR, "familiar")];
    await avisar();
    process.env.EMAIL_API_KEY = "chave-fake-de-teste";
    expect((await avisar()).status).toBe(200);
  });
});

describe("POST /emergencia/avisar: só e-mail verificado recebe", () => {
  it("uma chamada só ao Firebase, com os uids dos vinculados", async () => {
    vinculos = [vinculo(CUIDADOR, "cuidador"), vinculo(FAMILIAR, "familiar")];
    await avisar();
    expect(getUsers).toHaveBeenCalledTimes(1);
    expect(getUsers.mock.calls[0][0]).toEqual(
      expect.arrayContaining([{ uid: `uid-${CUIDADOR}` }, { uid: `uid-${FAMILIAR}` }]),
    );
  });

  it("e-mail não verificado não recebe e entra em nao_confirmados", async () => {
    usuarios.find((u) => u.id === FAMILIAR)!.verificado = false;
    vinculos = [vinculo(CUIDADOR, "cuidador"), vinculo(FAMILIAR, "familiar")];
    const res = await avisar();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ avisados: 1, falharam: 0, nao_confirmados: 1, mensagem: "Aviso enviado." });
    expect(destinatarios()).toEqual([[{ email: email(CUIDADOR) }]]);
  });

  it("conta Firebase com outro e-mail (trocado depois do cadastro) não conta como verificada", async () => {
    usuarios.find((u) => u.id === FAMILIAR)!.emailFirebase = "outro@exemplo.test";
    vinculos = [vinculo(FAMILIAR, "familiar")];
    const res = await avisar();
    expect(res.body.nao_confirmados).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ninguém verificado: 200 sem envio, com a contagem, e não gasta o limite", async () => {
    usuarios.forEach((u) => (u.verificado = false));
    vinculos = [vinculo(CUIDADOR, "cuidador"), vinculo(FAMILIAR, "familiar")];
    const res = await avisar();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      avisados: 0,
      falharam: 0,
      nao_confirmados: 2,
      mensagem: "Ninguém com e-mail confirmado para avisar.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    usuarios.forEach((u) => (u.verificado = true));
    expect((await avisar()).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("Firebase falha: falha fechada, 503 fixo, ninguém recebe e o log não tem e-mail", async () => {
    getUsers.mockRejectedValue(Object.assign(new Error(`falhou ${email(FAMILIAR)}`), { code: "app/network-error" }));
    vinculos = [vinculo(FAMILIAR, "familiar")];
    const res = await avisar();
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: "Não foi possível avisar agora. Ligue 192." });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(textoLogs()).not.toContain("@");
    expect(textoLogs()).toContain("VERIFICACAO_EMAIL");
  });
});

describe("POST /emergencia/avisar: espera de 2 minutos só depois de um envio com sucesso", () => {
  beforeEach(() => {
    vinculos = [vinculo(FAMILIAR, "familiar")];
  });

  it("depois de falha total, pode tentar de novo na hora", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    expect((await avisar()).status).toBe(502);
    expect((await avisar()).status).toBe(200);
  });

  it("o teto de 5 por hora conta toda tentativa, inclusive as que falharam", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    for (let i = 0; i < 5; i++) expect((await avisar()).status).toBe(502);
    expect((await avisar()).status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});
