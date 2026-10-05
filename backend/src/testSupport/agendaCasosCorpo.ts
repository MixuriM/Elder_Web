// Casos de corpo de POST /agenda e POST /agenda/idoso/:idosoId (item 6.1, RF-015), compartilhados por
// agenda.test.ts e agendaVinculado.test.ts. Só dados e uma checagem por caso: cada suíte monta os próprios
// fakes. Evento pode carregar dado de saúde no título (tipo 'medico'): todos os valores são FICTÍCIOS.

export const BODY_OK = {
  tipo_evento: "pessoal",
  titulo: "Compromisso Ficticio",
  data_hora_inicio: "2026-10-10T12:00:00Z",
};

export type DadosCreate = {
  tipo_evento: string;
  titulo: string;
  descricao: string | null;
  data_hora_inicio: Date;
  data_hora_fim: Date | null;
};

const longo = (n: number) => "a".repeat(n);

// [rótulo, campos que sobrescrevem BODY_OK, checagem sobre o que foi para o create]
export const CASOS_201: [string, Record<string, unknown>, (d: DadosCreate) => void][] = [
  ["tipo 'medico'", { tipo_evento: "medico" }, (d) => expect(d.tipo_evento).toBe("medico")],
  ["tipo 'pessoal'", { tipo_evento: "pessoal" }, (d) => expect(d.tipo_evento).toBe("pessoal")],
  ["titulo com trim", { titulo: "  Consulta  " }, (d) => expect(d.titulo).toBe("Consulta")],
  ["titulo com 150", { titulo: longo(150) }, (d) => expect(d.titulo).toHaveLength(150)],
  ["titulo com 150 após trim", { titulo: `  ${longo(150)}  ` }, (d) => expect(d.titulo).toBe(longo(150))],
  ["descricao ausente vira null", { descricao: undefined }, (d) => expect(d.descricao).toBeNull()],
  ["descricao null vira null", { descricao: null }, (d) => expect(d.descricao).toBeNull()],
  ["descricao vazia vira null", { descricao: "" }, (d) => expect(d.descricao).toBeNull()],
  ["descricao só espaços vira null", { descricao: "   " }, (d) => expect(d.descricao).toBeNull()],
  ["descricao com trim", { descricao: "  texto  " }, (d) => expect(d.descricao).toBe("texto")],
  ["descricao com 500", { descricao: longo(500) }, (d) => expect(d.descricao).toHaveLength(500)],
  ["descricao com 500 após trim", { descricao: ` ${longo(500)} ` }, (d) => expect(d.descricao).toBe(longo(500))],
  [
    "início com Z grava o instante exato",
    { data_hora_inicio: "2026-10-10T12:00:00Z" },
    (d) => expect(d.data_hora_inicio.toISOString()).toBe("2026-10-10T12:00:00.000Z"),
  ],
  [
    "início 09:00-03:00 grava 12:00Z",
    { data_hora_inicio: "2026-10-10T09:00:00-03:00" },
    (d) => expect(d.data_hora_inicio.toISOString()).toBe("2026-10-10T12:00:00.000Z"),
  ],
  [
    "início sem segundos e com offset positivo",
    { data_hora_inicio: "2026-10-10T09:00+02:00" },
    (d) => expect(d.data_hora_inicio.toISOString()).toBe("2026-10-10T07:00:00.000Z"),
  ],
  ["início no passado", { data_hora_inicio: "2000-01-15T08:00:00Z" }, (d) => expect(d.data_hora_inicio.getUTCFullYear()).toBe(2000)],
  ["início no futuro", { data_hora_inicio: "2099-12-31T08:00:00Z" }, (d) => expect(d.data_hora_inicio.getUTCFullYear()).toBe(2099)],
  ["fim ausente vira null", { data_hora_fim: undefined }, (d) => expect(d.data_hora_fim).toBeNull()],
  ["fim null vira null", { data_hora_fim: null }, (d) => expect(d.data_hora_fim).toBeNull()],
  [
    "fim posterior ao início",
    { data_hora_fim: "2026-10-10T13:00:00Z" },
    (d) => expect(d.data_hora_fim?.toISOString()).toBe("2026-10-10T13:00:00.000Z"),
  ],
  [
    "fim igual ao início",
    { data_hora_fim: "2026-10-10T12:00:00Z" },
    (d) => expect(d.data_hora_fim?.toISOString()).toBe("2026-10-10T12:00:00.000Z"),
  ],
  [
    "evento de 22:00 às 01:00 do dia seguinte (offset -03:00)",
    { data_hora_inicio: "2026-10-10T22:00:00-03:00", data_hora_fim: "2026-10-11T01:00:00-03:00" },
    (d) => {
      expect(d.data_hora_inicio.toISOString()).toBe("2026-10-11T01:00:00.000Z");
      expect(d.data_hora_fim?.toISOString()).toBe("2026-10-11T04:00:00.000Z");
    },
  ],
];

