// Extração de texto de PDF só para testes e scripts de verificação (devDependency pdfjs-dist 3.x, build
// CommonJS legacy; o pdf-parse 1.1.1 não lê o xref do pdfkit). Fora do build de produção.
// verbosity 0 (só erros) para o pdfjs não escrever warnings em stdout/stderr; isEvalSupported false fecha a falha
// de execução de JS por PDF malicioso (GHSA do pdfjs-dist <=4.1.392), embora só se leiam PDFs gerados aqui.
import type * as PdfJs from "pdfjs-dist/legacy/build/pdf.js";

let pdfjs: typeof PdfJs | undefined;

// Carga preguiçosa com console.log mudo: ao carregar, o pdfjs 3.x tenta o pacote opcional `canvas` (sem binário
// nativo, de propósito: allowScripts não o libera) e imprime um aviso de polyfill via console.log.
function carregarPdfjs(): typeof PdfJs {
  if (!pdfjs) {
    const original = console.log;
    console.log = () => undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      pdfjs = require("pdfjs-dist/legacy/build/pdf.js") as typeof PdfJs;
    } finally {
      console.log = original;
    }
  }
  return pdfjs;
}

// Junta os itens de texto de cada página: espaço entre itens, \n quando o item marca fim de linha,
// e normaliza espaços repetidos (por linha), para comparar texto de forma determinística.
export async function extrairTextoPdf(buffer: Buffer): Promise<{ texto: string; paginas: number }> {
  const doc = await carregarPdfjs().getDocument({ data: new Uint8Array(buffer), verbosity: 0, isEvalSupported: false }).promise;
  try {
    const partes: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const pagina = await doc.getPage(n);
      const conteudo = await pagina.getTextContent();
      let linha = "";
      for (const item of conteudo.items) {
        if (!("str" in item)) continue;
        linha += `${item.str} `;
        if (item.hasEOL) {
          partes.push(linha);
          linha = "";
        }
      }
      if (linha) partes.push(linha);
    }
    const texto = partes
      .map((l) => l.replace(/[ \t]+/g, " ").trim())
      .join("\n")
      .replace(/\n{2,}/g, "\n");
    return { texto, paginas: doc.numPages };
  } finally {
    await doc.destroy();
  }
}

export type ItemPdf = { str: string; x: number; y: number };

// Itens de texto de cada página com a posição (transform[4] = x, transform[5] = y). Origem no canto
// inferior esquerdo da página: y baixo = parte de baixo.
export async function extrairItensPdf(buffer: Buffer): Promise<ItemPdf[][]> {
  const doc = await carregarPdfjs().getDocument({ data: new Uint8Array(buffer), verbosity: 0, isEvalSupported: false }).promise;
  try {
    const paginas: ItemPdf[][] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const conteudo = await (await doc.getPage(n)).getTextContent();
      paginas.push(
        conteudo.items.flatMap((i) => ("str" in i && i.str.trim() !== "" ? [{ str: i.str, x: i.transform[4] as number, y: i.transform[5] as number }] : [])),
      );
    }
    return paginas;
  } finally {
    await doc.destroy();
  }
}
