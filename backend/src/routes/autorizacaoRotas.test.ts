import request from "supertest";

// Item 9.4 (RNF-003, RF-023, RF-032): suíte de autorização por INVENTÁRIO de rotas. A lista de rotas vem do próprio app
// (app._router.stack) e é comparada com ROTAS_ESPERADAS: rota nova sem classificação derruba o bloco A. Os blocos B a F
// provam, para toda rota que a categoria cobre, 401 sem token, 403 sem vínculo aprovado, 403 sem a flag do Cuidador, a
// regra de ator de escrita e o 404 uniforme de registro. Em todo caso negativo nenhuma escrita chega ao Prisma.
//
// Limite aceito (D4): o Prisma é um fake em memória que filtra pelo where, mas um mock não prova o filtro do SQL Server
// real. Todos os ids, uids e valores abaixo são FICTÍCIOS, só para teste.
// Convenção: IDOSO_A é o idoso consultado; IDOSO_B é outro idoso (acesso cruzado).

jest.mock("../lib/firebaseAdmin", () => ({
  auth: {
    verifyIdToken: (...args: unknown[]) =>
      jest.requireActual("../testSupport/prismaFakeAutorizacao").verifyIdToken(...args),
  },
}));
jest.mock("../lib/prisma", () => ({
  prisma: jest.requireActual("../testSupport/prismaFakeAutorizacao").prismaFake,
}));

import app from "../app";
import { requireAuth } from "../middleware/requireAuth";
import { enumerarRotas } from "../testSupport/rotasApp";
import {
  dados,
  escritasChamadas,
  leituras,
  limparChamadas,
  tokenDe,
  TOKEN_INDISPONIVEL,
  TOKEN_REJEITADO,
  TOKEN_SEM_USUARIO,
  zerarDados,
  type Linha,
} from "../testSupport/prismaFakeAutorizacao";

const IDOSO_A = 5;
const IDOSO_B = 6;
const CUIDADOR = 10;
const FAMILIAR = 20;
const REGISTRO_A = 1; // do idoso A, registrado pelo CUIDADOR
const REGISTRO_B = 2; // do idoso B
const REGISTRO_INEXISTENTE = 999;
const MEDICAMENTO_A = 1; // do idoso A, ativo
const MSG_VINCULO = "Vínculo aprovado não encontrado para este idoso.";

type Categoria = "publica" | "token_proprio" | "autenticada" | "vinculo" | "vinculo_flag" | "registro_por_id";
type Flag = "permite_registrar_saude" | "permite_marcar_dose" | "permite_criar_evento_cuidado";
const FLAGS: Flag[] = ["permite_registrar_saude", "permite_marcar_dose", "permite_criar_evento_cuidado"];

type Regra = {
  // "METODO /caminho" como o Express registra (prefixo de montagem incluído).
  rota: string;
  categoria: Categoria;
  // Só rotas com :idosoId. leitura: vínculo aprovado basta. nunca: regra fixa de ator, com qualquer flag. Flag: a única que abre.
  cuidador?: "leitura" | "nunca" | Flag;
  // leitura: vínculo aprovado basta. modo_decisao: exige modo_decisao efetivo 'familiar' (via resolverModoDecisao).
  familiar?: "leitura" | "modo_decisao";
  // Só rotas próprias do idoso (sem :idosoId): cuidador e familiar recebem 403 pelo tipo_perfil.
  soIdoso?: boolean;
  // Corpo mínimo válido (cuidador pode ter corpo próprio: a agenda do cuidador só cria 'cuidado').
  corpo?: object;
  corpoCuidador?: object;
  // Status de sucesso quando não segue a regra POST 201 / demais 200 (ação sem recurso criado).
  statusOk?: number;
};

const SAUDE = { tipo_medicao: "pressao", valor_1: 120, valor_2: 80, unidade: "mmHg" };
const EDICAO_SAUDE = { valor_1: 130 };
const MEDICAMENTO = { nome: "Remedio Ficticio", dosagem: "10 mg", frequencia: "1x ao dia", data_inicio: "2026-10-01" };
const DOSE = { status_administracao: "administrado" };
const EVENTO = { tipo_evento: "pessoal", titulo: "Compromisso Ficticio", data_hora_inicio: "2026-10-10T12:00:00Z" };
const EVENTO_CUIDADO = { ...EVENTO, tipo_evento: "cuidado" };
const REFEICAO = { refeicao: "almoco", descricao: "Refeicao Ficticia", data_hora: "2026-10-10T12:00:00Z" };

