import PDFDocument from "pdfkit";

// Item 5.4 (RF-014): builder do PDF do histórico combinado (remédios + saúde). Função pura: recebe dados já
// carregados e ordenados (a ordem recebida é a ordem impressa) e devolve o PDF inteiro em memória. Dado
// sensível (RNF-001): sem console.*, sem ids, autor, e-mail nem foto no documento.
// Fontes padrão do PDF (Helvetica, só Latin-1): sem arquivo de fonte.

export type DosePdf = {
  data_hora_administracao: Date;
  status_administracao: string;
  observacoes: string | null;
};

export type MedicamentoPdf = {
  nome: string;
  dosagem: string;
  frequencia: string;
  data_inicio: Date;
  data_fim: Date | null;
  ativo: boolean;
  observacoes: string | null;
  doses: DosePdf[];
};

export type RegistroPdf = {
  data_hora: Date;
  tipo_medicao: string;
  valor_1: number;
  valor_2: number | null;
  unidade: string;
  observacoes: string | null;
};

export type DadosHistoricoPdf = {
  nomeIdoso: string;
  geradoEm: Date;
  medicamentos: MedicamentoPdf[];
  registros: RegistroPdf[];
};

const ROTULO_STATUS_DOSE: Record<string, string> = { administrado: "Administrado", pulado: "Pulado", atrasado: "Atrasado" };

// Fontes padrão só cobrem Latin-1: NFC primeiro (acento decomposto vira um caractere só) e `?` por code
// point fora de U+0020 a U+007E e U+00A0 a U+00FF. Quebra de linha é preservada (\r\n e \r viram \n).
function limpar(texto: string): string {
  let saida = "";
  for (const c of texto.normalize("NFC").replace(/\r\n?/g, "\n")) {
    const p = c.codePointAt(0) as number;
    saida += c === "\n" || (p >= 0x20 && p <= 0x7e) || (p >= 0xa0 && p <= 0xff) ? c : "?";
  }
  return saida;
}

// Campo `date` (@db.Date) vem como Date UTC à meia-noite: formata em UTC para não deslocar o dia.
const FORMATO_DATA = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
const dataBr = (d: Date) => FORMATO_DATA.format(d);

// Fuso fixo: o resultado não depende do fuso da máquina. hourCycle h23 evita "24:00" à meia-noite.
const FORMATO_DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
function dataHoraBr(d: Date): string {
  const p = Object.fromEntries(FORMATO_DATA_HORA.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

const FORMATO_NUMERO = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

function valorFormatado(r: RegistroPdf): string {
  const valores = r.valor_2 === null ? FORMATO_NUMERO.format(r.valor_1) : `${FORMATO_NUMERO.format(r.valor_1)}/${FORMATO_NUMERO.format(r.valor_2)}`;
  return `${valores} ${r.unidade}`;
}

const primeiraMaiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const MARGEM = 50;
const CORPO = 12;

export function gerarHistoricoPdf(dados: DadosHistoricoPdf): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: MARGEM, bufferPages: true });
      const partes: Buffer[] = [];
      doc.on("data", (c: Buffer) => partes.push(c));
      doc.on("end", () => resolve(Buffer.concat(partes)));
      doc.on("error", reject);

      const linha = (texto: string, tamanho = CORPO, negrito = false, opcoes: PDFKit.Mixins.TextOptions = {}) =>
        doc.font(negrito ? "Helvetica-Bold" : "Helvetica").fontSize(tamanho).fillColor("black").text(limpar(texto), opcoes);

      linha("Histórico de saúde e remédios", 18, true);
      linha(dados.nomeIdoso);
      linha(`Gerado em ${dataHoraBr(dados.geradoEm)}`);
      doc.moveDown();

      linha("Remédios", 14, true);
      doc.moveDown(0.5);
      if (dados.medicamentos.length === 0) linha("Nenhum medicamento cadastrado.");
      for (const m of dados.medicamentos) {
        linha(m.nome, CORPO, true);
        linha(`Dosagem: ${m.dosagem}`);
        linha(`Frequência: ${m.frequencia}`);
        linha(
          m.data_fim === null
            ? `Período: de ${dataBr(m.data_inicio)}, sem data de término`
            : `Período: de ${dataBr(m.data_inicio)} até ${dataBr(m.data_fim)}`,
        );
        linha(`Situação: ${m.ativo ? "Ativo" : "Inativo"}`);
        if (m.observacoes) linha(`Observações: ${m.observacoes}`);
        if (m.doses.length === 0) linha("Nenhuma dose registrada.");
        else {
          linha("Doses:");
          for (const d of m.doses) {
            const status = ROTULO_STATUS_DOSE[d.status_administracao] ?? d.status_administracao;
            linha(`${dataHoraBr(d.data_hora_administracao)}, ${status}${d.observacoes ? ` (Observações: ${d.observacoes})` : ""}`);
          }
        }
        doc.moveDown(0.5);
      }
      doc.moveDown();

      linha("Saúde", 14, true);
      doc.moveDown(0.5);
      if (dados.registros.length === 0) linha("Nenhum registro de saúde.");
      for (const r of dados.registros) {
        linha(`${dataHoraBr(r.data_hora)}, ${primeiraMaiuscula(r.tipo_medicao)}, ${valorFormatado(r)}`);
        if (r.observacoes) linha(`Observações: ${r.observacoes}`);
      }

      // Rodapé em todas as páginas, depois de saber o total. Margem inferior zerada só durante a escrita:
      // senão o pdfkit trataria o rodapé como estouro de página e criaria uma página nova.
      const { start, count } = doc.bufferedPageRange();
      for (let i = 0; i < count; i++) {
        doc.switchToPage(start + i);
        doc.page.margins.bottom = 0;
        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor("black")
          .text(`Página ${i + 1} de ${count}`, MARGEM, doc.page.height - 40, {
            lineBreak: false,
            align: "center",
            width: doc.page.width - 2 * MARGEM,
          });
      }
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
