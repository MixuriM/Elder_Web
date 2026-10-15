import { ELENCO } from "./elenco";
import { VERSOES_DOCUMENTOS } from "../versoesDocumentos";

// Modo demonstração (D4): conteúdo FICTÍCIO das seis contas do elenco. Função pura do "agora": sem Math.random nem
// Date.now, mesmo agora dá a mesma saída. Tudo é relativo ao dia de hoje em Brasília (Intl com timeZone explícito,
// nunca o fuso do processo). Autoria segue as regras de ator das rotas: cuidador nunca cria medicamento nem refeição
// e só registra saúde, dose e evento 'cuidado' com a flag; familiar só escreve com modo_decisao 'familiar' do idoso.
// Texto curto, dentro dos limites das rotas e só em Latin-1 (o PDF do histórico troca o resto por ?).

export type Slug = (typeof ELENCO)[number]["slug"];

export type DadosDemo = {
  usuarios: {
    slug: Slug;
    modo_decisao: "idoso" | "familiar" | null;
    modo_decisao_alterado_por: Slug | null;
    modo_decisao_alterado_em: Date | null;
    aceite_documentos_em: Date;
    aceite_documentos_versao: string;
  }[];
  vinculos: {
    idoso: Slug;
    vinculado: Slug;
    tipo_vinculo: "cuidador" | "familiar";
    origem: "solicitacao_cuidador" | "solicitacao_familiar";
    status: "aprovado" | "pendente";
    aprovador: Slug | null;
    data_solicitacao: Date;
    data_resposta: Date | null;
    confirmado_em: null;
    permite_registrar_saude: boolean;
    permite_marcar_dose: boolean;
    permite_criar_evento_cuidado: boolean;
    definido_por: Slug | null;
    definido_em: Date | null;
  }[];
  saude: {
    idoso: Slug;
    registrado_por: Slug;
    tipo_medicao: string;
    valor_1: number;
    valor_2: number | null;
    unidade: string;
    data_hora: Date;
    observacoes: string | null;
  }[];
  medicamentos: {
    idoso: Slug;
    criado_por: Slug;
    nome: string;
    dosagem: string;
    frequencia: string;
    data_inicio: string; // YYYY-MM-DD
    data_fim: string | null;
    observacoes: string | null;
    ativo: boolean;
    doses: { registrado_por: Slug; data_hora: Date; status_administracao: "administrado" | "pulado" | "atrasado"; observacoes: string | null }[];
  }[];
  eventos: {
    idoso: Slug;
    criado_por: Slug;
    tipo_evento: "cuidado" | "medico" | "pessoal";
    titulo: string;
    descricao: string | null;
    data_hora_inicio: Date;
    data_hora_fim: Date | null;
  }[];
  refeicoes: { idoso: Slug; registrado_por: Slug; refeicao: string; descricao: string; data_hora: Date }[];
};

const HELENA = "idosa-helena";
const ANTONIO = "idoso-antonio";
const MARTA = "cuidadora-marta";
const PAULO = "cuidador-paulo";
const CARLOS = "familiar-carlos";
const RENATA = "familiar-renata";

const PARTES = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function partesSP(d: Date) {
  const p = Object.fromEntries(PARTES.formatToParts(d).map((x) => [x.type, Number(x.value)]));
  return { ano: p.year, mes: p.month, dia: p.day, hora: p.hour, minuto: p.minute };
}

// Instante de um horário de parede em Brasília. O deslocamento vem do Intl (não fixa -03:00); Date.UTC aceita dia
// fora do mês (32 vira o dia 1 do mês seguinte), então o deslocamento em dias entra direto no dia.
function instanteSP(ano: number, mes: number, dia: number, hora: number, minuto: number): Date {
  const palpite = Date.UTC(ano, mes - 1, dia, hora, minuto);
  const p = partesSP(new Date(palpite));
  const parede = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto);
  return new Date(palpite - (parede - palpite));
}

// Valores fixos (índice 0 = 13 dias atrás). Pressão de Helena alta e com melhora nos últimos 5 dias.
const SISTOLICA_HELENA = [142, 145, 140, 138, 144, 141, 139, 143, 137, 131, 128, 126, 123, 121];
const DIASTOLICA_HELENA = [90, 92, 89, 88, 91, 90, 88, 92, 87, 84, 83, 81, 80, 79];
const GLICEMIA_HELENA = [128, 131, 124, 135, 122, 119, 126, 118, 112, 109, 104, 101, 98, 96];
const FC_HELENA = [76, 74, 72, 75, 71, 73, 72];
// Índice 0 = 9 dias atrás.
const SISTOLICA_ANTONIO = [134, 130, 136, 132, 128, 131, 127, 129, 126, 125];
const DIASTOLICA_ANTONIO = [86, 84, 88, 85, 83, 84, 82, 83, 81, 80];