const ROTAS_ESPERADAS: Regra[] = [
  { rota: "GET /health", categoria: "publica" },
  { rota: "POST /auth/sync", categoria: "token_proprio" },

  { rota: "GET /usuario/me", categoria: "autenticada" },
  { rota: "GET /usuario/me/foto", categoria: "autenticada" },
  { rota: "POST /usuario/me/foto", categoria: "autenticada" },
  { rota: "DELETE /usuario/me/foto", categoria: "autenticada" },
  { rota: "PATCH /usuario/me", categoria: "autenticada" },
  { rota: "PATCH /usuario/me/modo-decisao", categoria: "autenticada" },
  { rota: "POST /usuario/cadastrar-idoso", categoria: "autenticada" },

  { rota: "POST /vinculo/solicitar-cuidador", categoria: "autenticada" },
  { rota: "POST /vinculo/solicitar-familiar", categoria: "autenticada" },
  { rota: "POST /vinculo/convidar-familiar", categoria: "autenticada" },
  { rota: "POST /vinculo/:id/aprovar", categoria: "autenticada" },
  { rota: "POST /vinculo/:id/recusar", categoria: "autenticada" },
  { rota: "POST /vinculo/:id/contestar", categoria: "autenticada" },
  { rota: "PATCH /vinculo/:id/definir-permissoes", categoria: "autenticada" },
  { rota: "POST /vinculo/:id/solicitar-transferencia-decisao", categoria: "autenticada" },
  { rota: "POST /vinculo/:id/confirmar-transferencia-decisao", categoria: "autenticada" },
  { rota: "GET /vinculo", categoria: "autenticada" },

  { rota: "POST /saude", categoria: "autenticada", soIdoso: true, corpo: SAUDE },
  { rota: "GET /saude", categoria: "autenticada", soIdoso: true },
  { rota: "PATCH /saude/:id", categoria: "registro_por_id", corpo: EDICAO_SAUDE },
  {
    rota: "POST /saude/idoso/:idosoId",
    categoria: "vinculo_flag",
    cuidador: "permite_registrar_saude",
    familiar: "modo_decisao",
    corpo: SAUDE,
  },
  {
    rota: "PATCH /saude/idoso/:idosoId/:id",
    categoria: "registro_por_id",
    cuidador: "permite_registrar_saude",
    familiar: "modo_decisao",
    corpo: EDICAO_SAUDE,
  },
  { rota: "GET /saude/idoso/:idosoId", categoria: "vinculo", cuidador: "leitura", familiar: "leitura" },

  { rota: "POST /remedios", categoria: "autenticada", soIdoso: true, corpo: MEDICAMENTO },
  { rota: "GET /remedios", categoria: "autenticada", soIdoso: true },
  { rota: "POST /remedios/:medicamentoId/doses", categoria: "autenticada", soIdoso: true, corpo: DOSE },
  {
    rota: "POST /remedios/idoso/:idosoId",
    categoria: "vinculo",
    cuidador: "nunca",
    familiar: "modo_decisao",
    corpo: MEDICAMENTO,
  },
  {
    rota: "POST /remedios/idoso/:idosoId/:medicamentoId/doses",
    categoria: "vinculo_flag",
    cuidador: "permite_marcar_dose",
    familiar: "modo_decisao",
    corpo: DOSE,
  },
  { rota: "GET /remedios/idoso/:idosoId", categoria: "vinculo", cuidador: "leitura", familiar: "leitura" },

  { rota: "GET /historico/pdf", categoria: "autenticada", soIdoso: true },
  { rota: "GET /historico/idoso/:idosoId/pdf", categoria: "vinculo", cuidador: "leitura", familiar: "leitura" },

  { rota: "POST /agenda", categoria: "autenticada", soIdoso: true, corpo: EVENTO },
  { rota: "GET /agenda", categoria: "autenticada", soIdoso: true },
  {
    rota: "POST /agenda/idoso/:idosoId",
    categoria: "vinculo_flag",
    cuidador: "permite_criar_evento_cuidado",
    familiar: "modo_decisao",
    corpo: EVENTO,
    corpoCuidador: EVENTO_CUIDADO,
  },
  { rota: "GET /agenda/idoso/:idosoId", categoria: "vinculo", cuidador: "leitura", familiar: "leitura" },

  { rota: "POST /alimentacao", categoria: "autenticada", soIdoso: true, corpo: REFEICAO },
  { rota: "GET /alimentacao", categoria: "autenticada", soIdoso: true },
  {
    rota: "POST /alimentacao/idoso/:idosoId",
    categoria: "vinculo",
    cuidador: "nunca",
    familiar: "modo_decisao",
    corpo: REFEICAO,
  },
  { rota: "GET /alimentacao/idoso/:idosoId", categoria: "vinculo", cuidador: "leitura", familiar: "leitura" },

  // Sem vínculo no fake: o controle positivo do idoso termina em 200 sem chegar ao provedor de e-mail.
  { rota: "POST /emergencia/avisar", categoria: "autenticada", soIdoso: true, statusOk: 200 },
];

