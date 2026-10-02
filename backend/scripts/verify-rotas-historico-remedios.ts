// Verificação ponta a ponta do item 5.3 (RF-013, RNF-003): rota REAL (app de ./app via Supertest), Prisma
// REAL e SQL Server LOCAL. Os testes de Jest mockam o Prisma; este script exercita o caminho inteiro junto.
//
// Firebase: só a validação do ID Token é trocada. auth.verifyIdToken passa a devolver { uid: <token> },
// então o "token" enviado é o firebase_uid da conta de teste. Nenhum código de produção é alterado e
// nenhuma chamada de rede ao Firebase acontece.
//
// Limpeza: as rotas usam o prisma global, então não dá para rodar numa transação revertida (mesma exceção
// deliberada de verify-rotas-dose.ts). Toda linha criada carrega uma sentinela única da execução (tag no
// firebase_uid das contas e no nome dos medicamentos). O finally apaga SÓ as linhas com essa sentinela
// (doses, vínculos, medicamentos, contas, nessa ordem). Se o COUNT(*) das duas tabelas depois da limpeza
// diferir do inicial, o script falha alto e lista o que sobrou. As sentinelas nunca podem aparecer em
// stdout/stderr.
//
// Uso (dentro de backend/, contra o SQL Server LOCAL do docker-compose.yml, porta 14330):
//   DATABASE_URL="sqlserver://localhost:14330;database=elder_web;user=sa;password=${MSSQL_SA_PASSWORD};trustServerCertificate=true" \
//     npx tsx scripts/verify-rotas-historico-remedios.ts
// Recusa rodar se o host de DATABASE_URL não for localhost/127.0.0.1 (nunca contra o Azure).

import { randomUUID } from "node:crypto";

function exigirBancoLocal() {
  const host = /^sqlserver:\/\/([^:;]+)/i.exec(process.env.DATABASE_URL ?? "")?.[1] ?? "";
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(`DATABASE_URL aponta para "${host || "(vazio)"}", não para o banco local. Abortado.`);
  }
}

type Resultado = { name: string; pass: boolean; detail: string };
const results: Resultado[] = [];
const ok = (name: string, pass: boolean, detail: string) => results.push({ name, pass, detail });

type MedResp = {
  id: number;
  nome: string;
  ativo: boolean;
  data_inicio: string;
  data_fim: string | null;
  doses: { id: number; status_administracao: string; data_hora_administracao: string }[];
};

