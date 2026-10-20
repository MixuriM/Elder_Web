import fs from "node:fs";
import path from "node:path";
import { DOMINIO_CONTA_EXCLUIDA, MSG_TOKEN_INVALIDO, ehContaExcluida, emailContaExcluida } from "./contaExcluida";

// Marcador único da conta excluída (fechamento do 9.5, F2): quem monta o e-mail anonimizado e quem o reconhece usam a
// mesma fonte. Ids e e-mails FICTÍCIOS, só para teste.

describe("contaExcluida", () => {
  it("monta o e-mail anonimizado a partir do id, com TLD reservado (.invalid)", () => {
    expect(emailContaExcluida(5)).toBe("excluido-5@excluido.invalid");
    expect(DOMINIO_CONTA_EXCLUIDA).toBe("excluido.invalid");
    expect(emailContaExcluida(5)).not.toBe(emailContaExcluida(6));
  });

  it("reconhece o que ele mesmo monta (ida e volta)", () => {
    for (const id of [1, 5, 99999]) expect(ehContaExcluida(emailContaExcluida(id))).toBe(true);
  });

  it.each([
    ["pessoa@exemplo.test", false],
    ["excluido-5@excluido.invalid.exemplo.test", false],
    ["excluido-5@outro.excluido.invalid", false], // subdomínio: não é o domínio do marcador
    ["EXCLUIDO-5@EXCLUIDO.INVALID", true], // e-mail é comparado sem diferenciar maiúsculas
    ["", false],
    [null, false],
    [undefined, false],
    [42, false],
    [{ endsWith: () => true }, false],
  ])("ehContaExcluida(%p) = %s", (valor, esperado) => {
    expect(ehContaExcluida(valor)).toBe(esperado);
  });

  it("a mensagem do 401 é a mesma do token inválido", () => {
    expect(MSG_TOKEN_INVALIDO).toBe("Token inválido ou expirado.");
  });

  // Mutação do marcador escrito solto em outro arquivo faria o requireAuth e o sync deixarem de reconhecer a conta.
  it("nenhum arquivo de produção escreve o marcador fora deste módulo", () => {
    const raiz = path.resolve(__dirname, "..");
    const achados: string[] = [];
    const varrer = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) varrer(p);
        else if (/\.ts$/.test(e.name) && !/\.test\.ts$/.test(e.name) && e.name !== "contaExcluida.ts") {
          const sem = fs.readFileSync(p, "utf-8").split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
          if (/excluido\.invalid/.test(sem)) achados.push(path.relative(raiz, p));
        }
      }
    };
    varrer(raiz);
    expect(achados).toEqual([]);
  });
});
