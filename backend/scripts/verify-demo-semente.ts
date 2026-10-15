// Verificação ponta a ponta do modo demonstração (D5): semearDemo e removerDemo com Prisma REAL contra o SQL Server
// LOCAL, Firebase FALSO (nenhuma conta é criada no Firebase) e as rotas REAIS de leitura (app de ./app via Supertest).
// Confere contagens contra montarDadosDemo, que as CHECK aceitaram tudo, as leituras de cada conta (e os 403 onde a
// regra manda), o PDF do histórico de Helena, a idempotência, a barreira contra usuário real e a remoção.
//
// Firebase: auth.verifyIdToken passa a devolver { uid: <token> }, então o "token" é o próprio firebase_uid.
// Limpeza: as rotas usam o prisma global (sem transação revertida, mesma exceção dos verify-rotas-*). As contas de
// fora do elenco criadas aqui levam o prefixo verify-demo-<tag> no firebase_uid e são apagadas no finally. Se o elenco
// já existia no banco local antes, o finally semeia de novo (o banco local volta a ter a demonstração).
//
// Uso (dentro de backend/, contra o SQL Server LOCAL do docker-compose.yml, porta 14330):
//   DATABASE_URL="sqlserver://localhost:14330;database=elder_web;user=sa;password=${MSSQL_SA_PASSWORD};trustServerCertificate=true" \
//     npx tsx scripts/verify-demo-semente.ts
// Recusa rodar se o host de DATABASE_URL não for localhost/127.0.0.1 (nunca contra o Azure).

import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

function exigirBancoLocal() {
  const host = /^sqlserver:\/\/([^:;]+)/i.exec(process.env.DATABASE_URL ?? "")?.[1] ?? "";
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error("DATABASE_URL não aponta para o banco local. Abortado.");
  }
}

type Resultado = { name: string; pass: boolean; detail: string };
const results: Resultado[] = [];
const ok = (name: string, pass: boolean, detail: string) => results.push({ name, pass, detail });