const metodoDe = (r: Regra) => r.rota.split(" ")[0];
const caminhoDe = (r: Regra) => r.rota.split(" ")[1];
const temIdoso = (r: Regra) => caminhoDe(r).includes(":idosoId");
const naoPublicas = ROTAS_ESPERADAS.filter((r) => r.categoria !== "publica");
const comVinculo = ROTAS_ESPERADAS.filter(temIdoso);
const comFlag = comVinculo.filter((r) => FLAGS.includes(r.cuidador as Flag));
const comModoDecisao = comVinculo.filter((r) => r.familiar === "modo_decisao");
const cuidadorNunca = comVinculo.filter((r) => r.cuidador === "nunca");
const soIdoso = ROTAS_ESPERADAS.filter((r) => r.soIdoso);

// ---------------------------------------------------------------------------------------------------------------
// Fixtures e helpers
// ---------------------------------------------------------------------------------------------------------------
function usuario(id: number, tipo_perfil: string, extra: Linha = {}): Linha {
  return {
    id,
    firebase_uid: `uid-${id}`,
    tipo_perfil,
    nome: "Pessoa Ficticia",
    modo_decisao: null,
    modo_decisao_solicitado: null,
    modo_decisao_solicitado_por_id: null,
    modo_decisao_solicitado_em: null,
    modo_decisao_expira_em: null,
    modo_decisao_segunda_confirmacao_id: null,
    modo_decisao_alterado_por_id: null,
    modo_decisao_alterado_em: null,
    modo_decisao_motivo: null,
    ...extra,
  };
}

function vinculo(tipo_vinculo: "cuidador" | "familiar", vinculado_id: number, extra: Linha = {}): Linha {
  return {
    id: 1,
    idoso_id: IDOSO_A,
    vinculado_id,
    tipo_vinculo,
    status: "aprovado",
    permite_registrar_saude: false,
    permite_marcar_dose: false,
    permite_criar_evento_cuidado: false,
    ...extra,
  };
}

function registro(id: number, idoso_id: number, registrado_por_id: number): Linha {
  const t = new Date("2026-10-01T12:00:00Z");
  return {
    id,
    idoso_id,
    registrado_por_id,
    editado_por_id: registrado_por_id,
    tipo_medicao: "pressao",
    valor_1: 120,
    valor_2: 80,
    unidade: "mmHg",
    data_hora: t,
    observacoes: null,
    created_at: t,
    updated_at: t,
  };
}

function usuarioDoIdoso(): Linha {
  return (dados.usuario as Linha[]).find((u) => u.id === IDOSO_A) as Linha;
}

function modoDecisaoDoIdoso(modo: "idoso" | "familiar" | null) {
  usuarioDoIdoso().modo_decisao = modo;
}

function definirVinculos(...linhas: Linha[]) {
  dados.vinculo = linhas;
}

