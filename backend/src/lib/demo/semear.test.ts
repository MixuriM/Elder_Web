import type { PrismaClient } from "@prisma/client";
import { ELENCO, UIDS_ELENCO } from "./elenco";
import { montarDadosDemo } from "./dados";
import { removerDemo, semearDemo, type AuthDemo } from "./semear";

// Modo demonstração (D5): semente idempotente e removível, com Prisma e Firebase FALSOS. O fake de Prisma FILTRA de
// verdade pelo where (igualdade, { in } e OR) e lança em filtro não suportado, para nenhum teste passar por vacuidade.
// Todos os ids, uids, nomes e valores são FICTÍCIOS.
type Linha = Record<string, unknown>;
const TABELAS = ["usuario", "vinculo", "medicamento", "registroDoseMedicamento", "registroSaude", "registroAlimentar", "evento"] as const;
type Tabela = (typeof TABELAS)[number];

function casa(l: Linha, where: Linha = {}): boolean {
  return Object.entries(where).every(([campo, valor]) => {
    if (campo === "OR") return (valor as Linha[]).some((w) => casa(l, w));
    if (valor === undefined) return true;
    if (valor !== null && typeof valor === "object" && !(valor instanceof Date)) {
      const chaves = Object.keys(valor);
      if (chaves.length === 1 && Array.isArray((valor as { in?: unknown[] }).in)) return (valor as { in: unknown[] }).in.includes(l[campo]);
      throw new Error(`fake: filtro não suportado em ${campo}`);
    }
    return l[campo] === valor;
  });
}

// ordem: registro compartilhado com o Firebase falso ("db:<tabela>.<metodo>" e "fb:<metodo>"), para provar a ordem.
function criarBanco(ordem: string[] = []) {
  const db = Object.fromEntries(TABELAS.map((t) => [t, [] as Linha[]])) as Record<Tabela, Linha[]>;
  let proximo = 1;
  const transacoes: unknown[] = [];
  const escolher = (l: Linha, select?: Record<string, boolean>) =>
    select ? Object.fromEntries(Object.keys(select).map((k) => [k, l[k]])) : { ...l };
  const inserir = (t: Tabela, data: Linha) => {
    const { doses, ...resto } = data as Linha & { doses?: { create: Linha[] } };
    for (const [k, v] of Object.entries(resto)) if (v !== null && typeof v === "object" && !(v instanceof Date)) throw new Error(`fake: data aninhado não suportado em ${t}.${k}`);
    const linha = { id: proximo++, ...resto };
    db[t].push(linha);
    for (const d of doses?.create ?? []) inserir("registroDoseMedicamento", { ...d, medicamento_id: linha.id });
    return linha;
  };
  const modeloBruto = (t: Tabela) => ({
    findMany: async (a: { where?: Linha; select?: Record<string, boolean> } = {}) => db[t].filter((l) => casa(l, a.where)).map((l) => escolher(l, a.select)),
    count: async (a: { where?: Linha } = {}) => db[t].filter((l) => casa(l, a.where)).length,
    deleteMany: async (a: { where?: Linha } = {}) => {
      if (!a.where) throw new Error("fake: deleteMany sem where");
      const antes = db[t].length;
      db[t] = db[t].filter((l) => !casa(l, a.where));
      return { count: antes - db[t].length };
    },
    updateMany: async (a: { where: Linha; data: Linha }) => {
      const alvo = db[t].filter((l) => casa(l, a.where));
      alvo.forEach((l) => Object.assign(l, a.data));
      return { count: alvo.length };
    },
    update: async (a: { where: Linha; data: Linha; select?: Record<string, boolean> }) => {
      const l = db[t].find((x) => casa(x, a.where));
      if (!l) throw new Error("fake: update sem linha");
      Object.assign(l, a.data);
      return escolher(l, a.select);
    },
    create: async (a: { data: Linha; select?: Record<string, boolean> }) => escolher(inserir(t, a.data), a.select),
    createMany: async (a: { data: Linha[] }) => {
      a.data.forEach((d) => inserir(t, d));
      return { count: a.data.length };
    },
  });
  const modelo = (t: Tabela) =>
    Object.fromEntries(
      Object.entries(modeloBruto(t)).map(([nome, f]) => [
        nome,
        (...a: unknown[]) => {
          ordem.push(`db:${t}.${nome}`);
          return (f as (...x: unknown[]) => unknown)(...a);
        },
      ]),
    );
  const cliente: Linha = Object.fromEntries(TABELAS.map((t) => [t, modelo(t)]));
  cliente.$transaction = async (fn: (tx: unknown) => Promise<unknown>, opcoes?: unknown) => {
    ordem.push("db:$transaction");
    transacoes.push(opcoes);
    // Transação de verdade: se algo falha no meio, nada fica gravado.
    const copia = structuredClone(db);
    try {
      return await fn(cliente);
    } catch (e) {
      for (const t of TABELAS) db[t] = copia[t];
      throw e;
    }
  };
  return { db, prisma: cliente as unknown as PrismaClient, transacoes };
}

