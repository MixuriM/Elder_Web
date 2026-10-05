// Casos de corpo de POST /alimentacao e POST /alimentacao/idoso/:idosoId (item 7.1, RF-018), compartilhados por
// alimentacao.test.ts e alimentacaoVinculado.test.ts. Só dados e uma checagem por caso: cada suíte monta os
// próprios fakes. A descrição de uma refeição pode revelar dieta e, por tabela, condição de saúde (tratada como
// dado sensível, RNF-001 por analogia): todos os valores são FICTÍCIOS.

export const BODY_OK = {
  refeicao: "almoco",
  descricao: "Refeicao Ficticia",
  data_hora: "2026-10-10T12:00:00Z",
};

export type DadosCreate = {
  refeicao: string;
  descricao: string;
  data_hora: Date;
};

export const REFEICOES = ["cafe_manha", "lanche_manha", "almoco", "lanche_tarde", "jantar", "ceia"];

const longo = (n: number) => "a".repeat(n);
// 500 caracteres com acento (cada um é 1 caractere em JS e em nvarchar).
const ACENTUADO_500 = "ção".repeat(166) + "çã";

// [rótulo, campos que sobrescrevem BODY_OK, checagem sobre o que foi para o create]
export const CASOS_201: [string, Record<string, unknown>, (d: DadosCreate) => void][] = [
  ...REFEICOES.map(
    (r): [string, Record<string, unknown>, (d: DadosCreate) => void] => [
      `refeicao '${r}'`,
      { refeicao: r },
      (d) => expect(d.refeicao).toBe(r),
    ],
  ),
  ["descricao com 1 caractere", { descricao: "x" }, (d) => expect(d.descricao).toBe("x")],
  ["descricao com trim", { descricao: "  Arroz e feijao  " }, (d) => expect(d.descricao).toBe("Arroz e feijao")],
  ["descricao com 500", { descricao: longo(500) }, (d) => expect(d.descricao).toBe(longo(500))],
  ["descricao com 500 após trim", { descricao: `  ${longo(500)}  ` }, (d) => expect(d.descricao).toBe(longo(500))],
  ["descricao com 500 acentuados", { descricao: ACENTUADO_500 }, (d) => expect(d.descricao).toBe(ACENTUADO_500)],
  [
    "data_hora com Z grava o instante exato",
    { data_hora: "2026-10-10T12:00:00Z" },
    (d) => expect(d.data_hora.toISOString()).toBe("2026-10-10T12:00:00.000Z"),
  ],
  [
    "data_hora 09:00-03:00 grava 12:00Z",
    { data_hora: "2026-10-10T09:00:00-03:00" },
    (d) => expect(d.data_hora.toISOString()).toBe("2026-10-10T12:00:00.000Z"),
  ],
  [
    "data_hora sem segundos e com offset positivo",
    { data_hora: "2026-10-10T09:00+02:00" },
    (d) => expect(d.data_hora.toISOString()).toBe("2026-10-10T07:00:00.000Z"),
  ],
  [
    "data_hora com milissegundos",
    { data_hora: "2026-10-10T12:00:00.123Z" },
    (d) => expect(d.data_hora.toISOString()).toBe("2026-10-10T12:00:00.123Z"),
  ],
  [
    "data_hora 29/02 em ano bissexto",
    { data_hora: "2028-02-29T10:00:00Z" },
    (d) => expect(d.data_hora.toISOString()).toBe("2028-02-29T10:00:00.000Z"),
  ],
  ["data_hora no passado", { data_hora: "2000-01-15T08:00:00Z" }, (d) => expect(d.data_hora.getUTCFullYear()).toBe(2000)],
  [
    "data_hora no futuro (plano alimentar)",
    { data_hora: "2099-12-31T08:00:00Z" },
    (d) => expect(d.data_hora.getUTCFullYear()).toBe(2099),
  ],
];

