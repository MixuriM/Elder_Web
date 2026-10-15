import { ELENCO } from "./elenco";
import { montarDadosDemo, type DadosDemo, type Slug } from "./dados";
import { VERSOES_DOCUMENTOS } from "../versoesDocumentos";

// Modo demonstração (D4): a semente é uma função pura do "agora". Todo conteúdo é FICTÍCIO.
// Os validadores das rotas não são exportados: os limites abaixo foram lidos de saude.ts, remedios.ts, agenda.ts e
// alimentacao.ts (e das colunas do schema.prisma) em 2026-10-15.
const LIMITES = {
  tipo_medicao: 50,
  unidade: 20,
  observacoesSaude: 300,
  nomeMedicamento: 150,
  dosagem: 50,
  frequencia: 100,
  observacoesMedicamento: 500,
  observacoesDose: 300,
  titulo: 150,
  descricaoEvento: 500,
  descricaoRefeicao: 500,
  decimal: 9999.99,
};
const REFEICOES = ["cafe_manha", "lanche_manha", "almoco", "lanche_tarde", "jantar", "ceia"];
const TIPOS_EVENTO = ["cuidado", "medico", "pessoal"];
const STATUS_DOSE = ["administrado", "pulado", "atrasado"];
const TOLERANCIA_FUTURO_MS = 5 * 60 * 1000;

// Quinta-feira, 15/10/2026, 14:00 em Brasília.
const AGORA = new Date("2026-10-15T17:00:00Z");

const DIA_SP = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
const HORA_SP = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const diaSP = (d: Date) => DIA_SP.format(d);
const horaSP = (d: Date) => HORA_SP.format(d);
const DIA_MS = 86_400_000;
// Dias de calendário (em Brasília) entre a data de d e a de AGORA. Negativo = passado.
const diasDesde = (d: Date, agora = AGORA) =>
  Math.round((Date.parse(diaSP(d)) - Date.parse(diaSP(agora))) / DIA_MS);

const dados = montarDadosDemo(AGORA);
const de = <T extends { idoso: Slug }>(linhas: T[], idoso: Slug) => linhas.filter((l) => l.idoso === idoso);
const doses = (d: DadosDemo, idoso: Slug) =>
  de(d.medicamentos, idoso).flatMap((m) => m.doses.map((dose) => ({ ...dose, medicamento: m })));

describe("montarDadosDemo: determinismo", () => {
  it("mesmo agora, mesma saída (sem Math.random nem Date.now)", () => {
    const random = jest.spyOn(Math, "random");
    const now = jest.spyOn(Date, "now");
    expect(montarDadosDemo(new Date(AGORA))).toEqual(montarDadosDemo(new Date(AGORA)));
    expect(random).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
    random.mockRestore();
    now.mockRestore();
  });

  it("volume total por restauração entre 200 e 400 linhas", () => {
    const total =
      dados.usuarios.length +
      dados.vinculos.length +
      dados.saude.length +
      dados.medicamentos.length +
      dados.medicamentos.reduce((n, m) => n + m.doses.length, 0) +
      dados.eventos.length +
      dados.refeicoes.length;
    expect(total).toBeGreaterThanOrEqual(200);
    expect(total).toBeLessThanOrEqual(400);
  });
});

