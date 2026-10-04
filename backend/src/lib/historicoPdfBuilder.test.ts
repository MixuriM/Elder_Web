import { gerarHistoricoPdf, type DadosHistoricoPdf, type MedicamentoPdf, type RegistroPdf } from "./historicoPdf";
import { extrairItensPdf, extrairTextoPdf } from "../testSupport/extrairTextoPdf";

// Item 5.4 (RF-014): unidade do builder do PDF. Função pura: recebe dados já carregados e ordenados e
// devolve Promise<Buffer>. Todos os valores abaixo são FICTÍCIOS.

const GERADO_EM = new Date("2026-10-04T17:45:00.000Z"); // 14:45 em America/Sao_Paulo

function med(over: Partial<MedicamentoPdf> = {}): MedicamentoPdf {
  return {
    nome: "Losartana",
    dosagem: "50 mg",
    frequencia: "2x ao dia",
    data_inicio: new Date("2026-01-01T00:00:00.000Z"),
    data_fim: null,
    ativo: true,
    observacoes: null,
    doses: [],
    ...over,
  };
}

function reg(over: Partial<RegistroPdf> = {}): RegistroPdf {
  return {
    data_hora: new Date("2026-09-24T12:00:00.000Z"),
    tipo_medicao: "pressao",
    valor_1: 120,
    valor_2: 80,
    unidade: "mmHg",
    observacoes: null,
    ...over,
  };
}

function dados(over: Partial<DadosHistoricoPdf> = {}): DadosHistoricoPdf {
  return { nomeIdoso: "Maria da Silva", geradoEm: GERADO_EM, medicamentos: [], registros: [], ...over };
}

async function texto(d: DadosHistoricoPdf) {
  return extrairTextoPdf(await gerarHistoricoPdf(d));
}