beforeEach(() => {
  zerarDados();
  limparChamadas();
  dados.usuario = [
    usuario(IDOSO_A, "idoso"),
    usuario(IDOSO_B, "idoso"),
    usuario(CUIDADOR, "cuidador"),
    usuario(FAMILIAR, "familiar"),
  ];
  dados.vinculo = [];
  dados.registroSaude = [registro(REGISTRO_A, IDOSO_A, CUIDADOR), registro(REGISTRO_B, IDOSO_B, CUIDADOR)];
  dados.medicamento = [{ id: MEDICAMENTO_A, idoso_id: IDOSO_A, ativo: true, ...linhaMedicamento() }];
});

function linhaMedicamento(): Linha {
  const t = new Date("2026-10-01T00:00:00Z");
  return {
    criado_por_id: IDOSO_A,
    editado_por_id: null,
    nome: "Remedio Ficticio",
    dosagem: "10 mg",
    frequencia: "1x ao dia",
    data_inicio: t,
    data_fim: null,
    observacoes: null,
    created_at: t,
    updated_at: t,
  };
}

type Opcoes = { authorization?: string; idoso?: number | string; id?: number | string; corpo?: object };

function chamar(r: Regra, o: Opcoes = {}) {
  const url = caminhoDe(r)
    .replace(":idosoId", String(o.idoso ?? IDOSO_A))
    .replace(":medicamentoId", String(MEDICAMENTO_A))
    .replace(":id", String(o.id ?? 1));
  const metodo = metodoDe(r).toLowerCase() as "get" | "post" | "patch" | "delete";
  let req = request(app)[metodo](url);
  if (o.authorization !== undefined) req = req.set("Authorization", o.authorization);
  return o.corpo !== undefined ? req.send(o.corpo) : req;
}

const bearer = (id: number) => `Bearer ${tokenDe(id)}`;
const statusOk = (r: Regra) => r.statusOk ?? (metodoDe(r) === "POST" ? 201 : 200);

function corpoDoAtor(r: Regra, ator: "cuidador" | "familiar" | "idoso"): object | undefined {
  return ator === "cuidador" && r.corpoCuidador ? r.corpoCuidador : r.corpo;
}

function expectSemEscrita() {
  expect(escritasChamadas()).toEqual([]);
}