describe("montarDadosDemo: contas e vínculos", () => {
  it("uma linha de usuário por conta do elenco, com aceite na versão atual e modo de decisão de cada idoso", () => {
    expect(dados.usuarios.map((u) => u.slug)).toEqual(ELENCO.map((c) => c.slug));
    const versao = VERSOES_DOCUMENTOS[VERSOES_DOCUMENTOS.length - 1];
    for (const u of dados.usuarios) {
      expect(u.aceite_documentos_versao).toBe(versao);
      expect(u.aceite_documentos_em.getTime()).toBeLessThan(AGORA.getTime());
    }
    const modo = Object.fromEntries(dados.usuarios.map((u) => [u.slug, u.modo_decisao]));
    expect(modo).toEqual({
      "idosa-helena": "idoso",
      "idoso-antonio": "familiar",
      "cuidadora-marta": null,
      "cuidador-paulo": null,
      "familiar-carlos": null,
      "familiar-renata": null,
    });
    const antonio = dados.usuarios.find((u) => u.slug === "idoso-antonio");
    expect(antonio?.modo_decisao_alterado_por).toBe("idoso-antonio");
    expect(antonio?.modo_decisao_alterado_em).toBeInstanceOf(Date);
  });

  it("cinco vínculos com os três estados da apresentação e as flags da D3", () => {
    const resumo = dados.vinculos.map((v) => [v.idoso, v.vinculado, v.tipo_vinculo, v.origem, v.status, v.aprovador]);
    expect(resumo).toEqual([
      ["idosa-helena", "cuidadora-marta", "cuidador", "solicitacao_cuidador", "aprovado", "idosa-helena"],
      ["idosa-helena", "familiar-carlos", "familiar", "solicitacao_familiar", "aprovado", "idosa-helena"],
      ["idosa-helena", "cuidador-paulo", "cuidador", "solicitacao_cuidador", "pendente", null],
      ["idoso-antonio", "familiar-renata", "familiar", "solicitacao_familiar", "aprovado", "idoso-antonio"],
      ["idoso-antonio", "cuidadora-marta", "cuidador", "solicitacao_cuidador", "aprovado", "familiar-renata"],
    ]);
    const flags = (idoso: Slug, vinculado: Slug) => {
      const v = dados.vinculos.find((x) => x.idoso === idoso && x.vinculado === vinculado);
      return [v?.permite_registrar_saude, v?.permite_marcar_dose, v?.permite_criar_evento_cuidado];
    };
    expect(flags("idosa-helena", "cuidadora-marta")).toEqual([true, true, true]);
    expect(flags("idoso-antonio", "cuidadora-marta")).toEqual([false, true, false]);
    expect(flags("idosa-helena", "cuidador-paulo")).toEqual([false, false, false]);
    expect(flags("idosa-helena", "familiar-carlos")).toEqual([false, false, false]);
  });

  it("datas do vínculo coerentes com o que as rotas gravam", () => {
    const perfil = (s: Slug) => ELENCO.find((c) => c.slug === s)?.tipo_perfil;
    for (const v of dados.vinculos) {
      expect(perfil(v.idoso)).toBe("idoso");
      expect(perfil(v.vinculado)).toBe(v.tipo_vinculo);
      expect(v.data_solicitacao.getTime()).toBeLessThan(AGORA.getTime());
      expect(v.confirmado_em).toBeNull(); // nenhuma origem automática na semente
      if (v.status === "pendente") {
        expect([v.aprovador, v.data_resposta, v.definido_por, v.definido_em]).toEqual([null, null, null, null]);
      } else {
        expect(v.data_resposta!.getTime()).toBeGreaterThan(v.data_solicitacao.getTime());
        expect(v.data_resposta!.getTime()).toBeLessThan(AGORA.getTime());
      }
      const temFlag = v.permite_registrar_saude || v.permite_marcar_dose || v.permite_criar_evento_cuidado;
      if (temFlag) {
        expect(v.tipo_vinculo).toBe("cuidador");
        expect(v.status).toBe("aprovado");
        expect(v.definido_por).toBe(v.aprovador);
        expect(v.definido_em!.getTime()).toBeGreaterThanOrEqual(v.data_resposta!.getTime());
      } else {
        expect(v.definido_por).toBeNull();
      }
    }
    // Renata aprovou Marta depois que Antônio passou a decisão para a família.
    const antonio = dados.usuarios.find((u) => u.slug === "idoso-antonio")!;
    const marta = dados.vinculos.find((v) => v.idoso === "idoso-antonio" && v.vinculado === "cuidadora-marta")!;
    const renata = dados.vinculos.find((v) => v.vinculado === "familiar-renata")!;
    expect(renata.data_resposta!.getTime()).toBeLessThan(antonio.modo_decisao_alterado_em!.getTime());
    expect(antonio.modo_decisao_alterado_em!.getTime()).toBeLessThan(marta.data_resposta!.getTime());
  });
});