// Item 6.2: corpo-base e casos de sucesso para o cuidador, que só cria 'cuidado'. Os dois casos "tipo 'medico'"
// e "tipo 'pessoal'" ficam de fora só aqui: para o cuidador esses tipos são 403 (têm teste próprio em
// agendaCuidador.test.ts). Todos os demais casos valem iguais, com o tipo-base trocado para 'cuidado'.
export const BODY_OK_CUIDADO = { ...BODY_OK, tipo_evento: "cuidado" };
export const CASOS_201_CUIDADOR = CASOS_201.filter(([rotulo]) => rotulo !== "tipo 'medico'" && rotulo !== "tipo 'pessoal'");

// Tipo fora do CHECK ou fora do formato: 400 (o 'cuidado' é 403 e tem teste próprio).
export const CASOS_400_TIPO: [string, Record<string, unknown>][] = [
  ["tipo 'outro'", { tipo_evento: "outro" }],
  ["tipo 'PESSOAL' (caixa)", { tipo_evento: "PESSOAL" }],
  ["tipo 'Medico' (caixa)", { tipo_evento: "Medico" }],
  ["tipo com espaço", { tipo_evento: " pessoal" }],
  ["tipo vazio", { tipo_evento: "" }],
  ["tipo null", { tipo_evento: null }],
  ["tipo número", { tipo_evento: 1 }],
  ["tipo array", { tipo_evento: ["pessoal"] }],
  ["tipo ausente", { tipo_evento: undefined }],
];

export const CASOS_400_CAMPOS: [string, Record<string, unknown>][] = [
  ["titulo ausente", { titulo: undefined }],
  ["titulo vazio", { titulo: "" }],
  ["titulo só espaços", { titulo: "   " }],
  ["titulo não string", { titulo: 123 }],
  ["titulo null", { titulo: null }],
  ["titulo com 151", { titulo: longo(151) }],
  ["descricao com 501", { descricao: longo(501) }],
  ["descricao não string", { descricao: 5 }],
  ["descricao objeto", { descricao: { a: 1 } }],
  ["início ausente", { data_hora_inicio: undefined }],
  ["início null", { data_hora_inicio: null }],
  ["início sem fuso", { data_hora_inicio: "2026-10-10T09:00:00" }],
  ["início só data", { data_hora_inicio: "2026-10-10" }],
  ["início em formato inválido", { data_hora_inicio: "10/10/2026 09:00" }],
  ["início inexistente (30/02)", { data_hora_inicio: "2026-02-30T10:00:00-03:00" }],
  ["início inexistente (31/04)", { data_hora_inicio: "2026-04-31T10:00:00Z" }],
  ["início com mês 13", { data_hora_inicio: "2026-13-01T10:00:00Z" }],
  ["início com hora 25", { data_hora_inicio: "2026-10-10T25:00:00Z" }],
  ["início não string", { data_hora_inicio: 20261010 }],
  ["fim sem fuso", { data_hora_fim: "2026-10-10T13:00:00" }],
  ["fim em formato inválido", { data_hora_fim: "amanhã" }],
  ["fim inexistente (30/02)", { data_hora_fim: "2026-02-30T10:00:00Z" }],
  ["fim não string", { data_hora_fim: 1 }],
  ["fim anterior ao início", { data_hora_fim: "2026-10-10T11:59:59Z" }],
  [
    "fim anterior ao início só pelo offset",
    { data_hora_inicio: "2026-10-10T09:00:00-03:00", data_hora_fim: "2026-10-10T11:00:00Z" },
  ],
];

// Campos que o cliente não controla: ignorados, nunca gravados.
export const CAMPOS_FORJADOS = {
  id: 999,
  idoso_id: 77,
  criado_por_id: 77,
  editado_por_id: 77,
  created_at: "2000-01-01T00:00:00Z",
  updated_at: "2000-01-01T00:00:00Z",
};