async function main() {
  exigirBancoLocal();
  const { default: request } = await import("supertest");
  const { default: app } = await import("../src/app");
  const { auth } = await import("../src/lib/firebaseAdmin");
  const { prisma } = await import("../src/lib/prisma");
  const { semearDemo, removerDemo, MSG_INVASOR } = await import("../src/lib/demo/semear");
  const { montarDadosDemo } = await import("../src/lib/demo/dados");
  const { UIDS_ELENCO } = await import("../src/lib/demo/elenco");

  (auth as unknown as { verifyIdToken: (t: string) => Promise<unknown> }).verifyIdToken = async (t) => ({ uid: t, email_verified: true });
  const db = prisma as unknown as PrismaClient;

  // Firebase falso para a semente: só um mapa em memória.
  const contas = new Map<string, Record<string, unknown>>();
  const authFalso = {
    getUser: async (uid: string) => {
      if (!contas.has(uid)) throw Object.assign(new Error("x"), { code: "auth/user-not-found" });
      return contas.get(uid);
    },
    getUserByEmail: async (email: string) => {
      const c = [...contas.values()].find((x) => x.email === email);
      if (!c) throw Object.assign(new Error("x"), { code: "auth/user-not-found" });
      return c;
    },
    createUser: async (p: Record<string, unknown>) => (contas.set(p.uid as string, p), p),
    updateUser: async (uid: string, p: Record<string, unknown>) => (contas.set(uid, { ...contas.get(uid), ...p }), p),
    deleteUser: async (uid: string) => {
      if (!contas.delete(uid)) throw Object.assign(new Error("x"), { code: "auth/user-not-found" });
    },
  } as unknown as Parameters<typeof semearDemo>[0]["auth"];

  const tag = randomUUID().slice(0, 8);
  const prefixo = `verify-demo-${tag}`;
  const elencoNoBanco = async () => db.usuario.findMany({ where: { firebase_uid: { in: [...UIDS_ELENCO] } }, select: { id: true, firebase_uid: true } });
  const existiaAntes = (await elencoNoBanco()).length > 0;

  // Linhas de domínio ligadas a um conjunto de ids (para contar e para comparar duas semeaduras sem id).
  async function dominio(ids: number[]) {
    const em = { in: ids };
    const meds = await db.medicamento.findMany({ where: { idoso_id: em }, orderBy: { id: "asc" }, include: { doses: { orderBy: { id: "asc" } } } });
    return {
      vinculos: await db.vinculo.findMany({ where: { OR: [{ idoso_id: em }, { vinculado_id: em }] }, orderBy: { id: "asc" } }),
      saude: await db.registroSaude.findMany({ where: { idoso_id: em }, orderBy: { id: "asc" } }),
      medicamentos: meds,
      doses: meds.flatMap((m) => m.doses),
      eventos: await db.evento.findMany({ where: { idoso_id: em }, orderBy: { id: "asc" } }),
      refeicoes: await db.registroAlimentar.findMany({ where: { idoso_id: em }, orderBy: { id: "asc" } }),
    };
  }
  const semIds = (v: unknown) =>
    JSON.stringify(v, (k, x) => (k === "id" || k === "medicamento_id" || k === "created_at" || k === "updated_at" ? undefined : x));

  let realIdoso = 0;
  let realCuidador = 0;
  try {
    // Usuário de fora do elenco com dado de saúde: a semente e a remoção não podem tocar nele.
    realIdoso = (await db.usuario.create({ data: { firebase_uid: `${prefixo}-idoso`, nome: "Sentinela Idoso", email: `${prefixo}-idoso@teste.local`, tipo_perfil: "idoso", modo_decisao: "idoso" }, select: { id: true } })).id;
    realCuidador = (await db.usuario.create({ data: { firebase_uid: `${prefixo}-cuidador`, nome: "Sentinela Cuidador", email: `${prefixo}-cuidador@teste.local`, tipo_perfil: "cuidador" }, select: { id: true } })).id;
    await db.registroSaude.create({ data: { idoso_id: realIdoso, registrado_por_id: realIdoso, editado_por_id: realIdoso, tipo_medicao: "Peso", valor_1: 70, unidade: "kg", data_hora: new Date() } });
    await db.vinculo.create({ data: { idoso_id: realIdoso, vinculado_id: realCuidador, tipo_vinculo: "cuidador", origem: "solicitacao_cuidador", status: "aprovado", aprovador_id: realIdoso, data_solicitacao: new Date() } });
    const sentinelaAntes = semIds(await dominio([realIdoso, realCuidador]));

    const agora = new Date();
    const esperado = montarDadosDemo(agora);
    const c1 = await semearDemo({ prisma: db, auth: authFalso, agora });
    ok("semearDemo concluiu (todas as CHECK e FKs aceitaram as linhas)", true, JSON.stringify(c1));

    const elenco = await elencoNoBanco();
    const id = Object.fromEntries(elenco.map((u) => [String(u.firebase_uid).replace(/^demo-/, ""), u.id]));
    const ids = elenco.map((u) => u.id);
    const d1 = await dominio(ids);
    const totalDoses = esperado.medicamentos.reduce((n, m) => n + m.doses.length, 0);
    ok(
      "contagens por tabela iguais a montarDadosDemo",
      elenco.length === 6 && d1.vinculos.length === esperado.vinculos.length && d1.saude.length === esperado.saude.length &&
        d1.medicamentos.length === esperado.medicamentos.length && d1.doses.length === totalDoses &&
        d1.eventos.length === esperado.eventos.length && d1.refeicoes.length === esperado.refeicoes.length,
      `usuarios ${elenco.length}, vinculos ${d1.vinculos.length}, saude ${d1.saude.length}, meds ${d1.medicamentos.length}, doses ${d1.doses.length}, eventos ${d1.eventos.length}, refeicoes ${d1.refeicoes.length}`,
    );
    const por = (linhas: { idoso_id: number }[], slug: string) => linhas.filter((l) => l.idoso_id === id[slug]).length;
    const hel = { saude: por(d1.saude, "idosa-helena"), meds: por(d1.medicamentos, "idosa-helena"), eventos: por(d1.eventos, "idosa-helena"), refeicoes: por(d1.refeicoes, "idosa-helena") };
    const ant = { saude: por(d1.saude, "idoso-antonio"), meds: por(d1.medicamentos, "idoso-antonio"), eventos: por(d1.eventos, "idoso-antonio"), refeicoes: por(d1.refeicoes, "idoso-antonio") };
    ok("mínimos da D4 (Helena)", hel.saude >= 30 && hel.meds === 5 && hel.eventos >= 13 && hel.refeicoes >= 16, JSON.stringify(hel));
    ok("mínimos da D4 (Antônio)", ant.saude >= 10 && ant.meds === 3 && ant.eventos === 7 && ant.refeicoes >= 6, JSON.stringify(ant));

    const get = (uid: string, caminho: string) => request(app).get(caminho).set("Authorization", `Bearer ${uid}`);
    const helena = "demo-idosa-helena";
    const quantos = (b: unknown, chave: string) => ((b as Record<string, unknown[]>)?.[chave] ?? (Array.isArray(b) ? b : [])).length;
    const leituras = [
      ["Helena: /saude", await get(helena, "/saude"), hel.saude],
      ["Helena: /remedios", await get(helena, "/remedios"), hel.meds],
      ["Helena: /agenda", await get(helena, "/agenda"), hel.eventos],
      ["Helena: /alimentacao", await get(helena, "/alimentacao"), hel.refeicoes],
      ["Marta: saúde de Helena", await get("demo-cuidadora-marta", `/saude/idoso/${id["idosa-helena"]}`), hel.saude],
      ["Marta: remédios de Antônio", await get("demo-cuidadora-marta", `/remedios/idoso/${id["idoso-antonio"]}`), ant.meds],
      ["Carlos: agenda de Helena", await get("demo-familiar-carlos", `/agenda/idoso/${id["idosa-helena"]}`), hel.eventos],
      ["Renata: alimentação de Antônio", await get("demo-familiar-renata", `/alimentacao/idoso/${id["idoso-antonio"]}`), ant.refeicoes],
    ] as const;
    for (const [nome, res, n] of leituras) {
      const corpo = res.body as unknown;
      const tamanho = Array.isArray(corpo) ? corpo.length : Math.max(...["registros", "medicamentos", "eventos", "vinculos"].map((k) => quantos(corpo, k)));
      ok(`leitura real: ${nome}`, res.status === 200 && tamanho === n, `status ${res.status}, ${tamanho} de ${n}`);
    }
    const vHelena = await get(helena, "/vinculo");
    const estados = ((vHelena.body as { vinculos?: { status: string }[] }).vinculos ?? []).map((v) => v.status).sort();
    ok("Helena vê 3 vínculos, um pendente (Paulo)", vHelena.status === 200 && JSON.stringify(estados) === JSON.stringify(["aprovado", "aprovado", "pendente"]), estados.join(","));
    const negados = [
      ["Paulo (pendente) lê saúde de Helena", await get("demo-cuidador-paulo", `/saude/idoso/${id["idosa-helena"]}`)],
      ["Carlos lê saúde de Antônio (sem vínculo)", await get("demo-familiar-carlos", `/saude/idoso/${id["idoso-antonio"]}`)],
      ["Carlos registra saúde de Helena (só leitura)", await request(app).post(`/saude/idoso/${id["idosa-helena"]}`).set("Authorization", "Bearer demo-familiar-carlos").send({ tipo_medicao: "Peso", valor_1: 68, unidade: "kg" })],
      ["Marta cria medicamento para Helena (cuidador nunca)", await request(app).post(`/remedios/idoso/${id["idosa-helena"]}`).set("Authorization", "Bearer demo-cuidadora-marta").send({ nome: "X", dosagem: "1", frequencia: "1", data_inicio: "2026-01-01" })],
      ["Marta cria evento de cuidado para Antônio (sem a flag)", await request(app).post(`/agenda/idoso/${id["idoso-antonio"]}`).set("Authorization", "Bearer demo-cuidadora-marta").send({ tipo_evento: "cuidado", titulo: "X", data_hora_inicio: new Date(Date.now() + 86_400_000).toISOString() })],
    ] as const;
    for (const [nome, res] of negados) ok(`403 onde a regra manda: ${nome}`, res.status === 403, `status ${res.status}`);

    // Barreira do modo demonstração: mesmo com vínculo aprovado gravado à força, conta do elenco não lê idoso real.
    await db.vinculo.create({ data: { idoso_id: realIdoso, vinculado_id: id["cuidadora-marta"], tipo_vinculo: "cuidador", origem: "solicitacao_cuidador", status: "aprovado", aprovador_id: realIdoso, data_solicitacao: new Date() } });
    const furo = await get("demo-cuidadora-marta", `/saude/idoso/${realIdoso}`);
    const pedido = await request(app).post("/vinculo/solicitar-cuidador").set("Authorization", "Bearer demo-cuidador-paulo").send({ email: `${prefixo}-idoso@teste.local` });
    ok("conta do elenco com vínculo aprovado forçado não lê idoso real (403)", furo.status === 403, `status ${furo.status}`);
    ok("conta do elenco não pede vínculo a idoso real (403)", pedido.status === 403, `status ${pedido.status}`);

    const pdf = await request(app).get("/historico/pdf").set("Authorization", `Bearer ${helena}`).buffer(true).parse((res, cb) => {
      const partes: Buffer[] = [];
      res.on("data", (c: Buffer) => partes.push(c));
      res.on("end", () => cb(null, Buffer.concat(partes)));
    });
    const buf = pdf.body as Buffer;
    ok("PDF do histórico de Helena gerado e não vazio", pdf.status === 200 && buf.subarray(0, 4).toString("latin1") === "%PDF" && buf.length > 2000, `status ${pdf.status}, ${buf.length} byte(s)`);

    // Idempotência: a segunda semeadura (mesmo agora) desfaz o vínculo forçado e reproduz exatamente as mesmas linhas.
    await semearDemo({ prisma: db, auth: authFalso, agora });
    const elenco2 = await elencoNoBanco();
    const d2 = await dominio(elenco2.map((u) => u.id));
    ok("idempotente: mesmos ids de usuário", JSON.stringify(elenco2) === JSON.stringify(elenco), `${elenco2.length} conta(s)`);
    ok("idempotente: mesmas linhas de domínio (sem ids)", semIds(d2) === semIds(d1), `${d2.saude.length} saúde, ${d2.doses.length} doses`);
    ok("idempotente: vínculo forçado com o idoso real foi apagado", (await db.vinculo.count({ where: { idoso_id: realIdoso, vinculado_id: id["cuidadora-marta"] } })) === 0, "0 vínculo");

    // Rollback real: erro na ÚLTIMA inserção (depois de apagar e recriar tudo) deixa o demo no ar exatamente como estava.
    const fotoDoDemo = async () => JSON.stringify([await elencoNoBanco(), await dominio(ids)]);
    const antesDoErro = await fotoDoDemo();
    const quebrado = new Proxy(db, {
      get: (alvo, nome) =>
        nome === "$transaction"
          ? (fn: (tx: unknown) => Promise<unknown>, o: unknown) =>
              (alvo.$transaction as (f: unknown, o: unknown) => Promise<unknown>)(
                (tx: Record<string, unknown>) =>
                  fn(
                    new Proxy(tx, {
                      get: (t, n) =>
                        n === "registroAlimentar"
                          ? new Proxy((t as Record<string | symbol, unknown>)[n] as object, { get: (m, k) => (k === "createMany" ? async () => { throw new Error("falha forçada"); } : (m as Record<string | symbol, unknown>)[k]) })
                          : (t as Record<string | symbol, unknown>)[n],
                    }),
                  ),
                o,
              )
          : (alvo as unknown as Record<string | symbol, unknown>)[nome],
    }) as unknown as PrismaClient;
    const falhou = await semearDemo({ prisma: quebrado, auth: authFalso, agora }).then(() => false, () => true);
    ok("rollback: erro na última inserção volta a transação inteira (mesmas linhas e ids)", falhou && (await fotoDoDemo()) === antesDoErro, falhou ? "estado igual ao de antes" : "não falhou");

    const r = await removerDemo({ prisma: db, auth: authFalso });
    const restam = await elencoNoBanco();
    const ligadas = await dominio(ids);
    const zero = Object.values(ligadas).every((l) => l.length === 0);
    ok("removerDemo: zero conta e zero linha do elenco", restam.length === 0 && zero, `${r.usuarios} conta(s) removida(s)`);
    ok("removerDemo: Firebase falso sem contas do elenco", contas.size === 0, `${contas.size} conta(s)`);
    ok("linhas de fora do elenco intactas", semIds(await dominio([realIdoso, realCuidador])) === sentinelaAntes, "sentinela igual");

    // Usuario estranho com e-mail reservado: a semente aborta ANTES de criar ou apagar qualquer coisa, com mensagem fixa.
    const invasor = await db.usuario.create({ data: { firebase_uid: `${prefixo}-invasor`, nome: "Sentinela Invasor", email: "idosa-helena@demo.elderweb.test", tipo_perfil: "idoso", modo_decisao: "idoso" }, select: { id: true } });
    const erroInvasor = await semearDemo({ prisma: db, auth: authFalso, agora }).then(() => null, (e: unknown) => e as Error);
    ok("Usuario estranho com e-mail reservado: aborta com a mensagem fixa, sem vazar nada", erroInvasor?.message === MSG_INVASOR && !JSON.stringify([erroInvasor?.name, erroInvasor?.message]).includes(String(invasor.id)), erroInvasor?.name ?? "não abortou");
    ok("o aborto não criou conta do elenco nem mexeu no Firebase falso", (await elencoNoBanco()).length === 0 && contas.size === 0, "0 conta no banco, 0 no Firebase falso");
    await db.usuario.delete({ where: { id: invasor.id } });
  } finally {
    const sentinelas = (await db.usuario.findMany({ where: { firebase_uid: { startsWith: prefixo } }, select: { id: true } })).map((u) => u.id);
    if (sentinelas.length > 0) {
      const em = { in: sentinelas };
      await db.registroSaude.deleteMany({ where: { OR: [{ idoso_id: em }, { registrado_por_id: em }] } });
      await db.vinculo.deleteMany({ where: { OR: [{ idoso_id: em }, { vinculado_id: em }, { aprovador_id: em }] } });
      await db.usuario.deleteMany({ where: { id: em } });
    }
    const sobras = await db.usuario.count({ where: { firebase_uid: { startsWith: prefixo } } });
    ok("nenhuma conta sentinela sobrou", sobras === 0, `${sobras} sobra(s)`);
    if (existiaAntes) await semearDemo({ prisma: db, auth: authFalso, agora: new Date() });
    await db.$disconnect();
  }

  console.log("\nCenário".padEnd(80) + "Resultado");
  console.log("-".repeat(110));
  for (const r of results) console.log(r.name.padEnd(80) + (r.pass ? "PASS" : "FAIL") + "  " + r.detail);
  const falhas = results.filter((r) => !r.pass);
  console.log(`\n${results.length - falhas.length}/${results.length} PASS`);
  if (falhas.length > 0) process.exitCode = 1;
}

main().catch((e: unknown) => {
  const info = (e ?? {}) as { name?: unknown; code?: unknown };
  console.error(`Falhou: ${typeof info.name === "string" ? info.name : "erro"}${typeof info.code === "string" ? ` ${info.code}` : ""}`);
  process.exitCode = 1;
});