describe("montarDadosDemo: Helena (conta principal)", () => {
  const saude = de(dados.saude, "idosa-helena");

  it("saúde: 14 dias, média de 3 registros por dia, pressão, glicemia em jejum, peso e mais um tipo", () => {
    const dias = new Set(saude.map((r) => diaSP(r.data_hora)));
    expect(dias.size).toBe(14);
    expect(saude.length).toBeGreaterThanOrEqual(36);
    expect(Math.min(...saude.map((r) => diasDesde(r.data_hora)))).toBe(-13);
    const tipos = new Set(saude.map((r) => r.tipo_medicao));
    expect(tipos).toEqual(new Set(["Pressão arterial", "Glicemia em jejum", "Peso", "Frequência cardíaca"]));
    expect(saude.filter((r) => r.observacoes !== null).length).toBeGreaterThanOrEqual(2);
    expect(new Set(saude.map((r) => r.registrado_por))).toEqual(new Set(["idosa-helena", "cuidadora-marta"]));
  });

  it("pressão entre 120/80 e 145/92, com melhora nos últimos 5 dias", () => {
    const pressao = saude.filter((r) => r.tipo_medicao === "Pressão arterial");
    for (const r of pressao) {
      expect(r.unidade).toBe("mmHg");
      expect(r.valor_1).toBeGreaterThanOrEqual(118);
      expect(r.valor_1).toBeLessThanOrEqual(145);
      expect(r.valor_2).toBeGreaterThanOrEqual(76);
      expect(r.valor_2).toBeLessThanOrEqual(92);
    }
    const media = (rs: typeof pressao) => rs.reduce((n, r) => n + r.valor_1, 0) / rs.length;
    const recentes = pressao.filter((r) => diasDesde(r.data_hora) >= -4);
    const antigos = pressao.filter((r) => diasDesde(r.data_hora) < -4);
    expect(media(recentes)).toBeLessThan(media(antigos) - 8);
  });

  it("glicemia de 95 a 135 mg/dL e peso semanal perto de 68 kg", () => {
    for (const r of saude.filter((x) => x.tipo_medicao === "Glicemia em jejum")) {
      expect([r.unidade, r.valor_2]).toEqual(["mg/dL", null]);
      expect(r.valor_1).toBeGreaterThanOrEqual(95);
      expect(r.valor_1).toBeLessThanOrEqual(135);
    }
    const peso = saude.filter((x) => x.tipo_medicao === "Peso");
    expect(peso.length).toBeGreaterThanOrEqual(2);
    for (const r of peso) {
      expect(r.unidade).toBe("kg");
      expect(Math.abs(r.valor_1 - 68)).toBeLessThanOrEqual(1.5);
    }
  });

  it("remédios: 4 ativos (desde meses atrás) e 1 encerrado há cerca de 3 semanas, todos criados por Helena", () => {
    const meds = de(dados.medicamentos, "idosa-helena");
    expect(meds.filter((m) => m.ativo).map((m) => m.nome).sort()).toEqual(["Losartana", "Metformina", "Omeprazol", "Sinvastatina"]);
    const encerrado = meds.filter((m) => !m.ativo);
    expect(encerrado).toHaveLength(1);
    expect(diasDesde(new Date(`${encerrado[0].data_fim}T12:00:00Z`))).toBeGreaterThanOrEqual(-24);
    expect(diasDesde(new Date(`${encerrado[0].data_fim}T12:00:00Z`))).toBeLessThanOrEqual(-18);
    for (const m of meds.filter((x) => x.ativo)) {
      expect(diasDesde(new Date(`${m.data_inicio}T12:00:00Z`))).toBeLessThanOrEqual(-60);
      expect(m.data_fim).toBeNull();
    }
    expect(new Set(meds.map((m) => m.criado_por))).toEqual(new Set(["idosa-helena"]));
  });

  it("doses dos últimos 7 dias: cerca de 90% administradas, 2 puladas com observação e 1 atrasada", () => {
    const ds = doses(dados, "idosa-helena").filter((d) => d.medicamento.ativo);
    expect(new Set(ds.map((d) => diasDesde(d.data_hora)))).toEqual(new Set([-6, -5, -4, -3, -2, -1, 0]));
    const puladas = ds.filter((d) => d.status_administracao === "pulado");
    expect(puladas).toHaveLength(2);
    for (const d of puladas) expect(d.observacoes).toBeTruthy();
    expect(ds.filter((d) => d.status_administracao === "atrasado")).toHaveLength(1);
    expect(ds.filter((d) => d.status_administracao === "administrado").length / ds.length).toBeGreaterThanOrEqual(0.85);
    expect(new Set(ds.map((d) => d.registrado_por))).toEqual(new Set(["idosa-helena", "cuidadora-marta"]));
  });

  it("agenda: 3 passados, 2 hoje (um já foi, um por vir) e pelo menos 8 futuros, com cuidado só da Marta", () => {
    const evs = de(dados.eventos, "idosa-helena");
    expect(evs.filter((e) => diasDesde(e.data_hora_inicio) < 0)).toHaveLength(3);
    const hoje = evs.filter((e) => diasDesde(e.data_hora_inicio) === 0);
    expect(hoje).toHaveLength(2);
    expect(hoje.filter((e) => e.data_hora_inicio <= AGORA)).toHaveLength(1);
    expect(hoje.filter((e) => e.data_hora_inicio > AGORA)).toHaveLength(1);
    expect(evs.filter((e) => diasDesde(e.data_hora_inicio) > 0).length).toBeGreaterThanOrEqual(8);
    expect(evs.some((e) => e.data_hora_fim !== null)).toBe(true);
    expect(evs.some((e) => diasDesde(e.data_hora_inicio) >= 20)).toBe(true);
    const cuidado = evs.filter((e) => e.tipo_evento === "cuidado");
    expect(cuidado.length).toBeGreaterThanOrEqual(2);
    expect(new Set(cuidado.map((e) => e.criado_por))).toEqual(new Set(["cuidadora-marta"]));
    const amanha = evs.filter((e) => diasDesde(e.data_hora_inicio) === 1 && e.tipo_evento === "medico");
    expect(amanha.map((e) => horaSP(e.data_hora_inicio))).toContain("09:00");
  });

  it("alimentação: últimos 5 dias, os 6 tipos de refeição, todas registradas por Helena", () => {
    const refs = de(dados.refeicoes, "idosa-helena");
    expect(new Set(refs.map((r) => diasDesde(r.data_hora)))).toEqual(new Set([-4, -3, -2, -1, 0]));
    expect(new Set(refs.map((r) => r.refeicao))).toEqual(new Set(REFEICOES));
    expect(new Set(refs.map((r) => r.registrado_por))).toEqual(new Set(["idosa-helena"]));
  });
});

