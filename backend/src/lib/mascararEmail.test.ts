import { mascararEmail } from "./mascararEmail";

describe("mascararEmail", () => {
  it("mantém o primeiro caractere da parte local, *** e o domínio completo", () => {
    expect(mascararEmail("maria@gmail.com")).toBe("m***@gmail.com");
  });

  it("e-mail nulo ou indefinido vira null", () => {
    expect(mascararEmail(null)).toBeNull();
    expect(mascararEmail(undefined)).toBeNull();
  });

  it("parte local de 1 caractere não vaza nada além do próprio caractere", () => {
    expect(mascararEmail("a@x.com")).toBe("a***@x.com");
  });

  it.each(["", "semarroba", "@dominio.com", "local@", "a@b@c.com"])("malformado %p vira ***", (entrada) => {
    expect(mascararEmail(entrada)).toBe("***");
  });
});