type UsuarioFirebase = { uid: string; email?: string; displayName?: string; emailVerified?: boolean; password?: string };
function criarFirebase(ordem: string[] = []) {
  const contas = new Map<string, UsuarioFirebase>();
  const chamadas: { metodo: string; args: unknown[] }[] = [];
  // falhas["createUser"] = erro: o método rejeita com ele (depois de registrar a chamada).
  const falhas: Record<string, Error> = {};
  const registrar = (metodo: string, args: unknown[]) => {
    chamadas.push({ metodo, args });
    ordem.push(`fb:${metodo}`);
    if (falhas[metodo]) throw falhas[metodo];
  };
  const naoExiste = () => Object.assign(new Error("não existe"), { code: "auth/user-not-found" });
  const auth: AuthDemo = {
    getUser: async (uid) => {
      registrar("getUser", [uid]);
      const c = contas.get(uid);
      if (!c) throw naoExiste();
      return c as never;
    },
    getUserByEmail: async (email) => {
      registrar("getUserByEmail", [email]);
      const c = [...contas.values()].find((x) => x.email?.toLowerCase() === email.toLowerCase());
      if (!c) throw naoExiste();
      return c as never;
    },
    createUser: async (p) => {
      registrar("createUser", [p]);
      contas.set(p.uid as string, { ...(p as UsuarioFirebase) });
      return p as never;
    },
    updateUser: async (uid, p) => {
      registrar("updateUser", [uid, p]);
      contas.set(uid, { ...contas.get(uid)!, ...(p as UsuarioFirebase) });
      return p as never;
    },
    deleteUser: async (uid) => {
      registrar("deleteUser", [uid]);
      if (!contas.delete(uid)) throw naoExiste();
    },
  };
  return { auth, contas, chamadas, falhas };
}

const MSG_INVASOR = "Há um usuário estranho ocupando um e-mail reservado da demonstração. Remova-o manualmente.";

const AGORA = new Date("2026-10-15T17:00:00Z"); // 14:00 em Brasília
const DIA = 86_400_000;

// Usuário real (fora do elenco) com dado em todas as tabelas: nada disso pode ser tocado.
function semearSentinela(db: Record<Tabela, Linha[]>) {
  const t = new Date("2026-10-01T12:00:00Z");
  db.usuario.push(
    { id: 9001, firebase_uid: "real-idoso", nome: "Pessoa Real Ficticia", email: "real@exemplo.test", tipo_perfil: "idoso", modo_decisao: "idoso", cadastrado_por_id: null },
    { id: 9002, firebase_uid: "real-cuidador", nome: "Cuidador Real Ficticio", email: "cuidador@exemplo.test", tipo_perfil: "cuidador", modo_decisao: null, cadastrado_por_id: null },
    // Uid parecido com o do elenco: comparação por prefixo apagaria esta conta.
    { id: 9003, firebase_uid: "demo-idosa-helena-copia", nome: "Parecida", email: "parecida@exemplo.test", tipo_perfil: "idoso", modo_decisao: "idoso", cadastrado_por_id: null },
  );
  db.vinculo.push({ id: 9101, idoso_id: 9001, vinculado_id: 9002, tipo_vinculo: "cuidador", origem: "solicitacao_cuidador", status: "aprovado", aprovador_id: 9001, definido_por_id: null });
  db.medicamento.push({ id: 9201, idoso_id: 9001, criado_por_id: 9001, editado_por_id: null, nome: "Remedio Real", ativo: true });
  db.registroDoseMedicamento.push({ id: 9301, medicamento_id: 9201, registrado_por_id: 9002, data_hora_administracao: t });
  db.registroSaude.push({ id: 9401, idoso_id: 9001, registrado_por_id: 9002, editado_por_id: 9002, tipo_medicao: "Peso", data_hora: t });
  db.registroAlimentar.push({ id: 9501, idoso_id: 9001, registrado_por_id: 9001, editado_por_id: null, refeicao: "almoco", data_hora: t });
  db.evento.push({ id: 9601, idoso_id: 9003, criado_por_id: 9003, editado_por_id: null, tipo_evento: "pessoal", data_hora_inicio: t });
}
const sentinela = (db: Record<Tabela, Linha[]>) =>
  JSON.stringify(TABELAS.map((t) => db[t].filter((l) => (l.id as number) >= 9000)));