describe("montarDadosDemo: Antônio (decisão da família)", () => {
  it("saúde: 10 dias de pressão e peso, autoria alternada entre Antônio e Renata", () => {
    const saude = de(dados.saude, "idoso-antonio");
    expect(new Set(saude.map((r) => diaSP(r.data_hora))).size).toBe(10);
    expect(new Set(saude.map((r) => r.tipo_medicao))).toEqual(new Set(["Pressão arterial", "Peso"]));
    expect(new Set(saude.map((r) => r.registrado_por))).toEqual(new Set(["idoso-antonio", "familiar-renata"]));
  });

  it("remédios: 3 ativos criados por Renata; doses dos últimos 5 dias por Antônio e Marta", () => {
    const meds = de(dados.medicamentos, "idoso-antonio");
    expect(meds.map((m) => [m.nome, m.ativo, m.criado_por])).toEqual([
      ["Enalapril", true, "familiar-renata"],
      ["Levotiroxina", true, "familiar-renata"],
      ["AAS", true, "familiar-renata"],
    ]);
    const ds = doses(dados, "idoso-antonio");
    expect(new Set(ds.map((d) => diasDesde(d.data_hora)))).toEqual(new Set([-4, -3, -2, -1, 0]));
    expect(new Set(ds.map((d) => d.registrado_por))).toEqual(new Set(["idoso-antonio", "cuidadora-marta"]));
  });

  it("agenda: 2 passados e 5 futuros, sem evento de cuidado, criados por Antônio ou Renata", () => {
    const evs = de(dados.eventos, "idoso-antonio");
    expect(evs.filter((e) => diasDesde(e.data_hora_inicio) < 0)).toHaveLength(2);
    expect(evs.filter((e) => diasDesde(e.data_hora_inicio) > 0)).toHaveLength(5);
    expect(evs.some((e) => e.tipo_evento === "cuidado")).toBe(false);
    expect(new Set(evs.map((e) => e.criado_por))).toEqual(new Set(["idoso-antonio", "familiar-renata"]));
    // /avisos mostra compromissos de hoje e de amanhã: Antônio, Renata e Marta precisam de um.
    expect(evs.some((e) => diasDesde(e.data_hora_inicio) === 1)).toBe(true);
  });

  it("alimentação: 3 dias, por Antônio e Renata", () => {
    const refs = de(dados.refeicoes, "idoso-antonio");
    expect(new Set(refs.map((r) => diasDesde(r.data_hora)))).toEqual(new Set([-2, -1, 0]));
    expect(new Set(refs.map((r) => r.registrado_por))).toEqual(new Set(["idoso-antonio", "familiar-renata"]));
  });
});

