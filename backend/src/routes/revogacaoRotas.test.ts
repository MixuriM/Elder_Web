import request from "supertest";

// D5 (2026-10-14): as ações sensíveis checam se o token foi revogado (verifyIdToken com checkRevoked) e respondem 401
// com token revogado; leituras, escrita de dado de saúde, emergência e foto não pagam essa chamada extra ao Firebase.
// O Firebase falso rejeita como revogado SÓ quando o segundo argumento é true. Ids e uids FICTÍCIOS, só para teste.

const verifyIdToken = jest.fn(async (token: string, checarRevogado?: boolean) => {
  if (checarRevogado === true) throw Object.assign(new Error("revogado"), { code: "auth/id-token-revoked" });
  const m = /^t(\d+)$/.exec(token);
  return { uid: `uid-${m ? m[1] : "x"}`, email_verified: true };
});
jest.mock("../lib/firebaseAdmin", () => ({
  auth: { verifyIdToken: (...args: unknown[]) => verifyIdToken(...(args as [string, boolean?])) },
}));
jest.mock("../lib/prisma", () => ({
  prisma: jest.requireActual("../testSupport/prismaFakeAutorizacao").prismaFake,
}));

import app from "../app";
import { dados, zerarDados } from "../testSupport/prismaFakeAutorizacao";

const IDOSO = 5;

beforeEach(() => {
  zerarDados();
  dados.usuario = [{ id: IDOSO, firebase_uid: `uid-${IDOSO}`, tipo_perfil: "idoso", nome: "Ficticio", email: "ficticio@teste.invalid" }];
  verifyIdToken.mockClear();
});

type Metodo = "post" | "patch" | "get" | "delete";
const chamar = (metodo: Metodo, caminho: string) =>
  request(app)[metodo](caminho).set("Authorization", `Bearer t${IDOSO}`).send({});

const COM_REVOGACAO: [Metodo, string][] = [
  ["patch", "/usuario/me"],
  ["delete", "/usuario/me"],
  ["patch", "/usuario/me/modo-decisao"],
  ["post", "/usuario/cadastrar-idoso"],
  ["post", "/vinculo/convidar-cuidador"],
  ["post", "/vinculo/convidar-familiar"],
  ["post", "/vinculo/solicitar-cuidador"],
  ["post", "/vinculo/solicitar-familiar"],
  ["post", "/vinculo/1/aprovar"],
  ["post", "/vinculo/1/recusar"],
  ["post", "/vinculo/1/aceitar-convite"],
  ["post", "/vinculo/1/recusar-convite"],
  ["patch", "/vinculo/1/definir-permissoes"],
  ["post", "/vinculo/1/solicitar-transferencia-decisao"],
  ["post", "/vinculo/1/confirmar-transferencia-decisao"],
  // Contestar tira acesso como /recusar (RF-022): entrou na lista em 2026-10-15.
  ["post", "/vinculo/1/contestar"],
];

describe.each(COM_REVOGACAO)("%s %s checa revogação", (metodo, caminho) => {
  it("token revogado dá 401 e o Firebase foi chamado com checkRevoked", async () => {
    const res = await chamar(metodo, caminho);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Token inválido ou expirado." });
    expect(verifyIdToken.mock.calls).toEqual([[`t${IDOSO}`, true]]);
  });
});

const SEM_REVOGACAO: [Metodo, string][] = [
  ["get", "/usuario/me"],
  ["get", "/vinculo"],
  ["get", "/usuario/me/foto"],
  ["delete", "/usuario/me/foto"],
  ["post", "/saude"],
  ["post", "/emergencia/avisar"],
];

describe.each(SEM_REVOGACAO)("%s %s não checa revogação", (metodo, caminho) => {
  it("verifyIdToken é chamado só com o token", async () => {
    const res = await chamar(metodo, caminho);
    expect(res.status).not.toBe(401);
    expect(verifyIdToken.mock.calls).toEqual([[`t${IDOSO}`]]);
  });
});