const CARDAPIO: Record<string, string[]> = {
  cafe_manha: [
    "Pão integral, queijo branco e café com leite",
    "Mamão, aveia e café com leite",
    "Tapioca com ovo e chá de camomila",
    "Pão francês com manteiga e café com leite",
    "Iogurte natural com banana e granola",
  ],
  lanche_manha: ["Banana com canela", "Iogurte natural", "Meia maçã"],
  almoco: [
    "Arroz, feijão, frango grelhado e salada de alface",
    "Arroz integral, lentilha, peixe assado e legumes",
    "Macarrão com molho de tomate e carne moída",
    "Arroz, feijão, omelete e salada de tomate",
    "Sopa de legumes com frango desfiado",
  ],
  lanche_tarde: ["Maçã e duas castanhas", "Bolo de cenoura e café", "Vitamina de banana", "Biscoito de polvilho e chá", "Pera"],
  jantar: [
    "Sopa de legumes e pão",
    "Omelete de espinafre e salada",
    "Arroz, frango ensopado e chuchu",
    "Caldo de mandioquinha",
    "Sanduíche natural e suco de laranja",
  ],
  ceia: ["Chá de camomila e duas torradas", "Leite morno", "Chá de erva-doce"],
};

export function montarDadosDemo(agora: Date): DadosDemo {
  const hoje = partesSP(agora);
  // Horário de parede em Brasília, d dias a partir de hoje (negativo = passado).
  const em = (d: number, hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return instanteSP(hoje.ano, hoje.mes, hoje.dia + d, h, m);
  };
  const dataISO = (d: number) => new Date(Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia + d)).toISOString().slice(0, 10);
  const diaSemana = (d: number) => new Date(Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia + d)).getUTCDay();
  const passou = (t: Date) => t.getTime() <= agora.getTime();
  // Hoje fica parcial: só o que já passou e nada da noite (as doses e refeições da noite ficam para marcar ao vivo).
  const registravel = (d: number, hhmm: string) => passou(em(d, hhmm)) && (d < 0 || hhmm < "18:00");

  const versao = VERSOES_DOCUMENTOS[VERSOES_DOCUMENTOS.length - 1];
  const usuarios: DadosDemo["usuarios"] = ELENCO.map((c) => ({
    slug: c.slug,
    modo_decisao: c.slug === HELENA ? "idoso" : c.slug === ANTONIO ? "familiar" : null,
    // Antônio passou a decisão à família depois de Renata aprovada (PATCH /usuario/me/modo-decisao grava ele mesmo).
    modo_decisao_alterado_por: c.slug === ANTONIO ? ANTONIO : null,
    modo_decisao_alterado_em: c.slug === ANTONIO ? em(-280, "16:00") : null,
    aceite_documentos_em: em(-365, "10:00"),
    aceite_documentos_versao: versao,
  }));

  const semFlags = { permite_registrar_saude: false, permite_marcar_dose: false, permite_criar_evento_cuidado: false };
  const vinculos: DadosDemo["vinculos"] = [
    {
      idoso: HELENA, vinculado: MARTA, tipo_vinculo: "cuidador", origem: "solicitacao_cuidador", status: "aprovado",
      aprovador: HELENA, data_solicitacao: em(-120, "09:00"), data_resposta: em(-119, "10:00"), confirmado_em: null,
      permite_registrar_saude: true, permite_marcar_dose: true, permite_criar_evento_cuidado: true,
      definido_por: HELENA, definido_em: em(-119, "10:05"),
    },
    {
      idoso: HELENA, vinculado: CARLOS, tipo_vinculo: "familiar", origem: "solicitacao_familiar", status: "aprovado",
      aprovador: HELENA, data_solicitacao: em(-200, "18:00"), data_resposta: em(-199, "09:00"), confirmado_em: null,
      ...semFlags, definido_por: null, definido_em: null,
    },
    {
      idoso: HELENA, vinculado: PAULO, tipo_vinculo: "cuidador", origem: "solicitacao_cuidador", status: "pendente",
      aprovador: null, data_solicitacao: em(-1, "10:00"), data_resposta: null, confirmado_em: null,
      ...semFlags, definido_por: null, definido_em: null,
    },
    {
      idoso: ANTONIO, vinculado: RENATA, tipo_vinculo: "familiar", origem: "solicitacao_familiar", status: "aprovado",
      aprovador: ANTONIO, data_solicitacao: em(-300, "14:00"), data_resposta: em(-299, "09:00"), confirmado_em: null,
      ...semFlags, definido_por: null, definido_em: null,
    },
    {
      // Com a decisão na família, quem aprova o cuidador e liga as flags é Renata.
      idoso: ANTONIO, vinculado: MARTA, tipo_vinculo: "cuidador", origem: "solicitacao_cuidador", status: "aprovado",
      aprovador: RENATA, data_solicitacao: em(-90, "09:00"), data_resposta: em(-89, "11:00"), confirmado_em: null,
      ...semFlags, permite_marcar_dose: true, definido_por: RENATA, definido_em: em(-89, "11:05"),
    },
  ];

  const saude: DadosDemo["saude"] = [];
  const leitura = (idoso: Slug, por: Slug, d: number, hhmm: string, tipo: string, v1: number, v2: number | null, unidade: string, obs: string | null = null) => {
    if (passou(em(d, hhmm))) saude.push({ idoso, registrado_por: por, tipo_medicao: tipo, valor_1: v1, valor_2: v2, unidade, data_hora: em(d, hhmm), observacoes: obs });
  };
  for (let i = 0; i < 14; i++) {
    const d = i - 13;
    leitura(HELENA, HELENA, d, "07:00", "Glicemia em jejum", GLICEMIA_HELENA[i], null, "mg/dL", i === 3 ? "Em jejum" : null);
    if (i === 0 || i === 7 || i === 13) leitura(HELENA, HELENA, d, "07:15", "Peso", [68.4, 68.1, 67.9][[0, 7, 13].indexOf(i)], null, "kg");
    leitura(HELENA, i % 2 === 0 ? HELENA : MARTA, d, "08:00", "Pressão arterial", SISTOLICA_HELENA[i], DIASTOLICA_HELENA[i], "mmHg", i === 1 ? "Sentiu tontura leve" : null);
    if (i % 2 === 1) {
      leitura(HELENA, MARTA, d, "08:05", "Frequência cardíaca", FC_HELENA[(i - 1) / 2], null, "bpm");
      leitura(HELENA, MARTA, d, "18:00", "Pressão arterial", SISTOLICA_HELENA[i] - 3, DIASTOLICA_HELENA[i] - 2, "mmHg", i === 9 ? "Após caminhada" : null);
    }
  }
  for (let i = 0; i < 10; i++) {
    const d = i - 9;
    if (i === 0 || i === 7) leitura(ANTONIO, ANTONIO, d, "08:00", "Peso", i === 0 ? 76.2 : 75.8, null, "kg");
    leitura(ANTONIO, i % 2 === 0 ? ANTONIO : RENATA, d, "08:30", "Pressão arterial", SISTOLICA_ANTONIO[i], DIASTOLICA_ANTONIO[i], "mmHg");
  }

  type Esquema = Omit<DadosDemo["medicamentos"][number], "doses" | "idoso" | "criado_por"> & { horarios: string[]; dias: number[] };
  const ultimos = (n: number) => Array.from({ length: n }, (_, i) => i - (n - 1));
  // Exceções fixas de dose: [nome, dia, horário] => status, horário real e observação.
  const EXCECOES: Record<string, { status: "pulado" | "atrasado"; hora?: string; obs: string }> = {
    "Metformina -4 07:30": { status: "pulado", obs: "Enjoo pela manhã" },
    "Sinvastatina -2 21:00": { status: "pulado", obs: "Esqueceu, já estava dormindo" },
    "Losartana -3 08:00": { status: "atrasado", hora: "10:15", obs: "Tomou depois do café" },
    "AAS -2 13:00": { status: "atrasado", hora: "15:10", obs: "Tomou à tarde" },
  };
  const medicamentos: DadosDemo["medicamentos"] = [];
  const receitar = (idoso: Slug, criado_por: Slug, autorDose: (hora: string) => Slug, esquemas: Esquema[]) => {
    for (const { horarios, dias, ...m } of esquemas) {
      const doses: DadosDemo["medicamentos"][number]["doses"] = [];
      for (const d of dias) {
        for (const hora of horarios) {
          if (!registravel(d, hora)) continue;
          const x = EXCECOES[`${m.nome} ${d} ${hora}`];
          doses.push({
            registrado_por: autorDose(hora),
            data_hora: em(d, x?.hora ?? hora),
            status_administracao: x?.status ?? "administrado",
            observacoes: x?.obs ?? null,
          });
        }
      }
      medicamentos.push({ idoso, criado_por, ...m, doses });
    }
  };
  receitar(HELENA, HELENA, (hora) => (hora === "08:00" || hora === "19:00" ? MARTA : HELENA), [
    { nome: "Losartana", dosagem: "50 mg", frequencia: "1 vez ao dia, pela manhã", data_inicio: dataISO(-240), data_fim: null, observacoes: "Para a pressão. Tomar com água.", ativo: true, horarios: ["08:00"], dias: ultimos(7) },
    { nome: "Metformina", dosagem: "850 mg", frequencia: "2 vezes ao dia, no café da manhã e no jantar", data_inicio: dataISO(-400), data_fim: null, observacoes: "Tomar junto com a refeição.", ativo: true, horarios: ["07:30", "19:00"], dias: ultimos(7) },
    { nome: "Sinvastatina", dosagem: "20 mg", frequencia: "1 vez ao dia, à noite", data_inicio: dataISO(-180), data_fim: null, observacoes: null, ativo: true, horarios: ["21:00"], dias: ultimos(7) },
    { nome: "Omeprazol", dosagem: "20 mg", frequencia: "1 vez ao dia, em jejum", data_inicio: dataISO(-150), data_fim: null, observacoes: "Tomar 30 minutos antes do café.", ativo: true, horarios: ["06:30"], dias: ultimos(7) },
    // Tratamento já encerrado: aparece no histórico como passado.
    { nome: "Amoxicilina", dosagem: "500 mg", frequencia: "De 8 em 8 horas, por 7 dias", data_inicio: dataISO(-27), data_fim: dataISO(-21), observacoes: "Infecção de garganta, tratamento concluído.", ativo: false, horarios: ["06:00", "14:00", "22:00"], dias: [-27, -26, -25, -24, -23, -22, -21] },
  ]);
  receitar(ANTONIO, RENATA, (hora) => (hora === "08:00" ? MARTA : ANTONIO), [
    { nome: "Enalapril", dosagem: "10 mg", frequencia: "1 vez ao dia, pela manhã", data_inicio: dataISO(-300), data_fim: null, observacoes: null, ativo: true, horarios: ["08:00"], dias: ultimos(5) },
    { nome: "Levotiroxina", dosagem: "50 mcg", frequencia: "1 vez ao dia, em jejum", data_inicio: dataISO(-500), data_fim: null, observacoes: "Tomar 30 minutos antes do café.", ativo: true, horarios: ["06:30"], dias: ultimos(5) },
    { nome: "AAS", dosagem: "100 mg", frequencia: "1 vez ao dia, após o almoço", data_inicio: dataISO(-200), data_fim: null, observacoes: null, ativo: true, horarios: ["13:00"], dias: ultimos(5) },
  ]);

  const eventos: DadosDemo["eventos"] = [];
  const evento = (idoso: Slug, criado_por: Slug, tipo_evento: DadosDemo["eventos"][number]["tipo_evento"], titulo: string, descricao: string | null, inicio: Date, fim: Date | null = null) =>
    eventos.push({ idoso, criado_por, tipo_evento, titulo, descricao, data_hora_inicio: inicio, data_hora_fim: fim });
  const sabadoPassado = [-1, -2, -3, -4, -5, -6, -7].find((d) => diaSemana(d) === 6) as number;
  const domingoQueVem = [1, 2, 3, 4, 5, 6, 7].find((d) => diaSemana(d) === 0) as number;
  evento(HELENA, HELENA, "medico", "Consulta com cardiologista", "Revisão da pressão. Levar o caderno de medições.", em(-5, "14:00"), em(-5, "15:00"));
  evento(HELENA, HELENA, "medico", "Exames de sangue", "Laboratório. Ir em jejum de 12 horas.", em(-2, "07:00"));
  evento(HELENA, HELENA, "pessoal", "Visita da neta", "Lanche da tarde em casa.", em(sabadoPassado, "16:30"));
  // Hoje: um compromisso que já passou e um que ainda vem, para o resumo do dia da Home.
  const horaPassada = `${String(Math.max(0, hoje.hora - 1)).padStart(2, "0")}:00`;
  const horaFutura = hoje.hora + 2 > 23 ? "23:59" : `${String(hoje.hora + 2).padStart(2, "0")}:00`;
  evento(HELENA, HELENA, "pessoal", "Caminhada leve", "Volta no quarteirão, com calçado confortável.", em(0, horaPassada));
  evento(HELENA, HELENA, "pessoal", "Chamada de vídeo com a família", "Carlos liga pelo celular.", em(0, horaFutura), new Date(em(0, horaFutura).getTime() + 30 * 60_000));
  evento(HELENA, HELENA, "medico", "Consulta com geriatra", "Levar exames anteriores e a lista de remédios.", em(1, "09:00"), em(1, "10:00"));
  for (let d = 1; d <= 14; d++) {
    if (diaSemana(d) === 2 || diaSemana(d) === 4) evento(HELENA, HELENA, "medico", "Fisioterapia", "Exercícios de equilíbrio e alongamento.", em(d, "15:00"), em(d, "16:00"));
  }
  evento(HELENA, HELENA, "pessoal", "Almoço em família", "Na casa do Carlos. Ele busca às 11h30.", em(domingoQueVem, "12:30"));
  evento(HELENA, HELENA, "medico", "Retorno com cardiologista", "Levar os exames de sangue.", em(21, "14:00"));
  for (const d of [1, 2, 3, 4, 5, 6]) {
    if (d % 2 === 1) evento(HELENA, MARTA, "cuidado", "Aferir pressão", "Anotar o valor no Elder Web.", em(d, "08:00"));
    else evento(HELENA, MARTA, "cuidado", "Banho assistido", "Separar toalha e roupa antes.", em(d, "10:00"));
  }
  evento(ANTONIO, RENATA, "medico", "Consulta com endocrinologista", "Ajuste da dose da levotiroxina.", em(-6, "10:00"));
  evento(ANTONIO, ANTONIO, "medico", "Fisioterapia", "Fortalecimento das pernas.", em(-2, "09:00"));
  evento(ANTONIO, ANTONIO, "medico", "Fisioterapia", "Fortalecimento das pernas.", em(2, "09:00"));
  evento(ANTONIO, RENATA, "pessoal", "Retirar receita", "Na unidade de saúde do bairro. Levar documento.", em(1, "11:00"));
  evento(ANTONIO, RENATA, "pessoal", "Aniversário do neto", "Festa em família.", em(6, "18:00"), em(6, "21:00"));
  evento(ANTONIO, ANTONIO, "medico", "Fisioterapia", "Fortalecimento das pernas.", em(9, "09:00"));
  evento(ANTONIO, RENATA, "medico", "Retorno com endocrinologista", "Levar o resultado do exame de tireoide.", em(20, "10:00"));

  const refeicoes: DadosDemo["refeicoes"] = [];
  const comer = (idoso: Slug, por: Slug, d: number, hhmm: string, refeicao: string, indice: number) => {
    // Hoje só café e almoço (o resto do dia fica para registrar ao vivo).
    if (!passou(em(d, hhmm)) || (d === 0 && refeicao !== "cafe_manha" && refeicao !== "almoco")) return;
    const opcoes = CARDAPIO[refeicao];
    refeicoes.push({ idoso, registrado_por: por, refeicao, descricao: opcoes[indice % opcoes.length], data_hora: em(d, hhmm) });
  };
  for (let i = 0; i < 5; i++) {
    const d = i - 4;
    comer(HELENA, HELENA, d, "07:30", "cafe_manha", i);
    if (d === -4 || d === -2 || d === -1) comer(HELENA, HELENA, d, "10:00", "lanche_manha", i);
    comer(HELENA, HELENA, d, "12:00", "almoco", i);
    comer(HELENA, HELENA, d, "16:00", "lanche_tarde", i);
    comer(HELENA, HELENA, d, "19:00", "jantar", i);
    if (d === -3 || d === -2 || d === -1) comer(HELENA, HELENA, d, "21:30", "ceia", i);
  }
  for (let i = 0; i < 3; i++) {
    const d = i - 2;
    comer(ANTONIO, ANTONIO, d, "07:00", "cafe_manha", i + 1);
    comer(ANTONIO, RENATA, d, "12:30", "almoco", i + 2);
    comer(ANTONIO, RENATA, d, "16:00", "lanche_tarde", i + 3);
    comer(ANTONIO, ANTONIO, d, "19:30", "jantar", i + 1);
  }

  return { usuarios, vinculos, saude, medicamentos, eventos, refeicoes };
}