describe("montarDadosDemo: hoje parcial e nada no futuro", () => {
  it.each([
    ["14:00", new Date("2026-10-15T17:00:00Z")],
    ["20:30", new Date("2026-10-15T23:30:00Z")],
    ["06:00", new Date("2026-10-15T09:00:00Z")],
  ])("às %s de Brasília: doses, saúde e refeições nunca no futuro; noite e refeições depois do almoço sem registro hoje", (_h, agora) => {
    const d = montarDadosDemo(agora);
    const todasDoses = d.medicamentos.flatMap((m) => m.doses);
    for (const x of todasDoses) expect(x.data_hora.getTime()).toBeLessThanOrEqual(agora.getTime() + TOLERANCIA_FUTURO_MS);
    for (const x of d.saude) expect(x.data_hora.getTime()).toBeLessThanOrEqual(agora.getTime());
    for (const x of d.refeicoes) expect(x.data_hora.getTime()).toBeLessThanOrEqual(agora.getTime());
    const hoje = (x: Date) => diaSP(x) === diaSP(agora);
    for (const x of todasDoses.filter((y) => hoje(y.data_hora))) expect(horaSP(x.data_hora) < "18:00").toBe(true);
    const refeicoesHoje = d.refeicoes.filter((r) => hoje(r.data_hora) && r.idoso === "idosa-helena").map((r) => r.refeicao);
    for (const r of refeicoesHoje) expect(["cafe_manha", "almoco"]).toContain(r);
  });

  it("às 14:00 Helena já tem café, almoço e doses da manhã hoje", () => {
    const hoje = (x: Date) => diaSP(x) === diaSP(AGORA);
    const refeicoes = de(dados.refeicoes, "idosa-helena").filter((r) => hoje(r.data_hora)).map((r) => r.refeicao);
    expect(refeicoes.sort()).toEqual(["almoco", "cafe_manha"]);
    expect(doses(dados, "idosa-helena").filter((x) => hoje(x.data_hora)).length).toBeGreaterThanOrEqual(3);
  });

  it("dose só de medicamento já iniciado e, no encerrado, dentro do período", () => {
    for (const m of dados.medicamentos) {
      for (const x of m.doses) {
        expect(diaSP(x.data_hora) >= m.data_inicio).toBe(true);
        if (m.data_fim) expect(diaSP(x.data_hora) <= m.data_fim).toBe(true);
      }
    }
  });

  it("'hoje' é o dia de Brasília: às 23:30 de 15/10 (02:30 UTC de 16/10) o dia de hoje é 15/10", () => {
    const agora = new Date("2026-10-16T02:30:00Z");
    const d = montarDadosDemo(agora);
    const helena = d.eventos.filter((e) => e.idoso === "idosa-helena");
    const deHoje = helena.filter((e) => diaSP(e.data_hora_inicio) === "2026-10-15");
    expect(deHoje).toHaveLength(2);
    expect(deHoje.filter((e) => e.data_hora_inicio <= agora)).toHaveLength(1);
    expect(d.refeicoes.filter((r) => r.idoso === "idosa-helena" && diaSP(r.data_hora) === "2026-10-15").map((r) => r.refeicao).sort()).toEqual(["almoco", "cafe_manha"]);
    const cafe = d.refeicoes.find((r) => r.idoso === "idosa-helena" && r.refeicao === "cafe_manha" && diaSP(r.data_hora) === "2026-10-15");
    expect(cafe?.data_hora.toISOString()).toBe("2026-10-15T10:30:00.000Z");
    expect(d.saude.some((r) => diaSP(r.data_hora) === "2026-10-16")).toBe(false);
  });
});