const idsDoElenco = (db: Record<Tabela, Linha[]>) =>
  db.usuario.filter((u) => (UIDS_ELENCO as readonly unknown[]).includes(u.firebase_uid)).map((u) => u.id as number);
const idDe = (db: Record<Tabela, Linha[]>, slug: string) =>
  db.usuario.find((u) => u.firebase_uid === `demo-${slug}`)?.id as number;

// Linhas sem id, para comparar duas semeaduras (ids de domínio mudam, os de usuário não).
const semId = (linhas: Linha[]) => linhas.map(({ id: _id, medicamento_id: _m, ...resto }) => resto);

describe("semearDemo", () => {
  it("cria as seis contas com firebase_uid = uid do elenco, e-mail .test, sem telefone nem foto", async () => {
    const { db, prisma } = criarBanco();
    const { auth } = criarFirebase();
    await semearDemo({ prisma, auth, agora: AGORA });
    for (const c of ELENCO) {
      const u = db.usuario.find((x) => x.firebase_uid === c.uid);
      expect(u).toMatchObject({ nome: c.nome, email: c.email, tipo_perfil: c.tipo_perfil, telefone: null, foto_perfil: null, cadastrado_por_id: null, termo_responsabilidade_aceito_em: null });
      expect(u?.aceite_documentos_versao).toBe("1.1");
      expect(u?.consentimento_saude_em).toEqual(u?.aceite_documentos_em);
    }
    const antonio = db.usuario.find((x) => x.firebase_uid === "demo-idoso-antonio");
    expect(antonio).toMatchObject({ modo_decisao: "familiar", modo_decisao_alterado_por_id: antonio?.id, modo_decisao_solicitado: null });
  });

  it("grava exatamente o que montarDadosDemo devolve, com ids resolvidos e editado_por_id = registrado_por_id na saúde", async () => {
    const { db, prisma } = criarBanco();
    const { auth } = criarFirebase();
    const contagens = await semearDemo({ prisma, auth, agora: AGORA });
    const d = montarDadosDemo(AGORA);
    const doses = d.medicamentos.reduce((n, m) => n + m.doses.length, 0);
    expect(contagens).toEqual({
      usuarios: 6,
      vinculos: d.vinculos.length,
      saude: d.saude.length,
      medicamentos: d.medicamentos.length,
      doses,
      eventos: d.eventos.length,
      refeicoes: d.refeicoes.length,
    });
    expect(db.vinculo).toHaveLength(d.vinculos.length);
    expect(db.registroSaude).toHaveLength(d.saude.length);
    expect(db.registroDoseMedicamento).toHaveLength(doses);
    for (const r of db.registroSaude) expect(r.editado_por_id).toBe(r.registrado_por_id);
    const helena = idDe(db, "idosa-helena");
    const marta = idDe(db, "cuidadora-marta");
    expect(db.vinculo.find((v) => v.vinculado_id === marta && v.idoso_id === helena)).toMatchObject({ aprovador_id: helena, definido_por_id: helena, permite_criar_evento_cuidado: true });
    expect(db.vinculo.find((v) => v.vinculado_id === idDe(db, "cuidador-paulo"))).toMatchObject({ status: "pendente", aprovador_id: null });
  });

  it("respeita as regras de ator no banco: cuidador nunca cria medicamento nem refeição, flag exata em cada autoria de cuidador", async () => {
    const { db, prisma } = criarBanco();
    const { auth } = criarFirebase();
    await semearDemo({ prisma, auth, agora: AGORA });
    const perfil = (id: unknown) => db.usuario.find((u) => u.id === id)?.tipo_perfil;
    for (const m of db.medicamento) expect(perfil(m.criado_por_id)).not.toBe("cuidador");
    for (const r of db.registroAlimentar) expect(perfil(r.registrado_por_id)).not.toBe("cuidador");
    const flagDe = (idoso: unknown, autor: unknown, flag: string) => db.vinculo.find((v) => v.idoso_id === idoso && v.vinculado_id === autor && v.status === "aprovado")?.[flag];
    for (const r of db.registroSaude) if (perfil(r.registrado_por_id) === "cuidador") expect(flagDe(r.idoso_id, r.registrado_por_id, "permite_registrar_saude")).toBe(true);
    for (const e of db.evento) if (perfil(e.criado_por_id) === "cuidador") expect(flagDe(e.idoso_id, e.criado_por_id, "permite_criar_evento_cuidado")).toBe(true);
    for (const x of db.registroDoseMedicamento) {
      const m = db.medicamento.find((y) => y.id === x.medicamento_id);
      if (perfil(x.registrado_por_id) === "cuidador") expect(flagDe(m?.idoso_id, x.registrado_por_id, "permite_marcar_dose")).toBe(true);
    }
  });

  it("datas relativas ao agora congelado (fuso de Brasília)", async () => {
    const { db, prisma } = criarBanco();
    const { auth } = criarFirebase();
    await semearDemo({ prisma, auth, agora: AGORA });
    const helena = idDe(db, "idosa-helena");
    const datas = db.registroSaude.filter((r) => r.idoso_id === helena).map((r) => (r.data_hora as Date).getTime());
    expect(Math.max(...datas)).toBeLessThanOrEqual(AGORA.getTime());
    expect(Math.min(...datas)).toBeGreaterThanOrEqual(AGORA.getTime() - 14 * DIA);
    const paulo = db.vinculo.find((v) => v.vinculado_id === idDe(db, "cuidador-paulo"));
    expect((paulo?.data_solicitacao as Date).getTime()).toBeLessThan(AGORA.getTime());
    // @db.Date do Prisma: meia-noite UTC do dia de calendário.
    for (const m of db.medicamento) expect((m.data_inicio as Date).toISOString()).toMatch(/T00:00:00\.000Z$/);
  });

  it("é idempotente: duas semeaduras dão o mesmo banco, com os mesmos ids de usuário", async () => {
    const { db, prisma } = criarBanco();
    const { auth } = criarFirebase();
    await semearDemo({ prisma, auth, agora: AGORA });
    const usuarios1 = JSON.stringify(db.usuario);
    const dominio1 = JSON.stringify(TABELAS.filter((t) => t !== "usuario").map((t) => semId(db[t])));
    await semearDemo({ prisma, auth, agora: AGORA });
    expect(JSON.stringify(db.usuario)).toBe(usuarios1);
    expect(JSON.stringify(TABELAS.filter((t) => t !== "usuario").map((t) => semId(db[t])))).toBe(dominio1);
  });

  it("restaurar desfaz o que a apresentação mudou: vínculo aprovado ao vivo, dose marcada, troca de e-mail e de modo", async () => {
    const { db, prisma } = criarBanco();
    const { auth } = criarFirebase();
    await semearDemo({ prisma, auth, agora: AGORA });
    const esperado = JSON.stringify(TABELAS.map((t) => (t === "usuario" ? db[t] : semId(db[t]))));
    const helena = idDe(db, "idosa-helena");
    const paulo = db.vinculo.find((v) => v.vinculado_id === idDe(db, "cuidador-paulo"))!;
    Object.assign(paulo, { status: "aprovado", aprovador_id: helena });
    db.registroDoseMedicamento.push({ id: 5000, medicamento_id: db.medicamento[0].id, registrado_por_id: idDe(db, "cuidadora-marta") });
    db.registroSaude.push({ id: 5001, idoso_id: helena, registrado_por_id: helena, editado_por_id: helena });
    Object.assign(db.usuario.find((u) => u.id === helena)!, { email: "trocado@demo.elderweb.test", modo_decisao: "familiar", modo_decisao_alterado_por_id: idDe(db, "familiar-carlos") });
    await semearDemo({ prisma, auth, agora: AGORA });
    expect(JSON.stringify(TABELAS.map((t) => (t === "usuario" ? db[t] : semId(db[t]))))).toBe(esperado);
  });

  it("não toca em nenhuma linha fora do elenco, nem em conta com uid parecido", async () => {
    const { db, prisma } = criarBanco();
    const { auth } = criarFirebase();
    semearSentinela(db);
    const antes = sentinela(db);
    await semearDemo({ prisma, auth, agora: AGORA });
    await semearDemo({ prisma, auth, agora: AGORA });
    expect(sentinela(db)).toBe(antes);
  });

  it("roda numa transação com prazo folgado para o Azure", async () => {
    const { prisma, transacoes } = criarBanco();
    const { auth } = criarFirebase();
    await semearDemo({ prisma, auth, agora: AGORA });
    expect(transacoes).toHaveLength(1);
    expect((transacoes[0] as { timeout: number }).timeout).toBeGreaterThanOrEqual(30_000);
  });

  it("Firebase: cria as contas sem senha e com e-mail verificado; depois só atualiza e devolve o e-mail do elenco", async () => {
    const { prisma } = criarBanco();
    const fb = criarFirebase();
    await semearDemo({ prisma, auth: fb.auth, agora: AGORA });
    const criadas = fb.chamadas.filter((c) => c.metodo === "createUser").map((c) => c.args[0] as UsuarioFirebase);
    expect(criadas.map((c) => c.uid)).toEqual([...UIDS_ELENCO]);
    for (const c of criadas) {
      expect(c.emailVerified).toBe(true);
      expect(c).not.toHaveProperty("password");
      expect(c.email).toMatch(/@demo\.elderweb\.test$/);
    }
    fb.contas.get("demo-idosa-helena")!.email = "trocado@demo.elderweb.test";
    fb.chamadas.length = 0;
    await semearDemo({ prisma, auth: fb.auth, agora: AGORA });
    expect(fb.chamadas.filter((c) => c.metodo === "createUser")).toHaveLength(0);
    const atualizadas = fb.chamadas.filter((c) => c.metodo === "updateUser");
    expect(atualizadas.map((c) => c.args[0])).toEqual([...UIDS_ELENCO]);
    for (const c of atualizadas) {
      expect(c.args[1]).toMatchObject({ emailVerified: true, disabled: false });
      expect(c.args[1]).not.toHaveProperty("password");
    }
    expect(fb.contas.get("demo-idosa-helena")?.email).toBe("idosa-helena@demo.elderweb.test");
  });

  it("erro do Firebase diferente de conta inexistente sobe (nunca cria por cima)", async () => {
    const { prisma } = criarBanco();
    const fb = criarFirebase();
    fb.auth.getUser = async () => {
      throw Object.assign(new Error("rede"), { code: "app/network-error" });
    };
    await expect(semearDemo({ prisma, auth: fb.auth, agora: AGORA })).rejects.toThrow();
    expect(fb.chamadas.filter((c) => c.metodo === "createUser")).toHaveLength(0);
  });
});

