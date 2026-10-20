import request from "supertest";

// Modo demonstração: as contas do elenco são contas reais do sistema, então um admin (ou quem roubar a sessão dele)
// poderia usá-las para pedir vínculo a um idoso REAL ou cadastrar um idoso com o e-mail de outra pessoa e, depois de
// aprovado, ler dado de saúde real. Duas barreiras, provadas aqui: (1) conta do elenco recebe 403 nas rotas que criam
// vínculo ou conta; (2) requireVinculoAprovado nega conta do elenco sobre idoso fora do elenco, mesmo com vínculo
// aprovado no banco. Fake de Prisma que filtra pelo where. Todos os ids, uids e valores são FICTÍCIOS.
jest.mock("../lib/firebaseAdmin", () => ({
  auth: {
    // O "token" é o próprio uid; os casos especiais do fake de autorização não são usados aqui.
    verifyIdToken: async (t: string) => ({ uid: t, email_verified: true }),
  },
}));
jest.mock("../lib/prisma", () => ({
  prisma: jest.requireActual("../testSupport/prismaFakeAutorizacao").prismaFake,
}));

import app from "../app";
import { requireAuth, requireAuthRevogacao } from "./requireAuth";
import { bloquearContaDemo } from "./bloquearContaDemo";
import { enumerarRotas } from "../testSupport/rotasApp";
import { dados, escritasChamadas, leituras, limparChamadas, zerarDados, type Linha } from "../testSupport/prismaFakeAutorizacao";

const REAL_IDOSO = 5;
const REAL_CUIDADOR = 7;
const HELENA = 6;
const MARTA = 10;
const PAULO = 11;
const CARLOS = 12;

const usuario = (id: number, firebase_uid: string, tipo_perfil: string): Linha => ({
  id,
  firebase_uid,
  tipo_perfil,
  nome: "Pessoa Ficticia",
  email: `${firebase_uid}@exemplo.test`,
  modo_decisao: tipo_perfil === "idoso" ? "idoso" : null,
});
const aprovado = (id: number, idoso_id: number, vinculado_id: number, tipo_vinculo: string): Linha => ({
  id,
  idoso_id,
  vinculado_id,
  tipo_vinculo,
  origem: "solicitacao_cuidador",
  status: "aprovado",
  permite_registrar_saude: true,
  permite_marcar_dose: true,
  permite_criar_evento_cuidado: true,
});

beforeEach(() => {
  zerarDados();
  limparChamadas();
  dados.usuario = [
    usuario(REAL_IDOSO, "uid-real-idoso", "idoso"),
    usuario(REAL_CUIDADOR, "uid-real-cuidador", "cuidador"),
    usuario(HELENA, "demo-idosa-helena", "idoso"),
    usuario(MARTA, "demo-cuidadora-marta", "cuidador"),
    usuario(PAULO, "demo-cuidador-paulo", "cuidador"),
    usuario(CARLOS, "demo-familiar-carlos", "familiar"),
  ];
  // Vínculo aprovado de Marta com o idoso REAL (só chegaria aqui por um furo): mesmo assim nada pode passar.
  dados.vinculo = [aprovado(1, HELENA, MARTA, "cuidador"), aprovado(2, REAL_IDOSO, MARTA, "cuidador"), aprovado(3, REAL_IDOSO, REAL_CUIDADOR, "cuidador")];
  dados.registroSaude = [];
});

const como = (uid: string) => ({ Authorization: `Bearer ${uid}` });

const BLOQUEADAS = [
  "POST /vinculo/solicitar-cuidador",
  "POST /vinculo/solicitar-familiar",
  "POST /vinculo/convidar-familiar",
  "POST /vinculo/convidar-cuidador",
  "POST /vinculo/:id/aceitar-convite",
  "POST /usuario/cadastrar-idoso",
  "DELETE /usuario/me",
];