describe("montarDadosDemo: validações das rotas", () => {
  const texto = (v: string | null, max: number) => v === null || (v === v.trim() && v.length > 0 && v.length <= max);
  const decimal = (v: number) => Number.isFinite(v) && v >= 0 && v <= LIMITES.decimal && /^\d+(\.\d{1,2})?$/.test(String(v));
  const data = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

  it("saúde dentro dos limites de saude.ts", () => {
    for (const r of dados.saude) {
      expect(texto(r.tipo_medicao, LIMITES.tipo_medicao) && r.tipo_medicao !== null).toBe(true);
      expect(texto(r.unidade, LIMITES.unidade) && r.unidade !== null).toBe(true);
      expect(decimal(r.valor_1)).toBe(true);
      expect(r.valor_2 === null || decimal(r.valor_2)).toBe(true);
      expect(texto(r.observacoes, LIMITES.observacoesSaude)).toBe(true);
    }
  });

  it("medicamentos e doses dentro dos limites de remedios.ts", () => {
    for (const m of dados.medicamentos) {
      expect(texto(m.nome, LIMITES.nomeMedicamento) && texto(m.dosagem, LIMITES.dosagem) && texto(m.frequencia, LIMITES.frequencia)).toBe(true);
      expect(texto(m.observacoes, LIMITES.observacoesMedicamento)).toBe(true);
      expect(data(m.data_inicio)).toBe(true);
      if (m.data_fim !== null) expect(data(m.data_fim) && m.data_fim >= m.data_inicio).toBe(true);
      for (const x of m.doses) {
        expect(STATUS_DOSE).toContain(x.status_administracao);
        expect(texto(x.observacoes, LIMITES.observacoesDose)).toBe(true);
      }
    }
    const status = new Set(dados.medicamentos.flatMap((m) => m.doses.map((x) => x.status_administracao)));
    expect(status).toEqual(new Set(STATUS_DOSE));
  });

  it("eventos dentro dos limites de agenda.ts, com os 3 tipos", () => {
    for (const e of dados.eventos) {
      expect(TIPOS_EVENTO).toContain(e.tipo_evento);
      expect(texto(e.titulo, LIMITES.titulo) && e.titulo !== null).toBe(true);
      expect(texto(e.descricao, LIMITES.descricaoEvento)).toBe(true);
      if (e.data_hora_fim) expect(e.data_hora_fim.getTime()).toBeGreaterThan(e.data_hora_inicio.getTime());
    }
    expect(new Set(dados.eventos.map((e) => e.tipo_evento))).toEqual(new Set(TIPOS_EVENTO));
  });

  it("refeições dentro dos limites de alimentacao.ts", () => {
    for (const r of dados.refeicoes) {
      expect(REFEICOES).toContain(r.refeicao);
      expect(texto(r.descricao, LIMITES.descricaoRefeicao) && r.descricao !== null).toBe(true);
    }
  });

  it("todo texto só usa Latin-1 (o PDF do histórico troca o resto por ?)", () => {
    const textos = JSON.stringify(dados);
    expect([...textos].filter((c) => c.charCodeAt(0) > 0xff)).toEqual([]);
  });
});

