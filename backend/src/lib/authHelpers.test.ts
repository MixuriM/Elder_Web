const verifyIdToken = jest.fn();

jest.mock("./firebaseAdmin", () => ({
  auth: { verifyIdToken: (...args: unknown[]) => verifyIdToken(...args) },
}));

import {
  emailDoTokenConfere,
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

describe("emailDoTokenConfere", () => {
  it.each([
    ["mesmo e-mail", "a@a.com", "a@a.com", true],
    ["caixa diferente", "A@A.com", "a@a.com", true],
    ["e-mail diferente", "antigo@a.com", "novo@a.com", false],
    ["token sem e-mail", undefined, "a@a.com", false],
    ["token com e-mail vazio", "", "a@a.com", false],
    ["token com e-mail não texto", 5, "a@a.com", false],
    ["cadastro sem e-mail", "a@a.com", null, false],
    ["cadastro indefinido", "a@a.com", undefined, false],
    ["cadastro vazio", "", "", false],
  ])("%s -> %p", (_nome, token, cadastro, esperado) => {
    expect(emailDoTokenConfere(token, cadastro as string | null | undefined)).toBe(esperado);
  });
});

// D5 (2026-10-14): checkRevoked só quando pedido (custa uma chamada extra ao Firebase por requisição).
describe("verifyFirebaseToken com checarRevogado", () => {
  beforeEach(() => verifyIdToken.mockReset());

  it("sem a opção, chama verifyIdToken só com o token (sem checkRevoked)", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-ficticio" });
    await verifyFirebaseToken("token-ficticio");
    expect(verifyIdToken.mock.calls).toEqual([["token-ficticio"]]);
  });

  it("com checarRevogado, chama verifyIdToken(token, true)", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid-ficticio" });
    const resultado = await verifyFirebaseToken("token-ficticio", { checarRevogado: true });
    expect(verifyIdToken.mock.calls).toEqual([["token-ficticio", true]]);
    expect(resultado.ok).toBe(true);
  });

  it("token revogado dá 401", async () => {
    verifyIdToken.mockRejectedValue(Object.assign(new Error("revogado"), { code: "auth/id-token-revoked" }));
    expect(await verifyFirebaseToken("token-ficticio", { checarRevogado: true })).toEqual({
      ok: false,
      status: 401,
      error: "Token inválido ou expirado.",
    });
  });

  it("falha de rede ao checar a revogação continua 503", async () => {
    verifyIdToken.mockRejectedValue(new Error("network"));
    const resultado = await verifyFirebaseToken("token-ficticio", { checarRevogado: true });
    expect(resultado).toMatchObject({ ok: false, status: 503 });
  });
});