describe("removerDemo", () => {
  it("deixa zero linha ligada ao elenco, apaga as contas do Firebase do elenco e preserva o resto", async () => {
    const { db, prisma } = criarBanco();
    const fb = criarFirebase();
    semearSentinela(db);
    const antes = sentinela(db);
    await semearDemo({ prisma, auth: fb.auth, agora: AGORA });
    const ids = idsDoElenco(db);
    expect(ids).toHaveLength(6);
    const contagens = await removerDemo({ prisma, auth: fb.auth });
    expect(contagens.usuarios).toBe(6);
    expect(idsDoElenco(db)).toEqual([]);
    const ligadas = TABELAS.flatMap((t) =>
      db[t].filter((l) => Object.entries(l).some(([k, v]) => k !== "id" && k.endsWith("_id") && ids.includes(v as number))),
    );
    expect(ligadas).toEqual([]);
    expect(sentinela(db)).toBe(antes);
    // D4: uma chamada deleteUser por conta do elenco, nenhuma por conta de fora; a sessão demo deixa de renovar.
    expect(fb.chamadas.filter((c) => c.metodo === "deleteUser").map((c) => c.args[0])).toEqual([...UIDS_ELENCO]);
    expect(fb.contas.size).toBe(0);
  });

  it("sem nada semeado, não falha (Firebase 'não encontrado' é ignorado) e não apaga nada", async () => {
    const { db, prisma } = criarBanco();
    const fb = criarFirebase();
    semearSentinela(db);
    const antes = sentinela(db);
    expect(await removerDemo({ prisma, auth: fb.auth })).toMatchObject({ usuarios: 0 });
    expect(sentinela(db)).toBe(antes);
    expect(fb.chamadas.filter((c) => c.metodo === "deleteUser")).toHaveLength(6);
  });

  it("erro do Firebase diferente de 'não encontrado' sobe", async () => {
    const { prisma } = criarBanco();
    const fb = criarFirebase();
    fb.falhas.deleteUser = Object.assign(new Error("interno"), { code: "auth/internal-error" });
    await expect(removerDemo({ prisma, auth: fb.auth })).rejects.toThrow("interno");
  });
});