describe("gerarHistoricoPdf", () => {
  it("devolve um Buffer PDF (começa com %PDF, termina com o marcador de fim)", async () => {
    const buf = await gerarHistoricoPdf(dados());
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.subarray(0, 4).toString("latin1")).toBe("%PDF");
    expect(buf.toString("latin1").trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("cabeçalho: título, nome do idoso e 'Gerado em' em America/Sao_Paulo", async () => {
    const { texto: t } = await texto(dados());
    expect(t).toContain("Histórico de saúde e remédios");
    expect(t).toContain("Maria da Silva");
    expect(t).toContain("Gerado em 04/10/2026 14:45");
  });

  it("estados vazios por seção", async () => {
    const { texto: t } = await texto(dados());
    expect(t).toContain("Remédios");
    expect(t).toContain("Saúde");
    expect(t).toContain("Nenhum medicamento cadastrado.");
    expect(t).toContain("Nenhum registro de saúde.");
  });

  it("estado vazio só de uma seção não aparece na outra", async () => {
    const { texto: t } = await texto(dados({ medicamentos: [med()] }));
    expect(t).not.toContain("Nenhum medicamento cadastrado.");
    expect(t).toContain("Nenhum registro de saúde.");
  });

  it("data `date` não desloca o dia: 2026-01-01 aparece como 01/01/2026 (e 31/12 como 31/12)", async () => {
    const { texto: t } = await texto(
      dados({ medicamentos: [med({ data_inicio: new Date("2026-01-01T00:00:00.000Z"), data_fim: new Date("2026-12-31T00:00:00.000Z") })] }),
    );
    expect(t).toContain("Período: de 01/01/2026 até 31/12/2026");
  });

  it("data_fim nula vira 'sem data de término'", async () => {
    const { texto: t } = await texto(dados({ medicamentos: [med()] }));
    expect(t).toContain("Período: de 01/01/2026, sem data de término");
    expect(t).not.toContain("até");
  });

  it("campos do medicamento: nome, dosagem, frequência, situação e observações", async () => {
    const { texto: t } = await texto(dados({ medicamentos: [med({ ativo: false, observacoes: "Tomar em jejum" })] }));
    expect(t).toContain("Losartana");
    expect(t).toContain("Dosagem: 50 mg");
    expect(t).toContain("Frequência: 2x ao dia");
    expect(t).toContain("Situação: Inativo");
    expect(t).toContain("Observações: Tomar em jejum");
  });

  it("situação Ativo e observações nulas não geram linha de observações", async () => {
    const { texto: t } = await texto(dados({ medicamentos: [med()] }));
    expect(t).toContain("Situação: Ativo");
    expect(t).not.toContain("Observações:");
  });

  it("datetime em America/Sao_Paulo (UTC-3) e rótulos de situação da dose", async () => {
    const { texto: t } = await texto(
      dados({
        medicamentos: [
          med({
            doses: [
              { data_hora_administracao: new Date("2026-09-14T12:30:00.000Z"), status_administracao: "administrado", observacoes: null },
              { data_hora_administracao: new Date("2026-09-14T03:05:00.000Z"), status_administracao: "pulado", observacoes: "Enjoo" },
              { data_hora_administracao: new Date("2026-09-10T02:59:00.000Z"), status_administracao: "atrasado", observacoes: null },
            ],
          }),
        ],
      }),
    );
    expect(t).toContain("14/09/2026 09:30, Administrado");
    expect(t).toContain("14/09/2026 00:05, Pulado (Observações: Enjoo)");
    // 02:59Z é 23:59 do dia anterior em São Paulo, com h23 (nunca "24:").
    expect(t).toContain("09/09/2026 23:59, Atrasado");
  });

  it("medicamento sem dose mostra 'Nenhuma dose registrada.'", async () => {
    const { texto: t } = await texto(dados({ medicamentos: [med()] }));
    expect(t).toContain("Nenhuma dose registrada.");
  });

  it("saúde: tipo com a primeira letra maiúscula, decimais em pt-BR, valor_2 nulo", async () => {
    const { texto: t } = await texto(
      dados({
        registros: [
          reg(),
          reg({ tipo_medicao: "temperatura", valor_1: 36.6, valor_2: null, unidade: "°C", data_hora: new Date("2026-09-23T12:00:00.000Z") }),
          reg({ tipo_medicao: "glicemia", valor_1: 1234.5, valor_2: null, unidade: "mg/dL", data_hora: new Date("2026-09-22T12:00:00.000Z") }),
        ],
      }),
    );
    expect(t).toContain("24/09/2026 09:00, Pressao, 120/80 mmHg");
    expect(t).toContain("Temperatura, 36,6 °C");
    expect(t).not.toContain("36.6");
    expect(t).toContain("Glicemia, 1.234,5 mg/dL");
    expect(t).not.toContain("Temperatura, 36,6/");
  });

  it("valor_2 com decimais: 12,5/8,25", async () => {
    const { texto: t } = await texto(dados({ registros: [reg({ valor_1: 12.5, valor_2: 8.25, unidade: "u" })] }));
    expect(t).toContain("12,5/8,25 u");
  });

  it("observação de saúde presente aparece; ausente não gera linha", async () => {
    const { texto: t } = await texto(
      dados({ registros: [reg({ observacoes: "Após caminhada" }), reg({ data_hora: new Date("2026-09-01T12:00:00.000Z") })] }),
    );
    expect(t.match(/Observações:/g)).toHaveLength(1);
    expect(t).toContain("Observações: Após caminhada");
  });

  it("acentos e cedilha preservados", async () => {
    const { texto: t } = await texto(
      dados({ nomeIdoso: "João Conceição", medicamentos: [med({ nome: "Ácido fólico", observacoes: "Ação lenta, coração" })] }),
    );
    expect(t).toContain("João Conceição");
    expect(t).toContain("Ácido fólico");
    expect(t).toContain("Ação lenta, coração");
  });

  it("acento decomposto (NFD) é normalizado para NFC e não vira '?'", async () => {
    const nfd = "José"; // José com acento combinante
    const { texto: t } = await texto(dados({ nomeIdoso: nfd }));
    expect(t).toContain("José");
    expect(t).not.toContain("?");
  });

  it("emoji e caractere CJK viram '?' sem lançar erro (um '?' por caractere)", async () => {
    const { texto: t } = await texto(
      dados({ medicamentos: [med({ nome: "A\u{1F600}B", observacoes: "X漢Y" })], registros: [reg({ observacoes: "中文" })] }),
    );
    expect(t).toContain("A?B");
    expect(t).toContain("X?Y");
    expect(t).toContain("Observações: ??");
    expect(t).not.toContain("\u{1F600}");
  });

  it("observação multilinha preserva as quebras de linha", async () => {
    const { texto: t } = await texto(dados({ medicamentos: [med({ observacoes: "linha UM\nlinha DOIS\r\nlinha TRES" })] }));
    const linhas = t.split("\n");
    expect(linhas).toContain("Observações: linha UM");
    expect(linhas).toContain("linha DOIS");
    expect(linhas).toContain("linha TRES");
  });

  it("respeita a ordem recebida (medicamentos e registros)", async () => {
    const { texto: t } = await texto(
      dados({
        medicamentos: [med({ nome: "MED_PRIMEIRO" }), med({ nome: "MED_SEGUNDO" })],
        registros: [reg({ tipo_medicao: "zeta" }), reg({ tipo_medicao: "alfa" })],
      }),
    );
    expect(t.indexOf("MED_PRIMEIRO")).toBeLessThan(t.indexOf("MED_SEGUNDO"));
    expect(t.indexOf("Zeta,")).toBeLessThan(t.indexOf("Alfa,"));
    expect(t.indexOf("Remédios")).toBeLessThan(t.indexOf("MED_PRIMEIRO"));
    expect(t.indexOf("MED_SEGUNDO")).toBeLessThan(t.lastIndexOf("Saúde"));
  });

  it("não inclui id, autor, e-mail nem foto", async () => {
    const { texto: t } = await texto(dados({ medicamentos: [med()], registros: [reg()] }));
    expect(t).not.toMatch(/\bid\b|autor|registrado|editado|e-mail|@/i);
  });

  it("rodapé 'Página X de Y' correto em documento de várias páginas", async () => {
    const muitos = Array.from({ length: 120 }, (_, i) => med({ nome: `Medicamento ${i}` }));
    const { texto: t, paginas } = await texto(dados({ medicamentos: muitos }));
    expect(paginas).toBeGreaterThan(2);
    for (let p = 1; p <= paginas; p++) expect(t).toContain(`Página ${p} de ${paginas}`);
    expect(t).not.toContain(`Página ${paginas + 1} de`);
  });

  it("rodapé na parte de baixo de cada página, na mesma posição, e nenhum outro texto abaixo ou sobreposto a ele", async () => {
    const muitos = Array.from({ length: 120 }, (_, i) => med({ nome: `Medicamento ${i}` }));
    const paginas = await extrairItensPdf(await gerarHistoricoPdf(dados({ medicamentos: muitos })));
    expect(paginas.length).toBeGreaterThan(2);
    const ys: number[] = [];
    paginas.forEach((itens, i) => {
      const rodapes = itens.filter((it) => /^Página \d+ de \d+$/.test(it.str.trim()));
      expect(rodapes).toHaveLength(1);
      expect(rodapes[0].str.trim()).toBe(`Página ${i + 1} de ${paginas.length}`);
      const y = rodapes[0].y;
      ys.push(y);
      expect(y).toBeLessThan(60); // A4 tem 842 pt de altura: parte de baixo
      // Nenhum outro texto com y menor ou sobreposto (corpo a pelo menos 1 linha de 10 pt acima do rodapé).
      for (const outro of itens.filter((it) => it !== rodapes[0])) expect(outro.y).toBeGreaterThan(y + 10);
    });
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(0.5); // mesma coordenada em todas as páginas
  });

  it("documento de uma página: 'Página 1 de 1'", async () => {
    const { texto: t, paginas } = await texto(dados());
    expect(paginas).toBe(1);
    expect(t).toContain("Página 1 de 1");
  });
});