// [rótulo, campos que sobrescrevem BODY_OK, mensagem exata esperada]
const R = "refeicao inválida.";
const D = "descricao inválida.";
const H = "data_hora inválida.";

export const CASOS_400: [string, Record<string, unknown>, string][] = [
  ["refeicao ausente", { refeicao: undefined }, R],
  ["refeicao null", { refeicao: null }, R],
  ["refeicao vazia", { refeicao: "" }, R],
  ["refeicao número", { refeicao: 1 }, R],
  ["refeicao array", { refeicao: ["almoco"] }, R],
  ["refeicao objeto", { refeicao: { valor: "almoco" } }, R],
  ["refeicao 'Almoco' (caixa)", { refeicao: "Almoco" }, R],
  ["refeicao 'JANTAR' (caixa)", { refeicao: "JANTAR" }, R],
  ["refeicao com espaço antes", { refeicao: " almoco" }, R],
  ["refeicao com espaço depois", { refeicao: "almoco " }, R],
  ["refeicao com acento ('almoço')", { refeicao: "almoço" }, R],
  ["refeicao fora da lista ('lanche')", { refeicao: "lanche" }, R],
  ["refeicao fora da lista ('cafe_da_manha')", { refeicao: "cafe_da_manha" }, R],
  ["descricao ausente", { descricao: undefined }, D],
  ["descricao null", { descricao: null }, D],
  ["descricao vazia", { descricao: "" }, D],
  ["descricao só espaços", { descricao: "   " }, D],
  ["descricao número", { descricao: 5 }, D],
  ["descricao objeto", { descricao: { a: 1 } }, D],
  ["descricao array", { descricao: ["x"] }, D],
  ["descricao com 501", { descricao: longo(501) }, D],
  ["descricao com 501 após trim", { descricao: ` ${longo(501)} ` }, D],
  ["data_hora ausente", { data_hora: undefined }, H],
  ["data_hora null", { data_hora: null }, H],
  ["data_hora vazia", { data_hora: "" }, H],
  ["data_hora sem fuso", { data_hora: "2026-10-10T09:00:00" }, H],
  ["data_hora só data", { data_hora: "2026-10-10" }, H],
  ["data_hora em formato inválido", { data_hora: "10/10/2026 09:00" }, H],
  ["data_hora com offset sem dois-pontos", { data_hora: "2026-10-10T09:00:00-0300" }, H],
  ["data_hora inexistente (30/02)", { data_hora: "2026-02-30T10:00:00-03:00" }, H],
  ["data_hora inexistente (31/04)", { data_hora: "2026-04-31T10:00:00Z" }, H],
  ["data_hora 29/02 em ano não bissexto", { data_hora: "2026-02-29T10:00:00Z" }, H],
  ["data_hora com mês 13", { data_hora: "2026-13-01T10:00:00Z" }, H],
  ["data_hora com hora 25", { data_hora: "2026-10-10T25:00:00Z" }, H],
  ["data_hora número", { data_hora: 20261010 }, H],
];

// Ordem de validação do corpo: refeicao, descricao, data_hora (a primeira inválida decide a mensagem).
export const CASOS_ORDEM_CORPO: [string, Record<string, unknown>, string][] = [
  ["os 3 inválidos: refeicao primeiro", { refeicao: "x", descricao: "", data_hora: "x" }, R],
  ["descricao e data_hora inválidas: descricao primeiro", { descricao: "", data_hora: "x" }, D],
];

// Campos que o cliente não controla: ignorados, nunca gravados.
export const CAMPOS_FORJADOS = {
  id: 999,
  idoso_id: 77,
  registrado_por_id: 77,
  editado_por_id: 77,
  created_at: "2000-01-01T00:00:00Z",
  updated_at: "2000-01-01T00:00:00Z",
};

export const CHAVES_CREATE = ["data_hora", "descricao", "editado_por_id", "idoso_id", "refeicao", "registrado_por_id"];