async function main() {
  exigirBancoLocal();
  // Imports depois da trava: carregar ./app já cria o PrismaClient e o app do Firebase Admin.
  const { default: request } = await import("supertest");
  // app primeiro: ele carrega o dotenv, de que firebaseAdmin depende ao inicializar.
  const { default: app } = await import("../src/app");
  const { auth } = await import("../src/lib/firebaseAdmin");
  const { prisma } = await import("../src/lib/prisma");

  (auth as unknown as { verifyIdToken: (t: string) => Promise<unknown> }).verifyIdToken = async (t) => ({
    uid: t,
    email_verified: true,
  });

  const tag = randomUUID().slice(0, 8);
  const SENT_A = `SENT_VERIFY_A_${tag}`;
  const SENT_B = `SENT_VERIFY_B_${tag}`;

  async function conta(perfil: "idoso" | "cuidador" | "familiar") {
    const uid = `verify-hist-${tag}-${perfil}-${randomUUID().slice(0, 6)}`;
    const u = await prisma.usuario.create({
      data: { firebase_uid: uid, nome: "Conta de Teste", email: `${uid}@teste.local`, tipo_perfil: perfil, modo_decisao: null },
      select: { id: true },
    });
    return { id: u.id, token: uid };
  }

  async function vincular(idosoId: number, vinculadoId: number, tipo: "cuidador" | "familiar", status: "aprovado" | "pendente" | "recusado") {
    await prisma.vinculo.create({
      data: {
        idoso_id: idosoId,
        vinculado_id: vinculadoId,
        tipo_vinculo: tipo,
        origem: tipo === "cuidador" ? "solicitacao_cuidador" : "solicitacao_familiar",
        status,
        aprovador_id: status === "pendente" ? null : idosoId,
        data_solicitacao: new Date(),
        permite_marcar_dose: false,
        permite_registrar_saude: false,
        permite_criar_evento_cuidado: false,
      },
    });
  }

  async function med(idosoId: number, nome: string, inicio: string, fim: string | null, ativo: boolean) {
    const m = await prisma.medicamento.create({
      data: {
        idoso_id: idosoId,
        criado_por_id: idosoId,
        editado_por_id: null,
        nome,
        dosagem: "10 mg",
        frequencia: "2x ao dia",
        data_inicio: new Date(`${inicio}T00:00:00.000Z`),
        data_fim: fim === null ? null : new Date(`${fim}T00:00:00.000Z`),
        observacoes: nome,
        ativo,
      },
      select: { id: true },
    });
    return m.id;
  }

  const dose = (medicamentoId: number, registradoPor: number, quando: string, status: string, obs: string | null) =>
    prisma.registroDoseMedicamento.create({
      data: { medicamento_id: medicamentoId, registrado_por_id: registradoPor, data_hora_administracao: new Date(quando), status_administracao: status, observacoes: obs },
    });

  const contagens = async () => ({ med: await prisma.medicamento.count(), dose: await prisma.registroDoseMedicamento.count() });
  const get = (token: string, caminho: string) => request(app).get(caminho).set("Authorization", `Bearer ${token}`);

  const antes = await contagens();
  const observacoesId: string[] = [];
  try {
    const idoso = await conta("idoso");
    const idosoB = await conta("idoso");
    const cuidador = await conta("cuidador"); // aprovado, as 3 flags false
    const cuidadorRec = await conta("cuidador"); // recusado
    const familiar = await conta("familiar"); // aprovado, modo_decisao NULL (efetivo 'idoso')
    const familiarPend = await conta("familiar"); // pendente
    await vincular(idoso.id, cuidador.id, "cuidador", "aprovado");
    await vincular(idoso.id, cuidadorRec.id, "cuidador", "recusado");
    await vincular(idoso.id, familiar.id, "familiar", "aprovado");
    await vincular(idoso.id, familiarPend.id, "familiar", "pendente");

    // Idoso A: m1 ativo com 2 doses, m2 inativo e já encerrado, m3 ativo sem doses e futuro.
    const m1 = await med(idoso.id, `${SENT_A}_M1`, "2026-03-01", null, true);
    const m2 = await med(idoso.id, `${SENT_A}_M2`, "2026-08-15", "2026-09-01", false);
    const m3 = await med(idoso.id, `${SENT_A}_M3`, "2026-12-01", null, true);
    await dose(m1, idoso.id, "2026-09-10T08:00:00.000Z", "pulado", `${SENT_A}_DOSE`);
    await dose(m1, idoso.id, "2026-09-14T12:30:00.000Z", "administrado", null);
    // Idoso B: nada disto pode chegar ao A nem a quem só tem vínculo com o A.
    const mB = await med(idosoB.id, `${SENT_B}_M`, "2026-09-01", null, true);
    await dose(mB, idosoB.id, "2026-09-21T09:00:00.000Z", "administrado", `${SENT_B}_DOSE`);

    const seeded = await contagens();

    // Tudo que as rotas escreverem em stdout/stderr durante as leituras é capturado e procurado por sentinela.
    let saida = "";
    const outOriginal = process.stdout.write.bind(process.stdout);
    const errOriginal = process.stderr.write.bind(process.stderr);
    const capturar = (chunk: unknown) => {
      saida += String(chunk);
      return true;
    };
    process.stdout.write = capturar as typeof process.stdout.write;
    process.stderr.write = capturar as typeof process.stderr.write;
    let controleCapturado = false;
    let doIdoso, doFamiliar, doCuidador, p1, p2, cruzado, doIdosoB;
    try {
      process.stdout.write(`CONTROLE_${tag}`);
      controleCapturado = saida.includes(`CONTROLE_${tag}`);
      doIdoso = await get(idoso.token, "/remedios");
      doFamiliar = await get(familiar.token, `/remedios/idoso/${idoso.id}`);
      doCuidador = await get(cuidador.token, `/remedios/idoso/${idoso.id}`);
      p1 = await get(familiarPend.token, `/remedios/idoso/${idoso.id}`);
      p2 = await get(cuidadorRec.token, `/remedios/idoso/${idoso.id}`);
      cruzado = await get(familiar.token, `/remedios/idoso/${idosoB.id}`);
      doIdosoB = await get(idosoB.token, "/remedios");
    } finally {
      process.stdout.write = outOriginal;
      process.stderr.write = errOriginal;
    }

    const lista = doIdoso.body.medicamentos as MedResp[];
    const porId = (id: number) => lista.find((m) => m.id === id);

    ok("captura de stdout funciona (controle positivo)", controleCapturado, controleCapturado ? "capturou" : "não capturou");
    ok("idoso lê o próprio: 200 com 3 medicamentos (ativo, inativo, sem doses)", doIdoso.status === 200 && lista.length === 3, `status ${doIdoso.status}, ${lista.length} item(ns)`);
    ok("ordem dos medicamentos: data_inicio desc", JSON.stringify(lista.map((m) => m.id)) === JSON.stringify([m3, m2, m1]), `ids ${lista.map((m) => m.id).join(",")}`);
    ok("inativo e fora da janela entram, com ativo na resposta", porId(m2)?.ativo === false && porId(m1)?.ativo === true && porId(m3)?.ativo === true, `m2.ativo=${porId(m2)?.ativo}`);
    ok("medicamento sem doses tem doses []", JSON.stringify(porId(m3)?.doses) === "[]", `${porId(m3)?.doses.length} dose(s)`);
    const d = porId(m1)?.doses ?? [];
    ok("duas doses em ordem data_hora desc, status como gravado", d.length === 2 && d[0].status_administracao === "administrado" && d[1].status_administracao === "pulado" && d[0].data_hora_administracao === "2026-09-14T12:30:00.000Z", `${d.map((x) => x.status_administracao).join(",")}`);
    ok("datas sem deslocamento: 2026-03-01, 2026-09-01 e fim null", porId(m1)?.data_inicio === "2026-03-01" && porId(m1)?.data_fim === null && porId(m2)?.data_inicio === "2026-08-15" && porId(m2)?.data_fim === "2026-09-01", `${porId(m1)?.data_inicio} / ${porId(m2)?.data_fim}`);
    ok("familiar aprovado (modo_decisao NULL) recebe corpo idêntico ao do idoso", doFamiliar.status === 200 && JSON.stringify(doFamiliar.body) === JSON.stringify(doIdoso.body), `status ${doFamiliar.status}`);
    ok("cuidador aprovado sem nenhuma flag lê: corpo idêntico", doCuidador.status === 200 && JSON.stringify(doCuidador.body) === JSON.stringify(doIdoso.body), `status ${doCuidador.status}`);
    ok("vínculo pendente = 403", p1.status === 403, `status ${p1.status}`);
    ok("vínculo recusado = 403", p2.status === 403, `status ${p2.status}`);
    ok("familiar só do A pedindo o idoso B = 403 sem dado do B", cruzado.status === 403 && !JSON.stringify(cruzado.body).includes(SENT_B), `status ${cruzado.status}`);
    ok("idoso A não enxerga nada do B", !JSON.stringify([doIdoso.body, doFamiliar.body, doCuidador.body]).includes(SENT_B), "sem sentinela do B");
    ok("idoso B enxerga só o dele", doIdosoB.status === 200 && (doIdosoB.body.medicamentos as MedResp[]).length === 1 && !JSON.stringify(doIdosoB.body).includes(SENT_A), `status ${doIdosoB.status}`);
    ok("sentinelas nunca aparecem em stdout nem stderr", !saida.replace(`CONTROLE_${tag}`, "").includes("SENT_VERIFY_"), `${saida.length - `CONTROLE_${tag}`.length} byte(s) escritos além do controle`);
    const apos = await contagens();
    ok("leitura não escreve: COUNT(*) de Medicamento e Dose iguais antes e depois das leituras", apos.med === seeded.med && apos.dose === seeded.dose, `med ${seeded.med}->${apos.med}, dose ${seeded.dose}->${apos.dose}`);

    // Observações (não contam como PASS/FAIL e não derrubam o script): idosoId acima de INT32_MAX passa pelo
    // middleware (Number() o aceita) e chega ao Prisma. Registra o status REAL observado.
    for (const id of ["2147483648", "99999999999"]) {
      try {
        const r = await get(familiar.token, `/remedios/idoso/${id}`);
        observacoesId.push(`GET /remedios/idoso/${id} respondeu status ${r.status}`);
      } catch {
        observacoesId.push(`GET /remedios/idoso/${id} falhou antes de responder`);
      }
    }
  } finally {
    // Só linhas com a sentinela desta execução. Ordem de FK: doses, vínculos, medicamentos, contas.
    const doTeste = { startsWith: `verify-hist-${tag}` };
    const contasTeste = (await prisma.usuario.findMany({ where: { firebase_uid: doTeste }, select: { id: true } })).map((u) => u.id);
    const medsTeste = { OR: [{ nome: { startsWith: SENT_A } }, { nome: { startsWith: SENT_B } }, { idoso_id: { in: contasTeste } }] };
    const idsMedsTeste = (await prisma.medicamento.findMany({ where: medsTeste, select: { id: true } })).map((m) => m.id);
    await prisma.registroDoseMedicamento.deleteMany({ where: { OR: [{ medicamento_id: { in: idsMedsTeste } }, { registrado_por_id: { in: contasTeste } }] } });
    await prisma.vinculo.deleteMany({ where: { OR: [{ idoso_id: { in: contasTeste } }, { vinculado_id: { in: contasTeste } }] } });
    await prisma.medicamento.deleteMany({ where: { id: { in: idsMedsTeste } } });
    await prisma.usuario.deleteMany({ where: { id: { in: contasTeste } } });
    const depois = await contagens();
    ok("COUNT(*) depois da limpeza = antes (as duas tabelas)", depois.med === antes.med && depois.dose === antes.dose, `med ${antes.med}->${depois.med}, dose ${antes.dose}->${depois.dose}`);
    const sobras = await prisma.usuario.count({ where: { firebase_uid: doTeste } });
    ok("nenhuma conta de teste sobrou", sobras === 0, `${sobras} sobra(s)`);
    if (depois.med !== antes.med || depois.dose !== antes.dose || sobras !== 0) {
      // Falha alta: lista o que sobrou (só ids e tabela, nunca valores).
      const meds = await prisma.medicamento.findMany({ where: { OR: [{ nome: { startsWith: SENT_A } }, { nome: { startsWith: SENT_B } }] }, select: { id: true } });
      const contas = await prisma.usuario.findMany({ where: { firebase_uid: doTeste }, select: { id: true } });
      console.error(`FALHA: a limpeza deixou resíduo. Medicamento sentinela: [${meds.map((m) => m.id).join(",")}]; contas sentinela: [${contas.map((c) => c.id).join(",")}]; Medicamento ${antes.med}->${depois.med}, Dose ${antes.dose}->${depois.dose}.`);
      process.exitCode = 1;
    }
    await prisma.$disconnect();
  }

  console.log("\nCenário".padEnd(86) + "Resultado");
  console.log("-".repeat(110));
  for (const r of results) console.log(r.name.padEnd(86) + (r.pass ? "PASS" : "FAIL") + "  " + r.detail);
  for (const o of observacoesId) console.log(`\nObservação (não é caso, sem PASS/FAIL): ${o}`);
  const falhas = results.filter((r) => !r.pass);
  console.log(`\n${results.length - falhas.length}/${results.length} PASS`);
  if (falhas.length > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("Erro fatal no script de verificação:", (e as Error).message.replace(/\s+/g, " ").slice(0, 300));
  process.exitCode = 1;
});