describe("montarDadosDemo: regras de ator (nenhuma autoria impossível)", () => {
  const perfil = (s: Slug) => ELENCO.find((c) => c.slug === s)!.tipo_perfil;
  const modo = (idoso: Slug) => dados.usuarios.find((u) => u.slug === idoso)!.modo_decisao;
  const vinculo = (idoso: Slug, autor: Slug) => dados.vinculos.find((v) => v.idoso === idoso && v.vinculado === autor && v.status === "aprovado");
  const familiarDecide = (idoso: Slug, autor: Slug) => perfil(autor) === "familiar" && !!vinculo(idoso, autor) && modo(idoso) === "familiar";
  const cuidadorCom = (idoso: Slug, autor: Slug, flag: "permite_registrar_saude" | "permite_marcar_dose" | "permite_criar_evento_cuidado") =>
    perfil(autor) === "cuidador" && vinculo(idoso, autor)?.[flag] === true;

  it("saúde: o idoso, cuidador com permite_registrar_saude ou familiar com modo 'familiar'", () => {
    for (const r of dados.saude) {
      expect(r.registrado_por === r.idoso || cuidadorCom(r.idoso, r.registrado_por, "permite_registrar_saude") || familiarDecide(r.idoso, r.registrado_por)).toBe(true);
    }
  });

  it("medicamento: o idoso ou familiar com modo 'familiar'; cuidador nunca", () => {
    for (const m of dados.medicamentos) {
      expect(perfil(m.criado_por)).not.toBe("cuidador");
      expect(m.criado_por === m.idoso || familiarDecide(m.idoso, m.criado_por)).toBe(true);
    }
  });

  it("dose: o idoso, cuidador com permite_marcar_dose ou familiar com modo 'familiar'", () => {
    for (const m of dados.medicamentos) {
      for (const x of m.doses) {
        expect(x.registrado_por === m.idoso || cuidadorCom(m.idoso, x.registrado_por, "permite_marcar_dose") || familiarDecide(m.idoso, x.registrado_por)).toBe(true);
      }
    }
  });

  it("evento: 'cuidado' só de cuidador com a flag; 'pessoal' e 'medico' do idoso ou familiar com modo 'familiar'", () => {
    for (const e of dados.eventos) {
      if (e.tipo_evento === "cuidado") expect(cuidadorCom(e.idoso, e.criado_por, "permite_criar_evento_cuidado")).toBe(true);
      else expect(e.criado_por === e.idoso || familiarDecide(e.idoso, e.criado_por)).toBe(true);
    }
  });

  it("refeição: o idoso ou familiar com modo 'familiar'; cuidador nunca", () => {
    for (const r of dados.refeicoes) {
      expect(perfil(r.registrado_por)).not.toBe("cuidador");
      expect(r.registrado_por === r.idoso || familiarDecide(r.idoso, r.registrado_por)).toBe(true);
    }
  });
});

describe("montarDadosDemo: nenhum dado real", () => {
  // Varre todo texto semeado (dados e elenco).
  const tudo = JSON.stringify([dados, ELENCO]);
  const strings = [...tudo.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]).filter((s) => !/^\d{4}-\d{2}-\d{2}T/.test(s));

  it("sem CPF, telefone brasileiro, URL nem e-mail fora de demo.elderweb.test", () => {
    for (const s of strings) {
      expect(s).not.toMatch(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
      expect(s).not.toMatch(/\(?\d{2}\)?\s?9?\d{4}-?\d{4}/);
      expect(s).not.toMatch(/https?:\/\/|www\./i);
      for (const m of s.matchAll(/@([^\s"]*)/g)) expect(m[1]).toBe("demo.elderweb.test");
    }
  });
});