describe("conta do elenco não cria vínculo nem conta", () => {
  const rotas = enumerarRotas(app);

  it("bloquearContaDemo vem logo depois da autenticação nas 7 rotas, e só nelas", () => {
    const com = rotas.filter((r) => r.handlers.includes(bloquearContaDemo)).map((r) => `${r.metodo} ${r.caminho}`);
    expect(com.sort()).toEqual([...BLOQUEADAS].sort());
    for (const r of rotas.filter((x) => x.handlers.includes(bloquearContaDemo))) {
      expect([requireAuth, requireAuthRevogacao]).toContain(r.handlers[0]);
      expect(r.handlers[1]).toBe(bloquearContaDemo);
    }
  });

  it.each([
    ["solicitar-cuidador", "/vinculo/solicitar-cuidador", "demo-cuidador-paulo", { email: "uid-real-idoso@exemplo.test" }],
    ["solicitar-familiar", "/vinculo/solicitar-familiar", "demo-familiar-carlos", { email: "uid-real-idoso@exemplo.test" }],
    ["convidar-familiar", "/vinculo/convidar-familiar", "demo-idosa-helena", { email: "uid-real-cuidador@exemplo.test" }],
    ["convidar-cuidador", "/vinculo/convidar-cuidador", "demo-idosa-helena", { email: "uid-real-cuidador@exemplo.test" }],
    ["aceitar-convite", "/vinculo/2/aceitar-convite", "demo-cuidadora-marta", {}],
    ["cadastrar-idoso", "/usuario/cadastrar-idoso", "demo-familiar-carlos", { nome: "Vitima", email: "vitima@exemplo.test" }],
  ])("%s: 403 fixo, sem ler nem escrever nada além da autenticação", async (_n, caminho, uid, corpo) => {
    const res = await request(app).post(caminho).set(como(uid)).send(corpo);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Ação indisponível no modo demonstração." });
    expect(escritasChamadas()).toEqual([]);
    expect(leituras("vinculo.findFirst") + leituras("vinculo.findUnique") + leituras("vinculo.findMany")).toBe(0);
  });

  it("controle: conta real passa da barreira (não recebe o 403 do modo demonstração)", async () => {
    const res = await request(app).post("/vinculo/solicitar-cuidador").set(como("uid-real-cuidador")).send({});
    expect(res.body).not.toEqual({ error: "Ação indisponível no modo demonstração." });
  });
});

describe("conta do elenco nunca alcança idoso fora do elenco", () => {
  it("Marta com vínculo aprovado no banco com idoso REAL: o mesmo 403 de sem vínculo, em leitura e escrita", async () => {
    const semVinculo = await request(app).get(`/saude/idoso/999`).set(como("demo-cuidadora-marta"));
    for (const [metodo, caminho] of [
      ["get", `/saude/idoso/${REAL_IDOSO}`],
      ["get", `/remedios/idoso/${REAL_IDOSO}`],
      ["get", `/agenda/idoso/${REAL_IDOSO}`],
      ["get", `/alimentacao/idoso/${REAL_IDOSO}`],
      ["get", `/historico/idoso/${REAL_IDOSO}/pdf`],
      ["post", `/saude/idoso/${REAL_IDOSO}`],
    ] as const) {
      const res = await request(app)[metodo](caminho).set(como("demo-cuidadora-marta")).send({ tipo_medicao: "Peso", valor_1: 70, unidade: "kg" });
      expect(res.status).toBe(403);
      expect(res.body).toEqual(semVinculo.body);
    }
    expect(escritasChamadas()).toEqual([]);
  });

  it("controle: Marta lê Helena (idosa do elenco) e o cuidador real lê o idoso real", async () => {
    expect((await request(app).get(`/saude/idoso/${HELENA}`).set(como("demo-cuidadora-marta"))).status).toBe(200);
    expect((await request(app).get(`/saude/idoso/${REAL_IDOSO}`).set(como("uid-real-cuidador"))).status).toBe(200);
  });

  it("conta real não paga a consulta extra do idoso (só a conta do elenco consulta o uid do idoso)", async () => {
    await request(app).get(`/saude/idoso/${REAL_IDOSO}`).set(como("uid-real-cuidador"));
    expect(leituras("usuario.findUnique")).toBe(0);
  });
});