// D2 a D4 (fechamento): a semente não pode falhar pela metade na frente da banca. Preflight sem efeito colateral,
// Firebase antes do banco e uma transação que volta inteira se algo falhar.
describe("semearDemo: robustez", () => {
  const RESERVADO = "idosa-helena@demo.elderweb.test";
  const escritasDoBanco = (ordem: string[]) => ordem.filter((o) => o.startsWith("db:") && !o.endsWith(".findMany") && !o.endsWith(".count"));
  let logs: jest.SpyInstance[];
  beforeEach(() => {
    logs = (["log", "info", "warn", "error", "debug"] as const).map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
  });
  afterEach(() => jest.restoreAllMocks());

  it("(b antes de c) todo o Firebase acontece antes da transação do banco", async () => {
    const ordem: string[] = [];
    const { prisma } = criarBanco(ordem);
    const fb = criarFirebase(ordem);
    await semearDemo({ prisma, auth: fb.auth, agora: AGORA });
    const ultimoFb = ordem.map((o) => o.startsWith("fb:")).lastIndexOf(true);
    expect(ultimoFb).toBeGreaterThan(-1);
    expect(ordem.indexOf("db:$transaction")).toBeGreaterThan(ultimoFb);
    expect(escritasDoBanco(ordem.slice(0, ordem.indexOf("db:$transaction")))).toEqual([]);
  });

  it("(i) falha do Firebase deixa o banco intacto: nenhuma escrita, nenhuma transação", async () => {
    for (const metodo of ["createUser", "updateUser", "getUser", "getUserByEmail"]) {
      const ordem: string[] = [];
      const { db, prisma } = criarBanco(ordem);
      const fb = criarFirebase(ordem);
      semearSentinela(db);
      await semearDemo({ prisma, auth: fb.auth, agora: AGORA }); // demo já no ar
      const antes = JSON.stringify(db);
      ordem.length = 0;
      if (metodo === "createUser") fb.contas.clear(); // contas sumiram do Firebase: a semente precisa recriá-las
      fb.falhas[metodo] = Object.assign(new Error("falha"), { code: "app/network-error" });
      await expect(semearDemo({ prisma, auth: fb.auth, agora: AGORA })).rejects.toThrow("falha");
      expect(ordem).not.toContain("db:$transaction");
      expect(escritasDoBanco(ordem)).toEqual([]);
      expect(JSON.stringify(db)).toBe(antes);
    }
  });

  it("(ii) conta invasora no Firebase com e-mail reservado é apagada e a semente segue", async () => {
    const { db, prisma } = criarBanco();
    const fb = criarFirebase();
    fb.contas.set("invasor-1", { uid: "invasor-1", email: RESERVADO });
    await semearDemo({ prisma, auth: fb.auth, agora: AGORA });
    expect(fb.chamadas.filter((c) => c.metodo === "deleteUser").map((c) => c.args[0])).toEqual(["invasor-1"]);
    expect(fb.contas.has("invasor-1")).toBe(false);
    expect(fb.contas.get("demo-idosa-helena")?.email).toBe(RESERVADO);
    expect(db.usuario).toHaveLength(6);
  });

  it("(ii) conta com e-mail que não é reservado nunca é apagada, nem a do próprio elenco", async () => {
    const { prisma } = criarBanco();
    const fb = criarFirebase();
    // getUserByEmail devolvendo conta de e-mail real (nunca acontece no Firebase de verdade): a defesa não pode apagá-la.
    fb.auth.getUserByEmail = async (email) => {
      fb.chamadas.push({ metodo: "getUserByEmail", args: [email] });
      return { uid: "pessoa-real", email: "pessoa@exemplo.test" } as never;
    };
    fb.contas.set("pessoa-real", { uid: "pessoa-real", email: "pessoa@exemplo.test" });
    await semearDemo({ prisma, auth: fb.auth, agora: AGORA }).catch(() => undefined);
    expect(fb.chamadas.filter((c) => c.metodo === "deleteUser")).toEqual([]);
    expect(fb.contas.has("pessoa-real")).toBe(true);
  });

  it("(iii) Usuario invasor com e-mail reservado aborta antes de qualquer exclusão, com mensagem fixa e sem vazar nada", async () => {
    for (const firebase_uid of ["uid-de-estranho", null]) {
      const ordem: string[] = [];
      const { db, prisma } = criarBanco(ordem);
      const fb = criarFirebase(ordem);
      semearSentinela(db);
      db.usuario.push({ id: 7777, firebase_uid, nome: "Nome Do Estranho", email: RESERVADO, tipo_perfil: "idoso", cadastrado_por_id: firebase_uid === null ? 9001 : null });
      const antes = JSON.stringify(db);
      const erro = await semearDemo({ prisma, auth: fb.auth, agora: AGORA }).catch((e: Error) => e);
      expect(erro).toBeInstanceOf(Error);
      expect((erro as Error).message).toBe(MSG_INVASOR);
      expect(JSON.stringify({ n: (erro as Error).name, m: (erro as Error).message, s: (erro as Error).stack?.split("\n")[0] })).not.toMatch(/Estranho|estranho@|7777|idosa-helena@/);
      expect(escritasDoBanco(ordem)).toEqual([]);
      expect(ordem).not.toContain("db:$transaction");
      expect(fb.chamadas).toEqual([]); // nada foi tocado no Firebase
      expect(JSON.stringify(db)).toBe(antes);
      expect(JSON.stringify(logs.flatMap((s) => s.mock.calls))).toBe("[]");
    }
  });

  it("(iii) o Usuario do próprio elenco com o e-mail reservado não é invasor", async () => {
    const { prisma } = criarBanco();
    const fb = criarFirebase();
    await semearDemo({ prisma, auth: fb.auth, agora: AGORA });
    await expect(semearDemo({ prisma, auth: fb.auth, agora: AGORA })).resolves.toBeDefined();
  });

  it("(v) falha na última inserção volta a transação inteira: o demo no ar fica como estava", async () => {
    const { db, prisma } = criarBanco();
    const fb = criarFirebase();
    semearSentinela(db);
    await semearDemo({ prisma, auth: fb.auth, agora: AGORA });
    const antes = JSON.stringify(db);
    const original = (prisma as unknown as { registroAlimentar: { createMany: (a: unknown) => Promise<unknown> } }).registroAlimentar.createMany;
    (prisma as unknown as { registroAlimentar: { createMany: unknown } }).registroAlimentar.createMany = async () => {
      throw new Error("falha forçada");
    };
    await expect(semearDemo({ prisma, auth: fb.auth, agora: AGORA })).rejects.toThrow("falha forçada");
    expect(JSON.stringify(db)).toBe(antes);
    (prisma as unknown as { registroAlimentar: { createMany: unknown } }).registroAlimentar.createMany = original;
  });
});
