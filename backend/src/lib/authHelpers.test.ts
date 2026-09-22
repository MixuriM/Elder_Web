const verifyIdToken = jest.fn();

jest.mock("./firebaseAdmin", () => ({
  auth: { verifyIdToken: (...args: unknown[]) => verifyIdToken(...args) },
}));

import {
  isTipoPerfil,
  isValidEmailFormat,
  isDuplicateEmail,
  isDuplicateFirebaseUid,
  verifyFirebaseToken,
} from "./authHelpers";

describe("isTipoPerfil", () => {
  it.each([
    ["idoso", true],
    ["cuidador", true],
    ["familiar", true],
    ["admin", false],
    ["", false],
    [undefined, false],
    [null, false],
    [123, false],
  ])("isTipoPerfil(%p) -> %p", (valor, esperado) => {
    expect(isTipoPerfil(valor)).toBe(esperado);
  });
});

describe("isValidEmailFormat", () => {
  it.each([
    ["ana@a.com", true],
    ["ana.silva@dominio.com.br", true],
    ["sem-arroba.com", false],
    ["sem-dominio@", false],
    ["@sem-local.com", false],
    ["com espaco@a.com", false],
    ["ana@a", false],
  ])("isValidEmailFormat(%p) -> %p", (valor, esperado) => {
    expect(isValidEmailFormat(valor)).toBe(esperado);
  });
});

describe("isDuplicateEmail / isDuplicateFirebaseUid", () => {
  it.each([
    [new Error("Violation of UNIQUE KEY constraint 'Usuario_email_key'"), true],
    [new Error("UNIQUE constraint failed: Usuario.email"), true],
    [new Error("duplicate key value violates unique constraint"), true],
    [new Error("outro erro qualquer"), false],
    ["nao é um Error", false],
    [null, false],
  ])("isDuplicateEmail(%p) -> %p", (erro, esperado) => {
    expect(isDuplicateEmail(erro)).toBe(esperado);
  });

  it.each([
    [new Error("Violation of UNIQUE KEY constraint 'Usuario_firebase_uid_key'"), true],
    [new Error("outro erro qualquer"), false],
  ])("isDuplicateFirebaseUid(%p) -> %p", (erro, esperado) => {
    expect(isDuplicateFirebaseUid(erro)).toBe(esperado);
  });
});

describe("verifyFirebaseToken", () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
  });

  it("token válido: ok:true com o decoded", async () => {
    verifyIdToken.mockResolvedValue({ uid: "u1" });

    const resultado = await verifyFirebaseToken("token-valido");

    expect(resultado).toEqual({ ok: true, decoded: { uid: "u1" } });
  });

  it.each([
    "auth/id-token-expired",
    "auth/id-token-revoked",
    "auth/argument-error",
    "auth/invalid-id-token",
    "auth/qualquer-outro-nao-listado",
  ])("código %s: ok:false, status 401", async (code) => {
    verifyIdToken.mockRejectedValue(Object.assign(new Error("token ruim"), { code }));

    const resultado = await verifyFirebaseToken("token-invalido");

    expect(resultado).toEqual({ ok: false, status: 401, error: expect.any(String) });
  });

  it("erro sem código auth/* (rede/serviço fora do ar): ok:false, status 503", async () => {
    verifyIdToken.mockRejectedValue(new Error("network timeout"));

    const resultado = await verifyFirebaseToken("token-qualquer");

    expect(resultado).toEqual({ ok: false, status: 503, error: expect.any(String) });
  });

  it("erro sem propriedade code nenhuma: status 503", async () => {
    verifyIdToken.mockRejectedValue({ message: "sem code" });

    const resultado = await verifyFirebaseToken("token-qualquer");

    expect(resultado.ok).toBe(false);
    expect((resultado as { status: number }).status).toBe(503);
  });
});