// ---------------------------------------------------------------------------------------------------------------
// A. Completude: toda rota do app está classificada, e a classificação bate com a estrutura real
// ---------------------------------------------------------------------------------------------------------------
describe("A. completude do inventário de rotas", () => {
  const enumeradas = enumerarRotas(app);
  const chave = (m: string, c: string) => `${m} ${c}`;

  it("as rotas do app são exatamente ROTAS_ESPERADAS (rota nova sem classificação falha aqui)", () => {
    const doApp = enumeradas.map((r) => chave(r.metodo, r.caminho)).sort();
    const esperadas = ROTAS_ESPERADAS.map((r) => r.rota).sort();
    expect(doApp).toEqual(esperadas);
  });

  it("ROTAS_ESPERADAS não tem rota repetida", () => {
    const rotas = ROTAS_ESPERADAS.map((r) => r.rota);
    expect(new Set(rotas).size).toBe(rotas.length);
  });

  it("toda rota autenticada, com vínculo ou por registro tem requireAuth como primeiro handler", () => {
    const semAuth = naoPublicas
      .filter((r) => r.categoria !== "token_proprio")
      .filter((r) => {
        const rota = enumeradas.find((e) => chave(e.metodo, e.caminho) === r.rota);
        return !rota || rota.handlers[0] !== requireAuth;
      })
      .map((r) => r.rota);
    expect(semAuth).toEqual([]);
  });

  it("rota pública e rota de token próprio não usam requireAuth (a classificação é verdadeira)", () => {
    for (const r of ROTAS_ESPERADAS.filter((x) => x.categoria === "publica" || x.categoria === "token_proprio")) {
      const rota = enumeradas.find((e) => chave(e.metodo, e.caminho) === r.rota);
      expect(rota?.handlers).toHaveLength(1);
      expect(rota?.handlers[0]).not.toBe(requireAuth);
    }
  });

  it("toda rota com :idosoId tem o handler de vínculo depois de requireAuth e declara a regra dos dois atores", () => {
    for (const r of comVinculo) {
      const rota = enumeradas.find((e) => chave(e.metodo, e.caminho) === r.rota);
      expect(rota?.handlers.length).toBeGreaterThanOrEqual(3);
      expect(r.cuidador).toBeDefined();
      expect(r.familiar).toBeDefined();
      expect(["vinculo", "vinculo_flag", "registro_por_id"]).toContain(r.categoria);
    }
  });

  it("nenhuma rota sem :idosoId é classificada como de vínculo", () => {
    const erradas = ROTAS_ESPERADAS.filter((r) => !temIdoso(r) && ["vinculo", "vinculo_flag"].includes(r.categoria));
    expect(erradas).toEqual([]);
  });

  it("categoria vinculo_flag exige uma flag de Cuidador e as demais categorias de vínculo não exigem", () => {
    for (const r of comVinculo) {
      const exigeFlag = FLAGS.includes(r.cuidador as Flag);
      if (r.categoria === "vinculo_flag") expect(exigeFlag).toBe(true);
      if (r.categoria === "vinculo") expect(exigeFlag).toBe(false);
    }
  });

  it("o inventário não é vazio (guarda contra a enumeração quebrar em silêncio)", () => {
    expect(enumeradas.length).toBeGreaterThanOrEqual(40);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// B. Autenticação: 401 sem token, 401/503 com token rejeitado, 403 sem Usuario; nunca escreve
// ---------------------------------------------------------------------------------------------------------------
describe("B. autenticação em toda rota não pública", () => {
  describe.each(naoPublicas.map((r) => [r.rota, r] as const))("%s", (_nome, r) => {
    it("401 sem header Authorization", async () => {
      const res = await chamar(r);
      expect(res.status).toBe(401);
      expectSemEscrita();
    });

    it.each([["Basic dXNlcjpzZW5oYQ=="], ["Bearer"], ["Bearer "], ["bearer t10"], [`Token ${tokenDe(CUIDADOR)}`]])(
      "401 com header sem prefixo Bearer válido (%j)",
      async (cabecalho) => {
        const res = await chamar(r, { authorization: cabecalho });
        expect(res.status).toBe(401);
        expectSemEscrita();
      },
    );

    it("401 com token rejeitado pelo Firebase (código auth/*)", async () => {
      const res = await chamar(r, { authorization: `Bearer ${TOKEN_REJEITADO}` });
      expect(res.status).toBe(401);
      expectSemEscrita();
    });

    it("503 com Firebase indisponível (erro sem código auth/*), nunca 401", async () => {
      const res = await chamar(r, { authorization: `Bearer ${TOKEN_INDISPONIVEL}` });
      expect(res.status).toBe(503);
      expectSemEscrita();
    });

    if (r.categoria !== "token_proprio") {
      it("403 com token válido e sem linha em Usuario", async () => {
        const res = await chamar(r, { authorization: `Bearer ${TOKEN_SEM_USUARIO}` });
        expect(res.status).toBe(403);
        expectSemEscrita();
      });
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// C. Vínculo: 403 uniforme sem vínculo aprovado do idoso pedido
// ---------------------------------------------------------------------------------------------------------------
describe("C. vínculo aprovado em toda rota com :idosoId", () => {
  const atores: ["cuidador" | "familiar", number][] = [
    ["cuidador", CUIDADOR],
    ["familiar", FAMILIAR],
  ];

  describe.each(comVinculo.map((r) => [r.rota, r] as const))("%s", (_nome, r) => {
    it.each(atores)("%s: sem vínculo, pendente, recusado e aprovado só do idoso B dão o mesmo 403 e não escrevem", async (perfil, id) => {
      const cenarios: Linha[][] = [
        [],
        [vinculo(perfil, id, { status: "pendente" })],
        [vinculo(perfil, id, { status: "recusado" })],
        [vinculo(perfil, id, { idoso_id: IDOSO_B })],
      ];
      const respostas: { status: number; body: unknown }[] = [];
      for (const linhas of cenarios) {
        // Flags e modo_decisao no máximo: nada além do vínculo pode ser a causa do 403.
        definirVinculos(...linhas.map((l) => ({ ...l, permite_registrar_saude: true, permite_marcar_dose: true, permite_criar_evento_cuidado: true })));
        modoDecisaoDoIdoso("familiar");
        const res = await chamar(r, { authorization: bearer(id), corpo: corpoDoAtor(r, perfil) });
        respostas.push({ status: res.status, body: res.body });
      }
      expect(respostas.map((x) => x.status)).toEqual([403, 403, 403, 403]);
      expect(respostas[0].body).toEqual({ error: MSG_VINCULO });
      for (const x of respostas) expect(x.body).toEqual(respostas[0].body);
      expectSemEscrita();
    });

    it("idoso chamando a rota de vínculo com o próprio id recebe 403 e não escreve", async () => {
      definirVinculos(vinculo("cuidador", CUIDADOR));
      const res = await chamar(r, { authorization: bearer(IDOSO_A), idoso: IDOSO_A, corpo: corpoDoAtor(r, "idoso") });
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: MSG_VINCULO });
      expectSemEscrita();
    });

    it("id de idoso não numérico dá 400 sem consultar vínculo nem escrever", async () => {
      const res = await chamar(r, { authorization: bearer(CUIDADOR), idoso: "abc", corpo: corpoDoAtor(r, "cuidador") });
      expect(res.status).toBe(400);
      expect(leituras("vinculo.findFirst")).toBe(0);
      expectSemEscrita();
    });

    it("controle positivo: o ator autorizado com vínculo aprovado do idoso A passa da camada de vínculo", async () => {
      const cuidadorPode = r.cuidador !== "nunca";
      const id = cuidadorPode ? CUIDADOR : FAMILIAR;
      const perfil = cuidadorPode ? "cuidador" : "familiar";
      const flag = FLAGS.includes(r.cuidador as Flag) ? { [r.cuidador as string]: true } : {};
      definirVinculos(vinculo(perfil, id, flag));
      modoDecisaoDoIdoso("familiar");
      const res = await chamar(r, { authorization: bearer(id), corpo: corpoDoAtor(r, perfil) });
      expect(res.status).toBe(statusOk(r));
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// D. Permissão do Cuidador: 403 sem a flag exata; uma flag não abre outra
// ---------------------------------------------------------------------------------------------------------------
describe("D. flag do Cuidador (permite_*)", () => {
  describe.each(comFlag.map((r) => [r.rota, r] as const))("%s", (_nome, r) => {
    const flag = r.cuidador as Flag;
    const outras = FLAGS.filter((f) => f !== flag);
    const todas = (valor: boolean) => Object.fromEntries(FLAGS.map((f) => [f, valor]));

    it("3 flags false: 403 e não escreve", async () => {
      definirVinculos(vinculo("cuidador", CUIDADOR, todas(false)));
      const res = await chamar(r, { authorization: bearer(CUIDADOR), corpo: corpoDoAtor(r, "cuidador") });
      expect(res.status).toBe(403);
      expectSemEscrita();
    });

    it("só as outras duas flags true: 403 e não escreve", async () => {
      definirVinculos(vinculo("cuidador", CUIDADOR, { ...todas(false), [outras[0]]: true, [outras[1]]: true }));
      const res = await chamar(r, { authorization: bearer(CUIDADOR), corpo: corpoDoAtor(r, "cuidador") });
      expect(res.status).toBe(403);
      expectSemEscrita();
    });

    it.each(outras)("só %s true: 403 e não escreve (uma flag não abre outra)", async (outra) => {
      definirVinculos(vinculo("cuidador", CUIDADOR, { ...todas(false), [outra]: true }));
      const res = await chamar(r, { authorization: bearer(CUIDADOR), corpo: corpoDoAtor(r, "cuidador") });
      expect(res.status).toBe(403);
      expectSemEscrita();
    });

    it("sem a flag, corpo inválido continua 403 (a autorização vem antes da validação)", async () => {
      definirVinculos(vinculo("cuidador", CUIDADOR, todas(false)));
      const res = await chamar(r, { authorization: bearer(CUIDADOR), corpo: { lixo: true } });
      expect(res.status).toBe(403);
      expectSemEscrita();
    });

    it("com só a flag certa true: passa (controle positivo) e escreve uma vez", async () => {
      definirVinculos(vinculo("cuidador", CUIDADOR, { ...todas(false), [flag]: true }));
      const res = await chamar(r, { authorization: bearer(CUIDADOR), corpo: corpoDoAtor(r, "cuidador") });
      expect(res.status).toBe(statusOk(r));
      expect(escritasChamadas()).toHaveLength(1);
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// E. Ator de escrita: familiar só com modo_decisao efetivo 'familiar'; cuidador nunca em medicamento e alimentação
// ---------------------------------------------------------------------------------------------------------------
describe("E. regra de ator nas rotas de escrita", () => {
  const MODOS_SEM_AUTORIDADE: [string, "idoso" | null][] = [
    ["'idoso'", "idoso"],
    ["NULL (vale 'idoso')", null],
  ];

  describe.each(comModoDecisao.map((r) => [r.rota, r] as const))("familiar em %s", (_nome, r) => {
    it.each(MODOS_SEM_AUTORIDADE)(
      "modo_decisao %s: 403 e não escreve",
      async (_rotulo, modo) => {
        definirVinculos(vinculo("familiar", FAMILIAR));
        modoDecisaoDoIdoso(modo);
        const res = await chamar(r, { authorization: bearer(FAMILIAR), corpo: corpoDoAtor(r, "familiar") });
        expect(res.status).toBe(403);
        expectSemEscrita();
      },
    );

    it("modo_decisao 'familiar': passa (controle positivo) e escreve", async () => {
      definirVinculos(vinculo("familiar", FAMILIAR));
      modoDecisaoDoIdoso("familiar");
      const res = await chamar(r, { authorization: bearer(FAMILIAR), corpo: corpoDoAtor(r, "familiar") });
      expect(res.status).toBe(statusOk(r));
      expect(escritasChamadas().length).toBeGreaterThanOrEqual(1);
    });

    it("transferência vencida: coluna 'idoso' mas efetiva 'familiar' pelo resolver, então passa", async () => {
      definirVinculos(vinculo("familiar", FAMILIAR));
      Object.assign(usuarioDoIdoso(), {
        modo_decisao: "idoso",
        modo_decisao_solicitado: "familiar",
        modo_decisao_solicitado_por_id: FAMILIAR,
        modo_decisao_expira_em: new Date(Date.now() - 1000),
      });
      const res = await chamar(r, { authorization: bearer(FAMILIAR), corpo: corpoDoAtor(r, "familiar") });
      expect(res.status).toBe(statusOk(r));
    });

    it("transferência ainda na janela: a coluna não vale, segue 'idoso' e dá 403", async () => {
      definirVinculos(vinculo("familiar", FAMILIAR));
      Object.assign(usuarioDoIdoso(), {
        modo_decisao: "idoso",
        modo_decisao_solicitado: "familiar",
        modo_decisao_solicitado_por_id: FAMILIAR,
        modo_decisao_expira_em: new Date(Date.now() + 86_400_000),
      });
      const res = await chamar(r, { authorization: bearer(FAMILIAR), corpo: corpoDoAtor(r, "familiar") });
      expect(res.status).toBe(403);
      expectSemEscrita();
    });
  });

  describe.each(cuidadorNunca.map((r) => [r.rota, r] as const))("cuidador em %s", (_nome, r) => {
    it("403 com as 3 flags true e modo_decisao 'familiar', e não escreve", async () => {
      definirVinculos(vinculo("cuidador", CUIDADOR, { permite_registrar_saude: true, permite_marcar_dose: true, permite_criar_evento_cuidado: true }));
      modoDecisaoDoIdoso("familiar");
      const res = await chamar(r, { authorization: bearer(CUIDADOR), corpo: corpoDoAtor(r, "cuidador") });
      expect(res.status).toBe(403);
      expectSemEscrita();
    });

    it.each(FLAGS)("403 com só %s true, e não escreve", async (flag) => {
      definirVinculos(vinculo("cuidador", CUIDADOR, { [flag]: true }));
      const res = await chamar(r, { authorization: bearer(CUIDADOR), corpo: corpoDoAtor(r, "cuidador") });
      expect(res.status).toBe(403);
      expectSemEscrita();
    });
  });

  const ATORES_NAO_IDOSO: ["cuidador" | "familiar", number][] = [
    ["cuidador", CUIDADOR],
    ["familiar", FAMILIAR],
  ];

  describe.each(soIdoso.map((r) => [r.rota, r] as const))("rota própria do idoso %s", (_nome, r) => {
    it.each(ATORES_NAO_IDOSO)("%s recebe 403 e não escreve, mesmo com vínculo aprovado e tudo liberado", async (perfil, id) => {
      definirVinculos(
        vinculo(perfil, id, {
          permite_registrar_saude: true,
          permite_marcar_dose: true,
          permite_criar_evento_cuidado: true,
        }),
      );
      modoDecisaoDoIdoso("familiar");
      const res = await chamar(r, { authorization: bearer(id), corpo: r.corpo });
      expect(res.status).toBe(403);
      expectSemEscrita();
    });

    it("controle positivo: o idoso passa", async () => {
      const res = await chamar(r, { authorization: bearer(IDOSO_A), corpo: r.corpo });
      expect(res.status).toBe(statusOk(r));
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// F. Registro por id: inexistente e de outro idoso colapsam no mesmo 404 (um 403 vazaria a existência)
// ---------------------------------------------------------------------------------------------------------------
describe("F. 404 uniforme em rotas por id de registro", () => {
  const propria = ROTAS_ESPERADAS.find((r) => r.rota === "PATCH /saude/:id") as Regra;
  const vinculada = ROTAS_ESPERADAS.find((r) => r.rota === "PATCH /saude/idoso/:idosoId/:id") as Regra;

  it("idoso: registro inexistente e registro de outro idoso dão o mesmo 404 e o mesmo corpo", async () => {
    const inexistente = await chamar(propria, { authorization: bearer(IDOSO_A), id: REGISTRO_INEXISTENTE, corpo: EDICAO_SAUDE });
    const doOutro = await chamar(propria, { authorization: bearer(IDOSO_A), id: REGISTRO_B, corpo: EDICAO_SAUDE });
    expect(inexistente.status).toBe(404);
    expect(doOutro.status).toBe(404);
    expect(doOutro.body).toEqual(inexistente.body);
    expectSemEscrita();
  });

  it("cuidador e familiar não editam registro do idoso pela rota própria: 404, sem escrita", async () => {
    definirVinculos(vinculo("cuidador", CUIDADOR, { permite_registrar_saude: true }));
    modoDecisaoDoIdoso("familiar");
    for (const id of [CUIDADOR, FAMILIAR]) {
      const res = await chamar(propria, { authorization: bearer(id), id: REGISTRO_A, corpo: EDICAO_SAUDE });
      expect(res.status).toBe(404);
    }
    expectSemEscrita();
  });

  const VINCULADOS: [string, "cuidador" | "familiar", number][] = [
    ["cuidador com a flag", "cuidador", CUIDADOR],
    ["familiar com modo_decisao 'familiar'", "familiar", FAMILIAR],
  ];

  it.each(VINCULADOS)("%s: registro inexistente e registro de outro idoso dão o mesmo 404 e o mesmo corpo", async (_rotulo, perfil, id) => {
    definirVinculos(vinculo(perfil, id, { permite_registrar_saude: true }));
    modoDecisaoDoIdoso("familiar");
    const inexistente = await chamar(vinculada, { authorization: bearer(id), id: REGISTRO_INEXISTENTE, corpo: EDICAO_SAUDE });
    const doOutro = await chamar(vinculada, { authorization: bearer(id), id: REGISTRO_B, corpo: EDICAO_SAUDE });
    expect(inexistente.status).toBe(404);
    expect(doOutro.status).toBe(404);
    expect(doOutro.body).toEqual(inexistente.body);
    expectSemEscrita();
  });

  it("cuidador com a flag só edita registro que ele mesmo criou: de outro autor dá 403, não 404", async () => {
    dados.registroSaude = [registro(REGISTRO_A, IDOSO_A, IDOSO_A)];
    definirVinculos(vinculo("cuidador", CUIDADOR, { permite_registrar_saude: true }));
    const res = await chamar(vinculada, { authorization: bearer(CUIDADOR), id: REGISTRO_A, corpo: EDICAO_SAUDE });
    expect(res.status).toBe(403);
    expectSemEscrita();
  });

  it("controle positivo: o idoso edita o próprio registro", async () => {
    const res = await chamar(propria, { authorization: bearer(IDOSO_A), id: REGISTRO_A, corpo: EDICAO_SAUDE });
    expect(res.status).toBe(200);
    expect(escritasChamadas()).toHaveLength(1);
  });
});
