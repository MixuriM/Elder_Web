import request from "supertest";

// Fechamento do 9.5 (F3): a linha anonimizada mantém tipo_perfil e ganha o e-mail excluido-<id>@excluido.invalid. Quem
// digita esse e-mail em solicitar, convidar, cadastrar idoso ou trocar o próprio e-mail encontraria uma conta morta
// (vínculo ou convite para quem não loga mais, e um 404 diferente que revela que o id existiu). A regra: e-mail do
// domínio do marcador é inválido em toda entrada de e-mail (400 igual, com ou sem conta morta), e nenhuma escrita
// acontece. O Prisma falso filtra de verdade pelo where, então o teste falha se a busca chegar à linha. Ids, uids e
// e-mails FICTÍCIOS, só para teste.

jest.mock("../lib/firebaseAdmin", () => ({
  auth: {
    verifyIdToken: (...args: unknown[]) =>
      jest.requireActual("../testSupport/prismaFakeAutorizacao").verifyIdToken(...args),
    getUser: jest.fn(),
    updateUser: jest.fn(),
  },
}));
jest.mock("../lib/prisma", () => ({
  prisma: jest.requireActual("../testSupport/prismaFakeAutorizacao").prismaFake,
}));

import app from "../app";
import { dados, escritasChamadas, limparChamadas, tokenDe, zerarDados, type Linha } from "../testSupport/prismaFakeAutorizacao";

const IDOSO = 5;
const CUIDADOR = 10;
const FAMILIAR = 20;
const IDOSO_MORTO = 8;
const FAMILIAR_MORTO = 9;
const CUIDADOR_MORTO = 11;
const marcador = (id: number) => `excluido-${id}@excluido.invalid`;

const usuario = (id: number, tipo_perfil: string, extra: Linha = {}): Linha => ({
  id,
  firebase_uid: `uid-${id}`,
  tipo_perfil,
  nome: `Pessoa Ficticia ${id}`,
  email: `ficticio${id}@teste.invalid`,
  modo_decisao: tipo_perfil === "idoso" ? "idoso" : null,
  ...extra,
});

beforeEach(() => {
  zerarDados();
  limparChamadas();
  dados.usuario = [
    usuario(IDOSO, "idoso"),
    usuario(CUIDADOR, "cuidador"),
    usuario(FAMILIAR, "familiar"),
    // Contas excluídas: nome "Conta excluída", e-mail do marcador, tipo_perfil preservado.
    usuario(IDOSO_MORTO, "idoso", { nome: "Conta excluída", email: marcador(IDOSO_MORTO), modo_decisao: null }),
    usuario(FAMILIAR_MORTO, "familiar", { nome: "Conta excluída", email: marcador(FAMILIAR_MORTO) }),
    usuario(CUIDADOR_MORTO, "cuidador", { nome: "Conta excluída", email: marcador(CUIDADOR_MORTO) }),
  ];
  dados.vinculo = [];
});

const chamar = (metodo: "post" | "patch", caminho: string, quem: number, corpo: object) =>
  request(app)[metodo](caminho).set("Authorization", `Bearer ${tokenDe(quem)}`).send(corpo);

const E_MAIL_INVALIDO = { error: "E-mail inválido." };

describe("e-mail do marcador de conta excluída é inválido em toda entrada", () => {
  it.each([
    ["solicitar-cuidador, idoso morto", "post", "/vinculo/solicitar-cuidador", CUIDADOR, { email: marcador(IDOSO_MORTO) }],
    ["solicitar-cuidador, familiar morto", "post", "/vinculo/solicitar-cuidador", CUIDADOR, { email: marcador(FAMILIAR_MORTO) }],
    ["solicitar-cuidador, id que nunca existiu", "post", "/vinculo/solicitar-cuidador", CUIDADOR, { email: marcador(777) }],
    ["solicitar-familiar, idoso morto", "post", "/vinculo/solicitar-familiar", FAMILIAR, { email: marcador(IDOSO_MORTO) }],
    ["solicitar-familiar, caixa alta", "post", "/vinculo/solicitar-familiar", FAMILIAR, { email: marcador(IDOSO_MORTO).toUpperCase() }],
    ["convidar-familiar, familiar morto", "post", "/vinculo/convidar-familiar", IDOSO, { email: marcador(FAMILIAR_MORTO) }],
    ["convidar-cuidador, cuidador morto", "post", "/vinculo/convidar-cuidador", IDOSO, { email: marcador(CUIDADOR_MORTO) }],
    ["cadastrar-idoso, colisão com idoso morto", "post", "/usuario/cadastrar-idoso", FAMILIAR, { nome: "Idoso Ficticio", email: marcador(IDOSO_MORTO), aceita_termo_responsabilidade: true }],
    ["cadastrar-idoso, marcador livre", "post", "/usuario/cadastrar-idoso", FAMILIAR, { nome: "Idoso Ficticio", email: marcador(888), aceita_termo_responsabilidade: true }],
    ["PATCH /usuario/me, colisão com conta morta", "patch", "/usuario/me", IDOSO, { email: marcador(IDOSO_MORTO) }],
    ["PATCH /usuario/me, marcador livre", "patch", "/usuario/me", IDOSO, { email: marcador(999) }],
  ] as const)("%s: 400 E-mail inválido. e nenhuma escrita", async (_nome, metodo, caminho, quem, corpo) => {
    const res = await chamar(metodo, caminho, quem, corpo);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(E_MAIL_INVALIDO);
    expect(escritasChamadas()).toEqual([]);
  });

  it("a resposta é a mesma com ou sem conta morta por trás (nenhum oráculo)", async () => {
    const comConta = await chamar("post", "/vinculo/solicitar-cuidador", CUIDADOR, { email: marcador(IDOSO_MORTO) });
    const semConta = await chamar("post", "/vinculo/solicitar-cuidador", CUIDADOR, { email: marcador(4242) });
    expect(comConta.status).toBe(semConta.status);
    expect(comConta.body).toEqual(semConta.body);
  });

  it("e-mail comum segue funcionando (convidar-cuidador sem conta: 201)", async () => {
    const res = await chamar("post", "/vinculo/convidar-cuidador", IDOSO, { email: "novo@exemplo.test" });
    expect(res.status).toBe(201);
  });

  it("e-mail que só parece o marcador segue valendo", async () => {
    const res = await chamar("post", "/vinculo/convidar-cuidador", IDOSO, { email: "excluido-8@excluido.invalid.exemplo.test" });
    expect(res.status).toBe(201);
  });
});
