import PDFDocument from "pdfkit";
import { extrairTextoPdf } from "./extrairTextoPdf";

// Prova que a extração lê PDF do pdfkit (acentos, cedilha, "120/80 mmHg", várias páginas) e não escreve
// nada em stdout/stderr nem console.*.
function gerar(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", bufferPages: true });
    const partes: Buffer[] = [];
    doc.on("data", (c: Buffer) => partes.push(c));
    doc.on("end", () => resolve(Buffer.concat(partes)));
    doc.on("error", reject);
    doc.font("Helvetica").fontSize(12);
    doc.text("Medicação e ação");
    doc.text("Pressão: 120/80 mmHg");
    doc.addPage();
    doc.text("Segunda página");
    doc.end();
  });
}

describe("extrairTextoPdf", () => {
  it("devolve texto com acentos, valor e número de páginas", async () => {
    const { texto, paginas } = await extrairTextoPdf(await gerar());
    expect(paginas).toBe(2);
    expect(texto).toContain("Medicação e ação");
    expect(texto).toContain("120/80 mmHg");
    expect(texto).toContain("Segunda página");
  });

  it("não escreve nada em stdout, stderr nem console.*", async () => {
    const buf = await gerar();
    const out = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
    const err = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
    const cons = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    );
    try {
      await extrairTextoPdf(buf);
      expect(out).not.toHaveBeenCalled();
      expect(err).not.toHaveBeenCalled();
      cons.forEach((s) => expect(s).not.toHaveBeenCalled());
    } finally {
      out.mockRestore();
      err.mockRestore();
      cons.forEach((s) => s.mockRestore());
    }
  });

  it("restaura console.log mesmo se o carregamento do pdfjs lançar erro", async () => {
    const original = console.log;
    let isolada: typeof extrairTextoPdf | undefined;
    jest.isolateModules(() => {
      jest.doMock("pdfjs-dist/legacy/build/pdf.js", () => {
        throw new Error("falha simulada no require");
      });
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      isolada = (require("./extrairTextoPdf") as typeof import("./extrairTextoPdf")).extrairTextoPdf;
    });
    await expect(isolada!(Buffer.from("x"))).rejects.toThrow("falha simulada no require");
    jest.dontMock("pdfjs-dist/legacy/build/pdf.js");
    expect(console.log).toBe(original);
  });
});
